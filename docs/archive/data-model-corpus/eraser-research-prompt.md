# Detour thread — driving eraser.io from an agent

**Written 2026-08-12, at the close of Sitting 3.** This is a *separate* thread from the
data-model interview. Do not resume the interview from this file — for that, read
`.notes/data-model-answers.md` and start at its ▶ RESUME HERE block.

**Why this exists.** `.notes/data-model-erd.md` is a first-class deliverable and is currently
maintained by hand, then copy-pasted into <https://app.eraser.io>. Before Sittings 4–5 add more
to it, find out whether that round-trip can be automated.

---

## Paste this into a fresh session

```
Research how to drive eraser.io programmatically from an agent, then assess our existing
diagram against what you find.

START HERE: https://www.eraser.io/agent-integrations — read it in full before searching
anything else. Follow through to the API docs, MCP server, and any CLI/SDK it links to.

CONTEXT — what we already have:
- `.notes/data-model-erd.md` holds a complete entity-relationship diagram in eraser's
  diagram-as-code DSL. It is ~150 lines of schema plus heavy `//` comments. Read it first;
  it IS the artifact this research is meant to serve.
- It is hand-maintained and pasted into app.eraser.io manually. Every decision in
  `.notes/data-model-answers.md` lands in it in the same sitting.
- It uses: entity blocks with `[icon: x, color: y]`, typed columns with `pk` / `fk` / `null`,
  `//` comments carried inline, `>` relationship lines, and a `title` line.

ANSWER THESE, in order, and say plainly which are unsupported rather than guessing:

1. INTEGRATION SURFACE. What can an agent actually do — is there an MCP server, a REST API,
   a CLI, a GitHub app? For each: auth model, what plan tier it needs, and whether it is
   generally available or waitlisted/beta.

2. WRITE PATH. Can a file of DSL be pushed into an eraser document programmatically, creating
   or updating a diagram? Can it update an EXISTING diagram in place (stable URL), or does
   each push create a new one? This is the single most important question — the whole point is
   keeping one canonical diagram current across sittings.

3. READ PATH. Can the DSL or a rendered image be pulled back out? Is there an export endpoint
   (SVG/PNG/PDF), and can a rendered image be committed to the repo?

4. DSL FIDELITY. Check our actual file against the documented DSL grammar and report any
   construct we are using that is non-standard, deprecated, or silently ignored — especially:
   inline `//` comments inside entity blocks, `null` as a column modifier, multi-line comment
   runs, `[icon:]` and `[color:]` values, and whether `>` is the right relationship operator
   for the cardinalities we mean. We have never validated this file against a renderer.

5. CARDINALITY. Our relationship lines are all bare `>`. Does the DSL support explicit
   one-to-many / many-to-many notation, and if so what should our lines actually be? Several
   of our relationships are documented in prose as many-to-many (pen→socket via tip options)
   and the diagram may be understating them.

6. COST / LOCK-IN. What does the automation tier cost, and if we later leave eraser, how
   portable is this DSL? Note any close-enough alternative that reads similar syntax
   (Mermaid ER, dbdiagram/DBML, PlantUML) and what a conversion would cost us.

DELIVERABLE: write findings to `.notes/eraser-integration-findings.md` with a clear
RECOMMENDATION section at the top answering one question — do we automate this now, automate
it later, or keep pasting by hand? Include a concrete next step for whichever you recommend.

CONSTRAINTS:
- Do not modify `.notes/data-model-erd.md` in this thread. If you find real DSL errors,
  list them in the findings file as a proposed patch and stop.
- Do not resume or advance the data-model interview.
- This repo's AGENTS.md requires `pnpm format` after documentation-only changes.
```

---

## Where the interview stands (for whoever picks this up)

- **Sittings 0–3 COMPLETE.** Sitting 3 closed 2026-08-12: 3.1–3.7, socket bridges (c′), and a
  new 3.2b (retention/adjustability).
- **Next is Sitting 4** — provenance & curation. 4.2 is already dissolved.
- **Two soft decisions** are flagged in the answers file's resume block: 3.2b's tip-option
  override and the `slot_option` → `part` merge. Both applied to the ERD, neither explicitly
  ratified.
- **Parked, blocking nothing:** measurement round 1 · Autmog's 2.5 mm · the Charpie cartridge ·
  BigIDesign's pencil mechanism · whether the Modern Fuel aBAP needs a tip swap for Parker ·
  whether Autmog's 36 Clipless is a different body.
