---
description: Write a Replit handoff doc in "Claude Handoffs/" for the work just completed (commit hash + runtime steps)
argument-hint: [short-slug or title]
---

Produce a handoff document for the Replit agent in the `Claude Handoffs/` folder, following this repo's convention.

How we work: the user gives instructions → you implement, run the reviewer gate, commit and push the branch you were assigned → you write the handoff here → the user points the Replit agent at it by saying only **"read NNN-xxx.md"**. The Replit agent then reads **only that one file** and runs any runtime steps (install, restart, publish).

Therefore the doc MUST be fully self-contained: assume the reader has **no chat history and no other file**: every commit hash, branch name, command, env var, and caveat needed to act lives inside this single `.md`.

Do this:

1. **Confirm the round is committed and pushed.** Run `git log --oneline -8` and identify the commit hash(es) for the work just done. If anything for this round is uncommitted, commit it first and push the assigned branch. Merge to `main` only if the user has asked for that.
2. **Pick the number.** List `Claude Handoffs/` and use the next zero-padded sequence (`001`, `002`, ...).
3. **Write `Claude Handoffs/NNN-<slug>.md`**: slug from `$ARGUMENTS`, else a short kebab-case title, using the template below. Pull the real runtime steps from what actually changed this round; if there is no runtime action, write "None: pull the branch." Include each fix's **reviewer-agent verdict** (every change must have passed the reviewer gate in `CLAUDE.md`).
4. **Flip status + ship.** In `HANDOFFS.md`, set this round's Status to **`📤 pending Replit`** and fill its commit hash (the row already exists as `🚧` from round start; if it's missing, add it). Commit the handoff + ledger together as `docs(handoff): NNN <title>` and push the branch.
5. **Reply** with the code commit hash and the exact paste-ready line for the user to send Replit, e.g.:
   > read `Claude Handoffs/NNN-<slug>.md`

Keep it skimmable. Lead with the action-required steps: that's what Replit executes.

---

Template:

# Handoff NNN: <Title>

|            |                                                            |
| ---------- | ---------------------------------------------------------- |
| **Date**   | <YYYY-MM-DD>                                               |
| **Branch** | `<branch>`                                                 |
| **Commit** | `<hash>`                                                   |
| **Status** | ✅ Code complete and pushed: awaiting Replit runtime steps |

## Replit Agent: action required (in order)

<exact commands, numbered; note interactive prompts / required env vars; or "None: pull the branch.">

## Summary

<2-4 sentences: what & why>

## What changed

### Backend

### Frontend

### Database

## Reviewer verdicts

## Decisions / deviations

## Not verified locally (Replit to confirm)

## Out of scope / follow-up tasks

## Smoke test
