# Joint agent workspace

This folder keeps project-specific agent guidance with the repository so a new Codex project can work without relying on the former Budget workspace.

- `skills/shadcn/` is a complete local copy of the shadcn skill, including the referenced rule files and CLI guidance.
- The root `AGENTS.md` is the operational entry point for contributors and agents.
- Product source documents live in `../docs/`: design contract, architecture, and MVP plan.

When adding a new project-specific skill, place it under `.agents/skills/<skill-name>/` with a complete `SKILL.md` and every referenced local file.
