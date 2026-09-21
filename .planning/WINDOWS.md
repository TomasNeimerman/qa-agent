---
schema_version: 1
open_count: 1
waived_count: 0
fixed_count: 0
total_count: 1
last_updated: 2026-09-21T13:53:45.897Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 05 | unrun-verify | SKILL.md |  | 05-03 Task 2 human-check (D-12 teammate dry run of the rewritten Installation procedure) not performed by the executor -- the clean-directory rehearsal proves mechanical sufficiency only, not that an unfamiliar teammate can follow the doc; PKG-03 stays open until a real teammate dry run happens | open |  | 2026-09-21T13:53:45.897Z |  |

````json
[
  {
    "id": 1,
    "kind": "unrun-verify",
    "phase": "05",
    "file": "SKILL.md",
    "line": null,
    "description": "05-03 Task 2 human-check (D-12 teammate dry run of the rewritten Installation procedure) not performed by the executor -- the clean-directory rehearsal proves mechanical sufficiency only, not that an unfamiliar teammate can follow the doc; PKG-03 stays open until a real teammate dry run happens",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-21T13:53:45.897Z",
    "resolved_at": null
  }
]
````
