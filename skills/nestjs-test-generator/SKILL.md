---
name: nestjs-test-generator
description: >
  MANDATORY SKILL FOR ALL TESTING in this project (including NestJS services, E2E controllers, and ANY normal standard TypeScript file or auxiliary class). Deterministic test generator using Vitest.
  An orchestrator script scans methods via AST, allows for agentic test planning,
  scaffolds structural blocks, and uses sub-agents to generate strict JSON payloads. 
  You MUST use this skill whenever the user asks to "generate tests", "write tests",
  "write unit tests", "write e2e tests", or "add test coverage". This skill can be used directory-wise (`--target-folder`), file-wise (`--target-file` even for normal .ts files), or method-wise (`--target-method`).
  DO NOT write tests manually. ALWAYS use this skill.
  If asked to test a NEWLY added method in an existing test file, YOU MUST use `--target-method <methodName> --rewrite` instead of rewriting the entire file.
  WARNING: Even with `--target-method`, this skill COMPLETELY REWRITES the targeted method's tests from scratch. DO NOT use this skill to make minor updates to existing tests if a simple file edit can do the job!
---

# 🧪 Universal Test Generator (Vitest)

This is the MANDATORY, strict, multi-agent pipeline for generating all tests in this project. It safely parses source code via AST and deterministically injects test code into `.spec.ts` files.

## 🛑 WHEN **NOT** TO USE THIS SKILL (CRITICAL)

**DO NOT** use this skill if you only need to:

- Make a minor logic change to an existing test.
- Fix a broken test assertion or bug.
- Add a single expectation or mock to an already mature, working test case.

**Why?** Because running this tool with the `--rewrite` flag will completely NUKE and REWRITE the targeted test blocks from scratch. Even if you use `--target-method`, it deletes ALL existing tests for that specific method before regenerating them, destroying any custom logic previously written.
**Solution:** For minor tweaks, completely ignore this skill and use your standard file editing tools (like `replace_file_content` or `multi_replace_file_content`) to update the file directly.

## ✅ WHEN TO USE THIS SKILL

You **MUST** use this skill when:

- Generating tests for a brand new service or file from scratch.
- Generating missing test coverage for an existing file.
- Adding tests for a newly created method inside a mature file (using `--target-method`).
- Doing a total, from-scratch rewrite of outdated tests.

---

## ⚠️ DANGER ZONE: UNDERSTANDING `.test-gen`

Every time you run the `pre-scan` phase, **it deletes the entire `.test-gen` folder and starts fresh.**
Because of this:

- **NO PARALLEL RUNS:** Do NOT run multiple `pre-scan` commands in parallel. They will overwrite each other.
- **NO INTERLEAVING / STRICT ISOLATION:** Once you run Step 1 (`pre-scan`) for a file, you are **LOCKED IN** to that pipeline. You absolutely CANNOT run Step 1 for another file until you have reached Step 7 (`Cleanup`) for the current file. If you run `pre-scan` again before injecting and cleaning up, you will permanently delete the in-progress work! You must finish Step 1 through Step 7 for `fileA` before you even touch `fileB`.

---

## 🎯 HOW TO USE CLI FLAGS SAFELY

| Flag                            | What it does                                                 | When to use it                                                                 |
| ------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `--target-folder <path>`        | Scans all matching files in the folder.                      | For bulk test generation on new features.                                      |
| `--target-file <path1,path2>`   | Scans only these specific files.                             | To target normal `.ts` files or specific classes.                              |
| `--target-method <name1,name2>` | Targets specific methods globally across the provided files. | **MANDATORY** when adding/updating tests for a single method in a mature file. |
| `--rewrite`                     | Regenerates existing tests.                                  | When you explicitly want to delete and replace tests.                          |

### 💡 Concrete Examples for Safe Execution:

**Example 1: Safe Method Update in a Mature File (✅ DO THIS!)**
You just added a `login` method to a huge, existing `auth.service.ts` file. You want to generate tests for `login` WITHOUT deleting the other 50 tests in the file.

```bash
node .agents/skills/nestjs-test-generator/scripts/orchestrate.js --phase pre-scan --project-root . --target-file "src/auth/auth.service.ts" --target-method "login" --rewrite
```

_(Result: It surgically deletes ONLY the `describe('login')` block if it exists, and leaves the rest of the file completely untouched.)_

**Example 2: The "Nuke the File" Mistake (❌ AVOID THIS!)**

