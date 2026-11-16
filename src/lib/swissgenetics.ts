import { parseNumber } from "./forms";

/**
 * Lecture des exports CSV du catalogue Swissgenetics (un fichier par race,
 * séparateur « ; », en-têtes en français).
 *
 * Les valeurs d'élevage ne sont pas toutes publiées sur la même échelle : la
 * colonne « VE » donne la base de chaque taureau (« GA HO 08.26 » = base
 * suisse, « FR 08.26 » = base française, etc.). L'appli travaille sur
 * l'échelle suisse (index 100 ± 12, production en kg). Les index étrangers
 * sont donc ramenés à cette échelle à l'import ; quand l'échelle d'une colonne
 * n'est pas sûre, la valeur n'est pas importée.
 *
 * ATTENTION : même convertis, un 110 danois et un 110 suisse ne se comparent
 * pas exactement (les populations de référence diffèrent). C'est une
 * approximation, signalée dans l'appli par la base affichée sur chaque taureau.
 */

export type ScaleProfile = "suisse" | "de_at" | "france" | "canada" | "nordique" | "inconnue";

export type CatalogBull = {
  name: string;
  fullName: string | null;
  herdbookId: string;
  breed: string | null;
  evalBase: string | null;
  profile: ScaleProfile;
  sire: string | null;
  mgs: string | null;
  price: number | null;
  priceSexed: number | null;
  polled: "PP" | "Pp" | null;
  kappaCasein: string | null;
  betaCasein: string | null;
  values: Record<string, number>;
};

export type CatalogResult = {
  bulls: CatalogBull[];
  /** Lignes ignorées (sans identité) et valeurs écartées car hors échelle. */
  warnings: string[];
};

/** Vrai si le texte ressemble à un export Swissgenetics. */
export function isSwissgeneticsCsv(text: string): boolean {
  const header = text.replace(/^﻿/, "").split(/\r?\n/, 1)[0] ?? "";
  return header.includes("Nom court") && header.includes("Identité") && header.includes("Race");
}

/** Découpe un CSV à point-virgule en tenant compte des guillemets. */
export function parseDelimited(text: string, separator = ";"): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const source = text.replace(/^﻿/, "");

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === separator) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

export function profileOf(evalBase: string | null): ScaleProfile {
  if (!evalBase) return "inconnue";
  if (evalBase.includes("DE/AT")) return "de_at";
  if (/^FR\b/.test(evalBase)) return "france";
  if (/^CA\b/.test(evalBase)) return "canada";
  if (/^DK\b/.test(evalBase)) return "nordique";
  // Bases suisses : « G », « GA », « GI » ou « A », suivi de la race (HO, BS, 60…).
  if (/^(G|GA|GI|A)\s+\S+/.test(evalBase)) return "suisse";
  return "inconnue";
}

type Conversion = (value: number) => number | null;

/** Garde la valeur telle quelle si elle est plausible pour un index 100 ± 12. */
const index100: Conversion = (v) => (v >= 40 && v <= 160 ? v : null);
/** Production (kg ou %) : telle quelle. */
const asIs: Conversion = (v) => v;
/** France, caractères fonctionnels : écarts-types génétiques (0 ± 1). */
const fromSdUnits: Conversion = (v) => (Math.abs(v) <= 5 ? 100 + 12 * v : null);
/** Canada, caractères fonctionnels : 100 ± 5. */
const fromCanadaFunctional: Conversion = (v) =>
  v >= 70 && v <= 130 ? 100 + (v - 100) * (12 / 5) : null;
/** Canada, conformation : 0 ± 5. */
const fromCanadaType: Conversion = (v) => (Math.abs(v) <= 25 ? 100 + v * (12 / 5) : null);
/** Pays nordiques (NAV) : 100 ± 10. */
const fromNordic: Conversion = (v) => (v >= 50 && v <= 150 ? 100 + (v - 100) * 1.2 : null);

/** Pour un critère : colonnes candidates (la première présente dans le fichier gagne). */
type Mapping = Record<string, { columns: string[]; convert: Conversion }>;

const PRODUCTION: Mapping = {
  lait_kg: { columns: ["Lait kg"], convert: asIs },
  mg_kg: { columns: ["Graisse kg"], convert: asIs },
  mg_pct: { columns: ["Graisse %"], convert: asIs },
  prot_kg: { columns: ["Protéine kg"], convert: asIs },
  prot_pct: { columns: ["Protéine %"], convert: asIs },
};

