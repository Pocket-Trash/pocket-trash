# Research findings — pen/refill data model

Deep-research pass feeding `.notes/data-model-question-sketch.md`. Output is the tight
question set in `.notes/data-model-questions.md`.

Local scratch, git-excluded. Researched: 2026-08-10.

**Scope researched:** ballpoint / gel / rollerball refill pens. Fountain pens excluded
(one finding crosses that line anyway — see F4).

---

## TL;DR — the six findings that change the schema

1. **`needs` must be a set.** NTI's own instruction is "swap the spring **and** tip,
   **and** trim the cartridge" — three needs on one edge, which our single-select can't
   hold. The vocabulary that survives BVG's scoping: **spacer, trim (with an amount),
   adapter, tip swap, spring swap** — and tip+spring almost always ship as one kit.
   *(Scoped out by BVG 2026-08-10: sanding a collar, plugging a rear hole, magnet seating,
   collets, washers. Recorded in section D/E below for the record, not modelled.)*
2. **Fit has a real third axis: rear/nock geometry.** Bore Ø and internal length are
   necessary and insufficient. **Confirmed by BVG:** Juice Up and Pilot Precise are
   correct-socket G2 refills that still don't work in a general G2 pen, because of the
   back plastic plug. Karas Retrakt is the mirror image from the pen side — refills with
   an open rear instead of a plug won't drive the click mechanism. This is a pen-mechanism
   × refill-rear-end interaction, and it means the socket join gets these pairs *wrong*
   unless we can record a negative.
3. **Archetype is a property of the body, not the maker.** Tactile Turn's Standard is
   semi-general and its Mini takes Pilot G2 Mini only; Fellhoelter's Full Size TiBolt is
   Schmidt-only while the G2 TiBolt is Pilot G2 Mini-only. Same maker, two archetypes. The
   table in the working notes assigns archetypes per maker; it has to move down to the
   product.
4. **There is a fourth archetype: clamped/collet.** BigIDesign's Ti Arto takes 800+
   refills via an "automatically adjusting collet" and explicitly markets **no wiggle**.
   That breaks our assumption that universal ⇒ wiggle. Retention mechanism (bore-fit vs
   clamped) is a separate axis from bore class, and its length adjustment is *continuous*,
   not discrete.
5. **Real published compat lists use inheritance + exceptions.** Tactile Turn publishes
   one list for Standard and defines Slim as "that list, minus the ones marked `**`". If
   we store flat per-tip-option edges we duplicate ~40 rows per body variant.
6. **Makers already publish exactly the graded output we planned** — and they add a grade
   we don't have. NTI splits "OEM (recommended)" from "also compatible" and disclaims the
   latter: *"NTI doesn't guarantee all listed inks match OEM precision. Our pens are
   designed around the ink they ship with."* That's `toleranced_for` plus a confidence
   tier, from the maker, unprompted.

---

## A. Maker roster & archetype placement

~25 makers surveyed. Placement against our three archetypes:

| Maker | Body/model | Refill posture | Archetype |
|---|---|---|---|
| Autmog | per-size bodies, per-refill bore | one refill, 2.5mm bore ±25µm | hyper-specific |
| Bastion | BAP | proprietary; "only *approximately* Parker-size; not all Parker refills fit" | **near-standard (new)** |
| Fellhoelter | TiBolt / G2 TiBolt / TiNyBolt | one refill per body + official G2 conversion kit | hyper-specific per body, semi-general per line |
| Nottingham Tactical | Parker Mid-Size, G2 Full Size | published chart, OEM vs also-compatible | semi-general |
| Tactile Turn | Short / Standard / Longer / Mini / Slim | published per-length lists + trim amounts | semi-general |
| Karas | Render K, Retrakt, Bolt | Parker or G2 variants | semi-general |
| Grimsmo | Saga | Schmidt P900/EasyFlow, Parker-style | hyper-specific-ish |
| BigIDesign | Ti Arto, Ti Arto EDC, BAP | collet clamp, 800+ refills, no wiggle | **clamped/universal (new)** |
| Modern Fuel | BAP | continuously adjustable, Space Pen → G2 | **clamped/universal (new)** |
| Spoke Design | Model CX, Clickstream, Model 2 | spring-behind-refill tolerates length spread | universal-ish |
| Ti2 Design | Techliner, BoltLiner | magnets + spacers conversion kit | semi-general |
| Schon DSGN | Machined Pen v2, Pocket Six | **swappable section changes the pen's category** | see F4 |
| Riind, Billetspin, Refyne, Ridge, Honeybadger, Smooth Precision, Suprlativ, KeySmart, CountyComm, Smootherpro, The Right Choice, Brad Gruss, CW&T, Machine Era | — | mostly Parker or G2, single socket | hyper-specific / semi-general |

