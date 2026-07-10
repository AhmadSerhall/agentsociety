# Project navigation and token-efficiency rules

1. Read `CODEX_CONTEXT.md` first, then the relevant sections of `PROJECT_MAP.md` and `FEATURE_INDEX.md` before investigating a task.
2. Identify the smallest likely file set before opening source files.
3. Do not scan the entire repository for localized changes.
4. Start with filenames, search results, imports, and references.
5. Open only files directly responsible for the requested behavior.
6. Follow dependencies only when the first files do not provide enough context.
7. Avoid generated folders, assets, lockfiles, and unrelated modules.
8. Reuse existing architecture instead of creating duplicate systems.
9. Do not modify files unrelated to the requested task.
10. Before editing, state the expected file scope.
11. After editing, report exactly which files changed.
12. Update project maps when architecture, ownership, or file locations change.
13. Do not rewrite documentation for minor implementation changes unless the map became inaccurate.
14. Never expose secrets from environment files.
15. Prefer small targeted patches over broad refactors.
16. Do not run expensive full-project operations unless required.
17. Run the narrowest relevant validation first.
18. Stop investigating once sufficient evidence exists to implement the task safely.

## Required workflow for every future task

### 1. Understand the request

Restate the requested behavior internally and identify the affected feature.

### 2. Consult the project map

Read only the relevant sections of:

- `PROJECT_MAP.md`
- `FEATURE_INDEX.md`
- `DEPENDENCY_MAP.md`

### 3. Predict file scope

Before opening source files, identify:

- Primary files likely to change
- Supporting files that may need inspection
- Unrelated areas that should not be opened

### 4. Inspect narrowly

Open the primary files first.

Search for exact symbols, handlers, component names, types, and imports.

Do not expand scope unless required.

### 5. Implement minimally

Make the smallest complete change that satisfies the request.

Avoid unrelated cleanup and refactoring.

### 6. Validate narrowly

Prefer:

- Targeted TypeScript checks
- Targeted linting
- Relevant tests
- Focused build checks

Use a full project build only when necessary.

### 7. Report

State:

- What changed
- Which files changed
- What was validated
- Any remaining risk
- Whether the project maps needed updating
