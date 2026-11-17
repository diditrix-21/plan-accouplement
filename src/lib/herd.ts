import type { CatalogDetails, DetailSection, Pedigree } from "./swissgenetics";

/**
 * Lecture de la « liste des animaux » exportée de swissherdbook / Holstein
 * Switzerland (fichier Excel « Tous les animaux »), une ligne par animal.
 * On reprend l'identité, l'ascendance et les lactations ; ce fichier ne
 * contient pas de valeurs d'élevage.
 */

export type HerdAnimal = {
  earTag: string;
  name: string;
  breedCode: string | null;
  birthDate: string | null;
  lactationNo: number;
  sireName: string | null;
  mgsName: string | null;
  details: CatalogDetails;
};

export type HerdResult = {
  animals: HerdAnimal[];
  skippedMales: string[];
  skippedNoId: number;
};

/** « N° BDTA » → « n bdta » : majuscules, accents, points et espaces ignorés. */
function normalize(header: string): string {
  return header
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const COLUMNS = {
  number: ["n"],
  earTag: ["n bdta", "no bdta", "bdta"],
  name: ["nom"],
  longName: ["nom long"],
  breed: ["cr", "race"],
  herdbookClass: ["classe de hb"],
  birthDate: ["date naiss", "date de naissance"],
  lactations: ["lact", "lactations"],
  sex: ["sexe"],
  sire: ["pere"],
  sireId: ["no bdta pere"],
  dam: ["mere"],
  damId: ["no bdta mere"],
  damNb: ["mere nb"],
  mgs: ["pere de la mere"],
  calvingDate: ["date vel", "date de velage"],
  milkStatus: ["statut dlc"],
  originFarm: ["expl d org"],
  originFarmId: ["no bdta expl d org"],
  organisation: ["org"],
  dateDe: ["date de"],
} as const;

type Key = keyof typeof COLUMNS;

/** Texte d'une cellule Excel (dates au format suisse, nombres sans « .0 »). */
export function cellText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toLocaleDateString("fr-CH", { timeZone: "UTC" });
  // Texte enrichi d'Excel : { richText: [{ text }, ...] }.
  if (typeof value === "object" && value !== null && "richText" in value) {
    const parts = (value as { richText: { text?: unknown }[] }).richText;
    return cellText(parts.map((part) => String(part.text ?? "")).join(""));
  }
  if (typeof value === "object" && value !== null && "text" in value) {
    return cellText((value as { text: unknown }).text);
  }
  if (typeof value === "object" && value !== null && "result" in value) {
    return cellText((value as { result: unknown }).result);
  }
  const text = String(value).replace(/\s+/g, " ").trim();
  return text === "" ? null : text;
}

function isoDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const text = cellText(value);
  const match = text?.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (match) return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  return null;
}

export function isHerdList(headers: unknown[]): boolean {
  const names = headers.map((h) => normalize(cellText(h) ?? ""));
  return COLUMNS.earTag.some((c) => names.includes(c)) && names.includes("nom");
}

/**
 * @param headers première ligne du fichier
 * @param rows lignes suivantes (valeurs brutes des cellules)
 * @param knownBreeds codes de race connus de l'appli
 */
export function parseHerdList(
  headers: unknown[],
  rows: unknown[][],
  knownBreeds: Set<string>,
): HerdResult {
  const names = headers.map((h) => normalize(cellText(h) ?? ""));
  const index = Object.fromEntries(
    (Object.keys(COLUMNS) as Key[]).map((key) => [
      key,
      names.findIndex((n) => (COLUMNS[key] as readonly string[]).includes(n)),
    ]),
  ) as Record<Key, number>;
  const raw = (row: unknown[], key: Key) => (index[key] === -1 ? null : row[index[key]]);
  const get = (row: unknown[], key: Key) => cellText(raw(row, key));

  const animals: HerdAnimal[] = [];
  const skippedMales: string[] = [];
  let skippedNoId = 0;

  for (const row of rows) {
    const earTag = get(row, "earTag");
    const name = get(row, "name");
    if (!earTag || !name) {
      if (row.some((cell) => cellText(cell))) skippedNoId += 1;
      continue;
    }
    if (get(row, "sex") === "M") {
      skippedMales.push(name);
      continue;
    }

    const breed = get(row, "breed");
    const lactations = Number(get(row, "lactations") ?? 0);

    const pedigree: Pedigree = {};
    const put = (key: keyof Pedigree, value: string | null) => {
      if (value) pedigree[key] = value;
    };
    put("sire", get(row, "sire"));
    put("sireId", get(row, "sireId"));
    put("dam", get(row, "dam"));
    put("damId", get(row, "damId"));
    put("ds", get(row, "mgs"));

    const section = (title: string, items: [string, string | null][]): DetailSection | null => {
      const kept = items.filter((item): item is [string, string] => item[1] !== null);
      return kept.length > 0 ? { title, items: kept } : null;
    };
    const origin = [get(row, "originFarm"), get(row, "originFarmId")].filter(Boolean).join(" · ");
    const sections = [
      section("Identité", [
        ["Nom complet", get(row, "longName")],
        ["N° BDTA", earTag],
        ["Race", breed],
        ["Classe de herd-book", get(row, "herdbookClass")],
        ["Date de naissance", get(row, "birthDate")],
        ["Organisation d'élevage", get(row, "organisation")],
        ["Exploitation d'origine", origin || null],
        ["Mère NB", get(row, "damNb")],
        ["N° dans la liste", get(row, "number")],
      ]),
      section("Lactations et contrôle laitier", [
        ["Nombre de lactations", get(row, "lactations")],
        ["Dernier vêlage", get(row, "calvingDate")],
        ["Statut du contrôle laitier", get(row, "milkStatus")],
        ["Date (colonne « Date de »)", get(row, "dateDe")],
      ]),
    ].filter((s): s is DetailSection => s !== null);

    animals.push({
      earTag,
      name,
      breedCode: breed && knownBreeds.has(breed) ? breed : null,
      birthDate: isoDate(raw(row, "birthDate")),
      lactationNo: Number.isFinite(lactations) && lactations > 0 ? Math.round(lactations) : 0,
      sireName: get(row, "sire"),
      mgsName: get(row, "mgs"),
      details: { pedigree, sections },
    });
  }

  return { animals, skippedMales, skippedNoId };
}
