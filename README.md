# გადახდების შედარების დეშბორდი (Payment Reconciliation Dashboard)

A dashboard for reconciling Bank of Georgia transactions against active service contracts — matching payments to companies, surfacing what's unmatched, and comparing expected vs. actual revenue per month.

## Stack

- Next.js 15 (App Router) + TypeScript
- Supabase (Postgres + PostgREST + RPC)
- TanStack Query
- Tailwind CSS v4
- Zod

---

## Setup & Running Locally

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Supabase project

Go to [supabase.com](https://supabase.com), create a free-tier project, and wait for it to provision.

### 3. Run the SQL files — in order, one at a time

Go to **SQL Editor** in your Supabase dashboard. For each step below, open a **new query tab**, paste the contents, and click **Run**.

> ⚠️ Always run each file in its own query tab. Pasting multiple files together causes the SQL Editor to silently skip everything except the last statement.

**Step 1** — paste and run `seed_schema.sql`

Creates the `companies`, `contracts`, and `bank_transactions` tables, indexes, and the `updated_at` trigger. Seeds 15 companies and 18 contracts.

**Step 2** — paste and run `seed_transactions.sql`

Seeds 89 bank transactions across April–June 2026. All start with `status = 'unmatched'`.

**Step 3** — paste and run `supabase/migrations/001_match_transactions_by_inn.sql`

Creates the `match_transactions_by_inn()` Postgres function that powers the "Run Matching" button in the dashboard.

**Step 4** — run this to grant the anon role permission to call the function:

```sql
GRANT EXECUTE ON FUNCTION match_transactions_by_inn() TO anon;
```

**Step 5** — disable Row Level Security on all three tables (required when using the anon key without auth):

```sql
ALTER TABLE companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE contracts DISABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions DISABLE ROW LEVEL SECURITY;
```

**Verify everything is correct:**

```sql
select count(*) from companies;         -- should be 15
select count(*) from contracts;         -- should be 18
select count(*) from bank_transactions; -- should be 89
select match_transactions_by_inn();     -- should return 77
```

The last query also runs the matching — after this, 77 transactions will be matched and 12 will remain unmatched (those 12 have unknown sender INNs that don't match any company).

### 4. Configure environment variables

Create a `.env.local` file in the project root (copy from `.env.local.example`):

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-or-publishable-key
```

Both values are found in your Supabase dashboard under **Project Settings → Data API**.

### 5. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The dashboard loads with all transactions already matched (from Step 3 above). To reset and test the matching button from scratch, re-run `seed_transactions.sql` to restore all 89 transactions to `unmatched`, then click **"მატჩინგის გაშვება"** in the dashboard.

---

## Resetting the database

If you need to start fresh:

**Step 1** — drop everything:
```sql
DROP TABLE IF EXISTS bank_transactions CASCADE;
DROP TABLE IF EXISTS contracts CASCADE;
DROP TABLE IF EXISTS companies CASCADE;
DROP FUNCTION IF EXISTS match_transactions_by_inn();
DROP FUNCTION IF EXISTS update_updated_at();
```

Then repeat Steps 1–5 from the setup section above.

---

## Schema

See `seed_schema.sql` for the full DDL. Summary:

- **companies** — `id`, `name`, `tax_id` (unique)
- **contracts** — `id`, `company_id` (FK), `monthly_amount`, `status` (`active`/`paused`/`ended`), `start_date`, `end_date` (nullable)
- **bank_transactions** — `id`, `doc_key` (unique dedup key), `entry_date`, `amount`, `sender_name`, `sender_inn`, `matched_company_id` (FK, nullable), `match_method`, `match_confidence`, `status` (`matched`/`unmatched`/`ignored`)

---

## Where the matching logic lives, and why

**It lives in the database**, as a Postgres function (`match_transactions_by_inn()`), called via Supabase RPC when the button is clicked.

> "I would avoid implementing the matching logic on the client because financial reconciliation must be trusted and cannot rely on client-side code. Between the application server and PostgreSQL, I would place the core reconciliation algorithm in PostgreSQL because it performs set-based operations, joins, and transactional updates very efficiently. The Next.js server would handle authentication, authorization, input validation, audit logging, and invoke the database function. This separation keeps the business workflow secure, performant, and maintainable while taking advantage of PostgreSQL's transaction guarantees."

The matching rule — `bank_transactions.sender_inn = companies.tax_id` — is a single equality join. There is no multi-step branching, no external API call, and nothing that benefits from being expressed in application code. It is a set-based operation over rows that already live in the same database, which is the textbook case for doing the work in SQL rather than pulling every row into the browser, looping in JavaScript, and firing one UPDATE per row.

**Why this approach:**

- **Atomicity** — the whole matching run is one SQL statement. A client-side implementation (fetch all, compare in JS, issue N updates) has a real failure mode where a network blip mid-loop leaves the dataset half-matched with no transaction boundary. The RPC either fully runs or it doesn't.
- **Performance** — one round-trip instead of N. For 89 rows this barely matters; at real scale (thousands of transactions per day from a bank feed) it matters a lot.
- **Idempotency** — the function only touches rows where `status = 'unmatched'`. Clicking the button repeatedly is safe. Already-matched rows are never re-touched. Transactions manually marked `ignored` are also never overwritten — that status represents a human decision and auto-matching should not silently undo it.

**The honest tradeoff:** this logic is invisible to anyone reading only the Next.js codebase, and harder to unit-test in isolation than a plain TypeScript function. That is an acceptable cost here because the operation is small and single-purpose. If fuzzy or manual matching logic grows significantly, that is a signal to move matching back into the application layer — which is exactly why the manual match path lives in the app, not the database.

---

## Expected vs. actual: the key rule

A contract counts as active during month M if:
- `start_date <= last day of M` AND
- `end_date IS NULL OR end_date >= first day of M`

This correctly handles edge cases in the seed data:
- **სეიფ ტრანსპორტი** (`end_date = 2026-05-15`): counts as active in April and May, drops out in June
- **ურბან მუვერსი** (`end_date = 2026-04-30`): counts in April, drops out in May and June
- **ეკო ტრანსპორტი** (two concurrent active contracts: 750 + 1100/month): expected amount is summed, not picked from one row

---

## Architecture notes

- **Service layer** (`src/services/`): one typed file per table, wrapping Supabase directly. No separate repository layer — with three tables and a thin query builder, an extra layer would be indirection without behavioral difference. Raw `NUMERIC` columns from PostgREST arrive as strings (to avoid float precision loss on money values) and are parsed to `number` once at the service boundary.
- **TanStack Query** (`src/hooks/`): centralized query key factory so cache invalidation is reliable. Mutations invalidate the whole `transactions` key prefix — correctness over shaving a network request at this data size.
- **`src/types/database.ts`**: hand-authored to mirror `seed_schema.sql`. Includes `Relationships: []` per table and an `__InternalSupabase` marker — both required by recent `@supabase/supabase-js` releases for `.update()` argument types to resolve correctly. Omitting them silently widens those types to `never`.
- **Zod**: validates filter/search/sort state in `src/schemas/transactionFilters.ts`.

---

## Deployment

Deployed on Vercel: _link to be added after deployment_

Environment variables required on Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
