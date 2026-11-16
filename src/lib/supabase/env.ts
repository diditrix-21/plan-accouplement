export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Variables Supabase manquantes : copie .env.example vers .env.local et remplis-le.",
    );
  }
  return { url, key };
}