**Answers to A:** the three archetypes do *not* cover the field. Two additions are needed —
**clamped** (BigIDesign, Modern Fuel: universal *without* wiggle) and **near-standard**
(Bastion: declares Parker, isn't reliably Parker). And archetype belongs on the product,
not the maker (finding 3).

> **Correction (BVG, 2026-08-10):** NTI's G2 pen is **full size G2, not Mini**. The
> per-body archetype case rests on Tactile Turn (Standard vs Mini) and Fellhoelter
> (Full Size TiBolt vs G2 TiBolt) instead.

---

## B. Sockets

### Confirmed nominal dimensions

| Socket | Length | Ø | Notes |
|---|---|---|---|
| parker-style (ISO 12757 "G2") | 98.0–99.0 mm (nominal 98.1) | 5.8–6.0 mm | front section 23.2 mm; 50+ conforming refills |
| euro/G2 rollerball (Pilot G2, Schmidt 888/5888, EnerGel, Signo) | ~110 mm | — | see the Japanese/European split below |
| pilot-g2-mini | ~0.7″ (≈18 mm) shorter than Parker-style | — | genuinely its own body on NTI + TT |
| d1 | 66–67 mm | 2.3 mm | multipens, mini pens |
| Hi-Tec-C | — | — | CW&T Pen Type-A is built around it |
| Fisher Space Pen PR | shortened, thinned G2, metal body | — | ships with a Parker adapter |
| Lamy M22 | — | — | Fellhoelter TiNyBolt is built around it |
| Cross slim gel | 4.375″ (111 mm) | — | own family |

### The seeded socket list needs work

- **`energel` is probably not its own socket.** Every reference groups EnerGel into the
  ~110 mm euro/G2 rollerball family alongside Pilot G2, Schmidt 888/5888, Uni Signo and
  Zebra. NTI lists EnerGel as compatible with its *G2 Full Size* body. Under our own rule
  (a socket earns a row when pens are built around it) EnerGel squeaks in only because
  Autmog builds a body for the 0.5 mm needle specifically — which is the *hyper-specific*
  pattern, i.e. `toleranced_for`, not a socket.
- **`pilot-g2` may be misnamed.** What our seed calls `pilot-g2` behaves in every maker's
  chart like the ~110 mm euro/gel-rollerball socket, of which Pilot G2 is one occupant.
  Naming the socket after one brand's refill rebuilds the exact trap the alias list exists
  to defuse.
- **Sockets that earn a row under our rule but aren't seeded:** Hi-Tec-C (CW&T),
  Fisher Space Pen PR (Fellhoelter TiNyBolt, KeySmart Tactiv), Lamy M22 (Fellhoelter
  TiNyBolt). Fisher PR and Lamy M22 may be one socket.
- **A split inside the 110 mm family:** Japanese refills are documented as *not*
  interchangeable with European ones despite matching length, because of tight interior
  clearance. That's a real socket boundary hiding inside one nominal envelope.

### Variance is real and documented

Parker-style spans 98–99 mm across brands, and the failure modes are specific, not fuzzy:
refills too long "because of the fins on the end"; Mont Blanc refills carry threads near
the tip that alternatives don't replicate. Bastion ships a body that declares Parker and
rejects some Parker refills. **Autmog is not the only maker where per-refill tolerancing
matters** — it's just the only one honest enough to publish the number (2.5 mm bore,
0.001″ / 25 µm tolerance).

