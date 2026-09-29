# Claude Handoffs

Handoffs from **Claude Code → the Replit agent**, one per round. The return leg lives in `Replit Handoffs/`.

## The loop (one round)

1. **Instructions** reach Claude: in chat, or via the "next instructions" section of the latest `Replit Handoffs/` report.
2. **Claude reviews**, asks questions (chat).
3. **Replit / the user answers** (chat).
4. **Claude implements**, runs the reviewer gate, commits and pushes the assigned branch, then writes `Claude Handoffs/NNN-slug.md` (this folder).
5. **Replit executes** the handoff (install, restart, **publish**), then writes `Replit Handoffs/NNN-slug.md`.
6. The next round starts from that Replit report.

The durable record of a round = its **two bookend docs**: `Claude Handoffs/NNN` (what was built + steps) and `Replit Handoffs/NNN` (what ran + result + next ask). Q&A stays in chat; don't document every message.

## Convention

- One file per round: `NNN-short-slug.md` (zero-padded). The Replit reply reuses the **same number + slug**.
- Every doc is **self-contained**: the other agent is pointed at it with just _"read NNN-xxx.md"_, no chat history.
- Claude docs state the **commit hash**, the **branch**, and the exact runtime steps. Generate with the **`/handoff`** command.
