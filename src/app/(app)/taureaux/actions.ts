"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseBullsCsv } from "@/lib/csv";
import { loadBreeds, loadSuppliers, loadTraits, requireUser } from "@/lib/data";
import { number, text } from "@/lib/forms";

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

  // En modification, la politique RLS ne laisse passer que le créateur :
  // aucune ligne renvoyée = taureau de quelqu'un d'autre.
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