---

## C. Tips & bore

- **Tips are sold separately and are real inventory.** Fellhoelter sells TiBolt tips
  (incl. MokuTi) and a G2 Adapter Kit = tip + spring + adapter/spacer + refill. NTI sells
  a "G2 Spring & Pen Tip" and a G2 Adapter Kit with material options. Tactile Turn sells
  a Parker-Style Refill Adapter. So a tip option is a purchasable SKU, not just an
  attribute.
- **Tip swaps come bundled with a spring swap.** Both NTI and Fellhoelter ship tip +
  spring together, because bore and spring geometry are coupled. Our slot vocabulary has
  no spring.
- **The refill's own front-end shape is a matching axis.** The incoherency tool classifies
  by tip profile — stepped cone / long gel cone / rollerball plug / D1 / Cross-style /
  Fisher-style. That's the refill side of the same question as our pen-side nose shape.
- **`precision / standard / wide` is too coarse to explain observed failures.** Autmog
  distinguishes fit at the 0.001″ level; Ti2's BoltLiner at 9.5 mm body Ø excludes refills
  a 10.9 mm body accepts. Bore class as a 3-way enum can't carry either.
- **No evidence found of cross-maker tip interchange.** Tips appear strictly in-house.
  Parts *within* a maker are broadly cross-model, though — Tactile Turn markets clips,
  bolts, springs, back pieces and o-rings as universal across their pen lines.

---

## D. Length adjustment

Two mechanically different things are both called "adjustment":

