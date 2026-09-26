#!/usr/bin/env python3
"""Validate .eraser ERD files: every relationship endpoint must resolve to a
declared entity and an existing column. Also reports entity/edge counts.

    python3 .notes/validate-eraser.py     # exit 0 = all endpoints resolve

Written 2026-08-14 (Sitting 5), extended 2026-08-15. It catches a moved or
renamed column that a relationship line still points at, AND it now checks
that the files agree with each other — the two schema-of-record files are the
same schema, the full public view matches through the rename map, and every
scoped view is a genuine subset. That last part used to be "still a read".

Column ORDER is deliberately ignored: Eraser reorders columns within an entity
on render, so order carries no meaning.

Add every new .eraser file to FILES below or it goes unchecked.
"""
import re
import sys
from pathlib import Path

NOTES = Path(__file__).resolve().parent
REPO = NOTES.parent

# Working corpus — git-excluded scratch.
FILES = [
    NOTES / "data-model-erd-clean.eraser",
    NOTES / "data-model-erd-public.eraser",
    NOTES / "data-model-erd-public-catalog.eraser",
    NOTES / "data-model-erd-public-compatibility.eraser",
    # The three REVIEW views were moved into the repo 2026-08-15 so the team can
    # reference them — .notes/ is git-excluded and nothing in it ships. They are
    # checked here exactly as before; only the path changed.
    REPO / "docs/data-model/fit.eraser",
    REPO / "docs/data-model/remedies.eraser",
    REPO / "docs/data-model/collection.eraser",
]

ENTITY_RE = re.compile(r"^(\w+)\s*(\[[^\]]*\])?\s*\{\s*$")
REL_RE = re.compile(r"^(\w+)\.(\w+)\s*[<>-]+\s*(\w+)\.(\w+)\s*$")


def strip_comment(line):
    return line.split("//")[0].rstrip()


def parse(path, fenced=False):
    entities, rels = {}, []
    current = None
    lines = path.read_text().splitlines()
    if fenced:
        start = next(i for i, l in enumerate(lines) if l.strip() == "```eraser")
        end = next(i for i, l in enumerate(lines[start + 1:], start + 1) if l.strip() == "```")
        lines = lines[start + 1:end]
    for raw in lines:
        line = strip_comment(raw).strip()
        if not line:
            continue
        if current is not None:
            if line == "}":
                current = None
            else:
                col = line.split()[0]
                entities[current].append(col)
            continue
        m = ENTITY_RE.match(line)
        if m:
            current = m.group(1)
            entities[current] = []
            continue
        m = REL_RE.match(line)
        if m:
            rels.append(m.groups())
    return entities, rels


def check(label, entities, rels):
    errs = []
    for src_e, src_c, dst_e, dst_c in rels:
        for e, c in ((src_e, src_c), (dst_e, dst_c)):
            if e not in entities:
                errs.append(f"  MISSING ENTITY  {e} (in {src_e}.{src_c} > {dst_e}.{dst_c})")
            elif c not in entities[e]:
                errs.append(f"  MISSING COLUMN  {e}.{c}")
    shells = [e for e, cols in entities.items() if not cols]
    real = len(entities) - len(shells)
    print(f"{label}: {len(entities)} declared blocks "
          f"({real} entities + {len(shells)} shell{'s' if len(shells) != 1 else ''}) "
          f"· {len(rels)} edges")
    for e in errs:
        print(e)
    return errs


failed = False
parsed = {}
for name in FILES:
    ents, rels = parse(name)
    parsed[name.name] = (ents, rels)
    if check(name.name, ents, rels):
        failed = True

ents, rels = parse(NOTES / "data-model-erd.md", fenced=True)
parsed["data-model-erd.md"] = (ents, rels)
if check("data-model-erd.md (fenced block)", ents, rels):
    failed = True


# ── cross-file agreement ────────────────────────────────────────────
# Added 2026-08-14. This used to be "still a read"; it is now checked.
# Column ORDER is deliberately ignored — Eraser reorders columns within an
# entity on render (verified 2026-08-12), so order carries no meaning.

# schema name -> buyer-facing name in the public views (lexicon section 3b)
RENAME = {
    "product": "pen",
    "product_family": "pen_size",
    "tip_option": "tip",
    "product_variant": "pen_finish",
    "refill_variant": "refill_option",
    "rebrand": "also_sold_as",
    "refill_dimension": "refill_measurement",
    "fit_report": "report",
    "user": "owner",
    "collection_item": "my_pen",
}


def cross(label, problems):
    print(f"{label}: {'OK' if not problems else 'MISMATCH'}")
    for p in problems:
        print(f"  {p}")
    return problems


def edge_shape(rels, rename=False):
    return sorted(
        (RENAME.get(a, a) if rename else a, RENAME.get(c, c) if rename else c)
        for a, _, c, _ in rels
    )


clean_e, clean_r = parsed["data-model-erd-clean.eraser"]
md_e, md_r = parsed["data-model-erd.md"]
pub_e, pub_r = parsed["data-model-erd-public.eraser"]

# 1. the two schema-of-record files must be the same schema
problems = []
if set(clean_e) != set(md_e):
    problems.append(f"entities differ: {set(clean_e) ^ set(md_e)}")
for e in sorted(set(clean_e) & set(md_e)):
    if set(clean_e[e]) != set(md_e[e]):
        problems.append(f"{e} columns differ: {set(clean_e[e]) ^ set(md_e[e])}")
if sorted(clean_r) != sorted(md_r):
    problems.append("edges differ")
if cross("clean .eraser == data-model-erd.md fenced block", problems):
    failed = True

# 2. the full public view must be the same shape, renamed
problems = []
mapped = {RENAME.get(e, e) for e in clean_e}
if mapped != set(pub_e):
    problems.append(f"entities: only in clean {sorted(mapped - set(pub_e))}, "
                    f"only in public {sorted(set(pub_e) - mapped)}")
if edge_shape(clean_r, rename=True) != edge_shape(pub_r):
    problems.append("edge shape differs (entity-to-entity, ignoring column names)")
if cross("public .eraser == clean, through the rename map", problems):
    failed = True

# 3. every scoped view must be a subset of the full public view
pub_edges = set(edge_shape(pub_r))
for path in FILES:
    name = path.name
    if name in ("data-model-erd-clean.eraser", "data-model-erd-public.eraser"):
        continue
    ents, rels = parsed[name]
    problems = []
    extra_e = set(ents) - set(pub_e)
    extra_r = set(edge_shape(rels)) - pub_edges
    if extra_e:
        problems.append(f"entities absent from the full view: {sorted(extra_e)}")
    if extra_r:
        problems.append(f"edges absent from the full view: {sorted(extra_r)}")
    if cross(f"{name} is a subset of the full public view", problems):
        failed = True

sys.exit(1 if failed else 0)
