---
name: evolving-automation
description: Improve existing scheduled tasks using verified past results, safe next-step selection, duplicate avoidance, and testing across app QA, regulatory monitoring, project audits and creative ideas.
---

# Evolving Automation v1

At every run, read the current saved automation instructions and previous verified results, then choose the highest-value next safe action. Preserve all original approvals, schedules, pause states, privacy, costs, and task-specific requirements.

Read `references/task-profiles.md` for all six task modes. Use `scripts/plan_next.py` to rank evidence-backed candidate work when executable. Do not repeat confirmed completed work, but do revisit serious unresolved failures.

Report confirmed facts, actual actions, tests, obstacles, next step and changes since last run. If historical runs or skills are unavailable, clearly say so. If no meaningful new work is supported, report NO_MATERIAL_CHANGE.

No autonomous spending, public deployments, publishing, data deletion, unapproved new apps, or privilege expansion. Never claim offline PC, local Codex, Android or Firebase actions without real tool evidence. Skill revisions require tests and an independently reviewable PR; never self-modify rules inside an unattended run.

Validate with official skill-creator `quick_validate.py`, and test all six task profiles before rollout.
