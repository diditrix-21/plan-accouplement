"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseBullsCsv } from "@/lib/csv";
import { isCatalogAdmin, loadBreeds, loadSuppliers, loadTraits, requireUser } from "@/lib/data";
import { number, text } from "@/lib/forms";
import { isSwissgeneticsCsv, mergeCatalogs, parseSwissgeneticsCsv } from "@/lib/swissgenetics";

export async function saveBull(form: FormData) {
  const { supabase, user } = await requireUser();
  const traits = await loadTraits(supabase);

  const id = text(form, "id");
  const name = text(form, "name");
  if (!name) redirect("/taureaux?message=name");

  const bull = {
    name,
    herdbook_id: text(form, "herdbook_id"),
    breed_code: text(form, "breed_code"),
    supplier_id: text(form, "supplier_id"),
    sire_name: text(form, "sire_name"),
    mgs_name: text(form, "mgs_name"),
    price_chf: number(form, "price_chf"),
    price_sexed_chf: number(form, "price_sexed_chf"),
  };

  // Un taureau ajouté ici est personnel : visible par son auteur seulement.
  // En modification, la base ne laisse passer que l'auteur (ou l'administrateur
  // pour le catalogue officiel) : aucune ligne renvoyée = pas le droit.
  const saved = id
    ? await supabase.from("bulls").update(bull).eq("id", id).select("id").maybeSingle()
    : await supabase.from("bulls").insert({ ...bull, created_by: user.id }).select("id").maybeSingle();
  if (saved.error) redirect("/taureaux?message=error");
  if (!saved.data) redirect("/taureaux?message=forbidden");

  const bullId = saved.data.id as string;
  const cleared = await supabase.from("bull_traits").delete().eq("bull_id", bullId);
  if (cleared.error) redirect("/taureaux?message=error");

  const values = traits.flatMap((trait) => {
    const value = number(form, `trait:${trait.code}`);
    return value === null ? [] : [{ bull_id: bullId, trait_code: trait.code, value }];
  });
  if (values.length > 0) {
    const inserted = await supabase.from("bull_traits").insert(values);
    if (inserted.error) redirect("/taureaux?message=error");
  }

  revalidatePath("/", "layout");
  redirect("/taureaux?message=saved");
}

export async function deleteBull(form: FormData) {
  const { supabase } = await requireUser();
  const id = text(form, "id");
  if (id) {
    const { data, error } = await supabase.from("bulls").delete().eq("id", id).select("id");
    if (error) redirect("/taureaux?message=error");
    if (!data || data.length === 0) redirect("/taureaux?message=forbidden");
  }
  revalidatePath("/", "layout");
  redirect("/taureaux?message=deleted");
}

