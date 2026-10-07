-- Forward-only marker for databases reconciled from the pre-merge slider stack.
-- The migration runner applies any missing 0063-0065 migrations before this
-- marker. Fresh databases reach it through the normal ordered chain.
SELECT 1;
