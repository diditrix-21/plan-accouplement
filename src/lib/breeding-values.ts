import { cellText } from "./herd";
import type { DetailSection } from "./swissgenetics";

/**
 * Lecture de la « liste des valeurs d'élevage » exportée de swissherdbook
 * (fichier Excel, une ligne par animal). Les valeurs sont sur l'échelle
 * suisse, comme celles du catalogue : index 100 ± 12, production en kg / %.
 */

type Column = {
  /** En-tête du fichier (comparé sans espaces superflus ni casse). */
  header: string;
  /** Libellé affiché dans la fiche. */
  label: string;
  section: SectionKey;
  /** Critère de l'appli alimenté par cette colonne. */
  trait?: string;
};

type SectionKey = "ve" | "index" | "production" | "health" | "morphology";

/** Titres des rubriques ajoutées à la fiche : remplacées à chaque import. */
export const BREEDING_VALUE_SECTIONS: Record<SectionKey, string> = {
  ve: "Valeurs d'élevage",
  index: "Index globaux (vache)",
  production: "Production laitière (vache)",
  health: "Santé et caractères fonctionnels (vache)",
  morphology: "Morphologie linéaire (vache)",
};

export const BREEDING_VALUE_COLUMNS: Column[] = [
  { header: "VE Date", label: "Date de l'estimation", section: "ve" },
  { header: "VE Label", label: "Type d'estimation (code swissherdbook)", section: "ve" },
  { header: "Base", label: "Base", section: "ve" },
  { header: "ISET", label: "ISET", section: "index" },
  { header: "IPL", label: "IPL (production laitière)", section: "index" },
  { header: "IFF", label: "IFF (fitness)", section: "index" },
  { header: "IFV", label: "IFV", section: "index" },
  { header: "ITP", label: "ITP (note globale)", section: "index", trait: "note_globale" },
  { header: "B% Lait kg", label: "Sécurité lait (%)", section: "production" },
  { header: "Lait kg", label: "Lait (kg)", section: "production", trait: "lait_kg" },
  { header: "Mat.gr. kg", label: "Matière grasse (kg)", section: "production", trait: "mg_kg" },
  { header: "Mat.gr.%", label: "Matière grasse (%)", section: "production", trait: "mg_pct" },
  { header: "Protéine kg", label: "Protéine (kg)", section: "production", trait: "prot_kg" },
  { header: "Prot.%", label: "Protéine (%)", section: "production", trait: "prot_pct" },
  { header: "Pers.", label: "Persistance", section: "production", trait: "persistance" },
  { header: "Cell.", label: "Cellules", section: "health", trait: "cellules" },
  { header: "Fécondité", label: "Fécondité", section: "health", trait: "fertilite" },
  { header: "Résistance", label: "Résistance aux mammites", section: "health", trait: "mammites" },
  { header: "AT", label: "Aptitude à la traite", section: "health", trait: "vitesse_traite" },
  { header: "Santé onglons", label: "Santé des onglons", section: "health", trait: "onglons" },
  { header: "Derm. dig.", label: "Dermatite digitale", section: "health" },
  { header: "Ligne blanche", label: "Ligne blanche", section: "health" },
  { header: "Path. inf.", label: "Pathologies infectieuses des onglons", section: "health" },
  { header: "Path. non inf.", label: "Pathologies non infectieuses des onglons", section: "health" },
  { header: "Méthane", label: "Méthane", section: "health" },
  { header: "Format", label: "Format", section: "morphology", trait: "format_capacite" },
  { header: "Croupe", label: "Croupe", section: "morphology", trait: "croupe" },
  { header: "Membres", label: "Membres", section: "morphology", trait: "membres" },
  { header: "Pis", label: "Pis", section: "morphology", trait: "systeme_mammaire" },
  { header: "Trayons", label: "Trayons", section: "morphology", trait: "trayons" },
  { header: "Hauteur à la croupe", label: "Hauteur à la croupe", section: "morphology" },
  { header: "Haut. rel. avant-main", label: "Hauteur relative de l'avant-main", section: "morphology" },
  { header: "Largeur de poitrine", label: "Largeur de poitrine", section: "morphology" },
  { header: "Profondeur", label: "Profondeur", section: "morphology" },
  { header: "Rein", label: "Rein", section: "morphology" },
  { header: "Structure des côtes", label: "Structure des côtes", section: "morphology" },
  { header: "Position des ischions", label: "Position des ischions", section: "morphology" },
  { header: "Largeur aux ischions", label: "Largeur aux ischions", section: "morphology" },
  { header: "Qualité d'ossature", label: "Qualité d'ossature", section: "morphology" },
  { header: "Angle du jarret", label: "Angle du jarret", section: "morphology" },
  { header: "Angle du pied", label: "Angle du pied", section: "morphology" },
  { header: "Hauteur du talon", label: "Hauteur du talon", section: "morphology" },
  { header: "Aplombs arrières", label: "Aplombs arrière", section: "morphology" },
  { header: "Mobilité", label: "Mobilité", section: "morphology" },
  { header: "Attache avant", label: "Attache avant", section: "morphology" },
  { header: "Attache arr. hauteur", label: "Attache arrière (hauteur)", section: "morphology" },
  { header: "Attache arr. largeur", label: "Attache arrière (largeur)", section: "morphology" },
  { header: "Ligament", label: "Ligament", section: "morphology" },
  { header: "Profondeur du pis", label: "Profondeur du pis", section: "morphology" },
  { header: "Texture", label: "Texture", section: "morphology" },
  { header: "Longueur trayons avant", label: "Longueur des trayons avant", section: "morphology" },
  { header: "Impl. trayons avant", label: "Implantation des trayons avant", section: "morphology" },
  { header: "Impl. trayons arrière", label: "Implantation des trayons arrière", section: "morphology" },
];

