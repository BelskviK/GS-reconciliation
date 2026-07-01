import { z } from "zod";

/**
 * Validates filter/search state for the transactions table.
 * Even though this state originates from UI controls (not raw user text
 * input from a URL or API), validating it here means:
 *  - the shape is enforced in one place if filters are ever pushed to the
 *    URL as query params (a natural next step for shareable filtered views)
 *  - `search` gets a sane length cap, so a stray huge paste can't end up
 *    in a Postgres ILIKE pattern unbounded
 */
export const transactionFiltersSchema = z.object({
  status: z.enum(["all", "matched", "unmatched", "ignored"]).default("all"),
  search: z.string().trim().max(200).default(""),
  monthKey: z.string().regex(/^\d{4}-\d{2}$/),
});

export type TransactionFiltersInput = z.input<typeof transactionFiltersSchema>;
export type TransactionFiltersParsed = z.output<
  typeof transactionFiltersSchema
>;

export const sortFieldSchema = z.enum(["entry_date", "amount"]);
export const sortDirectionSchema = z.enum(["asc", "desc"]);

export const tableSortSchema = z.object({
  field: sortFieldSchema.default("entry_date"),
  direction: sortDirectionSchema.default("desc"),
});

export type TableSort = z.output<typeof tableSortSchema>;
