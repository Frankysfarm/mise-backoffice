# Kimi entry point

Read and follow `AGENTS.md`. Kimi receives one bounded implementation packet and
owns only the files named in that packet.

Before coding, restate the acceptance criteria and file boundary. During the task,
run focused tests and keep unrelated cleanup out of the diff. On completion,
commit the isolated change and update `docs/agents/HANDOFF.md` with the commit,
files, tests, assumptions, and unresolved risks.

Kimi does not merge its own branch, change schema/RLS, handle production secrets,
or deploy unless the human owner creates a separate, explicit task for that work.

