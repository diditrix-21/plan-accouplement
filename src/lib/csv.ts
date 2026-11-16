import { parseNumber } from "./forms";

/**
 * Import de taureaux depuis un tableur (Excel → copier-coller, ou CSV).
 *
 * Première ligne = en-têtes. Séparateur : point-virgule, tabulation ou virgule
 * (détecté sur la ligne d'en-têtes). Colonnes reconnues :
 *   nom ; race ; vendeur ; pere ; gpm ; prix ; prix_sexe ; no_herdbook
 *   + un code de critère par colonne (lait_kg, cellules, membres, …)
 */

export type ImportedBull = {
  name: string;
  breed: string | null;
  supplier: string | null;
  sire: string | null;
  mgs: string | null;
  price: number | null;
  priceSexed: number | null;
  herdbookId: string | null;
  values: Record<string, number>;
};

export type ImportResult = {
  bulls: ImportedBull[];
  /** Colonnes qui ne correspondent à rien de connu. */
  unknownColumns: string[];
  errors: string[];
};

const FIELD_ALIASES: Record<string, keyof Omit<ImportedBull, "values">> = {
  nom: "name",
  taureau: "name",
  name: "name",
  race: "breed",
  vendeur: "supplier",
  fournisseur: "supplier",
  pere: "sire",
  gpm: "mgs",
  prix: "price",
  prix_sexe: "priceSexed",
  no_herdbook: "herdbookId",
};

function normalizeHeader(header: string): string {
  return header
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function detectSeparator(headerLine: string): string {
  const candidates = ["\t", ";", ","];
  return candidates.reduce((best, sep) =>
    headerLine.split(sep).length > headerLine.split(best).length ? sep : best,
  );
}

export function parseBullsCsv(input: string, traitCodes: string[]): ImportResult {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "");

  if (lines.length < 2) {
    return { bulls: [], unknownColumns: [], errors: ["Il faut une ligne d'en-têtes et au moins un taureau."] };
  }

  const separator = detectSeparator(lines[0]);
  const headers = lines[0].split(separator).map(normalizeHeader);
  const knownTraits = new Set(traitCodes);
  const unknownColumns = headers.filter(
    (h) => h !== "" && !(h in FIELD_ALIASES) && !knownTraits.has(h),
  );

  if (!headers.some((h) => FIELD_ALIASES[h] === "name")) {
    return { bulls: [], unknownColumns, errors: ["Colonne « nom » introuvable."] };
  }

  const bulls: ImportedBull[] = [];
  const errors: string[] = [];

  lines.slice(1).forEach((line, index) => {
    const cells = line.split(separator).map((cell) => cell.trim());
    const bull: ImportedBull = {
      name: "",
      breed: null,
      supplier: null,
      sire: null,
      mgs: null,
      price: null,
      priceSexed: null,
      herdbookId: null,
      values: {},
    };

    headers.forEach((header, column) => {
      const cell = cells[column] ?? "";
      if (cell === "") return;
      const field = FIELD_ALIASES[header];

      if (field === "price" || field === "priceSexed") {
        bull[field] = parseNumber(cell);
      } else if (field) {
        bull[field] = cell;
      } else if (knownTraits.has(header)) {
        const value = parseNumber(cell);
        if (value === null) {
          errors.push(`Ligne ${index + 2} : « ${cell} » n'est pas un nombre (${header}).`);
        } else {
          bull.values[header] = value;
        }
      }
    });

    if (bull.name === "") errors.push(`Ligne ${index + 2} : nom manquant, ligne ignorée.`);
    else bulls.push(bull);
  });

  return { bulls, unknownColumns, errors };
}
