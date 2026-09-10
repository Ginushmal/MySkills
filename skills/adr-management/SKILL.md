---
name: adr-management
description: >-
  Use this skill ONLY when proposing a SIGNIFICANT architecture-changing decision (e.g., adding a major new framework, changing core tensor shape representations, or altering the overarching system design). DO NOT use this skill for minor refactors, simple bug fixes, or routine configuration tweaks.
---

# ADR Management

As an AI working on this project, you have access to the ADR Management System. 

> **CRITICAL RULE - WHEN TO USE THIS SKILL:**
> Do **NOT** write an ADR for every small change. Only trigger this workflow for major, project-altering decisions such as:
> - Adopting a new major library or framework.
> - Radically altering the `Structure of Arrays` (SoA) data model or tensor shapes.
> - Changing the core algorithms (like the reward math or genetic crossover).

## How to Use Your Skill:
> **IMPORTANT:** Always run these commands from the repository root (`E:\Projects_and_Competitions\CivilizationSimulation`). Do not run them from within the `.agents` or `scripts` folders.

1. **Search First:** Before making a decision, run the semantic search script from the repository root to see if we have already made a rule about this:
   `pixi run search_adr "<your natural language query>"`
2. **Read:** If the search returns an ADR ID (e.g., `0004`), read the actual file (`docs/adr/0004-*.md`) to understand the context. Pay attention to the "Status" field to ensure it isn't superseded.
3. **Write:** To propose a new architecture decision, DO NOT manually create the file. Use the native `npryce/adr-tools` wrapper via pixi:
   `pixi run adr new "Title of the Decision"`
   This will automatically generate the correctly numbered file in `docs/adr/`. Once generated, open the file and fill in the Context, Decision, and Consequences sections.
4. **Link / Supersede:** If your new ADR supersedes an old one, use the `-s` flag to auto-link them:
   `pixi run adr new -s 4 "Title of the New Decision"`
   You can also create custom links between existing ADRs without creating a new file:
   `pixi run adr link 5 Amends 1 "Amended by"`
5. **Re-Index:** Whenever you write or modify an ADR, you MUST re-run the semantic search script with the index flag to update your own semantic brain:
   `pixi run search_adr --index`
6. **List & Generate Reports:**
   - To list all existing ADRs: `pixi run adr list`
   - To generate a table of contents: `pixi run adr generate toc`
   - To generate a visual relationship graph: `pixi run adr generate graph`
