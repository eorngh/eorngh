import importlib.util
from pathlib import Path
import unittest

source = Path(__file__).resolve().parents[1] / "scripts" / "plan_next.py"
spec = importlib.util.spec_from_file_location("plan_next", source)
planner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(planner)


def candidate(fid="new", severity=1, evidence="verified"):
    return {"fingerprint": fid, "title": fid, "severity": severity, "impact": 2, "confidence": 3, "effort": 1, "evidence": evidence}


class TestPlanner(unittest.TestCase):
    def test_each_mode(self):
        for mode in planner.MODES:
            with self.subTest(mode=mode):
                self.assertEqual(planner.select_next({"mode": mode, "candidates": [candidate()]})["status"], "ACTION_SELECTED")

    def test_avoid_completed(self):
        data = {"mode": "creative", "recent_completed": ["old"], "candidates": [candidate("old", 3), candidate()]}
        self.assertEqual(planner.select_next(data)["action"]["fingerprint"], "new")

    def test_keep_unresolved_severe(self):
        data = {"mode": "website-qa", "recent_completed": ["bug"], "unresolved": ["bug"], "candidates": [candidate("bug", 3)]}
        self.assertEqual(planner.select_next(data)["action"]["fingerprint"], "bug")

    def test_no_change(self):
        self.assertEqual(planner.select_next({"mode": "law-monitoring", "candidates": []})["status"], "NO_MATERIAL_CHANGE")

    def test_refuse_unapproved(self):
        risky = candidate("deploy", 3)
        risky["requires_unapproved_action"] = True
        self.assertEqual(planner.select_next({"mode": "qa-research", "candidates": [risky]})["status"], "NO_MATERIAL_CHANGE")

    def test_require_evidence(self):
        self.assertEqual(planner.select_next({"mode": "project-evidence", "candidates": [candidate(evidence="")]})["status"], "NO_MATERIAL_CHANGE")

    def test_prioritize_critical(self):
        data = {"mode": "development-audit", "candidates": [candidate("low", 0), candidate("high", 3)]}
        self.assertEqual(planner.select_next(data)["action"]["fingerprint"], "high")

    def test_reject_bad_mode(self):
        with self.assertRaises(ValueError):
            planner.select_next({"mode": "bad", "candidates": []})

    def test_bad_candidate_ignored(self):
        self.assertEqual(planner.select_next({"mode": "creative", "candidates": [{"id": "bad"}]})["status"], "NO_MATERIAL_CHANGE")

    def test_deterministic_tie_break(self):
        data = {"mode": "creative", "candidates": [candidate("b"), candidate("a")]}
        self.assertEqual(planner.select_next(data)["action"]["fingerprint"], "a")


if __name__ == "__main__":
    unittest.main()
