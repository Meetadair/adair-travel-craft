# Schema tests

`business_core.sql` proves the guarantees the business schema is supposed to
make. It needs nothing but a scratch PostgreSQL 16 — no Supabase, no Docker,
no network — because a schema you can only test against production is a schema
nobody tests.

```sh
initdb -D /tmp/pg/data -U postgres
pg_ctl -D /tmp/pg/data -o "-k /tmp/pg -p 5433 -c listen_addresses=" start
psql -h /tmp/pg -p 5433 -U postgres -f supabase/tests/business_core.sql
```

Every line marked `must be refused` is expected to print an ERROR. A run where
none of them do is a run that has found a hole.

What it checks:

1. A budget cannot be saved without a named release authority.
2. A deputy cannot exist without a waiting period — that would be a second
   authority by accident.
3. A deputy cannot also be the authority.
4. A budget's scope has to match what it points at.
5. The release authority cannot be deleted out from under a live budget.
6. A release cannot be recorded without a reason.
7. One person cannot hold two live memberships.
8. Cost-centre codes and email domains are unique, case-insensitively.
9. No write policy exists on the audit log for anybody.
10. Row-level security is on for every business table, and `anon` reaches none.
11. **Two companies cannot see each other** — the one that matters.
12. An ordinary employee cannot read the audit log or write to it.
13. A signed-in user with no company sees nothing at all.
14. Nested reads do not leak: a rival cannot reach budget lines through the
    budget they hang off.
