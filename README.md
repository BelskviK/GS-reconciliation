# გადახდების შედარების დეშბორდი (Payment Reconciliation Dashboard)

A dashboard for reconciling Bank of Georgia transactions against active service contracts — matching payments to companies, surfacing what's unmatched, and comparing expected vs. actual revenue per month.

**Live:** [gs-reconciliation.vercel.app](https://gs-reconciliation.vercel.app/)

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

Go to **SQL Editor** in your Supabase dashboard. For each file, open a **new query tab**, paste the contents, and click **Run**. (Pasting multiple files into one tab causes the editor to silently run only the last statement.)

1. `seed_schema.sql` — creates `companies`, `contracts`, `bank_transactions`, indexes, and the `updated_at` trigger; seeds 15 companies and 18 contracts.
2. `seed_transactions.sql` — seeds 89 bank transactions (April–June 2026), all `status = 'unmatched'`.
3. `supabase/migrations/001_match_transactions_by_inn.sql` — creates `match_transactions_by_inn()`, the Postgres function behind the **"მატჩინგის გაშვება"** button.
4. Grant `anon` execute access and disable RLS (required to use the anon key without auth):
   ```sql
   GRANT EXECUTE ON FUNCTION match_transactions_by_inn() TO anon;
   ALTER TABLE companies DISABLE ROW LEVEL SECURITY;
   ALTER TABLE contracts DISABLE ROW LEVEL SECURITY;
   ALTER TABLE bank_transactions DISABLE ROW LEVEL SECURITY;
   ```
5. **Recommended, optional:** `supabase/migrations/002_add_transaction_comment.sql` — adds a nullable `comment` column to `bank_transactions`. The frontend detects at runtime whether this column exists and only shows the "კომენტარი" column/editor if it does, so skipping this step is safe — the app still works without it. It's worth running anyway: of the 89 seeded transactions, 12 have a sender INN that doesn't belong to any company (`select match_transactions_by_inn();` matches 77, leaving those 12 `unmatched`), and there's no contract to suggest one either. A comment is the only place to record *why* — e.g. "confirmed with the bank, one-off payment, not a contract" or "unknown sender, flagged for follow-up 2026-07-02" — so the next operator looking at that row doesn't have to re-investigate it from scratch.

Sanity check: `select count(*) from bank_transactions;` should return 89, and `select match_transactions_by_inn();` should return 77 (77 matched, 12 stay unmatched — those 12 have sender INNs that don't belong to any seeded company).

### 4. Configure environment variables

Copy `.env.local.example` to `.env.local` and fill in your Supabase project's URL and anon/publishable key (**Project Settings → Data API**):

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-or-publishable-key
```

### 5. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). To re-test the matching button from scratch, re-run `seed_transactions.sql` (resets all 89 rows to `unmatched`) and click **"მატჩინგის გაშვება"**.

---

## Assignment requirements — where each one is met

| Requirement | Where |
|---|---|
| Auto-matching logic (`sender_inn = tax_id`, idempotent, `ignored` is sticky) | [Where the matching logic lives, and why](#where-the-matching-logic-lives-and-why) · `supabase/migrations/001_match_transactions_by_inn.sql` |
| Stats bar (total / matched / unmatched counts + amounts, match rate %) | `src/components/dashboard/StatsBar.tsx` |
| Transactions table (date, sender, tax ID, amount, colored status, matched company, action; sortable by date/amount; filterable by status) | `src/components/dashboard/TransactionsTable.tsx` |
| Month navigation (April–June 2026, all sections scoped to the selected month) | `src/components/dashboard/MonthTabs.tsx`, `src/lib/utils/month.ts` |
| Expected vs. actual, including contract-active-in-month edge cases | [Expected vs. actual: the key rule](#expected-vs-actual-the-key-rule) |
| Zod validation for filter/search/sort state | `src/schemas/transactionFilters.ts` |
| TanStack Query for all data loading, correct cache invalidation after mutations, loading/error states | [Data loading, caching, and mutations](#data-loading-caching-and-mutations) |

### Bonus features (all implemented)

- **Search** by company name or tax ID, debounced with an instant clear button — `src/components/dashboard/FilterBar.tsx`
- **CSV export** of the expected-vs-actual summary — `src/lib/utils/exportCSV.ts`
- **Matching logic as a Supabase RPC function**, not client-side — see below
- **Fuzzy name suggestions** for unmatched (and manually-matched) transactions, e.g. "გეოტრანსი (ფილიალი)" → "შპს გეოტრანსი" — `src/lib/utils/fuzzyMatch.ts`, surfaced via `MatchScoreDot` and `CompanyMatchSelect`'s suggestion dropdown

---

## Schema

See `seed_schema.sql` for the full DDL. Summary:

- **companies** — `id`, `name`, `tax_id` (unique)
- **contracts** — `id`, `company_id` (FK), `monthly_amount`, `status` (`active`/`paused`/`ended`), `start_date`, `end_date` (nullable)
- **bank_transactions** — `id`, `doc_key` (unique dedup key), `entry_date`, `amount`, `sender_name`, `sender_inn`, `matched_company_id` (FK, nullable), `match_method`, `match_confidence`, `status` (`matched`/`unmatched`/`ignored`)

---

## Where the matching logic lives, and why

**It lives in the database**, as a Postgres function (`match_transactions_by_inn()`), called via Supabase RPC when the button is clicked.

I would avoid implementing the matching logic on the client because financial reconciliation must be trusted and cannot rely on client-side code. Between the application server and PostgreSQL, I would place the core reconciliation algorithm in PostgreSQL because it performs set-based operations, joins, and transactional updates very efficiently. The Next.js server would handle authentication, authorization, input validation, audit logging, and invoke the database function. This separation keeps the business workflow secure, performant, and maintainable while taking advantage of PostgreSQL's transaction guarantees.

The matching rule — `bank_transactions.sender_inn = companies.tax_id` — is a single equality join. There is no multi-step branching, no external API call, and nothing that benefits from being expressed in application code.

**Why this approach:**

- **Atomicity** — the whole matching run is one SQL statement. A client-side implementation (fetch all, compare in JS, issue N updates) has a real failure mode where a network blip mid-loop leaves the dataset half-matched with no transaction boundary. The RPC either fully runs or it doesn't.
- **Performance** — one round-trip instead of N. For 89 rows this barely matters; at real scale (thousands of transactions per day from a bank feed) it matters a lot.
- **Idempotency** — the function only touches rows where `status = 'unmatched'`. Clicking the button repeatedly is safe. Already-matched rows are never re-touched. Transactions manually marked `ignored` are also never overwritten — that status represents a human decision and auto-matching should not silently undo it.
- **Actionable failure mode** — if `match_transactions_by_inn()` hasn't been created yet (migration 001 skipped, or `EXECUTE` never granted to `anon`), the RPC call fails with a PostgREST "function not found" error. The service layer (`src/services/transaction.service.ts`) detects that specific error and the "მატჩინგის გაშვება" button surfaces an actionable message telling the operator to run the migration, instead of a generic/silent failure.

**The honest tradeoff:** this logic is invisible to anyone reading only the Next.js codebase, and harder to unit-test in isolation than a plain TypeScript function. That is an acceptable cost here because the operation is small and single-purpose. If fuzzy or manual matching logic grows significantly, that is a signal to move matching back into the application layer — which is exactly why the manual match path (and its fuzzy-suggestion scoring) lives in the app, not the database.

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

## Data loading, caching, and mutations

**Loading** — every read (companies, contracts, transactions) goes through TanStack Query via a centralized query key factory (`src/lib/query/queryKeys.ts`), so cache invalidation can't silently miss a key. Each component owns its own `isLoading` state and renders a skeleton (`StatsBar`, `TransactionsTable`, `ExpectedVsActual` all have one) instead of a blank screen.

**Caching** — companies and contracts rarely change, so they use a 5-minute `staleTime`. Transactions are different: they only ever change through a mutation this app controls (there's no external process writing to `bank_transactions` while the dashboard is open), so `useTransactions` sets `staleTime: Infinity` and relies entirely on mutation-driven cache invalidation instead of a clock. Practically, this means switching between month tabs or status filters you've already visited in the session is served from cache with **zero network requests** — it only refetches for a filter/month combination that's genuinely new. `placeholderData: keepPreviousData` additionally keeps the previous rows on screen while a new combination loads, so the table updates in place instead of flashing back to a loading skeleton on every filter change or keystroke (search is also debounced client-side before it reaches the query, so typing doesn't fire a request per character).

**Mutations** — every write goes through `src/hooks/useTransactionMutations.ts`:

- `useRunAutoMatching` — runs the `match_transactions_by_inn()` RPC
- `useManuallyMatchTransaction` / `useUnmatchTransaction` — assign or remove a manual company match
- `useUpdateTransactionStatus` — ignore / un-ignore a transaction
- `useUpdateTransactionComment` — save a free-text comment

Any of these can move a transaction between `matched` / `unmatched` / `ignored`, which changes which filtered view it belongs to. Rather than surgically patching each cached filter combination, every mutation calls `invalidateQueries({ queryKey: queryKeys.transactions.all })` — since `["transactions"]` is a prefix of every `["transactions", "list", filters]` key, this correctly invalidates all filtered views (the "all" view, the "unmatched only" view, etc.) in one call. Combined with the `staleTime: Infinity` above, this is the only thing that ever causes a transactions refetch: real data changes, not elapsed time.

---

## Architecture notes

- **Service layer** (`src/services/`): one typed file per table, wrapping Supabase directly. No separate repository layer — with three tables and a thin query builder, an extra layer would be indirection without behavioral difference. Raw `NUMERIC` columns from PostgREST arrive as strings (to avoid float precision loss on money values) and are parsed to `number` once at the service boundary.
- **`src/types/database.ts`**: hand-authored to mirror `seed_schema.sql`. Includes `Relationships: []` per table and an `__InternalSupabase` marker — both required by recent `@supabase/supabase-js` releases for `.update()` argument types to resolve correctly. Omitting them silently widens those types to `never`.
- **Zod**: validates filter/search/sort state in `src/schemas/transactionFilters.ts`.
- **Fixed-width table columns**: `TransactionsTable` uses `table-layout: fixed` with an explicit `<colgroup>`, so a long sender name, comment, or company name truncates with an ellipsis instead of shifting every other column's width as rows re-render.

---

## Deployment

Deployed on Vercel: [gs-reconciliation.vercel.app](https://gs-reconciliation.vercel.app/)

Environment variables required on Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