const SECTION_ORDER: SectionKey[] = ["ve", "index", "production", "health", "morphology"];

export type BreedingValues = {
  earTag: string;
  name: string | null;
  /** Critères de l'appli → valeur. */
  traits: Record<string, number>;
  sections: DetailSection[];
};

function norm(header: unknown): string {
  return (cellText(header) ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

export function isBreedingValueList(headers: unknown[]): boolean {
  const names = headers.map(norm);
  return names.includes("n° bdta") && names.includes("iset") && names.includes("ve date");
}

export function parseBreedingValues(headers: unknown[], rows: unknown[][]): BreedingValues[] {
  const names = headers.map(norm);
  const tagIndex = names.indexOf("n° bdta");
  const nameIndex = names.indexOf("nom");
  const columns = BREEDING_VALUE_COLUMNS.map((column) => ({
    ...column,
    index: names.indexOf(column.header.toLowerCase()),
  })).filter((column) => column.index !== -1);

  const result: BreedingValues[] = [];
  for (const row of rows) {
    const earTag = cellText(row[tagIndex]);
    if (!earTag) continue;

    const traits: Record<string, number> = {};
    const bySection = new Map<SectionKey, [string, string][]>();
    for (const column of columns) {
      const text = cellText(row[column.index]);
      if (!text) continue;
      if (column.trait) {
        const value = Number(text);
        if (Number.isFinite(value)) traits[column.trait] = value;
      }
      if (!bySection.has(column.section)) bySection.set(column.section, []);
      bySection.get(column.section)!.push([column.label, text]);
    }

    result.push({
      earTag,
      name: nameIndex === -1 ? null : cellText(row[nameIndex]),
      traits,
      sections: SECTION_ORDER.filter((key) => bySection.has(key)).map((key) => ({
        title: BREEDING_VALUE_SECTIONS[key],
        items: bySection.get(key)!,
      })),
    });
  }
  return result;
}

/** Remplace les rubriques « valeurs d'élevage » d'une fiche, garde les autres. */
export function mergeSections(existing: DetailSection[], fresh: DetailSection[]): DetailSection[] {
  const replaced = new Set(Object.values(BREEDING_VALUE_SECTIONS));
  return [...existing.filter((s) => !replaced.has(s.title)), ...fresh];
}

/** Compare deux N° BDTA en ignorant « CH », espaces et points. */
export function sameEarTag(a: string | null | undefined, b: string | null | undefined): boolean {
  const digits = (value: string | null | undefined) => (value ?? "").replace(/\D/g, "");
  return digits(a) !== "" && digits(a) === digits(b);
}
