#!/usr/bin/env python3
"""Offline, side-effect-free selection of next verified automation action."""
import argparse
import json
import sys

MODES = {"development-audit", "qa-research", "law-monitoring", "creative", "website-qa", "project-evidence"}


def select_next(payload):
    if not isinstance(payload, dict) or payload.get("mode") not in MODES:
        raise ValueError("unsupported mode")
    candidates = payload.get("candidates", [])
    if not isinstance(candidates, list) or len(candidates) > 100:
        raise ValueError("invalid candidate list")
    done = set(payload.get("recent_completed", []))
    unresolved = set(payload.get("unresolved", []))
    options = []
    for c in candidates:
        if not isinstance(c, dict):
            continue
        fid = c.get("fingerprint")
        if not isinstance(fid, str) or not fid.strip() or len(fid) > 160:
            continue
        if fid in done and fid not in unresolved:
            continue
        if c.get("requires_unapproved_action") is True:
            continue
        if not isinstance(c.get("evidence"), str) or not c["evidence"].strip():
            continue
        try:
            severity, impact, confidence, effort = [int(c[k]) for k in ("severity", "impact", "confidence", "effort")]
        except (KeyError, ValueError, TypeError):
            continue
        if any(v < 0 or v > 3 for v in (severity, impact, confidence)) or effort not in (1, 2, 3) or confidence == 0:
            continue
        score = severity * 5 + impact * 3 + confidence * 2 - effort * 2
        if fid in unresolved and severity >= 2:
            score += 5
        options.append((-score, -severity, -impact, -confidence, effort, fid, c))
    if not options:
        return {"status": "NO_MATERIAL_CHANGE"}
    options.sort(key=lambda r: r[:-1])
    choice = options[0]
    selected = choice[-1]
    return {"status": "ACTION_SELECTED", "score": -choice[0], "action": {
        "fingerprint": selected["fingerprint"], "title": selected.get("title"),
        "evidence": selected["evidence"]}}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    args = parser.parse_args()
    try:
        with open(args.input, encoding="utf-8") as file:
            outcome = select_next(json.load(file))
    except (OSError, ValueError, TypeError) as exc:
        print(json.dumps({"status": "INVALID_INPUT", "error": str(exc)}), file=sys.stderr)
        return 2
    print(json.dumps(outcome, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
