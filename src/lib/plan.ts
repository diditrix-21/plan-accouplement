import {
  getFarm,
  loadBreeds,
  loadBulls,
  loadCows,
  loadGoals,
  loadStock,
  loadTraits,
  valuesByCode,
  type BullRow,
  type CowRow,
} from "@/lib/data";
import {
  DEFAULT_OPTIONS,
  allowedBullBreeds,
  bullCap,
  dosesNeeded,
  planForHerd,
  type Bull,
  type Cow,
  type Trait,
} from "@/lib/mating";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

function toCow(row: CowRow): Cow {
  return {
    id: row.id,
    name: row.name,
    breedCode: row.breed_code,
    breedGroup: row.breed?.breed_group ?? null,
    sireName: row.sire_name,
    mgsName: row.mgs_name,
    values: valuesByCode(row.cow_traits),
    isHeifer: row.lactation_no === 0,
  };
}

function toBull(row: BullRow): Bull {
  return {
    id: row.id,
    name: row.name,
    breedCode: row.breed_code,
    breedGroup: row.breed?.breed_group ?? null,
    sireName: row.sire_name,
    mgsName: row.mgs_name,
    values: valuesByCode(row.bull_traits),
    supplier: row.supplier?.name ?? null,
    priceChf: row.price_chf === null ? null : Number(row.price_chf),
  };
}

/** Charge le troupeau, le catalogue et les objectifs, puis calcule le plan. */
export async function buildPlan(supabase: Supabase) {
  const farm = await getFarm(supabase);
  const [traitRows, cowRows, goals, breeds, stockRows] = await Promise.all([
    loadTraits(supabase),
    loadCows(supabase, farm.id),
    loadGoals(supabase, farm.id),
    loadBreeds(supabase),
    loadStock(supabase),
  ]);
  const stock = Object.fromEntries(
    stockRows.filter((row) => row.doses > 0).map((row) => [row.bull_id, row.doses]),
  ) as Record<string, number>;

  // Le catalogue compte plus de mille taureaux : on ne charge que ceux des
  // races utilisables sur le troupeau (même race, même couleur en Holstein).
  const breedCodes = [...new Set(cowRows.flatMap((c) => allowedBullBreeds(c.breed_code)))];
  const bullRows = await loadBulls(supabase, { breedCodes });

  const traits: Trait[] = traitRows.map((t) => ({
    code: t.code,
    label: t.label,
    mean: t.mean,
    sd: t.sd,
    direction: t.direction,
  }));
  const activeGoals = traitRows
    .filter((t) => (goals[t.code] ?? 0) > 0)
    .map((t) => ({ label: t.label, weight: goals[t.code] }))
    .sort((a, b) => b.weight - a.weight);

  const plans = planForHerd(cowRows.map(toCow), bullRows.map(toBull), traits, goals, {
    ...DEFAULT_OPTIONS,
    heiferMinCalvingEase: Number(farm.heifer_min_calving_ease),
    maxBullShare: Number(farm.max_bull_share),
  }, stock);

  return {
    farm,
    stock,
    stockDoses: Object.values(stock).reduce((sum, n) => sum + n, 0),
    breedNames: Object.fromEntries(breeds.map((b) => [b.code, b.name])) as Record<string, string>,
    cowCount: cowRows.length,
    bullCount: bullRows.length,
    hasExampleBulls: bullRows.some((b) => b.is_example),
    activeGoals,
    plans,
    cap: bullCap(plans.filter((p) => p.chosen).length, Number(farm.max_bull_share)),
    doses: dosesNeeded(plans),
  };
}
