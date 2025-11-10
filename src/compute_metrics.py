#!/usr/bin/env python3
"""
Aggregate downloaded response JSON files into table-ready metrics.

Usage:
    python src/compute_metrics.py --responses responses/ --fields config/table_fields.json
"""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path
from typing import Dict, List

METHOD_ALIASES = {
    "physpropprior": "Ours (ControlNet)",
    "baseline_text_conditioned": "Ours (Text only)",
    "cosmos2B": "Base Model (zero-shot)",
    "force_prompting": "Force Prompting",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Compute controllability/realism scores from responses.")
    parser.add_argument(
        "--responses",
        type=Path,
        required=True,
        help="Directory containing downloaded response_*.json files.",
    )
    parser.add_argument(
        "--fields",
        type=Path,
        default=Path("config/table_fields.json"),
        help="Field-definition file (default: config/table_fields.json).",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Optional path to write the aggregated metrics as JSON.",
    )
    return parser.parse_args()


def load_fields(path: Path) -> Dict[str, dict]:
    fields = json.loads(path.read_text(encoding="utf-8"))
    return {field["id"]: field for field in fields}


def iter_response_files(folder: Path) -> List[Path]:
    return sorted(p for p in folder.glob("*.json") if p.is_file())


def read_responses(path: Path) -> List[dict]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(payload, dict) and "responses" in payload:
        return payload["responses"]
    if isinstance(payload, list):
        return payload
    raise ValueError(f"{path} is not a valid response bundle.")


def evaluate_response(response: dict, dataset: str) -> bool:
    choice = response.get("choice")
    if not choice:
        return False

    if dataset == "control_fidelity":
        target = (response.get("targetLevel") or "").lower()
        selected = response.get(f"video{choice}")
        level = (selected or {}).get("level", "").lower()
        return bool(target and level == target)

    if dataset == "force_direction":
        selected = response.get(f"video{choice}")
        return (selected or {}).get("role") == "target"

    if dataset in {"physical_plausibility", "force_baseline"}:
        option_key = "optionA" if choice.upper() == "A" else "optionB"
        option = response.get(option_key) or {}
        return option.get("method") == "physpropprior"

    return False


def aggregate(responses_dir: Path, fields_config: Dict[str, dict]) -> dict:
    field_stats = {
        fid: {
            "label": data["label"],
            "axis": data["axis"],
            "method": data["method"],
            "attribute": data["attribute"],
            "dataset": data["dataset"],
            "success": 0,
            "total": 0,
        }
        for fid, data in fields_config.items()
    }

    table = defaultdict(lambda: defaultdict(lambda: defaultdict(lambda: {"success": 0, "total": 0})))

    for file_path in iter_response_files(responses_dir):
        for response in read_responses(file_path):
            field_id = response.get("fieldId") or response.get("field", {}).get("id")
            if not field_id or field_id not in field_stats:
                continue
            field = field_stats[field_id]
            dataset = response.get("dataset") or field["dataset"]
            if response.get("meta") and "fieldId" not in response["meta"]:
                response["meta"]["fieldId"] = field_id
            success = evaluate_response(response, dataset)
            field["total"] += 1
            if success:
                field["success"] += 1

            axis = field["axis"]
            method = field["method"]
            attribute = field["attribute"]
            agg = table[axis][method][attribute]
            agg["total"] += 1
            if success:
                agg["success"] += 1

    # compute percentages
    for field in field_stats.values():
        if field["total"]:
            field["pct"] = 100 * field["success"] / field["total"]
        else:
            field["pct"] = None

    for axis in table.values():
        for method_blocks in axis.values():
            for attr_stats in method_blocks.values():
                if attr_stats["total"]:
                    attr_stats["pct"] = 100 * attr_stats["success"] / attr_stats["total"]
                else:
                    attr_stats["pct"] = None

    return {"fields": field_stats, "table": freeze_defaultdict(table)}


def freeze_defaultdict(obj):
    if isinstance(obj, defaultdict):
        obj = {key: freeze_defaultdict(value) for key, value in obj.items()}
    elif isinstance(obj, dict):
        obj = {key: freeze_defaultdict(value) for key, value in obj.items()}
    return obj


def print_summary(result: dict) -> None:
    print("\n=== Field-level Metrics ===")
    for field_id, stats in result["fields"].items():
        pct = stats.get("pct")
        pct_str = f"{pct:.1f}%" if pct is not None else "n/a"
        print(
            f"{field_id}: {pct_str} "
            f"({stats['success']}/{stats['total']}) — {stats['label']}"
        )

    print("\n=== Table View ===")
    for axis_name, method_block in result["table"].items():
        print(f"\n{axis_name.upper()}:")
        for method, attributes in method_block.items():
            method_label = METHOD_ALIASES.get(method, method)
            cells = []
            for attribute, stats in attributes.items():
                pct = stats.get("pct")
                cells.append(
                    f"{attribute}: {pct:.1f}% ({stats['success']}/{stats['total']})"
                    if pct is not None
                    else f"{attribute}: n/a"
                )
            print(f"  {method_label} -> " + ", ".join(cells))


def main() -> None:
    args = parse_args()
    fields = load_fields(args.fields)
    result = aggregate(args.responses, fields)
    if args.output:
        args.output.write_text(json.dumps(result, indent=2), encoding="utf-8")
        print(f"Wrote metrics to {args.output}")
    print_summary(result)


if __name__ == "__main__":
    main()