- **Discrete** — a specific spacer or adapter part (Fellhoelter G2 kit, Ti2 conversion kit
  with magnets + spacers, Tactile Turn Parker adapter, Spoke Clickstream's white washer).
- **Continuous** — a collet or thread that covers a *range* (BigIDesign Ti Arto; Modern
  Fuel spanning Space Pen through G2; Spoke's spring-behind-refill tolerating spread).

So D's "range or discrete?" is answered **both**, and the schema needs both shapes.

Vocabulary gaps in `none | spacer | internal_screw | extender`: **collet/clamp**,
**adapter** (distinct from spacer — it changes the socket, not the length), **magnet**
(Ti2), **spring swap**, and **washer/diameter expander** (Spoke's washer is a *diameter*
stabiliser, not a length part, which means diameter adjustment exists too).

> **Scoping (BVG, 2026-08-10):** of those, only **adapter** and **spring swap** get
> modelled. Collet, magnet and washer are recorded here as observed behaviour but stay out
> of the `needs` vocabulary. Note this leaves the *clamped archetype* (finding 4) still on
> the table — a collet is a pen mechanism, not something an owner does to a refill.

Spacers are **strictly in-house** in everything found — every kit is maker-branded and
model-specific. One exception worth noting: a **3D-printed community adapter** enables D1
refills in Tactile Turn Minis. Aftermarket fit parts exist and aren't maker-supplied.

---

## E. Fit grades

**Trimming is mainstream and maker-documented — not a niche hack.** Tactile Turn has an
official support article on trimming a Pilot G2 for Short bodies (~2 mm off the top to
match the Schmidt). NTI instructs trimming for G2-in-Parker. Multiple makers (Smooth
Precision, The Right Choice, BilletSpin, Tactile Turn) are documented as needing an
EnerGel trim. It ships at launch.

**Trim needs an amount and a reference.** Real instructions are "trim 1–2 mm", "trim about
2 mm from the top", "trim to Parker ballpoint length", "trim to Hi-Tec-C length". A
boolean `trim` throws away the only part owners need.

**Wiggle is a marketing battleground, not a shrug.** BigIDesign leads with "no refill
tip-wiggle"; Autmog leads with 25 µm; the halffull survey singles out the collet as
solving rattle. Treating `loose` as a plain pass is out of step with how the market talks.

**Fit failures the two axes don't explain — all documented.** The first row is the one BVG
confirmed independently and the only one that has to be modelled; the rest are recorded as
evidence that it isn't a one-off.

| Failure | Example |
|---|---|
| **Rear plug / nock geometry** ✅ | **BVG: Juice Up and Pilot Precise are correct-socket G2 refills that don't work in a general G2 pen, because of the back plastic plug.** Mirror image from the pen side: Karas Retrakt rejects refills with an open rear hole instead of a plug — they won't drive the click mech |
| Fins on the refill's rear end | Parker-style refills too long for some bodies specifically because of the end fins |
| Collar / ferrule Ø | Uni Jetstream's collar is fatter; needs sanding — and "cutting the collar off seems to affect how the refill writes" |
| Threads near the tip | Mont Blanc refills; alternatives don't replicate, tip sits back |
| Internal clearance | Lamy 2000 — Schmidt P8126 "hits the metal tension ring inside the barrel" |
| Spring mismatch | Tactile Turn Side Click + Signo DX needs a narrower, thinner-wire spring |
| Ink/mechanism interaction | Ti2 Techliner — Jetstream fits fine but the magnet causes ink-flow problems with hybrid ink |

That last one is the clearest case of **"fits but you shouldn't"** — a physical pass with a
functional fail. There's a second flavour: sanding the Jetstream collar works but degrades
writing. Both argue for a grade or flag beyond the five.

---

## F. Product identity

- **Size-as-identity holds broadly.** Tactile Turn names lengths (Short / Standard /
  Longer / Mini) and diameters (Slim) and treats them as separate products with different
  compat. NTI names bodies by refill+size ("Parker Mid-Size 5\"", "G2 Full Size 5½\"").
  Fellhoelter names by size (TiBolt / TiNyBolt).
- **F4 — Schon DSGN breaks "Product = the body."** The Classic Machined Pen v2 is
  cross-compatible with Pocket Six **fountain pen and rollerball sections**, so the buyer
  swaps a section and the same body becomes a fountain pen, a rollerball, or a ballpoint.
  A slot pick changes the **category** — and category is supposed to be the template that
  decides which slots are legal. Schon also runs an explicit "Build Your Own Pocket Six"
  configurator.
- **NTI's Parker Mid-Size converts to a mechanical pencil** (LeadSlinger kit) "and back
  again." Same problem from a different angle: the socket stops being a refill socket.
- **Autmog's product copy is inconsistent listing-to-listing.** The bore/tolerance
  sentence appears on some listings and not others; compat lives in free-text prose, not a
  field. Scraper implication: extract, don't map.

---

## G. Slots

Parts actually sold as separate SKUs, across makers: **tip/nose, clip, bolt, spring,
back piece, o-ring, toggle switch, grip/section, adapter, spacer, conversion kit**.
Springs, back pieces, o-rings and toggles are all absent from our slot list.

Tactile Turn's spare parts are "universally interchangeable across their pen lines" —
i.e. slot options are scoped to the **maker**, not the product. Modelling options
per-product duplicates every clip and bolt across the catalog.

---

## H. Refill catalog

- Refill identity in the wild = **brand + model + tip size + ink colour + ink type**,
  exactly the "one loose Product with options" call already made.
- therefillguide.com indexes 150+ brands **by length** (35.8 mm → 143.5 mm, plus "Unknown"
  and "Variable"). Length-as-primary-key is a live pattern.
- Ink type distinctions that matter functionally, not just cosmetically: ballpoint /
  gel / hybrid / rollerball / **pressurized** (Fisher, Schmidt P950) — and hybrid ink is
  what broke the Ti2 magnet case.
- Tip sizes cluster at 0.38 / 0.5 / 0.7 / 1.0 mm, and NTI publishes a use-case gloss per
  size (planners / journaling / daily / signatures).

---

## I. Provenance — what already exists

| Source | Shape | Notes |
|---|---|---|
| BigIDesign refill sheet | public Google Sheet, ~800 rows | brand + model + tip size + colour per row |
| NTI ink cartridge guide | per-body, OEM vs also-compatible, with needs | closest thing to our schema in the wild |
| Tactile Turn refill lists | per-length, "without modification" vs "requires trimming (1–2 mm)", `**` exceptions | inheritance pattern |
| therefillguide.com | 150+ brands indexed by length | dimensional taxonomy |
| penboutique chart | brand × refill, **binary** | no grading |
| stationery.wiki | wiki pages per format | its G2 page **does not distinguish** Parker G2 from Pilot G2 — the trap is live in the wild |
| pensandplanes "Pen Hacks" | per pen × refill, with technique | the tacit-knowledge corpus, closest to what we'd generate |
| halffull.org bolt-action survey | community comparison | author *corrected* an entry after feedback — a live provenance loop |

**Prior art on the derived-vs-declared call:** tools.incoherency.co.uk's "Pen Refill
Compatibility Finder" does exactly what we decided against — dimensional matching with
**scoring** (69 points primary match, 20–41 for "stretch" matches), across ~6 refill
families. It's thin (families, not products) and it can't know about rear-hole geometry or
magnets, which is decent evidence our "declared, not derived" call is right — but it means
a competitor exists and the differentiator is the assertion corpus, not the idea.

No single comprehensive crowdsourced pen↔refill database was found. The knowledge is
fragmented across maker charts, one blog's hack list, and forum posts. **That gap is the
product.**

---

## Sources

Makers: [Nottingham Tactical ink guide](https://nottinghamtactical.com/pages/ink-cartridge-guide) ·
[Tactile Turn ink refills](https://tactileturn.com/pages/ink-refills) ·
[Tactile Turn spare parts](https://tactileturn.com/collections/spare-parts) ·
[Tactile Turn trim guide](https://support.tactileturn.com/hc/en-us/articles/5191339957133-How-to-trim-a-Pilot-G2-ink-refill-for-a-Short-length-pen) ·
[BigIDesign Ti Arto](https://bigidesign.com/products/ti-arto-edc-pen) ·
[Ti Arto refill sheet](https://docs.google.com/spreadsheets/d/10V76z_kVRp9k-urphTYaavsk-VSZ5ZglGAeUs0Qp2u8/edit) ·
[Fellhoelter refills](https://fellhoelter.com/products/ink-refills) ·
[Fellhoelter G2 adapter kit](https://fellhoelter.com/products/tibolt-g2-adapter-kit) ·
[Autmog 40 Clipless](https://www.autmog.com/products/40-clipless-click-pen-6061-aluminum-conical-nose-pilot-g2) ·
[Schon DSGN Machined Pen v2](https://www.schondsgn.com/collections/fountain-pens/products/the-machined-pen-v2-the-anniversary-edition-roller-and-fountain-pen) ·
[Spoke Clickstream](https://spokedesign.com/collections/clickstream) ·
[BilletSpin Fusion](https://www.billetspin.com/fusion)

Formats & data: [stationery.wiki G2](https://stationery.wiki/G2) ·
[The Refill Guide (98mm)](https://www.therefillguide.com/product-category/length/98mm/) ·
[Pen Boutique compat chart](https://www.penboutique.com/pages/refill-compatibility-chart) ·
[Unsharpen Parker-style](https://unsharpen.com/refill_type/parker-style/) ·
[Well-Appointed Desk Epic Refill Guide](https://www.wellappointeddesk.com/2014/06/epic-refill-guide-rollerball-gel-and-ballpoints/) ·
[Muze Pens on Parker-style](https://www.muzepens.com/blogs/news/all-about-parker-style-g2-ballpoint-pen-refills)

Community & prior art: [halffull.org bolt-action survey](https://halffull.org/2023/01/10/a-survey-of-bolt-action-pens/) ·
[Pens and Planes — Pen Hacks](https://pensandplanes.com/pen-hacks/) ·
[Refill Compatibility Finder](https://tools.incoherency.co.uk/pen-refill-compatibility-finder) ·
[JetPens best machined pens](https://www.jetpens.com/blog/The-Best-Machined-Pens/pt/973)
