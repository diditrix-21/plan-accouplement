"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/data";

const REASONS = ["stock_initial", "achat", "insemination", "correction"] as const;
type Reason = (typeof REASONS)[number];

/** Change le stock d'un taureau (+ achat, − insémination). Jamais sous zéro. */
export async function adjustStock(form: FormData) {
  const { supabase } = await requireUser();
  const bullId = String(form.get("bull_id") ?? "");
  const reason = String(form.get("reason") ?? "") as Reason;
  const back = String(form.get("back") ?? "/stock");
  const delta = Math.trunc(Number(String(form.get("delta") ?? "").replace(",", ".")));

  if (!bullId || !REASONS.includes(reason)) redirect(`${back}${back.includes("?") ? "&" : "?"}message=error`);
  if (!Number.isFinite(delta) || delta === 0 || Math.abs(delta) > 999) {
    redirect(`/stock?message=stock_quantity`);
  }

  const { error } = await supabase.rpc("adjust_semen_stock", {
    p_bull: bullId,
    p_delta: delta,
    p_reason: reason,
  });
  if (error) {
    const empty = error.code === "23514" || /insuffisant|check/i.test(error.message);
    redirect(`/stock?message=${empty ? "stock_empty" : "error"}`);
  }

  revalidatePath("/stock");
  revalidatePath("/plan");
  redirect(back.startsWith("/") ? back : "/stock");
}

/** Retire du container un taureau dont il ne reste aucune dose. */
export async function removeFromStock(form: FormData) {
  const { supabase } = await requireUser();
  const bullId = String(form.get("bull_id") ?? "");
  const { error } = await supabase.from("semen_stock").delete().eq("bull_id", bullId).eq("doses", 0);
  if (error) redirect("/stock?message=error");
  revalidatePath("/stock");
  redirect("/stock");
}
