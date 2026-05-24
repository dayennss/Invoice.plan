# Issue Tracker

Issues are tracked as **local markdown files** under `.scratch/` in this repository.

## Layout

Each feature or bug gets its own directory:

```
.scratch/
  <feature-slug>/
    issue.md        # the issue body
    notes.md        # optional working notes
```

## Workflow

- To create an issue: write `.scratch/<slug>/issue.md`
- To list issues: read the `.scratch/` directory
- To close an issue: add `status: closed` to the issue frontmatter or move to `.scratch/_closed/<slug>/`
- No CLI tool needed — all file operations

## Issue frontmatter format

```markdown
---
title: Short issue title
labels: [needs-triage]
status: open
created: YYYY-MM-DD
---

Issue body here.
```

## Skills that use this

`to-issues`, `triage`, `to-prd`, `qa`
