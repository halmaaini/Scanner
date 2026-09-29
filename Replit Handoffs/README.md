# Replit Handoffs

Reports from the **Replit agent → Claude Code**, one per round: the return leg of the loop that starts in `Claude Handoffs/`.

After Claude hands off a round (`Claude Handoffs/NNN-slug.md`), the Replit agent runs the steps, publishes, and writes its report **here** as `NNN-slug.md`, with the **same number and slug** as the Claude doc it answers.

**A Replit report states:**

- which runtime steps ran and their results (✅ / ❌),
- anything Replit changed (commits) and the **publish/deploy** status,
- the smoke-test / verification result,
- **open questions or the next instructions for Claude**, which kick off the next round.

Start from `_TEMPLATE.md`. Keep it **self-contained**: Claude will be pointed at it with just _"read Replit Handoffs/NNN-xxx.md"_, with no chat history, so every fact needed lives in the file.
