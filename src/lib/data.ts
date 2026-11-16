import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type TraitRow = {
  code: string;
  label: string;
  category: "production" | "fonctionnel" | "morphologie";
  unit: string | null;
  mean: number;
  sd: number;
  direction: 1 | -1;
  low_label: string | null;
  high_label: string | null;
  sort_order: number;
};

export type BreedRow = { code: string; name: string; breed_group: string };
export type SupplierRow = { id: string; name: string; website: string | null };

export type FarmRow = {
  id: string;
  name: string;
  heifer_min_calving_ease: number;
  max_bull_share: number;
};

export type BullRow = {
  id: string;
  name: string;
  herdbook_id: string | null;
  breed_code: string | null;
  supplier_id: string | null;
  sire_name: string | null;
  mgs_name: string | null;
  price_chf: number | null;
  price_sexed_chf: number | null;
  is_example: boolean;
  created_by: string | null;
  supplier: { name: string } | null;
  breed: { name: string; breed_group: string } | null;
  bull_traits: { trait_code: string; value: number }[];
};

export type CowRow = {
  id: string;
  farm_id: string;
  name: string;
  ear_tag: string | null;
  breed_code: string | null;
  birth_date: string | null;
  lactation_no: number;
  sire_name: string | null;
  mgs_name: string | null;
  notes: string | null;
  breed: { name: string; breed_group: string } | null;
  cow_traits: { trait_code: string; value: number; estimated: boolean }[];
};

export const CATEGORY_LABELS: Record<TraitRow["category"], string> = {
  production: "Production",
  fonctionnel: "Critères fonctionnels",
  morphologie: "Morphologie",
};

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Utilisateur connecté, ou redirection vers /login. */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

/** Exploitation de l'utilisateur, créée au premier passage. */
export async function getFarm(supabase: Supabase): Promise<FarmRow> {
  const columns = "id, name, heifer_min_calving_ease, max_bull_share";
  const existing = await supabase.from("farms").select(columns).maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data) return existing.data as FarmRow;

  const created = await supabase
    .from("farms")
    .insert({ name: "Mon exploitation" })
    .select(columns)
    .single();
  if (created.error) throw new Error(created.error.message);
  return created.data as FarmRow;
}

export async function loadTraits(supabase: Supabase): Promise<TraitRow[]> {
  const { data, error } = await supabase.from("traits").select("*").order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []).map((t) => ({ ...t, mean: Number(t.mean), sd: Number(t.sd) })) as TraitRow[];
}

export async function loadBreeds(supabase: Supabase): Promise<BreedRow[]> {
  const { data, error } = await supabase.from("breeds").select("*").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as BreedRow[];
}

export async function loadSuppliers(supabase: Supabase): Promise<SupplierRow[]> {
  const { data, error } = await supabase.from("suppliers").select("*").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as SupplierRow[];
}

export async function loadBulls(supabase: Supabase): Promise<BullRow[]> {
  const { data, error } = await supabase
    .from("bulls")
    .select(
      "*, supplier:suppliers(name), breed:breeds(name, breed_group), bull_traits(trait_code, value)",
    )
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as BullRow[];
}

export async function loadCows(supabase: Supabase, farmId: string): Promise<CowRow[]> {
  const { data, error } = await supabase
    .from("cows")
    .select("*, breed:breeds(name, breed_group), cow_traits(trait_code, value, estimated)")
    .eq("farm_id", farmId)
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as CowRow[];
}

export async function loadGoals(
  supabase: Supabase,
  farmId: string,
): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("breeding_goals")
    .select("trait_code, weight")
    .eq("farm_id", farmId);
  if (error) throw new Error(error.message);
  return Object.fromEntries((data ?? []).map((g) => [g.trait_code, g.weight]));
}

export function valuesByCode(rows: { trait_code: string; value: number }[]): Record<string, number> {
  return Object.fromEntries(rows.map((r) => [r.trait_code, Number(r.value)]));
}
