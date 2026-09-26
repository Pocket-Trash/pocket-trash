# Naming thread — making the model legible to a person buying a pen

**Written 2026-08-12, after Sitting 3 closed and the ERD first rendered.** This is a *separate*
thread from the data-model interview. Do not resume the interview from this file — for that, read
`.notes/data-model-answers.md` and start at its ▶ RESUME HERE block.

**Why this exists.** The model is correct and unreadable. Every identifier in it is engineering
vocabulary earned during the interview — `socket`, `compat_edge`, `tip_option`, `rear_topology`,
`observance`, `polarity`, `bore_class`, `axial_adjust`, `radial_retention`, `trim_necessity`. A
person shopping for a pen knows none of those words. Before Sittings 4–5 add more, find out what
the market actually calls these things.

---

## Paste this into a fresh session

```
Research the real-world vocabulary for pen and refill compatibility, then propose how to make our
data model legible to someone buying or using a pen.

CONTEXT — read these first, in this order:
- `.notes/data-model-erd-clean.eraser` — the current ERD, comment-free and pastable. This is the
  artifact the work serves. It renders; don't re-validate it.
- `.notes/data-model-erd.md` — the same model annotated, where every `//` comment cites a numbered
  decision.
- `.notes/data-model-answers.md` — SOURCE OF TRUTH for why each field exists. Opens with a
  RESUME HERE block. Read it for rationale; do NOT advance the interview.
- `.notes/eraser-integration-findings.md` — eraser.io mechanics and the VERIFIED DSL grammar.
  Don't re-research any of that; it's settled.

THE PROBLEM. Two audiences need two different things from this model and currently get one
vocabulary that serves only the first:
- the schema, where precision matters and words like `socket` were chosen deliberately to avoid
  brand-anchoring ("dsm-2006, not schmidt");
- a buyer, who wants to know "will this refill work in my pen?"

RESOLVE THIS FIRST, before any bulk work — recommend, then get it ratified:
  (A) Keep every schema name; produce a separate display lexicon that maps internal → buyer-facing.
  (B) Rename schema identifiers outright to buyer-facing terms.
  (C) Hybrid — rename only where the internal name is ALSO bad on its own merits; map the rest.
Note the cost of (B): the `//` comments in data-model-erd.md cross-reference decision numbers in
data-model-answers.md. Renaming in bulk breaks that audit trail. Say so plainly if you recommend it.

RESEARCH — go find how real people write about this. Cite a real page or thread for every
recommendation; no vibes.
1. RETAIL / REFERENCE: JetPens (their refill-compatibility guides and refill taxonomy are the
   densest source in the market), Goulet, Drop, Amazon listing titles.
2. REFILL MAKERS: Schmidt, Pilot, Uni/Mitsubishi, Zebra, Pentel, Fisher, Monteverde, Parker.
   What do THEY call the format vs. the ink vs. the tip?
3. PEN MAKERS in our corpus: Tactile Turn, BigIDesign, Modern Fuel, Autmog, BilletSpin, Karas,
   Machine Era, Ti2, Alpha, Dark Pines, KVR.
4. COMMUNITIES: r/pens, r/EDC, r/mechanicalpencils, Fountain Pen Network, pen forums. Community
   words are often the ones buyers search.

For EACH internal term deliver: candidate labels · who uses each · how settled it is ·
ambiguity risks · your recommendation.

WATCH FOR FALSE FRIENDS. These trip people up and are the main reason to do the research:
- "refill type" — sometimes the ink (gel/ballpoint), sometimes the physical format. Two axes,
  one phrase. Our model already separates them (`medium` vs `socket`) and the market often doesn't.
- "tip" — the writing point vs. the pen's nose cone. Our `tip_option` means the SECOND one.
- "standard" (an actual ISO spec) vs "format" (a de facto shape).
- "size" — length, diameter, or tip width.

HIGH-VALUE TARGETS, roughly in order of how often a buyer would meet them:
  socket (the crux — what does the market call "the shape a refill has to be"?), compat_edge,
  tip_option, medium, fit_quality, trim_necessity + trim_mm, polarity, functional_warning,
  rear_topology, bore_class + bore_mm, axial_adjust, radial_retention, observance, form
  (sku|harvested), one_off, part.kind values, socket_bridge, product_family, product_variant.

If the community has NO settled word for something, SAY SO. That is a finding, not a failure —
it tells us where we have to teach a word instead of borrow one.

READABILITY, second half of the job. The rendered diagram is a 16-entity hairball with 26
crossing relationship lines. Naming alone won't fix it. Assess whether to split it into
audience-scoped views — e.g. catalog / compatibility / collection — instead of one canvas, and
whether entity ORDER in the file can reduce edge crossings. Note that Eraser reorders columns
within an entity on render and that ERD entities appear to have no `[label:]` property, so a
"friendly" view likely means a separate file with renamed identifiers — verify that before
relying on it.

DELIVERABLES:
- `.notes/vocabulary-lexicon.md` — the mapping table (internal → recommended label → definition →
  evidence), plus a short RECOMMENDATION at the top answering the A/B/C question.
- If A or C wins: `.notes/data-model-erd-public.eraser` — a second pastable diagram, buyer-facing
  labels, same structure, same house style as data-model-erd-clean.eraser.

CONSTRAINTS:
- Do NOT advance the data-model interview. Sittings 4–5 are open and two soft decisions are
  unratified; naming must not quietly settle them.
- Do NOT rename anything in `.notes/data-model-erd.md`. Propose and stop, as the eraser thread did.
- Keep `fk`, `null`, and the `//` comments — all verified legal against the renderer.
- A label change that loses a distinction the model fought for is a REGRESSION, not a
  simplification. `advance_mechanism` vs `actuator` were split for a reason; `socket` is
  model-level, never brand-level. Flag any collision instead of collapsing it.
- This repo's AGENTS.md requires `pnpm format` after documentation-only changes.
```

---

## Where things stand (for whoever picks this up)

- **Sittings 0–3 COMPLETE**; Sitting 3 closed 2026-08-12. **Next is Sitting 4** (provenance &
  curation); 4.2 is already dissolved.
- **Two soft decisions unratified:** 3.2b's tip-option override, and the `slot_option` → `part`
  merge. Both applied to the ERD, neither explicitly confirmed.
- **The eraser.io thread is done.** DSL grammar is verified, the in-place write path exists
  (`PUT /api/files/{fileId}/diagrams/{diagramId}`), automation was recommended but **not wired** —
  no `.mcp.json` in this repo. See `.notes/eraser-integration-findings.md`.
- **One known defect** still unpatched in `data-model-erd.md`: a missing FK edge,
  `socket_bridge.scope_tip_option_id > tip_option.id`. It is already present in
  `data-model-erd-clean.eraser`.
- **Parked, blocking nothing:** measurement round 1 · Autmog's 2.5 mm · the Charpie cartridge ·
  BigIDesign's pencil mechanism · whether the Modern Fuel aBAP needs a tip swap for Parker ·
  whether Autmog's 36 Clipless is a different body.