function sameText(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export async function importBulls(form: FormData) {
  const { supabase, user } = await requireUser();
  const [traits, breeds, suppliers] = await Promise.all([
    loadTraits(supabase),
    loadBreeds(supabase),
    loadSuppliers(supabase),
  ]);

  const parsed = parseBullsCsv(
    text(form, "csv") ?? "",
    traits.map((t) => t.code),
  );

  let imported = 0;
  let failed = parsed.errors.length;

  for (const row of parsed.bulls) {
    const breed = row.breed
      ? breeds.find((b) => sameText(b.code, row.breed!) || sameText(b.name, row.breed!))
      : undefined;
    const supplier = row.supplier
      ? suppliers.find((s) => sameText(s.name, row.supplier!))
      : undefined;

    const { data, error } = await supabase
      .from("bulls")
      .insert({
        name: row.name,
        herdbook_id: row.herdbookId,
        breed_code: breed?.code ?? null,
        supplier_id: supplier?.id ?? null,
        sire_name: row.sire,
        mgs_name: row.mgs,
        price_chf: row.price,
        price_sexed_chf: row.priceSexed,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error) {
      failed += 1;
      continue;
    }

    const values = Object.entries(row.values).map(([trait_code, value]) => ({
      bull_id: data.id,
      trait_code,
      value,
    }));
    if (values.length > 0) {
      const inserted = await supabase.from("bull_traits").insert(values);
      if (inserted.error) failed += 1;
    }
    imported += 1;
  }

  revalidatePath("/", "layout");
  redirect(
    `/taureaux?imported=${imported}&failed=${failed}&unknown=${parsed.unknownColumns.length}`,
  );
}

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

/**
 * Import des exports CSV du catalogue Swissgenetics (un ou plusieurs fichiers)
 * dans le catalogue officiel, visible par tous les éleveurs. Réservé à
 * l'administrateur du catalogue. Un taureau déjà présent (même vendeur, même
 * identité) est mis à jour : on peut réimporter après chaque nouvelle
 * estimation des valeurs d'élevage.
 */
export async function importCatalog(form: FormData) {
  const { supabase, user } = await requireUser();
  if (!(await isCatalogAdmin(supabase))) redirect("/taureaux?message=admin");

  const files = form
    .getAll("files")
    .filter((file): file is File => file instanceof File && file.size > 0);
  if (files.length === 0) redirect("/taureaux?import=1&message=nofile");

  const texts = await Promise.all(files.map((file) => file.text()));
  if (texts.some((content) => !isSwissgeneticsCsv(content))) {
    redirect("/taureaux?import=1&message=format");
  }
  const catalog = mergeCatalogs(texts.map(parseSwissgeneticsCsv));

  const [traits, breeds, suppliers] = await Promise.all([
    loadTraits(supabase),
    loadBreeds(supabase),
    loadSuppliers(supabase),
  ]);
  const supplier = suppliers.find((s) => s.name === "Swissgenetics");
  if (!supplier) redirect("/taureaux?import=1&message=error");
  const knownBreeds = new Set(breeds.map((b) => b.code));
  const knownTraits = new Set(traits.map((t) => t.code));
  const importedAt = new Date().toISOString();

  // 1. Taureaux déjà au catalogue pour ce vendeur (lus par pages de 1000).
  const idByHerdbook = new Map<string, string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("bulls")
      .select("id, herdbook_id")
      .eq("is_catalog", true)
      .eq("supplier_id", supplier.id)
      .order("id")
      .range(from, from + 999);
    if (error) redirect("/taureaux?import=1&message=catalog_error");
    for (const row of data ?? []) {
      if (row.herdbook_id) idByHerdbook.set(row.herdbook_id as string, row.id as string);
    }
    if (!data || data.length < 1000) break;
  }

  // 2. Création ou mise à jour, par paquets. Chaque taureau garde son identifiant.
  const rows = catalog.bulls.map((bull) => {
    const id = idByHerdbook.get(bull.herdbookId) ?? crypto.randomUUID();
    idByHerdbook.set(bull.herdbookId, id);
    return {
      id,
      name: bull.name,
      full_name: bull.fullName,
      herdbook_id: bull.herdbookId,
      breed_code: bull.breed && knownBreeds.has(bull.breed) ? bull.breed : null,
      supplier_id: supplier.id,
      sire_name: bull.sire,
      mgs_name: bull.mgs,
      price_chf: bull.price,
      price_sexed_chf: bull.priceSexed,
      eval_base: bull.evalBase,
      polled: bull.polled,
      kappa_casein: bull.kappaCasein,
      beta_casein: bull.betaCasein,
      catalog_imported_at: importedAt,
      is_catalog: true,
      created_by: user.id,
    };
  });
  for (const batch of chunks(rows, 300)) {
    const { error } = await supabase.from("bulls").upsert(batch, { onConflict: "id" });
    if (error) redirect("/taureaux?import=1&message=catalog_error");
  }

  // 3. Leurs critères : on efface les anciennes valeurs puis on écrit les nouvelles.
  const bullIds = rows.map((row) => row.id);
  const cleared = await Promise.all(
    chunks(bullIds, 100).map((ids) => supabase.from("bull_traits").delete().in("bull_id", ids)),
  );
  if (cleared.some((result) => result.error)) redirect("/taureaux?import=1&message=catalog_error");

  const values = catalog.bulls.flatMap((bull) => {
    const bullId = idByHerdbook.get(bull.herdbookId);
    if (!bullId) return [];
    return Object.entries(bull.values)
      .filter(([code]) => knownTraits.has(code))
      .map(([trait_code, value]) => ({ bull_id: bullId, trait_code, value }));
  });
  const written = await Promise.all(
    chunks(values, 2000).map((batch) => supabase.from("bull_traits").insert(batch)),
  );
  if (written.some((result) => result.error)) redirect("/taureaux?import=1&message=catalog_error");

  const withoutValues = catalog.bulls.filter((b) => Object.keys(b.values).length === 0).length;
  revalidatePath("/", "layout");
  redirect(`/taureaux?catalog=${rows.length}&values=${values.length}&novalues=${withoutValues}`);
}
