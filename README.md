# გადახდების შედარების დეშბორდი (Payment Reconciliation Dashboard)

A dashboard for reconciling Bank of Georgia transactions against active service contracts — matching payments to companies, surfacing what's unmatched, and comparing expected vs. actual revenue per month.

**Live:** [gs-reconciliation.vercel.app](https://gs-reconciliation.vercel.app/)

🇬🇪 [ქართული ვერსია](./README.ka.md)

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

Go to **SQL Editor** in your Supabase dashboard. Open a **new query tab** per file, paste, click **Run** (pasting multiple files into one tab only runs the last statement). In order:

1. `schema.sql` — every table, function, and trigger the app needs: `companies`/`contracts`/`bank_transactions`, `match_transactions_by_inn()` (behind **"მატჩინგის გაშვება"**), plus the optional ledger scaffold (`financial_events`/`accounts`/`journal_entries`/`journal_lines`, a 16-account chart of accounts, and the triggers in [The three-stage ledger model](#the-three-stage-ledger-model)). No data yet.
2. `seed_contracts.sql` — 15 companies, 18 contracts. Posts each contract's ledger demand live as it inserts.
3. `seed_demo_opening_balance.sql` _(optional, demo-only — skip for a real deployment)_ — writes off the ledger's pre-window balance so the numbers on screen look reasonable from here on, instead of one big number until you've also run the next step. See the file's own header and the stage-by-step image in [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).
4. `seed_transactions.sql` — 89 bank transactions (April–June 2026), all `unmatched`. Posts each import live as it inserts.

The ledger half of `schema.sql` (and step 3 above) is entirely optional — leave it out if you only care about the required dashboard.

Sanity check: `select count(*) from bank_transactions;` → 89. `select match_transactions_by_inn();` → 77 (12 stay unmatched — sender INNs that don't belong to any seeded company).

### 4. Configure environment variables

Copy `.env.local.example` to `.env.local` and fill in your Supabase project's URL and anon key (**Project Settings → Data API**):

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-or-publishable-key
```

### 5. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Navigation:** `/` is the ledger recommendation branch's Summary page (balance sheet + P&L), not the required dashboard. Every page shares one sidebar with a bordered **"შედარების დეშბორდი" / "ეს არის დავალება"** link to `/reconciliation` — the actual assignment deliverable — plus the ledger's own nav (`/`, `/accounts`, `/journal`). See [Where this could go next](#where-this-could-go-next) for why.

**Resetting:** to re-test matching, `truncate table bank_transactions cascade;` then re-run `seed_transactions.sql`. To re-test contract demand (e.g. after editing `post_contract_demand()`), `truncate table contracts cascade;` and delete its `financial_events`/`journal_entries` rows, then re-run `schema.sql` + `seed_contracts.sql`.

---

## The required dashboard

Everything the assignment asked for — auto-matching (`sender_inn = tax_id`, idempotent, `ignored` sticky), the stats bar, the transactions table, month navigation, expected-vs-actual, search, CSV export, Zod validation, and TanStack Query for loading/caching/mutations — is live at **`/reconciliation`**, built on the `companies`/`contracts`/`bank_transactions` schema in `schema.sql`. It isn't restated point-by-point here; the code is the source of truth. Two things worth knowing going in:

- [Where the matching logic lives](#where-the-matching-logic-lives) — it's a database function, not client code, and that choice is deliberate.
- [Expected vs. actual: the key rule](#expected-vs-actual-the-key-rule) — the one rule that makes the edge cases in the seed data work out.

---

## Schema

See `schema.sql` for the full DDL. Summary:

- **companies** — `id`, `name`, `tax_id` (unique)
- **contracts** — `id`, `company_id` (FK), `monthly_amount`, `status`, `start_date`, `end_date` (nullable)
- **bank_transactions** — `id`, `doc_key` (unique), `entry_date`, `amount`, `sender_name`, `sender_inn`, `matched_company_id` (FK, nullable), `match_method`, `match_confidence`, `status`, `comment`

---

## Where the matching logic lives

It lives in the database, as a Postgres function (`match_transactions_by_inn()`) called via Supabase RPC. Financial reconciliation should be trusted, not client-side; the matching rule itself (`sender_inn = tax_id`) is a single equality join with no branching or external calls, so there's nothing application code adds by re-implementing it.

**Why:**

- **Atomicity** — one SQL statement, no half-matched state from a network blip mid-loop.
- **Performance** — one round-trip instead of N.
- **Idempotency** — only touches `unmatched` rows; already-matched or manually-`ignored` rows are never re-touched.
- **Actionable failures** — if the function isn't set up yet, the service layer detects the specific PostgREST error and the button tells the operator to run `schema.sql`, instead of failing silently.

**Tradeoff:** this logic is invisible to anyone reading only the Next.js code. Acceptable here because it's small and single-purpose — which is also why manual matching and fuzzy suggestions live in the app instead.

---

## Expected vs. actual: the key rule

A contract counts as active during month M if `start_date <= last day of M` AND (`end_date IS NULL` OR `end_date >= first day of M`).

- **სეიფ ტრანსპორტი** (`end_date = 2026-05-15`): active April–May, drops out in June
- **ურბან მუვერსი** (`end_date = 2026-04-30`): active April only
- **ეკო ტრანსპორტი** (two concurrent contracts): expected amount is summed, not picked from one row

---

## Data loading, caching, and mutations

Every read goes through TanStack Query via a centralized query key factory (`src/lib/query/queryKeys.ts`). Companies/contracts use a 5-minute `staleTime`; transactions use `staleTime: Infinity` and rely entirely on mutation-driven invalidation (nothing else writes to `bank_transactions` while the dashboard is open), so switching between already-visited month/filter combinations is served from cache with zero network requests. `placeholderData: keepPreviousData` keeps the table populated while a new combination loads.

Every write goes through `src/hooks/useTransactionMutations.ts` (`useRunAutoMatching`, `useManuallyMatchTransaction`, `useUnmatchTransaction`, `useUpdateTransactionStatus`, `useUpdateTransactionComment`). Any of these can move a transaction between statuses, so each one invalidates the whole `["transactions"]` key space rather than patching individual filtered views.

---

## Architecture notes

- **Service layer** (`src/services/`): one typed file per table, wrapping Supabase directly — no separate repository layer. `NUMERIC` columns arrive as strings from PostgREST and are parsed to `number` once at the service boundary.
- **`src/types/database.ts`**: hand-authored to mirror `schema.sql`.
- **Zod**: validates filter/search/sort state in `src/schemas/transactionFilters.ts`.
- **Fixed-width table columns**: `TransactionsTable` uses `table-layout: fixed` so long values truncate instead of shifting other columns.

---

## Where this could go next

Today this application answers one question: _do the bank transactions we received match the contracts we expect payment on?_ That's the assignment, and `/reconciliation` answers it fully.

The recommendation on this branch is what a senior engineer would suggest before the next request comes in — because it will: payroll, rent, supplier invoices, taxes, other recurring expenses. Each of those is the same shape of problem (something happened, money moved, someone needs to see it on a statement), and without a shared foundation, each one becomes its own one-off table and its own one-off report. `financial_events` + `accounts`/`journal_entries`/`journal_lines` (a `src/modules/ledger` module, and three pages — Summary at `/`, Chart of Accounts at `/accounts`, Journal at `/journal`) is that shared foundation, added without touching a single line of the required dashboard. It's a **recommendation for accounting/finance stakeholders to evaluate, not a decision already made** — see `docs/ARCHITECTURE.md` for the full reasoning, including what it deliberately doesn't try to solve yet.

It's the app's default landing page for now, so it's easy to review; the required dashboard moved to `/reconciliation`, reachable via the sidebar's bordered link. The _code_ relationship stays one-directional: `/reconciliation`'s own code imports nothing from `src/modules/ledger` and would work identically if the whole scaffold were dropped.

Running the setup files in order installs it — nothing to backfill, every posting happens live off the insert that caused it. Safe to skip entirely or re-run from scratch. To remove it later, run `supabase/drop_ledger_branch.sql` (never touches the required dashboard's tables) — just note that afterward `/` has nothing to read, so you'd want to repoint the sidebar's link or just navigate straight to `/reconciliation`.

### The three-stage ledger model

| Stage                   | Trigger                         | Posting                                                            | Effect                                                                                            |
| ----------------------- | ------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| 1. Contract created     | `INSERT` on `contracts`         | `Dr 1410 მოთხოვნები` / `Cr 6000 შემოსავალი`, once per active month | Receivable and revenue rise each month the contract is active, not as one lump sum                |
| 2. Transaction imported | `INSERT` on `bank_transactions` | `Dr 1490 დაუდგენელი` / `Cr 6110 არა იდენტ. შემოსავალი`             | Money the bank received shows up immediately, before it's identified                              |
| 3. Transaction matched  | `status = 'matched'`            | `Dr 1210 BOG` / `Cr 1490` and `Dr 6110` / `Cr 1410`                | Cash moves out of suspense; the receivable settles against stage 2's suspense revenue, not `6000` |

This holds an invariant at all times: `sum(bank_transactions.amount) = balance(1210) + balance(1490)` ("Imported = Matched + Undefined"). Verify with:

```sql
select
  (select coalesce(sum(amount), 0) from bank_transactions) as imported,
  (select balance from account_balances where code = '1210') as matched_bog,
  (select balance from account_balances where code = '1490') as undefined_transactions;
```

`1410` posts once per calendar month a contract is active (not once per contract), mirroring the same `isContractActiveInMonth()` rule the dashboard's own expected-vs-actual uses — including for paused/ended contracts, whose past months still keep their demand. See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the remaining scope limits, and its stage-by-step image for what each of these five setup stages actually looks like on screen, month by month.

### Ledger UI notes

- `/` and `/journal` default to the most recent of the last 4 months (same as `/reconciliation`) — there's no "all months" view. On `/`, `1410` still shows a true cumulative balance regardless of month picked (see `computeAccountBalances()`); on `/journal`, entries older than 4 months just aren't browsable, though they're still counted everywhere else.
- `/journal` paginates 25 entries per page — a single month can hold a couple hundred entries once contract demand and transaction postings are combined.

---

## Deployment

Deployed on Vercel: [gs-reconciliation.vercel.app](https://gs-reconciliation-ruzn-ten.vercel.app/)

Environment variables required on Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
