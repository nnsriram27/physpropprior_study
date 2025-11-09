#!/usr/bin/env python3
"""
Generate PhysPropPrior vs baseline physical-plausibility questions
for friction, deformation, and restitution attributes.

Each question compares a PhysPropPrior high/low clip against the matching
baseline clip (same filename) and asks which better matches the target level.
"""

from __future__ import annotations

import argparse
import json
import random
import re
import sys
from pathlib import Path
from typing import Dict, List, Optional

ATTRIBUTE_LABELS = {
    "friction": "Friction",
    "deformation": "Deformation",
    "restitution": "Bounce",
}

LEVEL_PATTERN = re.compile(r"_(?P<level>high|low)(?P<suffix>[^/]*)", re.IGNORECASE)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Create physical plausibility question bank (PhysPropPrior vs baselines)."
    )
    parser.add_argument(
        "--root",
        type=Path,
        default=Path("."),
        help="Root directory containing all method folders (default: current directory).",
    )
    parser.add_argument(
        "--baselines",
        nargs="+",
        required=True,
        help="Baseline method folders to compare against.",
    )
    parser.add_argument(
        "--attributes",
        nargs="+",
        default=["friction", "deformation", "restitution"],
        help="Attributes/subfolders to process (default: friction deformation restitution).",
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
        default=99,
        help="Random seed for reproducible shuffling (default: 99).",
    )
    return parser.parse_args()


def detect_level(filename: str) -> Optional[str]:
    match = LEVEL_PATTERN.search(filename)
    if not match:
        return None
    return match.group("level").lower()


def attribute_label(attribute: str) -> str:
    return ATTRIBUTE_LABELS.get(attribute, attribute.replace("_", " ").title())


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_") or "scenario"


def build_question(
    attribute: str,
    level: str,
    scenario: str,
    phys_path: Path,
    baseline_path: Path,
    baseline_name: str,
    root: Path,
) -> Dict[str, object]:
    label = attribute_label(attribute)
    prompt = f"Which video better matches the {level.upper()} {label} target?"
    options = [
        ("physpropprior", phys_path),
        (baseline_name, baseline_path),
    ]
    random.shuffle(options)

    def payload(method: str, clip: Path) -> Dict[str, str]:
        return {
            "src": clip.relative_to(root).as_posix(),
            "method": method,
        }

    (a_method, a_clip), (b_method, b_clip) = options
    return {
        "id": f"pp_{attribute}_{slugify(scenario)}_{level}_{baseline_name}",
        "axis": "Physical plausibility",
        "axisDetail": label,
        "prompt": prompt,
        "targetLevel": level,
        "meta": {
            "attribute": attribute,
            "scenario": scenario,
            "baseline": baseline_name,
        },
        "videoA": payload(a_method, a_clip),
        "videoB": payload(b_method, b_clip),
    }


def main() -> None:
    args = parse_args()
    random.seed(args.seed)
    root = args.root.resolve()

    phys_root = root / "physpropprior"
    if not phys_root.is_dir():
        print(f"Missing physpropprior directory at {phys_root}", file=sys.stderr)
        sys.exit(1)

    questions: List[Dict[str, object]] = []

    for attribute in args.attributes:
        phys_attr_dir = phys_root / attribute
        if not phys_attr_dir.is_dir():
            print(f"[warn] Skipping missing attribute folder {phys_attr_dir}", file=sys.stderr)
            continue

        phys_files = list(phys_attr_dir.glob("*.mp4"))
        if not phys_files:
            print(f"[warn] No videos in {phys_attr_dir}", file=sys.stderr)
            continue

        for phys_clip in phys_files:
            level = detect_level(phys_clip.name)
            if level not in {"high", "low"}:
                continue
            scenario = phys_clip.stem
            for baseline in args.baselines:
                baseline_clip = root / baseline / attribute / phys_clip.name
                if not baseline_clip.is_file():
                    continue
                questions.append(
                    build_question(
                        attribute=attribute,
                        level=level,
                        scenario=scenario,
                        phys_path=phys_clip,
                        baseline_path=baseline_clip,
                        baseline_name=baseline,
                        root=root,
                    )
                )

    if not questions:
        print("No questions generated. Ensure filenames match across methods.", file=sys.stderr)
        sys.exit(1)

    output_path = args.output
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as fh:
        json.dump(questions, fh, indent=2)

    print(f"Wrote {len(questions)} questions to {output_path}")


if __name__ == "__main__":
    main()
