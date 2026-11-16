"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function credentials(form: FormData) {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  return { email, password };
}

export async function signIn(form: FormData) {
  const { email, password } = credentials(form);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect("/login?message=invalid");
  redirect("/");
}

export async function signUp(form: FormData) {
  const { email, password } = credentials(form);
  if (password.length < 8) redirect("/login?message=short");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) redirect("/login?message=signup");
  // Sans session, Supabase attend la confirmation de l'adresse e-mail.
  if (!data.session) redirect("/login?message=confirm");
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
