# Database erasure

`services.db.erasure.eraseDatabase(clerkId)` applies the approved disposition
matrix in one transaction. It deletes account-owned roots, clears identifying
links on preserved shared data, and aborts unless its identifier, captured-ID,
and orphan checks all return zero.

The storage step must delete every captured object and clear its deletion queue
before this database step runs. The erasure receipt is deliberately retained;
the provider step removes its raw Clerk ID later.

## Post-restore reconciliation

Do not send production traffic to a restored or production-derived database
until all of these checks succeed:

1. Keep traffic blocked and retain the pre-restore branch.
2. For every restored user, compute the subject HMAC and replay each unexpired
   erasure receipt against the database, storage, caches, and Clerk.
3. Compare restored Clerk IDs with Clerk. Quarantine mismatches for a privacy
   operator; a provider mismatch must not trigger automatic deletion.
4. Run the database eraser's identifier, captured-ID, and orphan checks, plus
   the storage and provider negative checks, on every promotable branch.
5. Record privacy-operator approval before reopening traffic.

The full disposition and retention policy is in `docs/complete-erasure.md` from
ENG-201. Any new account-linked column must be added to both that matrix and the
transactional verification query before release.
