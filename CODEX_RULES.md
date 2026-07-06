# CODEX RULES

## Objective
Your primary objective is to maximize implementation while minimizing token usage, repository scans, and reasoning time.

---

# 1. Read Only What Is Necessary

- Read only the files required for the current task.
- Never scan the entire repository unless explicitly instructed.
- Ignore unrelated folders and modules.
- Avoid repository-wide searches.

---

# 2. Restrict Scope

When file names or folders are provided:

- Work only inside those files.
- Do not inspect unrelated files.
- Do not search the entire project.

---

# 3. Complete Entire Missions

Treat every prompt as one complete mission.

- Finish every listed requirement.
- Do not stop after small tasks.
- Do not ask for confirmation unless absolutely blocked.

---

# 4. Minimize Reasoning

- Think briefly.
- Avoid long planning.
- Start implementing immediately.
- Spend tokens on coding instead of explanations.

---

# 5. Keep Responses Concise

After completion provide only:

- Files changed
- Summary of work
- Remaining issues (if any)

Avoid long explanations.

---

# 6. Assume Existing Architecture

Do not analyze the whole application.

Assume:

- existing architecture
- project structure
- coding patterns

are already correct.

Follow nearby code.

---

# 7. Ignore Unrelated Modules

If working on one feature, ignore all unrelated features.

Example:

Ignore

- Accounting
- CRM
- Inventory
- HR
- Payroll

unless explicitly requested.

---

# 8. Prefer Explicit Files

If files are specified:

Only edit those files.

Do not search elsewhere.

---

# 9. Batch Work

Complete all requested improvements before responding.

Avoid unnecessary intermediate updates.

---

# 10. Minimize Terminal Commands

Avoid unnecessary commands.

Do not repeatedly run:

- npm install
- npm test
- npm run build
- npm run lint

Only perform one final verification if required.

---

# 11. Avoid Large Searches

Avoid:

- grep across the repository
- recursive searches
- reading every file

Search only where necessary.

---

# 12. Edit Existing Code

Prefer:

- editing existing components
- reusing utilities
- extending existing hooks

Avoid creating unnecessary files.

---

# 13. Resume Efficiently

When resuming work:

- Continue from the previous checkpoint.
- Do not re-read the repository.
- Reopen only files still required.

---

# 14. Keep Changes Local

Modify only what is necessary.

Avoid rewriting unrelated code.

Preserve existing behavior.

---

# 15. Follow Existing Patterns

Reuse:

- components
- hooks
- utilities
- styles

Maintain consistency.

---

# 16. Work Autonomously

Unless blocked by missing information:

- make reasonable engineering decisions
- complete the implementation
- avoid unnecessary questions

---

# 17. Production Quality

Every implementation should be:

- responsive
- performant
- maintainable
- clean
- accessible
- animation-friendly when appropriate

---

# 18. Token Efficiency

Prioritize:

- implementation
- focused edits
- local searches
- minimal reasoning

Avoid wasting tokens on explanations or repository-wide analysis.

---

# Final Objective

Read the minimum number of files.

Use the minimum number of tokens.

Produce the maximum amount of completed work.

Focus on implementation rather than discussion.