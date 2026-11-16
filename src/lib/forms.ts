/** Petits helpers pour lire les formulaires envoyés aux Server Actions. */

export function text(form: FormData, name: string): string | null {
  const raw = form.get(name);
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
}

/** Accepte « 1,5 », « 1.5 », « +250 », « 1'250 ». Vide ou invalide → null. */
export function parseNumber(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  const cleaned = raw.trim().replace(/['’\s]/g, "").replace(",", ".");
  if (cleaned === "") return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

export function number(form: FormData, name: string): number | null {
  const raw = form.get(name);
  return typeof raw === "string" ? parseNumber(raw) : null;
}

export function formatNumber(value: number, digits = 0): string {
  return value.toLocaleString("fr-CH", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatChf(value: number | null): string {
  return value === null ? "—" : `${formatNumber(Number(value), 2)} CHF`;
}
