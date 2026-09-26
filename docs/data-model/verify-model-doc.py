#!/usr/bin/env python3
"""Check docs/data-model/MODEL.md covers every entity and column in schema.eraser.

    python3 docs/data-model/verify-model-doc.py      # exit 0 = every entity and column is mentioned

Phase 2 of the 2026-08-15 distillation. MODEL.md is prose, so this is a COVERAGE
check, not a structural one: every entity name and every non-house-style column
in docs/data-model/schema.eraser must appear in MODEL.md as a backticked
token. It cannot prove the prose is correct — that is the human review — but it
proves nothing was silently dropped.
"""
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
HOUSE = {"id", "created_at", "updated_at", "slug"}

schema = (REPO / "docs/data-model/schema.eraser").read_text()
doc = (REPO / "docs/data-model/MODEL.md").read_text()

entities, current = {}, None
for raw in schema.splitlines():
    line = raw.split("//")[0].strip()
    if not line:
        continue
    if current is not None:
        if line == "}":
            current = None
        else:
            entities[current].append(line.split()[0])
        continue
    m = re.match(r"^(\w+)\s*(\[[^\]]*\])?\s*\{$", line)
    if m:
        current = m.group(1)
        entities[current] = []

missing_e, missing_c, checked = [], [], 0
for ent, cols in entities.items():
    if f"`{ent}`" not in doc:
        missing_e.append(ent)
    for col in cols:
        if col in HOUSE:
            continue
        checked += 1
        if f"`{col}`" not in doc:
            missing_c.append(f"{ent}.{col}")

print(f"schema:  {len(entities)} entities, {checked} non-house-style columns")
print(f"MODEL.md: {len(doc.splitlines())} lines")
print(f"entities not mentioned: {len(missing_e)}")
for e in missing_e:
    print(f"  MISSING ENTITY  {e}")
print(f"columns not mentioned:  {len(missing_c)}")
for c in missing_c:
    print(f"  MISSING COLUMN  {c}")

# the three rules, the derived count and the defect count must survive
for probe, label in [
    ("Nothing modifies the pen", "rule 1"),
    ("no measurement can express", "rule 2"),
    ("never a positive", "rule 3"),
    ("Eleven demotions", "the derived list"),
    ("MATCH FULL", "the composite-FK note"),
]:
    if probe not in doc:
        print(f"  MISSING  {label} ({probe!r})")
        missing_c.append(label)

sys.exit(1 if (missing_e or missing_c) else 0)