```bash
node .agents/skills/nestjs-test-generator/scripts/orchestrate.js --phase pre-scan --project-root . --target-file "src/auth/auth.service.ts" --rewrite
```

_(Result: Because `--target-method` is missing, it will DELETE ALL 50 TESTS in `auth.service.ts` and rewrite the entire file from scratch. Very dangerous!)_

**Example 3: The "Global Method" Mistake (❌ AVOID THIS!)**

```bash
node .agents/skills/nestjs-test-generator/scripts/orchestrate.js --phase pre-scan --project-root . --target-file "A.ts,B.ts" --target-method "login" --rewrite
```

_(Result: `--target-method` searches GLOBALLY. If both `A.ts` and `B.ts` have a `login` method, BOTH will be overwritten. If you only wanted to update `A.ts`, run the full pipeline on `A.ts` alone first.)_

---

## 🚀 THE STEP-BY-STEP WORKFLOW

### Step 1: Pre-Scan

Run the orchestrator to analyze the target and build a default test plan:

```bash
node .agents/skills/nestjs-test-generator/scripts/orchestrate.js --phase pre-scan --project-root . [add your flags here]
```

### Step 2: Agentic Test Planning (YOUR CRITICAL JOB)

The pre-scan creates a `.test-gen/{Service}/test_plan.json` with basic defaults (1 happy, 1 error).
You must evaluate the complexity of the service in `.test-gen/{Service}/ast_findings.json`.
For **complex methods or services**, do NOT attempt to manually guess the edge cases. Instead, you should spawn **planning sub-agents** (using the `research` or `self` role) to study the method in depth.
Give them an instruction similar to:

> "Study the method `{{MethodName}}` from `.test-gen/{Service}/ast_findings.json`. Investigate the project's architectural guidelines and business logic. Provide a comprehensive JSON array of test cases that exhaustively covers edge cases, domain rules, and architectural constraints. Do not just test code coverage. You MUST return a strict JSON array in this exact format:
> `[ { "id": "{{MethodName}}_happy_path", "description": "should return expected result when..." } ]`"

**CRITICAL**: The `test_plan.json` file is a dictionary keyed by method name. You must ONLY update the array for the specific `{{MethodName}}` you researched. Do NOT overwrite the entire file or delete the test cases for other methods! Use your file editing tools to surgically replace just that method's array.

**CRITICAL NOTE ON TEST INTENT**: When reviewing or updating the test plan, ensure the test cases verify the _actual business logic and architectural constraints_ (as defined in `AGENTS.md` or the project's architectural guidelines), not just blind code coverage.

### Step 3: Scaffold

```bash
node .agents/skills/nestjs-test-generator/scripts/orchestrate.js --phase scaffold --project-root .
```

_(Result: Injects empty `it` blocks with `// TASK_ID:` comments and generates `manifest.json` and prompts.)_

### Step 4: Spawn Sub-Agents in Parallel

Read `.test-gen/{Service}/manifest.json`. For each task in the manifest, spawn a **self** sub-agent (using the `self` role so it inherits your write tools). Give it the following instruction:

> "Read the instructions inside `{{task.promptFile}}` and execute them. You are encouraged to use your read tools to investigate any dependencies to understand how they work, and you MUST use your write tools to save your final JSON response directly to the requested file at `{{task.responseFile}}`."

You must run these sub-agents in parallel using a single tool call to save time. Wait for all sub-agents to finish.

### Step 5: Inject

```bash
node .agents/skills/nestjs-test-generator/scripts/orchestrate.js --phase inject --project-root .
```

_(Result: Replaces `// TASK_ID:` comments with the sub-agent JSON code.)_

### Step 6: Verify

Run `vp test <target-folder>` (or equivalent test runner) to ensure tests pass.

### Step 7: Cleanup

```bash
rm -rf .test-gen
```

---

## 🌐 E2E TESTING WORKFLOW

If the user explicitly requests "e2e tests":
Use `orchestrate_e2e.js` and `.test-gen-e2e/`. The workflow is identical:

1. `node .agents/skills/nestjs-test-generator/scripts/orchestrate_e2e.js --phase pre-scan --project-root . [flags]`
2. `node .agents/skills/nestjs-test-generator/scripts/orchestrate_e2e.js --phase scaffold --project-root .`
3. Spawn sub-agents reading from `.test-gen-e2e/{Controller}/manifest.json`.
4. `node .agents/skills/nestjs-test-generator/scripts/orchestrate_e2e.js --phase inject --project-root .`
5. Verify tests via `vp test`.
6. `rm -rf .test-gen-e2e`
