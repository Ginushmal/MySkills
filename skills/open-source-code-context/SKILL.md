---
name: open-source-code-context
description: Ground responses in live source code before analyzing, explaining, or using any open-source GitHub project or library. Use when the task involves an open-source project's code, or when you lack 100% certainty about a library's current API surface, file structure, or syntax.
---

# Open-Source Code Context

Fetch the exact, up-to-date source before making any claims about an open-source project hosted on GitHub.

## Trigger

Activate this protocol whenever:

- You are tasked with analyzing, explaining, or utilizing an open-source project's code.
- You lack 100% certainty about the current API surface of a library.

## Rules

1. **Never rely on static training data** — do not hallucinate, guess, or assume implementation details, file structures, or syntax.
2. **Fetch the live source** by constructing a raw file URL and reading it into your context.
3. **Ground your response** — only after ingesting the raw text may you generate code, specifications, or architectural decisions.

## URL Mapping

Convert a standard GitHub URL to its raw equivalent:

- `https://github.com/[user]/[repo]/blob/[branch]/[path]`
- → `https://raw.githubusercontent.com/[user]/[repo]/[branch]/[path]`

Fetch the raw URL (e.g. via `webfetch`) and read the content directly.
