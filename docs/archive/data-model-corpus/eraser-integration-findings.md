# Eraser.io integration — findings

**Researched 2026-08-12.** Answers the six questions in `.notes/eraser-research-prompt.md`.

**Scope guard:** this thread did **not** modify `.notes/data-model-erd.md` and did **not** advance
the data-model interview. Proposed DSL fixes are listed in [Proposed patch](#proposed-patch--not-applied)
and stopped there.

---

## RECOMMENDATION

> ### Automate **now** — via the free MCP path, not a CI pipeline.
>
> **Revised 2026-08-12 after the probe rendered.** The first draft of this file said *automate
> later*, on the grounds that our DSL had never been validated and might not render. It renders.
> Every construct we were worried about is legal. That blocker is gone, and with it the reason
> to wait.

**Both preconditions are now met:**

1. **The write path does what we need.** `PUT /api/files/{fileId}/diagrams/{diagramId}` updates a
   diagram **in place, at a stable URL** — same fileId, same diagramId, same link. One canonical
   diagram across sittings is exactly the supported case. See [Q2](#q2--write-path).
2. **Our file is valid DSL.** The probe confirmed `fk`, `null`, `fk null`, inline `//` inside
   entity blocks, multi-line comment runs, heavy comment punctuation, icons and colours **all
   render correctly**. No restructuring is required. See [Q4](#q4--dsl-fidelity).

**And the cost objection doesn't survive either.** The MCP server's *deterministic* diagram
create/read/update/delete consumes **no AI credits and needs no paid token** — only the
natural-language generate/edit tools bill. The in-place write is reachable at **$0**.

**Concrete next step — ~10 minutes:**

```bash
claude mcp add --transport http eraser https://app.eraser.io/api/mcp
```

Then restart the session, complete the OAuth prompt, create the canonical ERD file once, and
record its `fileId` / `diagramId` at the top of `data-model-erd.md`. Every sitting after that is
one deterministic update against the same URL.

**Verify one thing during setup:** that the MCP server really does expose a *deterministic* diagram
update taking DSL wholesale. Eraser documents its tools by capability rather than by name, so this
is documented but not something this thread could confirm firsthand. If it turns out only the
natural-language editor is exposed, **stop** — do not let an AI editor rewrite hand-authored
decisions — and treat the $15/user/mo Starter tier (for the REST `PUT`) as a separate decision.

**Two caveats that are decisions, not details:**

- **Free plan = 3 files, 7-day version history, and no private files.** A public link for a
  public-catalogue project's schema is probably fine, but it is a choice worth making deliberately.
- **Do not wire this into CI.** Interactive OAuth is right for an agent-in-the-loop sitting and
  unusable headless. The value here is "the agent updates the diagram as decisions land," not
  "the build publishes a diagram."

**What automation is worth, concretely:** Sittings 4 and 5 are still open, two soft decisions are
unratified, and this repo already hand-exports a *second* set of diagrams
(`docs/infra-diagrams/*.png`, from `docs/infrastructure-diagram.eraser`). The manual round-trip
has more than one consumer and more than a couple of iterations left in it.

---

## Q1 — Integration surface

Four surfaces. Two are agent-facing, two are plumbing.

| Surface | What it is | Auth | Plan needed | Status |
|---|---|---|---|---|
| **MCP server** | HTTP MCP at `https://app.eraser.io/api/mcp`. File + diagram + folder CRUD, full-text search, AI generate/edit, export. | **OAuth** (browser prompt on first connect), or API key for headless | **Free** — subject to the same free-tier limits as in-app use | GA |
| **Agent Skills** | `SKILL.md` that teaches an agent Eraser syntax + how to call `/render/elements` | Optional API key | Free, but **without a key output is watermarked and low-resolution** | GA |
| **REST API** | Full API: render, file/diagram/folder CRUD, usage reports, audit logs | `Authorization: Bearer <token>` | **Paid teams only** — tokens cannot be generated on Free | GA |
| **GitHub app / CLI** | **Does not exist.** Not offered as an agent integration. | — | — | — |

**Setup (documented, not performed — you chose to defer):**

```bash
# MCP server — Claude Code
claude mcp add --transport http eraser https://app.eraser.io/api/mcp
```

```json
// or, project-scoped, in .mcp.json at the repo root
{
  "mcpServers": {
    "eraser": {
      "type": "http",
      "url": "https://app.eraser.io/api/mcp"
    }
  }
}
```

```bash
# Agent Skills — alternative, lighter
npx skills add eraserlabs/eraser-io
```

Notes for whoever wires this up:

- This repo has **no `.mcp.json` today** — Linear runs through the claude.ai web connector, not a
  project-scoped server. Adding one establishes a new pattern and would be committed and shared.
- MCP servers require a **session restart** to load.
- The Skills route is the weaker of the two here: it renders through `/render/elements`, which is
  the *stateless* endpoint. It cannot update a canonical diagram. It is a "generate me a picture"
  tool, not a "keep this diagram current" tool.

---

## Q2 — Write path

**This was the deciding question. The answer is yes.**

| Endpoint | Method | Behaviour |
|---|---|---|
| `/api/files/{fileId}/diagrams/{diagramId}` | **PUT** | **Updates in place.** Body is `{ "code": "<DSL>" }`. Same `fileId`, same `diagramId`, **same `diagramUrl`.** Returns `id`, `diagramUrl`, `diagramType`, `code`, `updatedAt`. |
| `/api/files/{fileId}/diagrams` | POST | Creates a *new* diagram inside an existing file |
| `/api/render/elements` | POST | **Stateless.** Renders DSL → PNG. Creates nothing durable. |

So the workflow we want is real: create the canonical diagram once, record its `fileId` and
`diagramId`, and every subsequent sitting is one `PUT` against the same URL. Nothing is re-minted,
no links rot.

**The trap to avoid:** `/api/render/elements` is the endpoint that shows up first in the docs and
in the Skills integration, and it is the *wrong one* for us. Each call produces a throwaway image.
Its `createEraserFileUrl` is merely a link a human can click to create a new file, and
`fileOptions.create: true` creates a **new** file every call. Building on that endpoint is exactly
how you end up with forty orphaned diagrams and no canonical one.

**Free vs paid on the write path:** the REST `PUT` needs a paid token, but the **MCP server exposes
deterministic diagram create/read/update/delete and consumes no AI credits** — only the natural-language
generate/edit/export tools do. So the in-place update is reachable on the free tier through MCP.
Caveats: OAuth is interactive (fine for an agent-in-the-loop sitting, unusable in CI), and the free
plan caps you at **3 files, 7-day version history, and no private files**.

⚠️ Do **not** use the MCP server's *AI diagram editing* ("edit this diagram with natural language")
on the canonical ERD. It is non-deterministic and would silently rewrite hand-authored decisions.
The deterministic `update diagram` operation — which takes DSL wholesale — is the one to use.

---

## Q3 — Read path

- **Export:** PNG and JPEG, via the MCP server and via `/api/render/elements` (`imageUrl` in the
  response, or `returnImageAsFile` for a stream). Options: `theme` light/dark, `background`
  on/off, `imageQuality` 1–3.
- **SVG / PDF: not documented** for the API. Treat as unavailable.
- **Reading DSL back:** yes — the get-diagram endpoint returns `code`, so the stored DSL is
  round-trippable. That matters for lock-in (Q6): the file is never trapped in the canvas.
- **Committing a rendered image:** entirely doable, and there is precedent in this repo —
  `docs/infra-diagrams/*.png` are committed exports. They were produced **by hand**, though:
  `scripts/generate-infrastructure-diagram.mjs` only writes `docs/infrastructure-diagram.eraser`
  and stops. Nothing in this repo has ever talked to Eraser over the network.

---

## Q4 — DSL fidelity

### Method

Two sources of truth, both empirical rather than documentary:

1. **A control sample that provably renders** — the `product_pens` / `feature_flags` draft, with
   its exported PNG as proof.
2. **A live probe of our own suspect constructs**, run in `app.eraser.io` on 2026-08-12. Every
   construct our file uses that the control does *not* was isolated into its own entity so a
   failure would be attributable. **It rendered with no errors.**

### Verdict table

**Every construct passes.** Nothing in `data-model-erd.md` is non-standard, deprecated, or
silently ignored.

| Construct | Our file | Status | Evidence |
|---|---|---|---|
| `pk` | ✔ | ✅ **Verified** | Control + probe. Renders as a badge. |
| `unique` | ✘ | ✅ **Verified** | Control only; we never use it. |
| Arbitrary bare-word types | ✔ | ✅ **Verified** | Control uses real enum type names as the type token. Our `enum`, `decimal`, `bool`, `text`, `string` all render. |
| **`fk` as a modifier** | ✔ heavily | ✅ **Verified — supported** | Probe `p2`: renders as a real badge, `maker_id  string fk`. **Not ignored.** |
| **`null` as a modifier** | ✔ heavily | ✅ **Verified — supported** | Probe `p3`: `bore_mm  decimal null`. |
| **`fk null` (two modifiers)** | ✔ | ✅ **Verified — supported** | Probe `p4`: `family_id  string fk null`. Both badges render. |
| **Inline `//` after a column, inside a block** | ✔ everywhere | ✅ **Verified** | Probe `p7`: renders `name  string`, no leakage. |
| **Bare `//` continuation runs inside a block** | ✔ everywhere | ✅ **Verified** | Probe `p8`: exactly three columns rendered; the indented continuation lines produced **no phantom rows**. |
| Non-ASCII / heavy punctuation in comments | ✔ | ✅ **Verified** | Probe `p9`: em-dash, en-dash, `a\|b\|c`, `{}`, `> <`, quotes, apostrophe, ⚠️ × ′ — all stripped cleanly. |
| `[icon: x, color: y]` | ✔ | ✅ **Verified** | Probe `p5`/`p6`. **`factory` resolves to a real icon** — the earlier concern that it wasn't a Feather name was wrong; Eraser's library is larger than Feather. `pen-tool` renders too. Colours apply. |
| `//` at **top level** | ✔ | ✅ **Verified** | Probe `P0` + Eraser's own ERD examples. |
| `notation` / `typeface` / `styleMode` | ✘ | ✅ **Verified** | Probe applied all three. We currently set **none** — so we inherit `chen` notation and render nothing like the draft. Cosmetic, not an error. |
| `title <text>` with `(`, `)`, `;` | ✔ | ⚠️ **Untested** | The trailing `(Sittings 0–3 COMPLETE; 4–5 open)` was removed before the probe was run, so the punctuation was never exercised. Docs say reserved characters need quoting. See the patch. |

### The honest summary

**The file is clean.** The constructs we were most worried about — inline comments inside entity
blocks and the `fk` / `null` modifiers — are not merely tolerated, they are *first-class*: `fk`
and `null` render as visible badges exactly the way `pk` and `unique` do. The annotations that
carry the file's decision provenance survive the lexer intact.

This inverts the earlier assumption that the comments were a liability to be refactored out. They
are safe where they are, and the "restructure into a comment-free block" proposal is **withdrawn**.

The one thing static analysis found, the probe could not: a **missing relationship line**. See
[Q5](#q5--cardinality) and the patch.

### Column order is not preserved

Observed 2026-08-12 on the first full render of the complete model. **Eraser reorders columns in
the rendered entity**, pushing relationship-participating columns toward the edge they connect to.
`part` written as `id, maker_id, family_id, kind, name, source` draws as
`id, kind, name, source, maker_id, family_id`; `compat_edge` and `collection_item` do the same.

Not a defect — a layout optimisation, and the data is unchanged. But it has one real consequence:
**semantic column grouping in the source does not survive into the picture.** The paired
`accepts_length_min_mm` / `accepts_length_max_mm`, or keeping `bore_class` next to `bore_mm`, reads
correctly in the DSL and may not in the render. Anything that *must* be understood as a group
belongs in the Markdown annotations, not in column adjacency.

---

## Q5 — Cardinality

### Operators, settled empirically

Eraser's own docs are **self-contradictory** here: the syntax reference calls `>` *many-to-one*,
while the ERD guide describes the same operator as *one-to-many*. They are describing the same
line from opposite ends.

Your exported PNG settles it. `product_pens.maker_id > makers.id` renders with a **crow's foot on
`product_pens`** and a **`1` on `makers`**. So:

| Written | Means | Renders |
|---|---|---|
| `child.fk > parent.pk` | many children → one parent | `•——1` |
| `a.x < b.y` | one `a` → many `b` | `1——•` |
| `a.x - b.y` | one-to-one | `1——1` (control: `user_settings.user_id - users.id`) |
| `a.x <> b.y` | many-to-many | crow's feet both ends |

### Is our diagram understating its cardinality?

**No — and switching to `<>` would make it wrong.**

Every relationship line in the file is `child.fk > parent.pk`, which is **many-to-one, and correct
in every case.** The prose many-to-many relationships are all already resolved through explicit
associative entities that carry their own attributes:

| Prose m:n | Resolved through | Carries |
|---|---|---|
| pen ↔ socket | `tip_option` | `name`, `toleranced_for_refill_id`, `axial_adjust`, `accepts_length_*` |
| refill ↔ tip_option/socket | `compat_edge` | polarity, fit_quality, trim, necessity, source, verified |
| compat_edge ↔ part | `edge_required_part` | `sourcing`, `necessity` |
| socket ↔ socket | `socket_bridge` | `result_quality`, `scope_tip_option_id` |

`<>` is for an implicit many-to-many where you *don't* model the join. Ours all carry payload, so
they **must** be entities. Two many-to-one edges through a junction is the textbook resolution and
it is what the file already does. **No change needed.**

### The real cardinality gap — optionality, not m:n

What `>` cannot express is **optional vs mandatory**. Eraser documents no `0..1` / `1..1` modifier,
so these all render identically to required relationships:

`product.family_id` · `product.ships_with_refill_id` · `tip_option.toleranced_for_refill_id` ·
`compat_edge.tip_option_id` · `compat_edge.socket_id` · `product_variant.finisher_maker_id` ·
`part.maker_id` · `part.family_id` · `socket_bridge.scope_tip_option_id` ·
`collection_item.installed_refill_id`

Ten nullable FKs, all drawn as if required. This is a **renderer limitation, not a file defect** —
there is no notation to fix it with. The `null` markers in the column list are the only place that
information lives, which is an argument for keeping them *if* the probe shows they survive.

Two things the notation also cannot carry, worth knowing rather than fixing:

- **`compat_edge`'s exclusive arc** — `tip_option_id` and `socket_id` are an either/or scoping
  choice (2.5, most-specific-wins). ERDs have no exclusive-arc notation.
- **`socket_bridge` is directed** — `from_socket_id` / `to_socket_id` both render as plain
  many-to-one against `socket`; the reverse-is-a-separate-row rule is invisible in the picture.

### One genuine omission

`socket_bridge.scope_tip_option_id` is declared `fk null` but has **no relationship line**. Every
other FK in the file has one. See the patch below.

---

## Q6 — Cost and lock-in

**Cost**

| Plan | Annual | Monthly | AI diagrams | Notes |
|---|---|---|---|---|
| Free | $0 | $0 | 3 | **3 files**, 7-day history, **no private files**, no API token |
| Starter | $15/user/mo | $20/user/mo | 40 | Cheapest tier with API access |
| Business | $45/user/mo | $60/user/mo | 250 | |

The relevant number is **$0**, not $15 — MCP's deterministic diagram update needs no token and no
AI credits. The free plan's real constraints are the 3-file cap and that **files cannot be private**.
For a schema diagram of a public-catalogue project that is probably acceptable; it is a decision,
not a detail.

**Lock-in: low.** The DSL is plain text we already keep in git, and the API hands it back on read,
so we are never holding it hostage in a canvas. The genuinely Eraser-specific parts are small:
`[icon:]` / `[color:]`, the global `notation` / `typeface` / `styleMode` lines, and the `<`/`>`/`<>`/`-`
operators.

| Target | Conversion cost | What breaks |
|---|---|---|
| **Mermaid ER** | Low — mechanical | Operators become `\|\|--o{` etc.; icons/colors dropped. **Gains** optionality notation, which Eraser lacks. Renders natively on GitHub *and* in Claude artifacts. |
| **DBML** (dbdiagram.io) | Low | Closest sibling. Native `[pk]`, `[not null]`, `[ref: > table.id]`, and **real support for `Note:`** — the annotation problem solves itself. |
| **PlantUML** | Medium | Verbose; different mental model. |

DBML is the natural escape hatch: it is the one format that natively supports both the nullability
and the per-column annotations we are currently trying to express with unverified modifiers and
inline comments. Worth remembering if the probe comes back badly.

---

## Proposed patch — NOT APPLIED

Per the thread constraint, these are listed and stopped on — **nothing was applied.** The probe
cleared items 3 and 4 from the first draft of this file; both are withdrawn. Two remain, and only
the first is a real defect.

**1. Missing relationship line — unconditional, real omission**

`socket_bridge.scope_tip_option_id` is declared `fk null` but has no relationship line. Every other
FK in the file has one; this is the only orphan.

```diff
  socket_bridge.part_id > part.id
  socket_bridge.from_socket_id > socket.id
  socket_bridge.to_socket_id > socket.id
+ socket_bridge.scope_tip_option_id > tip_option.id
```

**2. Adopt the house-style global block — cosmetic, but the diagram looks wrong without it**

We currently set only `title`, so we inherit `chen` notation and render nothing like the draft.

```diff
  title machinedpens — refill compatibility model
+ notation crows-feet
+ typeface clean
+ styleMode plain
```

**On the title.** Its trailing `(Sittings 0–3 COMPLETE; 4–5 open)` was removed before the probe
ran, so that punctuation was never exercised — and the better fix is to leave it removed:

```diff
- title machinedpens — refill compatibility model (Sittings 0–3 COMPLETE; 4–5 open)
+ title machinedpens — refill compatibility model
```

It is churn state. Baked into the title it goes stale inside any exported PNG the moment Sitting 4
lands, and it is the one string in the file carrying `(`, `)` and `;` past a parser we have not
tested. It belongs in the Markdown around the block, where it already lives. To keep it in the
title anyway, quote the whole thing and confirm it renders:
`title "machinedpens — refill compatibility model (Sittings 0–3 COMPLETE; 4–5 open)"`.

**Withdrawn from the first draft of this file:**

- ~~Restructure into a comment-free DSL block.~~ Inline comments render fine. The annotations stay
  exactly where they are — they were never the liability this file first assumed.
- ~~Drop `fk` / `null`.~~ Both are supported and render as visible badges. Keep them; per
  [Q5](#q5--cardinality), `null` is the only place nullability is recorded at all.

---

## Validation probe — RUN 2026-08-12, PASSED

Run in `app.eraser.io` → Diagram as code → Entity Relationship Diagram. Kept for reproducibility;
also lives standalone at `.notes/eraser-probe.eraser`.

### Result: rendered with no errors. Every suspect construct is legal.

| Probe | Construct | Result |
|---|---|---|
| `P0` | Top-level `//` | ✅ Stripped cleanly |
| `p1` | `pk`, `unique` | ✅ Badges render |
| `p2` | `fk` | ✅ **Supported** — renders as a badge, not ignored |
| `p3` | `null` | ✅ **Supported** — `decimal null` |
| `p4` | `fk null` together | ✅ **Supported** — both badges render |
| `p5` | `[icon: factory, color: blue]` | ✅ **`factory` resolves to a real icon**; colour applies |
| `p6` | `[icon: pen-tool, color: purple]` | ✅ Renders |
| `p7` | Inline `//` after a column, inside a block | ✅ **Clean** — `name  string`, no leakage |
| `p8` | Multi-line `//` continuation run inside a block | ✅ **Clean** — three columns, **no phantom rows** |
| `p9` | Em-dash, `a\|b\|c`, `{}`, `> <`, quotes, apostrophe, ⚠️ × ′ in a comment | ✅ Stripped cleanly |
| — | `>` operator direction | ✅ Crow's foot on the **left** operand, `1` on the right |
| — | `-` operator | ✅ `1——1` |
| — | `title` with `(`, `)`, `;` | ⚠️ **Not tested** — trailing parenthetical was removed before the run |

The `>` result is the third independent confirmation of operator direction, and it settles the
contradiction in Eraser's own docs: `A > B` means **many A to one B**, so our
`child.fk > parent.pk` lines are correct as written.

### The probe

```
title machinedpens — refill compatibility model (Sittings 0–3 COMPLETE; 4–5 open)
notation crows-feet
typeface clean
styleMode plain

// P0 — top-level comment (expected to pass; Eraser's own examples use these)

p1_baseline {
  id string pk
  slug text unique
}

p2_fk_modifier {
  id string pk
  maker_id string fk
}

p3_null_modifier {
  id string pk
  bore_mm decimal null
}

p4_fk_and_null {
  id string pk
  family_id string fk null
}

p5_icons [icon: factory, color: blue] {
  id string pk
}

p6_icons_two [icon: pen-tool, color: purple] {
  id string pk
}

p7_inline_comment {
  id string pk
  name string // trailing comment inside an entity block
}

p8_comment_run {
  id string pk
  actuator enum // first line of a run
                //   indented continuation
                //   second continuation
  bore_class enum
}

p9_comment_punctuation {
  id string pk
  medium enum // 5.1 — em-dash, en–dash, pipes a|b|c, braces {}, angles > <, "quotes", maker's, ⚠️ × ′
}

p1_baseline.id > p2_fk_modifier.id
p3_null_modifier.id - p4_fk_and_null.id
```

### Still worth doing once

Paste the **entire** existing block from `.notes/data-model-erd.md` into a scratch diagram. The
probe proves every *construct* is legal; a full paste proves the *file* is — it catches anything
structural the probe couldn't isolate (a typo'd entity name in a relationship line, a duplicate
entity). Expected to pass.

---

## House style — modeled on your draft

Extracted from the `product_pens` / `feature_flags` draft, which is confirmed-rendering. This is
the target format for the data-model ERD.

| Convention | Draft does | `data-model-erd.md` currently does |
|---|---|---|
| Global block | `title` + `notation crows-feet` + `typeface clean` + `styleMode plain` | `title` only → renders in `chen` |
| Types | Real Postgres types + real enum type names (`bigint`, `timestamptz`, `jsonb`, `theme_mode`) | Abstract (`string`, `enum`, `decimal`, `bool`) |
| Modifiers | `pk` and `unique` only; **FK columns bare** | `pk`, `fk`, `null` — **all three verified legal** |
| Comments | **None in the DSL** | Heavy, inline, multi-line — **verified legal** |
| Icons/colors | None — plain | `[icon:, color:]` throughout |
| Relationships | Grouped at the bottom; `-` for 1:1, `>` for many-to-one | Grouped at the bottom; `>` throughout |

**Converge on:** the global block. That is the only row where the draft is unambiguously right and
we are unambiguously wrong — without `notation crows-feet` we render in `chen` and look like a
different tool's output.

**Diverge deliberately on the rest.** Three of these rows are differences in *purpose*, not quality:

- **Icons and colours — keep.** The draft covers ten flat tables. Our model has five semantic
  layers (catalog / sockets / refills / assertions / collection) and colour is doing real work
  separating them.
- **Comments — keep.** Now that they're verified to render, the argument for stripping them is
  gone. They carry the decision provenance that is the entire reason the file exists.
- **`fk` / `null` — keep.** The draft omits them; we shouldn't. `null` is the *only* place
  nullability is recorded, since the notation can't draw optionality ([Q5](#q5--cardinality)).
- **Abstract types — keep, for now.** Not a defect: the draft documents a schema that exists, ours
  documents one that doesn't yet. `string` / `enum` are correct until the migration is written, at
  which point they should become real Postgres types.

---

## Where the interview stands

Unchanged by this thread — carried forward from `.notes/eraser-research-prompt.md` so this file
stands alone.

- **Sittings 0–3 COMPLETE.** Sitting 3 closed 2026-08-12: 3.1–3.7, socket bridges (c′), and a new
  3.2b (retention/adjustability).
- **Next is Sitting 4** — provenance & curation. 4.2 is already dissolved.
- **Two soft decisions**, flagged in the answers file's resume block: 3.2b's tip-option override
  and the `slot_option` → `part` merge. Both applied to the ERD, neither explicitly ratified.
- **Parked, blocking nothing:** measurement round 1 · Autmog's 2.5 mm · the Charpie cartridge ·
  BigIDesign's pencil mechanism · whether the Modern Fuel aBAP needs a tip swap for Parker ·
  whether Autmog's 36 Clipless is a different body.

▶ To resume the interview, read `.notes/data-model-answers.md` and start at its **RESUME HERE**
block. Do not resume it from this file.

---

## Sources

- [Using the AI agent integrations](https://docs.eraser.io/docs/using-ai-agent-integrations)
- [MCP Server](https://docs.eraser.io/docs/mcp)
- [API Token](https://docs.eraser.io/reference/api-token)
- [REST API overview](https://docs.eraser.io/reference/getting-started)
- [Eraser DSL → Diagram (`/api/render/elements`)](https://docs.eraser.io/reference/generate-diagram-from-eraser-dsl)
- [Create a diagram in a file](https://docs.eraser.io/reference/create-diagram)
- [Update a diagram](https://docs.eraser.io/reference/update-diagram)
- [ERD syntax](https://docs.eraser.io/docs/syntax-1)
- [ERD examples](https://docs.eraser.io/docs/examples-1)
- [Pricing](https://www.eraser.io/pricing)
- [Agent integrations overview](https://www.eraser.io/agent-integrations)
