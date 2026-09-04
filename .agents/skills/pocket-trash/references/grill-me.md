# Grill Me

Interview the user about a plan until the important in-scope decisions, risks,
and dependencies are understood. Stay focused on the plan's stated goal and
avoid exhaustive or speculative questioning.

## Session Files

Before asking the first question:

1. Create a short lowercase slug for the plan, using 2-5 hyphen-separated words.
2. Ensure `./plans` exists.
3. Use `./plans/grill-me-<slug>.md` as the session log.
4. Use `./plans/grill-me-<slug>-out-of-scope.md` for questions that are not
   worth asking.

If the session log does not exist, create it with:

```markdown
# Grill Me: <Plan Name>

## Plan

<brief summary of the plan being grilled>

## Questions And Answers
```

After each user answer, immediately append the asked question, the recommended
answer that was provided, and the user's answer to the session log before asking
another question.

## Question Gate

Before asking any question, sound-check `./plans/grill-me-<slug>.md`:

- Read the existing session log and do not ask a question that is already
  answered or substantially duplicates a prior question.
- If a question can be answered by exploring the codebase, inspect the codebase
  instead of asking the user.
- Ask only questions that materially affect the plan, design, implementation
  path, risk profile, sequencing, or acceptance criteria.
- Keep the interview bounded. Prefer the next highest-leverage unresolved
  decision over covering every possible branch.
- Stop when the remaining uncertainties are minor, already answerable from
  context, or out of scope.

For each in-scope question, ask one question at a time and include your
recommended answer.

## Out-Of-Scope Handling

If a possible question is out of scope, do not show it to the user and do not
ask permission to park it. Write it to `./plans/grill-me-<slug>-out-of-scope.md`
instead.

Group out-of-scope questions under relevant Markdown headers. If a better
grouping becomes clear later, edit the header and move prior questions as
needed. Create the file on first use with:

```markdown
# Out Of Scope: <Plan Name>
```
