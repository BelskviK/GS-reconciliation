import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import type { Company } from "@/types/domain";

type CompanyRow = Database["public"]["Tables"]["companies"]["Row"];

function toCompany(row: CompanyRow): Company {
  return {
    id: row.id,
    name: row.name,
    taxId: row.tax_id,
    createdAt: row.created_at,
  };
}

export async function getCompanies(): Promise<Company[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Failed to load companies: ${error.message}`);
  }

  return (data ?? []).map(toCompany);
}