const SWISS: Mapping = {
  ...PRODUCTION,
  cellules: { columns: ["Cellules somatiques"], convert: index100 },
  mammites: { columns: ["Résistance aux mammites"], convert: index100 },
  onglons: { columns: ["Santé des onglons"], convert: index100 },
  duree_utilisation: { columns: ["Durée d'utilisation"], convert: index100 },
  fertilite: { columns: ["Fertilité"], convert: index100 },
  persistance: { columns: ["Persistance"], convert: index100 },
  velage_direct: { columns: ["Vêlage direct", "Vêlages normaux taureau"], convert: index100 },
  velage_filles: { columns: ["Vêlage filles", "Vêlages normaux filles"], convert: index100 },
  // swissherdbook publie aussi « Aptitude à la traite » en kg/min : on ne la
  // prend que si le fichier n'a pas de colonne « Vitesse de traite ».
  vitesse_traite: { columns: ["Vitesse de traite", "Aptitude à la traite"], convert: index100 },
  temperament: { columns: ["Tempérament"], convert: index100 },
  bcs: { columns: ["BCS"], convert: index100 },
  note_globale: { columns: ["Note globale"], convert: index100 },
  format_capacite: { columns: ["Format & Capacité", "Gabarit"], convert: index100 },
  croupe: { columns: ["Croupe", "Bassin"], convert: index100 },
  membres: { columns: ["Membres"], convert: index100 },
  systeme_mammaire: { columns: ["Système mammaire", "Mamelle"], convert: index100 },
  trayons: { columns: ["Trayons"], convert: index100 },
};

const MAPPINGS: Record<ScaleProfile, Mapping> = {
  suisse: SWISS,
  // Allemagne/Autriche : même convention (100 ± 12) que la Suisse.
  de_at: SWISS,
  france: {
    ...PRODUCTION,
    cellules: { columns: ["Cellules"], convert: fromSdUnits },
    mammites: { columns: ["Mammites cliniques"], convert: fromSdUnits },
    onglons: { columns: ["Santé du pied"], convert: fromSdUnits },
    duree_utilisation: { columns: ["Longévité"], convert: fromSdUnits },
    fertilite: { columns: ["Fertilité vaches"], convert: fromSdUnits },
    vitesse_traite: { columns: ["Vitesse de traite"], convert: index100 },
    temperament: { columns: ["Tempérament"], convert: index100 },
    note_globale: { columns: ["ITP"], convert: index100 },
    format_capacite: { columns: ["Format"], convert: index100 },
    membres: { columns: ["Membres"], convert: index100 },
    systeme_mammaire: { columns: ["Système mammaire"], convert: index100 },
    trayons: { columns: ["Trayons"], convert: index100 },
    // Facilité de naissance / de vêlage : échelle française non confirmée,
    // volontairement non importée.
  },
  canada: {
    ...PRODUCTION,
    cellules: { columns: ["Cellules somatiques"], convert: fromCanadaFunctional },
    mammites: { columns: ["Santé du pis"], convert: fromCanadaFunctional },
    duree_utilisation: { columns: ["Durée d'utilisation"], convert: fromCanadaFunctional },
    fertilite: { columns: ["Fertilité"], convert: fromCanadaFunctional },
    persistance: { columns: ["Persistance"], convert: fromCanadaFunctional },
    vitesse_traite: { columns: ["Aptitude à la traite"], convert: fromCanadaFunctional },
    note_globale: { columns: ["Note globale"], convert: fromCanadaType },
    croupe: { columns: ["Bassin"], convert: fromCanadaType },
    membres: { columns: ["Membres"], convert: fromCanadaType },
    systeme_mammaire: { columns: ["Mamelle"], convert: fromCanadaType },
  },
  nordique: {
    // La production nordique est publiée en index, pas en kg : non importée.
    mammites: { columns: ["Santé du pis"], convert: fromNordic },
    onglons: { columns: ["Santé des onglons"], convert: fromNordic },
    duree_utilisation: { columns: ["Durée d'utilisation"], convert: fromNordic },
    fertilite: { columns: ["Fertilité"], convert: fromNordic },
    persistance: { columns: ["Persistance"], convert: fromNordic },
    vitesse_traite: { columns: ["Aptitude à la traite"], convert: fromNordic },
    temperament: { columns: ["Tempérament"], convert: fromNordic },
    format_capacite: { columns: ["Gabarit"], convert: fromNordic },
    membres: { columns: ["Membres"], convert: fromNordic },
    systeme_mammaire: { columns: ["Mamelle"], convert: fromNordic },
  },
  inconnue: {},
};

