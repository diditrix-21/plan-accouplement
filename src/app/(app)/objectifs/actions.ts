"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getFarm, loadTraits, requireUser } from "@/lib/data";
import { number } from "@/lib/forms";

export async function saveGoals(form: FormData) {
  const { supabase } = await requireUser();
  const farm = await getFarm(supabase);
  const traits = await loadTraits(supabase);

  const goals = traits.map((trait) => ({
    farm_id: farm.id,
    trait_code: trait.code,
    weight: Math.min(5, Math.max(0, Math.round(number(form, `goal:${trait.code}`) ?? 0))),
  }));

  const saved = await supabase.from("breeding_goals").upsert(goals);
  if (saved.error) redirect("/objectifs?message=error");

  const minEase = number(form, "heifer_min_calving_ease");
  const sharePercent = number(form, "max_bull_share");
  const rules = {
    ...(minEase !== null && { heifer_min_calving_ease: minEase }),
    ...(sharePercent !== null && {
      max_bull_share: Math.min(100, Math.max(1, sharePercent)) / 100,
    }),
  };
  if (Object.keys(rules).length > 0) {
    const updated = await supabase.from("farms").update(rules).eq("id", farm.id);
    if (updated.error) redirect("/objectifs?message=error");
  }

  revalidatePath("/", "layout");
  redirect("/objectifs?message=saved");
}
