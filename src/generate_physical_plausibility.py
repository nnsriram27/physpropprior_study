#!/usr/bin/env python3
"""
Build four-video physical plausibility questions.

Each question compares PhysPropPrior with a baseline by showing both HIGH and
LOW variants for each method. Participants are asked which method better
demonstrates the attribute contrast.
"""

from __future__ import annotations

import argparse
import json
import random
import re
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple

ATTRIBUTE_LABELS = {
    "friction": "Friction",
    "deformation": "Deformation",
    "restitution": "Bounce",
}

LEVEL_PATTERN = re.compile(r"_(?P<level>high|low)(?P<suffix>[^/]*)", re.IGNORECASE)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Generate physical plausibility comparison questions where each option "
            "contains both HIGH and LOW videos."
        )
    )
    parser.add_argument(
        "--root",
        type=Path,
        default=Path("."),
        help="Root directory containing all method folders (default: cwd).",
    )
    parser.add_argument(
        "--attributes",
        nargs="+",
        default=["friction", "deformation", "restitution"],
        help="Attribute subfolders to include (default: friction deformation restitution).",
    )
    parser.add_argument(
        "--baselines",
        nargs="+",
        required=True,
        help="Baseline method folders to compare against.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("data/physical_plausibility_questions.json"),
        help="Destination JSON file (default: data/physical_plausibility_questions.json).",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=2024,
        help="Random seed for shuffling option order (default: 2024).",
    )
    return parser.parse_args()


def method_display(name: str) -> str:
    mapping = {
        "physpropprior": "PhysPropPrior",
        "baseline_text_conditioned": "Baseline (Text)",
        "cogvideox5B": "CogVideoX5B",
        "cosmos2B": "Cosmos2B",
        "force_prompting": "Force Prompting",
    }
    return mapping.get(name, name.replace("_", " ").title())


def attribute_label(attribute: str) -> str:
    return ATTRIBUTE_LABELS.get(attribute, attribute.replace("_", " ").title())


def detect_level(filename: str) -> Optional[Tuple[str, slice]]:
    match = LEVEL_PATTERN.search(filename)
    if not match:
        return None
    level = match.group("level").lower()
    return level, slice(match.start(), match.end())


def canonical_key(filename: str) -> Optional[str]:
    parsed = detect_level(filename)
    if not parsed:
        return None
    _, token_slice = parsed
    return filename[: token_slice.start] + "_{lvl}" + filename[token_slice.stop :]


def collect_pairs(directory: Path) -> Dict[str, Dict[str, Path]]:
    pairs: Dict[str, Dict[str, Path]] = {}
    for video_path in directory.glob("*.mp4"):
        result = detect_level(video_path.name)
        if not result:
            continue
        level, token_slice = result
        canonical = (
            video_path.name[: token_slice.start]
            + "_{lvl}"
            + video_path.name[token_slice.stop :]
        )
        slot = pairs.setdefault(canonical, {})
        slot[level] = video_path
    return {key: levels for key, levels in pairs.items() if {"high", "low"} <= levels.keys()}


def slugify(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", text.lower())
    return slug.strip("_") or "scenario"


def clip_payload(path: Path, level: str, attr_label: str, root: Path) -> Dict[str, str]:
    return {
        "src": path.relative_to(root).as_posix(),
        "level": level,
        "label": f"{level.upper()} {attr_label}",
    }


def make_option(method: str, pair: Dict[str, Path], attr_label: str, root: Path) -> Dict[str, object]:
    return {
        "method": method,
        "label": method_display(method),
        "clips": [
            clip_payload(pair["high"], "high", attr_label, root),
            clip_payload(pair["low"], "low", attr_label, root),
        ],
    }


def generate_questions(
    root: Path,
    attributes: List[str],
    baselines: List[str],
) -> List[Dict[str, object]]:
    questions: List[Dict[str, object]] = []
    phys_root = root / "physpropprior"

    for attribute in attributes:
        attr_label = attribute_label(attribute)
        phys_dir = phys_root / attribute
        if not phys_dir.is_dir():
            print(f"[warn] Missing PhysPropPrior directory: {phys_dir}", file=sys.stderr)
            continue

        phys_pairs = collect_pairs(phys_dir)
        if not phys_pairs:
            continue

        for baseline in baselines:
            baseline_dir = root / baseline / attribute
            if not baseline_dir.is_dir():
                print(f"[warn] Skipping baseline without {attribute}: {baseline_dir}", file=sys.stderr)
                continue
            baseline_pairs = collect_pairs(baseline_dir)

            shared_keys = set(phys_pairs.keys()) & set(baseline_pairs.keys())
            for key in sorted(shared_keys):
                phys_option = make_option("physpropprior", phys_pairs[key], attr_label, root)
                base_option = make_option(baseline, baseline_pairs[key], attr_label, root)
                options = [phys_option, base_option]
                random.shuffle(options)
                question_id = f"ppset_{attribute}_{slugify(key)}_{baseline}"
                questions.append(
                    {
                        "id": question_id,
                        "axis": "Physical realism",
                        "axisDetail": attr_label,
                        "prompt": f"Which method better distinguishes HIGH vs LOW {attr_label}?",
                        "meta": {
                            "attribute": attribute,
                            "scenarioKey": key,
                            "baseline": baseline,
                        },
                        "optionA": options[0],
                        "optionB": options[1],
                    }
                )

    return questions


def main() -> None:
    args = parse_args()
    random.seed(args.seed)
    root = args.root.resolve()

    questions = generate_questions(root, args.attributes, args.baselines)
    if not questions:
        print("No questions generated. Check data availability.", file=sys.stderr)
        sys.exit(1)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8") as fh:
        json.dump(questions, fh, indent=2)

    print(f"Wrote {len(questions)} questions to {args.output}")


if __name__ == "__main__":
    main()
