# Domain Docs

Layout: **single-context**

- `CONTEXT.md` — project domain language, ubiquitous terms, key invariants. Read this before making architectural decisions.
- `docs/adr/` — past architectural decisions (ADRs). Read relevant ADRs before proposing changes that touch the same area.

## Consumer rules

1. Always read `CONTEXT.md` at the start of an architecture or diagnosis session.
2. Before proposing a design that touches an existing decision, grep `docs/adr/` for related ADRs.
3. If a new architectural decision is made, write an ADR under `docs/adr/NNNN-<slug>.md`.
4. If `CONTEXT.md` does not exist yet, prompt the user to create it before proceeding with domain-sensitive work.
