#!/usr/bin/env python3
"""
Build a question bank for Control Fidelity comparisons.

The script scans each <method>/<attribute> directory for mp4 files that have
both a HIGH and LOW variant (e.g., *_high_friction.mp4 & *_low_friction.mp4),
then emits randomized 2AFC questions referencing those pairs.
"""

from __future__ import annotations

import argparse
import json
import random
import re
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple

ATTRIBUTE_TITLES = {
    "friction": "Friction",
    "deformation": "Deformation",
    "restitution": "Bounce",
}

LEVELS = ("high", "low")
LEVEL_TOKEN_RE = re.compile(r"_(?P<level>high|low)(?P<suffix>[^_\.]*)", re.IGNORECASE)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Generate control_fidelity_questions.json by pairing high/low videos "
            "for each method and attribute."
        )
    )
    parser.add_argument(
        "--root",
        type=Path,
        default=Path("."),
        help="Root directory containing the method folders (default: current dir).",
    )
    parser.add_argument(
        "--methods",
        nargs="+",
        required=True,
        help="List of method folders to include (e.g. physpropprior baseline_text_conditioned).",
    )
    parser.add_argument(
        "--attributes",
        nargs="+",
        required=True,
        help="Attributes/subfolders to scan inside each method (e.g. friction deformation restitution).",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("data/control_fidelity_questions.json"),
        help="Destination JSON file (default: data/control_fidelity_questions.json).",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed for reproducible shuffling (default: 42).",
    )
    return parser.parse_args()


def find_level_token(filename: str) -> Optional[Tuple[str, slice]]:
    match = LEVEL_TOKEN_RE.search(filename)
    if not match:
        return None
    level = match.group("level").lower()
    start = match.start()
    end = match.end()
    return level, slice(start, end)


def canonical_key(filename: str) -> Optional[Tuple[str, str]]:
    result = find_level_token(filename)
    if not result:
        return None
    level, token_slice = result
    canonical = filename[: token_slice.start] + "_{lvl}" + filename[token_slice.stop :]
    return level, canonical


def readable_attribute(attribute: str) -> str:
    return ATTRIBUTE_TITLES.get(attribute, attribute.replace("_", " ").title())


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", value.lower())
    return slug.strip("_") or "clip"


def build_pairs(attr_dir: Path) -> Dict[str, Dict[str, Path]]:
    pairs: Dict[str, Dict[str, Path]] = {}
    for video_path in sorted(attr_dir.glob("*.mp4")):
        result = canonical_key(video_path.name)
        if not result:
            print(f"[skip] No high/low token in {video_path}", file=sys.stderr)
            continue
        level, key = result
        bucket = pairs.setdefault(key, {})
        bucket[level] = video_path
    return pairs


def make_question(
    method: str,
    attribute: str,
    scenario_key: str,
    high_path: Path,
    low_path: Path,
    root: Path,
) -> Dict[str, object]:
    target_level = random.choice(LEVELS)
    videos = [
        ("high", high_path),
        ("low", low_path),
    ]
    random.shuffle(videos)
    (video_a_level, video_a_path), (video_b_level, video_b_path) = videos

    attribute_label = readable_attribute(attribute)
    prompt = (
        f"Which video better matches the {target_level.upper()} {attribute_label} target?"
    )
    scenario_slug = slugify(Path(scenario_key).stem.replace("{lvl}", ""))
    question_id = f"cf_{method}_{attribute}_{scenario_slug}_{target_level}"

    def to_payload(path: Path, level: str) -> Dict[str, str]:
        rel_path = path.relative_to(root)
        return {"src": rel_path.as_posix(), "level": level}

    return {
        "id": question_id,
        "axis": "Control fidelity",
        "axisDetail": attribute_label,
        "prompt": prompt,
        "targetLevel": target_level,
        "meta": {
            "method": method,
            "attribute": attribute,
            "scenario": scenario_slug,
        },
        "videoA": to_payload(video_a_path, video_a_level),
        "videoB": to_payload(video_b_path, video_b_level),
    }


def main() -> None:
    args = parse_args()
    random.seed(args.seed)

    root = args.root.resolve()
    output_path = args.output
    output_path.parent.mkdir(parents=True, exist_ok=True)

    questions: List[Dict[str, object]] = []

    for method in args.methods:
        for attribute in args.attributes:
            attr_dir = root / method / attribute
            if not attr_dir.is_dir():
                print(f"[warn] Missing directory: {attr_dir}", file=sys.stderr)
                continue
            pairs = build_pairs(attr_dir)
            for scenario_key, pair in pairs.items():
                if "high" not in pair or "low" not in pair:
                    continue
                question = make_question(
                    method=method,
                    attribute=attribute,
                    scenario_key=scenario_key,
                    high_path=pair["high"],
                    low_path=pair["low"],
                    root=root,
                )
                questions.append(question)

    if not questions:
        print("No questions generated. Check your inputs.", file=sys.stderr)
        sys.exit(1)

    with output_path.open("w", encoding="utf-8") as f:
        json.dump(questions, f, indent=2)

    print(f"Wrote {len(questions)} questions to {output_path}")


if __name__ == "__main__":
    main()