function clean(raw: string | undefined): string | null {
  if (raw === undefined) return null;
  const value = raw.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  return value === "" ? null : value;
}

/** « 43.00 » → 43 ; « 18.00*** / 43.00 » (action / prix normal) → 43. */
export function parsePrice(raw: string | undefined): number | null {
  const text = clean(raw);
  if (!text) return null;
  const last = text.split("/").pop() ?? "";
  const value = parseNumber(last.replace(/\*/g, ""));
  return value !== null && value >= 0 ? value : null;
}

/** « 107|107 » (deux publications) → 107. */
function parseValue(raw: string | undefined): number | null {
  const text = clean(raw);
  if (!text) return null;
  return parseNumber(text.split("|")[0]);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function parseSwissgeneticsCsv(text: string): CatalogResult {
  const rows = parseDelimited(text);
  const warnings: string[] = [];
  if (rows.length === 0) return { bulls: [], warnings: ["Fichier vide."] };

  const headers = rows[0].map((h) => h.trim());
  // Certaines colonnes existent en double (« Nombre de filles ») : on garde la première.
  const column = (name: string) => headers.indexOf(name);
  const cell = (row: string[], name: string) => {
    const index = column(name);
    return index === -1 ? undefined : row[index];
  };
  const flag = (row: string[], name: string) => clean(cell(row, name)) === "1";

  let outOfScale = 0;
  const bulls: CatalogBull[] = [];

  rows.slice(1).forEach((row, lineIndex) => {
    const herdbookId = clean(cell(row, "Identité"));
    if (!herdbookId) {
      warnings.push(`Ligne ${lineIndex + 2} : pas d'identité, ignorée.`);
      return;
    }

    const fullName = clean(cell(row, "Nom complet"));
    const evalBase = clean(cell(row, "VE"));
    const profile = profileOf(evalBase);

    const values: Record<string, number> = {};
    for (const [code, mapping] of Object.entries(MAPPINGS[profile])) {
      const source = mapping.columns.find((name) => column(name) !== -1);
      if (!source) continue;
      const raw = parseValue(cell(row, source));
      if (raw === null) continue;
      const converted = mapping.convert(raw);
      if (converted === null) {
        outOfScale += 1;
        continue;
      }
      values[code] = round(converted);
    }

    bulls.push({
      name: clean(cell(row, "Nom court")) ?? fullName ?? herdbookId,
      fullName,
      herdbookId,
      breed: clean(cell(row, "Race")),
      evalBase,
      profile,
      sire: clean(cell(row, "Nom du père")),
      // « PM » = père de la mère, c'est-à-dire le grand-père maternel.
      mgs: clean(cell(row, "Nom PM")),
      price: parsePrice(cell(row, "N [CHF]")),
      priceSexed: parsePrice(cell(row, "X [CHF]")),
      polled: flag(row, "Sans cornes PP") ? "PP" : flag(row, "Sans cornes Pp") ? "Pp" : null,
      kappaCasein: clean(cell(row, "κ-cas.")),
      betaCasein: clean(cell(row, "β-cas.")),
      values,
    });
  });

  if (outOfScale > 0) {
    warnings.push(`${outOfScale} valeur(s) hors échelle attendue, non importée(s).`);
  }
  return { bulls, warnings };
}

/**
 * Fusionne plusieurs fichiers : un taureau présent deux fois (ex. un OB listé
 * aussi parmi les races à viande) n'est gardé qu'une fois, avec la fiche la
 * plus complète.
 */
export function mergeCatalogs(results: CatalogResult[]): CatalogResult {
  const byId = new Map<string, CatalogBull>();
  for (const result of results) {
    for (const bull of result.bulls) {
      const existing = byId.get(bull.herdbookId);
      if (!existing || Object.keys(bull.values).length > Object.keys(existing.values).length) {
        byId.set(bull.herdbookId, bull);
      }
    }
  }
  return { bulls: [...byId.values()], warnings: results.flatMap((r) => r.warnings) };
}
