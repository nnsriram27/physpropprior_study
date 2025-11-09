#!/usr/bin/env python3
"""
Generate physpropprior-vs-baseline force comparison questions.

Each question pits a PhysPropPrior force video against the corresponding baseline
clip (same scenario + angle) whenever both exist. The force arrow PNG from
physpropprior/force provides the context image.
"""

from __future__ import annotations

import argparse
import json
import random
import re
import sys
from pathlib import Path
from typing import Dict, List, Tuple

SCENARIO_RE = re.compile(r"(?P<base>.+)_angle_(?P<angle>\d+)$")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build PhysPropPrior vs baseline force adherence questions."
    )
    parser.add_argument(
        "--root",
        type=Path,
        default=Path("."),
        help="Root directory containing the method folders (default: current directory).",
    )
    parser.add_argument(
        "--baselines",
        nargs="+",
        required=True,
        help="Baseline method folders (excluding physpropprior) to compare against.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("data/force_baseline_questions.json"),
        help="Destination JSON file (default: data/force_baseline_questions.json).",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=11,
        help="Random seed for reproducible shuffling (default: 11).",
    )
    return parser.parse_args()


def parse_scenario(name: str) -> Tuple[str, str]:
    match = SCENARIO_RE.match(name)
    if not match:
        raise ValueError(f"Missing _angle_ token in {name}")
    return match.group("base"), match.group("angle")


def slugify(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", text.lower())
    return slug.strip("_") or "scenario"


def collect_physpropprior_force(root: Path) -> Dict[Tuple[str, str], Path]:
    mapping: Dict[Tuple[str, str], Path] = {}
    force_dir = root / "physpropprior" / "force"
    if not force_dir.is_dir():
        raise FileNotFoundError(f"Missing physpropprior force directory: {force_dir}")
    for mp4 in force_dir.glob("*.mp4"):
        try:
            scenario, angle = parse_scenario(mp4.stem)
        except ValueError:
            print(f"[skip] {mp4.name} lacks angle token", file=sys.stderr)
            continue
        mapping[(scenario, angle)] = mp4
    return mapping


def collect_context_images(root: Path) -> Dict[Tuple[str, str], Path]:
    images: Dict[Tuple[str, str], Path] = {}
    context_dir = root / "physpropprior" / "force"
    for png in context_dir.glob("*_force.png"):
        stem = png.stem
        if not stem.endswith("_force"):
            continue
        base = stem[: -len("_force")]
        try:
            scenario, angle = parse_scenario(base)
        except ValueError:
            continue
        images[(scenario, angle)] = png
    return images


def relative(path: Path, root: Path) -> Path:
    return path.relative_to(root)


def make_question(
    scenario: str,
    angle: str,
    phys_path: Path,
    baseline_path: Path,
    baseline_name: str,
    context_path: Path,
    root: Path,
) -> Dict[str, object]:
    prompt = "Which video better obeys the applied force direction?"
    scenario_slug = slugify(scenario)
    options = [
        ("physpropprior", phys_path),
        (baseline_name, baseline_path),
    ]
    random.shuffle(options)

    def option_payload(label: str, path: Path) -> Dict[str, str]:
        return {
            "src": relative(path, root).as_posix(),
            "method": label,
        }

    (a_label, a_path), (b_label, b_path) = options

    return {
        "id": f"fb_{scenario_slug}_{angle}_{baseline_name}",
        "axis": "Force adherence",
        "axisDetail": "Baseline comparison",
        "prompt": prompt,
        "meta": {
            "scenario": scenario,
            "angle": angle,
            "baseline": baseline_name,
        },
        "videoA": option_payload(a_label, a_path),
        "videoB": option_payload(b_label, b_path),
        "contextImage": relative(context_path, root).as_posix(),
        "contextCaption": "Arrow indicates the intended force direction.",
    }


def main() -> None:
    args = parse_args()
    random.seed(args.seed)

    root = args.root.resolve()
    phys_clips = collect_physpropprior_force(root)
    context_images = collect_context_images(root)

    questions: List[Dict[str, object]] = []
    for baseline in args.baselines:
        base_dir = root / baseline / "force"
        if not base_dir.is_dir():
            print(f"[warn] Skipping baseline without force dir: {base_dir}", file=sys.stderr)
            continue
        for mp4 in base_dir.glob("*.mp4"):
            try:
                scenario, angle = parse_scenario(mp4.stem)
            except ValueError:
                continue
            key = (scenario, angle)
            phys_path = phys_clips.get(key)
            context_path = context_images.get(key)
            if not phys_path or not context_path:
                continue
            questions.append(
                make_question(
                    scenario=scenario,
                    angle=angle,
                    phys_path=phys_path,
                    baseline_path=mp4,
                    baseline_name=baseline,
                    context_path=context_path,
                    root=root,
                )
            )

    if not questions:
        print("No questions generated. Check baselines/scenarios.", file=sys.stderr)
        sys.exit(1)

    output_path = args.output
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as fh:
        json.dump(questions, fh, indent=2)

    print(f"Wrote {len(questions)} questions to {output_path}")


if __name__ == "__main__":
    main()
