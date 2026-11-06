# Existing automation profiles

These six profiles are subordinate to each task's saved instructions and original approval limits.

| Task ID | Task | Mode | New action focus | Protection |
|---|---|---|---|---|
| 6ad8f5eb054081919fd35448ca6d168c | 딱 시리즈 오전 점검 | development-audit | verified CI failure, PR or blocker and Codex handoff | no unsanctioned code, deploy or deletion |
| 6ac9839dbf388191bbb51d58ab0e8030 | 기존 앱 AI 점검·개선 및 수요조사 | qa-research | reproducible error, test regression, grounded demand | previously approved small fixes only; no new apps |
| 6ab3d0443ad08191a1ce80b0707a545e | 지하수 업계 변화 | law-monitoring | new official change, effective date, affected region | real official evidence, distinguish proposed versus effective |
| 6a48add280cc8191a6d07f9547892baf | Sibling Edit Ideas | creative | 10 novel photos, 5 novel video concepts | Seongwon/Rawon names; preserve faces and expressions |
| 6ae92ee795a88191ba1cf9ba17ec81b4 | 경일 딱 홈페이지 점검 | website-qa | actual site bug or source/test failure | keep paused; Codex deployment handoff only |
| 6ae27a9abe5881918eb687a3542c5ad3 | 환성사 관정공사 주간점검 | project-evidence | newly evidenced test status, missing records, risks | keep paused; never invent field test completion |

On each run: inspect the current prompt and accessible past result; propose evidence-backed candidate actions; choose one safe high-value action. Skip verified completed items; retain still-failing severe issues. If no current information is available, say so. If the skill cannot be loaded, apply the core fallback rule in the saved automation prompt and mark SKILL_NOT_LOADED.