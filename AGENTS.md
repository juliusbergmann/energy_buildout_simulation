# Repository Instructions

## Project Plans

- Before implementing a feature, bug fix, or refactor, check the `plans/` folder for the relevant plan.
- Treat plan files as durable project context: they explain what was implemented at what time and why.
- If a change needs a new plan or a plan update, add or update a file in `plans/` before opening the PR.

## Pull Requests

- Every PR must reference the relevant plan file in its description.
- Every PR must explain what was implemented, why the change was made, and how it was verified.
- If the implementation diverges from the linked plan, document the deviation and the reason in the PR.
- If no plan applies, explicitly write that in the PR and explain why the change does not need one.

## Git Workflow

- Keep completed, verified work committed in logical checkpoints unless the user asks not to commit.
