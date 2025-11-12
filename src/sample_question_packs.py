#!/usr/bin/env python3
"""
Sample balanced 2AFC question packs for local participants.

For each table field (method x attribute x axis), the script draws N questions
from the corresponding dataset so every participant answers the same number
of prompts per cell.
"""

from __future__ import annotations

import argparse
import json
import random
import sys
from copy import deepcopy
from pathlib import Path
from typing import Dict, List, Optional, Sequence

DATASET_FILES = {
  "physical_plausibility": "physical_plausibility_questions.json",
  "force_baseline": "force_baseline_questions.json",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate per-user question packs covering every table field."
    )
    parser.add_argument(
        "--config",
        type=Path,
        default=Path("config/table_fields.json"),
        help="Field-definition file (default: config/table_fields.json).",
    )
    parser.add_argument(
        "--data-root",
        type=Path,
        default=Path("data"),
        help="Directory that stores the question banks (default: data).",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("data/packs"),
        help="Folder to write participant packs into (default: data/packs).",
    )
    parser.add_argument(
        "--participants",
        nargs="*",
        default=[],
        help="Explicit participant IDs (e.g., alice bob).",
    )
    parser.add_argument(
        "--count",
        type=int,
        default=0,
        help="Number of packs to auto-generate (ignored when --participants is used).",
    )
    parser.add_argument(
        "--prefix",
        default="user",
        help="Prefix for auto-generated IDs (default: user).",
    )
    parser.add_argument(
        "--questions-per-field",
        type=int,
        default=None,
        help="Override the per-field question count defined in the config.",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed (default: 42).",
    )
    return parser.parse_args()


def get_nested(data: dict, dotted_key: str):
    parts = dotted_key.split(".")
    value = data
    for part in parts:
        if not isinstance(value, dict) or part not in value:
            return None
        value = value[part]
    return value


def matches_filters(question: dict, filters: Dict[str, object]) -> bool:
    for key, expected in (filters or {}).items():
        actual = get_nested(question, key) if "." in key else question.get(key)
        if actual is None:
            meta = question.get("meta", {})
            actual = meta.get(key)
        if isinstance(expected, Sequence) and not isinstance(expected, (str, bytes)):
            if actual not in expected:
                return False
        else:
            if actual != expected:
                return False
    return True


def load_dataset(dataset_name: str, data_root: Path) -> List[dict]:
    filename = DATASET_FILES.get(dataset_name)
    if not filename:
        raise KeyError(f"Unknown dataset '{dataset_name}'. Available: {', '.join(DATASET_FILES)}")
    path = data_root / filename
    if not path.is_file():
        raise FileNotFoundError(f"Dataset {dataset_name} missing at {path}")
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def build_question_pool(fields: List[dict], data_root: Path) -> Dict[str, List[dict]]:
    cache: Dict[str, List[dict]] = {}
    pools: Dict[str, List[dict]] = {}
    for field in fields:
        dataset_name = field["dataset"]
        if dataset_name not in cache:
            cache[dataset_name] = load_dataset(dataset_name, data_root)
        candidates = [
            q
            for q in cache[dataset_name]
            if matches_filters(q, field.get("filters", {}))
        ]
        if len(candidates) < field.get("questions", 2):
            raise ValueError(
                f"Not enough questions for field '{field['id']}' "
                f"(wanted {field.get('questions', 2)}, found {len(candidates)})"
            )
        pools[field["id"]] = candidates
    return pools


def ensure_participants(args: argparse.Namespace) -> List[str]:
    if args.participants:
        return args.participants
    if args.count <= 0:
        raise ValueError("Provide --participants ... or --count N to generate packs.")
    width = max(2, len(str(args.count)))
    return [f"{args.prefix}_{i:0{width}d}" for i in range(1, args.count + 1)]


def make_question_copy(question: dict, field: dict) -> dict:
    copy = deepcopy(question)
    field_info = {
        "id": field["id"],
        "label": field["label"],
        "axis": field["axis"],
        "method": field["method"],
        "attribute": field["attribute"],
    }
    copy["field"] = field_info
    copy["fieldId"] = field["id"]
    copy["fieldLabel"] = field["label"]
    copy["dataset"] = field["dataset"]
    copy.setdefault("meta", {})["fieldId"] = field["id"]
    return copy


def assemble_pack(
    participant_id: str,
    fields: List[dict],
    pools: Dict[str, List[dict]],
    questions_per_field: Optional[int],
) -> List[dict]:
    pack: List[dict] = []
    for field in fields:
        sample_size = questions_per_field or field.get("questions", 2)
        candidates = pools[field["id"]]
        sampled = random.sample(candidates, sample_size)
        pack.extend(make_question_copy(q, field) for q in sampled)
    random.shuffle(pack)
    return pack


def main() -> None:
    args = parse_args()
    random.seed(args.seed)
    fields = json.loads(args.config.read_text(encoding="utf-8"))
    participants = ensure_participants(args)
    pools = build_question_pool(fields, args.data_root)

    args.output_dir.mkdir(parents=True, exist_ok=True)
    for pid in participants:
        pack = assemble_pack(pid, fields, pools, args.questions_per_field)
        output_path = args.output_dir / f"{pid}.json"
        with output_path.open("w", encoding="utf-8") as fh:
            json.dump(pack, fh, indent=2)
        print(f"Wrote {len(pack)} questions to {output_path}")

    total_fields = sum(field.get("questions", 2) for field in fields)
    print(
        f"Each participant receives {total_fields} questions "
        f"({len(fields)} fields × {fields[0].get('questions', 2)})."
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # noqa: BLE001
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)
