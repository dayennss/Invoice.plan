# Triage Labels

| Role | Label string |
|---|---|
| Maintainer needs to evaluate | `needs-triage` |
| Waiting on reporter | `needs-info` |
| Fully specified, AFK-agent-ready | `ready-for-agent` |
| Needs human implementation | `ready-for-human` |
| Will not be actioned | `wontfix` |

In the local markdown tracker, labels are stored as a `labels:` array in the issue frontmatter:

```markdown
---
labels: [needs-triage]
---
```

Multiple labels are allowed: `labels: [ready-for-agent, needs-info]`
