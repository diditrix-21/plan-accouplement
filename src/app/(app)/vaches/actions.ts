"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getFarm, loadTraits, requireUser, type TraitRow } from "@/lib/data";
import { number, text } from "@/lib/forms";

type TraitValue = { trait_code: string; value: number; estimated: boolean };

/** Valeur attribuée à un critère coché « faible » sans chiffre : un écart-type sous la moyenne. */
function weakValue(trait: TraitRow): number {
  return trait.mean - trait.direction * trait.sd;
}

function readTraitValues(form: FormData, traits: TraitRow[]): TraitValue[] {
  const values: TraitValue[] = [];
  for (const trait of traits) {
    const value = number(form, `trait:${trait.code}`);
    if (value !== null) {
      values.push({ trait_code: trait.code, value, estimated: false });
    } else if (form.get(`weak:${trait.code}`) === "on") {
      values.push({ trait_code: trait.code, value: weakValue(trait), estimated: true });
    }
  }
  return values;
}

export async function saveCow(form: FormData) {
  const { supabase } = await requireUser();
  const farm = await getFarm(supabase);
  const traits = await loadTraits(supabase);

  const id = text(form, "id");
  const name = text(form, "name");
  if (!name) redirect("/vaches?message=name");

  const cow = {
    farm_id: farm.id,
    name,
    ear_tag: text(form, "ear_tag"),
    breed_code: text(form, "breed_code"),
    birth_date: text(form, "birth_date"),
    lactation_no: Math.max(0, Math.round(number(form, "lactation_no") ?? 0)),
    sire_name: text(form, "sire_name"),
    mgs_name: text(form, "mgs_name"),
    notes: text(form, "notes"),
  };

  const saved = id
    ? await supabase.from("cows").update(cow).eq("id", id).select("id").single()
    : await supabase.from("cows").insert(cow).select("id").single();
  if (saved.error) redirect("/vaches?message=error");

  const cowId = saved.data.id as string;
  const cleared = await supabase.from("cow_traits").delete().eq("cow_id", cowId);
  if (cleared.error) redirect("/vaches?message=error");

  const values = readTraitValues(form, traits).map((v) => ({ ...v, cow_id: cowId }));
  if (values.length > 0) {
    const inserted = await supabase.from("cow_traits").insert(values);
    if (inserted.error) redirect("/vaches?message=error");
  }

  revalidatePath("/", "layout");
  redirect("/vaches?message=saved");
}

export async function deleteCow(form: FormData) {
  const { supabase } = await requireUser();
  const id = text(form, "id");
  if (id) {
    const { error } = await supabase.from("cows").delete().eq("id", id);
    if (error) redirect("/vaches?message=error");
  }
  revalidatePath("/", "layout");
  redirect("/vaches?message=deleted");
}

/** Quelques vaches fictives pour essayer le plan sans rien saisir. */
export async function addExampleCows() {
  const { supabase } = await requireUser();
  const farm = await getFarm(supabase);
  const traits = await loadTraits(supabase);
  const byCode = new Map(traits.map((t) => [t.code, t]));

  const examples = [
    { name: "Exemple Bella", lactation_no: 3, weak: ["cellules", "mammites"] },
    { name: "Exemple Fleur", lactation_no: 2, weak: ["lait_kg"] },
    { name: "Exemple Rosa", lactation_no: 4, weak: ["membres", "systeme_mammaire"] },
    { name: "Exemple Luna", lactation_no: 0, weak: ["mg_pct", "prot_pct"] },
  ];

  for (const example of examples) {
    const { data, error } = await supabase
      .from("cows")
      .insert({
        farm_id: farm.id,
        name: example.name,
        lactation_no: example.lactation_no,
        breed_code: "RH",
        notes: "Vache d'exemple, à supprimer.",
      })
      .select("id")
      .single();
    if (error) redirect("/vaches?message=error");

    const values = example.weak
      .map((code) => byCode.get(code))
      .filter((trait): trait is TraitRow => trait !== undefined)
      .map((trait) => ({
        cow_id: data.id,
        trait_code: trait.code,
        value: weakValue(trait),
        estimated: true,
      }));
    if (values.length > 0) {
      const inserted = await supabase.from("cow_traits").insert(values);
      if (inserted.error) redirect("/vaches?message=error");
    }
  }

  revalidatePath("/", "layout");
  redirect("/vaches?message=saved");
}
