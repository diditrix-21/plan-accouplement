"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getFarm, loadBreeds, loadTraits, requireUser, type TraitRow } from "@/lib/data";
import { isHerdList, parseHerdList } from "@/lib/herd";
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

/**
 * Import de la « liste des animaux » swissherdbook (Excel). Une vache déjà
 * présente (même N° BDTA) est mise à jour ; ses critères saisis ne bougent pas.
 */
export async function importHerd(form: FormData) {
  const { supabase } = await requireUser();
  const farm = await getFarm(supabase);

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) redirect("/vaches?import=1&message=nofile");

  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(await file.arrayBuffer());
  } catch {
    redirect("/vaches?import=1&message=herd_format");
  }
  const sheet = workbook.worksheets[0];
  const lines: unknown[][] = [];
  sheet?.eachRow({ includeEmpty: false }, (row) => {
    // ExcelJS numérote les colonnes à partir de 1.
    lines.push((row.values as unknown[]).slice(1));
  });
  if (lines.length < 2 || !isHerdList(lines[0])) redirect("/vaches?import=1&message=herd_format");

  const breeds = await loadBreeds(supabase);
  const herd = parseHerdList(lines[0], lines.slice(1), new Set(breeds.map((b) => b.code)));

  const { data: existing, error: readError } = await supabase
    .from("cows")
    .select("id, ear_tag")
    .eq("farm_id", farm.id);
  if (readError) redirect("/vaches?import=1&message=error");
  const idByTag = new Map(
    (existing ?? []).filter((c) => c.ear_tag).map((c) => [c.ear_tag as string, c.id as string]),
  );

  let created = 0;
  const rows = herd.animals.map((animal) => {
    let id = idByTag.get(animal.earTag);
    if (!id) {
      id = crypto.randomUUID();
      created += 1;
    }
    return {
      id,
      farm_id: farm.id,
      name: animal.name,
      ear_tag: animal.earTag,
      breed_code: animal.breedCode,
      birth_date: animal.birthDate,
      lactation_no: animal.lactationNo,
      sire_name: animal.sireName,
      mgs_name: animal.mgsName,
      details: animal.details,
    };
  });
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await supabase.from("cows").upsert(rows.slice(i, i + 200), { onConflict: "id" });
    if (error) redirect("/vaches?import=1&message=error");
  }

  revalidatePath("/", "layout");
  const params = new URLSearchParams({
    herd: String(rows.length),
    created: String(created),
    males: herd.skippedMales.join(", "),
  });
  redirect(`/vaches?${params}`);
}
