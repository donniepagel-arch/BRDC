# BRDC Markdown Filing Map

This file explains where BRDC markdown should live.

## Root

Keep only markdown that is actively useful as repo entry documentation or coding guidance.

Examples:

- `README.md`
- `DEPLOY.md`
- `START_HERE.md`
- `CLAUDE.md`
- a small number of still-active project/spec docs

## `docs/`

Use for stable reference material.

Examples:

- architecture
- data model docs
- page maps
- function maps
- current repo inventory

## `docs/work-tracking/`

Use for implementation history, audits, bugfix notes, deployment notes, testing notes, and project progress logs.

## `docs/work-tracking/root-history/`

Use for markdown that originally lived at repo root but is clearly historical status/report material rather than a current entry doc.

## `docs/archive/`

Use for large session transcripts, old logs, or documentation that is worth keeping but should not stay in the active working surface.

## Rule

If a markdown file answers "how does BRDC work today?" it belongs in `README.md`, `DEPLOY.md`, `START_HERE.md`, or `docs/`.

If it answers "what happened during a fix, audit, or testing round?" it belongs in `docs/work-tracking/`.
