"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cleanFarmName, getFarm, requireUser } from "@/lib/data";

export async function renameFarm(form: FormData) {
  const { supabase } = await requireUser();
  const name = cleanFarmName(form.get("farm_name"));
  if (!name) redirect("/?rename=1&message=farmname");

  const farm = await getFarm(supabase);
  // La base ne laisse modifier que sa propre exploitation.
  const { data, error } = await supabase
    .from("farms")
    .update({ name })
    .eq("id", farm.id)
    .select("id")
    .maybeSingle();
  if (error || !data) redirect("/?rename=1&message=error");

  revalidatePath("/", "layout");
  redirect("/?message=saved");
}
