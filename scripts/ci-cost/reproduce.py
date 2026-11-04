"""Replay the immutable ENG-380 job snapshot (Python standard library only)."""
import csv
from collections import Counter
from datetime import datetime
from pathlib import Path

root = Path(__file__).resolve().parent
with (root / 'prs.tsv').open() as file:
    count = len(list(csv.DictReader(file, delimiter='\t')))
with (root / 'jobs.tsv').open() as file:
    rows = list(csv.DictReader(file, delimiter='\t'))

def total(snapshot):
    executions = {}
    for row in sorted(snapshot, key=lambda row: int(row['attempt'])):
        key = tuple(row[key] for key in ('run_id', 'job', 'started_at', 'completed_at'))
        executions.setdefault(key, row)
    seconds = Counter()
    for row in executions.values():
        elapsed = (datetime.fromisoformat(row['completed_at']) - datetime.fromisoformat(row['started_at'])).total_seconds()
        assert elapsed >= 0
        seconds[row['category']] += elapsed
    return seconds

seconds = total(rows)
assert seconds == total(reversed(rows))
assert count == 99
assert sum(seconds.values()) == 236115
for category in ('code-push-ci', 'metadata-edit-ci', 'successful-deployment', 'failed-retried-deployment'):
    print(f'{category}\t{seconds[category] / 60:.1f}\t{seconds[category] / 60 / count:.1f}')
print(f'total\t{sum(seconds.values()) / 60:.1f}\t{sum(seconds.values()) / 60 / count:.2f}')
