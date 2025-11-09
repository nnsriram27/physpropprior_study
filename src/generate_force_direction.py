#!/usr/bin/env python3
"""
Generate force-direction comparison questions.

For each method's force videos, find scenarios that have multiple angles and
that also have a reference PNG stored in physpropprior/force. Creates
force_direction_questions.json containing randomized A/B comparisons.
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
        description="Build force direction question set using available PNG arrows."
    )
    parser.add_argument(
        "--root",
        type=Path,
        default=Path("."),
        help="Root directory containing method folders (default: current directory).",
    )
    parser.add_argument(
        "--methods",
        nargs="+",
        required=True,
        help="Method folders to process (e.g. physpropprior baseline_text_conditioned).",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("data/force_direction_questions.json"),
        help="Destination JSON file (default: data/force_direction_questions.json).",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=7,
        help="Random seed for reproducible shuffling (default: 7).",
    )
    parser.add_argument(
        "--context-method",
        default="physpropprior",
        help="Method folder that stores the force PNG diagrams (default: physpropprior).",
    )
    return parser.parse_args()


def parse_scenario(name: str) -> Tuple[str, str]:
    """
    Returns (scenario_base, angle) for names like foo_angle_225.
    Raises ValueError if pattern missing.
    """
    match = SCENARIO_RE.match(name)
    if not match:
        raise ValueError(f"Missing _angle_ pattern in {name}")
    return match.group("base"), match.group("angle")


def collect_context_images(context_dir: Path) -> Dict[Tuple[str, str], Path]:
    images: Dict[Tuple[str, str], Path] = {}
    for png in context_dir.glob("*_force.png"):
        stem = png.stem  # includes _force suffix
        if not stem.endswith("_force"):
            continue
        base_name = stem[: -len("_force")]
        try:
            scenario_base, angle = parse_scenario(base_name)
        except ValueError:
            continue
        images[(scenario_base, angle)] = png
    return images


def relative(path: Path, root: Path) -> Path:
    return path.relative_to(root)


def slugify(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", text.lower())
    return slug.strip("_") or "scenario"


def build_questions(
    root: Path,
    methods: List[str],
    context_images: Dict[Tuple[str, str], Path],
) -> List[Dict[str, object]]:
    questions: List[Dict[str, object]] = []
    for method in methods:
        force_dir = root / method / "force"
        if not force_dir.is_dir():
            print(f"[warn] Missing force directory for {method}: {force_dir}", file=sys.stderr)
            continue

        scenarios: Dict[str, Dict[str, Path]] = {}
        for video_path in force_dir.glob("*.mp4"):
            try:
                scenario_base, angle = parse_scenario(video_path.stem)
            except ValueError:
                print(f"[skip] {video_path.name} lacks angle token", file=sys.stderr)
                continue
            scenarios.setdefault(scenario_base, {})[angle] = video_path

        for scenario_base, videos_by_angle in scenarios.items():
            for target_angle, target_video in videos_by_angle.items():
                context_path = context_images.get((scenario_base, target_angle))
                if not context_path:
                    continue
                distractor_angles = [a for a in videos_by_angle if a != target_angle]
                if not distractor_angles:
                    continue
                distractor_angle = random.choice(distractor_angles)
                distractor_video = videos_by_angle[distractor_angle]
                questions.append(
                    make_force_question(
                        method=method,
                        scenario_base=scenario_base,
                        target_angle=target_angle,
                        target_video=target_video,
                        distractor_angle=distractor_angle,
                        distractor_video=distractor_video,
                        context_image=context_path,
                        root=root,
                    )
                )
    return questions


def make_force_question(
    method: str,
    scenario_base: str,
    target_angle: str,
    target_video: Path,
    distractor_angle: str,
    distractor_video: Path,
    context_image: Path,
    root: Path,
) -> Dict[str, object]:
    prompt = "Which video best follows the applied force direction shown?"
    scenario_slug = slugify(scenario_base)

    options = [
        ("target", target_video, target_angle),
        ("distractor", distractor_video, distractor_angle),
    ]
    random.shuffle(options)

    def option_payload(kind: str, path: Path, angle: str) -> Dict[str, str]:
        return {
            "src": relative(path, root).as_posix(),
            "angle": angle,
            "role": kind,
        }

    (a_kind, a_path, a_angle), (b_kind, b_path, b_angle) = options

    return {
        "id": f"fd_{method}_{scenario_slug}_{target_angle}",
        "axis": "Force adherence",
        "axisDetail": "Direction compliance",
        "prompt": prompt,
        "meta": {
            "method": method,
            "scenario": scenario_base,
            "targetAngle": target_angle,
            "distractorAngle": distractor_angle,
        },
        "videoA": option_payload(a_kind, a_path, a_angle),
        "videoB": option_payload(b_kind, b_path, b_angle),
        "contextImage": relative(context_image, root).as_posix(),
        "contextCaption": "Arrow indicates the intended force direction.",
    }


def main() -> None:
    args = parse_args()
    random.seed(args.seed)

    root = args.root.resolve()
    context_dir = root / args.context_method / "force"
    if not context_dir.is_dir():
        print(f"No context directory found at {context_dir}", file=sys.stderr)
        sys.exit(1)

    context_images = collect_context_images(context_dir)
    if not context_images:
        print("No force diagrams found. Cannot build questions.", file=sys.stderr)
        sys.exit(1)

    questions = build_questions(root, args.methods, context_images)
    if not questions:
        print("No questions generated. Check your inputs.", file=sys.stderr)
        sys.exit(1)

    output_path = args.output
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as fh:
        json.dump(questions, fh, indent=2)

    print(f"Wrote {len(questions)} questions to {output_path}")


if __name__ == "__main__":
    main()
