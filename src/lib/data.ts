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
  /** true = catalogue officiel (visible par tous) ; false = taureau personnel de l'éleveur. */
  is_catalog: boolean;
  created_by: string | null;
  /** Nom complet, base des valeurs d'élevage (« GA HO 08.26 »), sans cornes : remplis par l'import de catalogue. */
  full_name: string | null;
  eval_base: string | null;
  polled: "PP" | "Pp" | null;
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

export const DEFAULT_FARM_NAME = "Mon exploitation";

/** Nom d'exploitation saisi par l'utilisateur : espaces nettoyés, 80 caractères au plus. */
export function cleanFarmName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.replace(/\s+/g, " ").trim().slice(0, 80);
  return name === "" ? null : name;
}

/**
 * Exploitation de l'utilisateur, créée au premier passage avec le nom donné à
 * l'inscription. Les règles de la base ne laissent voir que la sienne.
 */
export async function getFarm(supabase: Supabase): Promise<FarmRow> {
  const columns = "id, name, heifer_min_calving_ease, max_bull_share";
  const existing = await supabase.from("farms").select(columns).maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data) return existing.data as FarmRow;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const name = cleanFarmName(user?.user_metadata?.farm_name) ?? DEFAULT_FARM_NAME;

  const created = await supabase.from("farms").insert({ name }).select(columns).maybeSingle();
  if (created.data) return created.data as FarmRow;

  // Deux parties de la page ont pu créer l'exploitation en même temps : on relit.
  const retry = await supabase.from("farms").select(columns).maybeSingle();
  if (retry.data) return retry.data as FarmRow;
  throw new Error(created.error?.message ?? retry.error?.message ?? "Exploitation introuvable");
}

/** Vrai si l'utilisateur a le droit de gérer le catalogue officiel. */
export async function isCatalogAdmin(supabase: Supabase): Promise<boolean> {
  const { data, error } = await supabase.from("catalog_admins").select("user_id").maybeSingle();
  return !error && data !== null;
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

export type BullFilter = {
  /** Limite aux races données (codes). Liste vide = aucun taureau. */
  breedCodes?: string[];
  supplierId?: string;
  /** Recherche dans le nom court ou complet. */
  search?: string;
  /** « catalog » = catalogue officiel seulement, « mine » = mes taureaux personnels. */
  scope?: "catalog" | "mine";
};

/**
 * Charge les taureaux visibles par l'utilisateur (catalogue officiel + ses
 * taureaux personnels) avec leurs critères. L'API Supabase renvoie au plus
 * 1000 lignes par requête : on lit donc par pages pour ne perdre personne.
 */
export async function loadBulls(supabase: Supabase, filter: BullFilter = {}): Promise<BullRow[]> {
  if (filter.breedCodes && filter.breedCodes.length === 0) return [];

  const pageSize = 500;
  const bulls: BullRow[] = [];
  for (let from = 0; ; from += pageSize) {
    let query = supabase
      .from("bulls")
      .select(
        "*, supplier:suppliers(name), breed:breeds(name, breed_group), bull_traits(trait_code, value)",
      )
      .order("name")
      .order("id")
      .range(from, from + pageSize - 1);
    if (filter.breedCodes) query = query.in("breed_code", filter.breedCodes);
    if (filter.supplierId) query = query.eq("supplier_id", filter.supplierId);
    if (filter.scope) query = query.eq("is_catalog", filter.scope === "catalog");
    if (filter.search) {
      // Les caractères spéciaux de la syntaxe de filtre sont retirés de la recherche.
      const term = filter.search.replace(/[%_,()*\\]/g, " ").trim();
      if (term) query = query.or(`name.ilike.%${term}%,full_name.ilike.%${term}%`);
    }
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    bulls.push(...((data ?? []) as unknown as BullRow[]));
    if (!data || data.length < pageSize) break;
  }
  return bulls;
}

/** Nombre de taureaux du catalogue, sans les charger. */
export async function countBulls(supabase: Supabase): Promise<number> {
  const { count, error } = await supabase.from("bulls").select("id", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  return count ?? 0;
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
