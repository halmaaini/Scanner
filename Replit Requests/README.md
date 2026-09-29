# Replit Requests

Inbound briefs from **Replit (or the user via Replit) → Claude Code**: standalone issues, bugs, or feature/spec requests that are **not** a response to a finished round.

Use this lane (not a round report) when the work isn't tied to a `Claude Handoffs/` handoff, e.g. a bug found in the live app, a new feature, or a spec to build. Round-to-round continuations still go in the `Replit Handoffs/NNN.md` report's "next instructions" section.

**Convention**

- One file per brief: `NNN-short-slug.md`, numbered in **its own sequence** (separate from round numbers).
- **Self-contained**: Claude reads only that one file (no chat history); give enough context to act cold.
- Start from `_TEMPLATE.md`. Set a clear **done-when** so Claude knows the target.
- A brief usually becomes a round; when Claude picks it up it notes the round number and the brief's status moves to ✅.

Claude scans this folder for open (🆕) briefs at the **start of every round**, alongside the latest `Replit Handoffs/` report.
