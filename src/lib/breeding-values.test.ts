import { describe, expect, it } from "vitest";
import { isBreedingValueList, mergeSections, parseBreedingValues } from "./breeding-values";

const HEADERS = [null, "N°", "Nom", "N° BDTA", "Date de naissance", "VE Date", "VE Label", "Base", "ISET",
  "Lait kg", "Mat.gr.%", "Cell.", "Résistance ", "AT", "ITP", "Pis", "Trayons", "Angle du jarret"];
const ROW = [null, 2, "BELINDA", "CH 120.1754.8582.1", new Date(Date.UTC(2024, 9, 2)), new Date(Date.UTC(2026, 7, 11)),
  "A", "HO26", 995, 315, -0.01, 99, 98, 98, 110, 102, "", 97];

describe("valeurs d'élevage swissherdbook", () => {
  it("reconnaît le fichier", () => {
    expect(isBreedingValueList(HEADERS)).toBe(true);
    expect(isBreedingValueList(["N° BDTA", "Nom"])).toBe(false);
  });

  it("lit les critères du plan et toutes les rubriques", () => {
    const [cow] = parseBreedingValues(HEADERS, [ROW]);
    expect(cow.earTag).toBe("CH 120.1754.8582.1");
    expect(cow.traits).toEqual({
      lait_kg: 315,
      mg_pct: -0.01,
      cellules: 99,
      mammites: 98,
      vitesse_traite: 98,
      note_globale: 110,
      systeme_mammaire: 102,
    });
    expect(cow.sections.map((s) => s.title)).toEqual([
      "Valeurs d'élevage",
      "Index globaux (vache)",
      "Production laitière (vache)",
      "Santé et caractères fonctionnels (vache)",
      "Morphologie linéaire (vache)",
    ]);
    expect(cow.sections[0].items).toContainEqual(["Date de l'estimation", "11.08.2026"]);
    expect(cow.sections[4].items).toContainEqual(["Angle du jarret", "97"]);
  });

  it("remplace les anciennes rubriques sans toucher aux autres", () => {
    const [cow] = parseBreedingValues(HEADERS, [ROW]);
    const merged = mergeSections(
      [
        { title: "Identité", items: [["N° BDTA", "x"]] },
        { title: "Index globaux (vache)", items: [["ISET", "1"]] },
      ],
      cow.sections,
    );
    expect(merged[0].title).toBe("Identité");
    expect(merged.filter((s) => s.title === "Index globaux (vache)")).toHaveLength(1);
    expect(merged.find((s) => s.title === "Index globaux (vache)")?.items).toContainEqual(["ISET", "995"]);
  });
});
