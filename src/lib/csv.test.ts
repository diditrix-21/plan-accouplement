import { describe, expect, it } from "vitest";
import { parseBullsCsv } from "./csv";
import { parseNumber } from "./forms";

const traitCodes = ["lait_kg", "mg_pct", "cellules"];

describe("parseNumber", () => {
  it("accepte les formats suisses", () => {
    expect(parseNumber("1,5")).toBe(1.5);
    expect(parseNumber("+250")).toBe(250);
    expect(parseNumber("1'250")).toBe(1250);
    expect(parseNumber("-0.18")).toBe(-0.18);
  });

  it("renvoie null pour vide ou invalide", () => {
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("abc")).toBeNull();
    expect(parseNumber(null)).toBeNull();
  });
});

describe("parseBullsCsv", () => {
  it("lit un export à points-virgules", () => {
    const csv = [
      "Nom;Race;Vendeur;Père;GPM;Prix;lait_kg;mg_pct;cellules",
      "TORO;RH;Swissgenetics;ALPHA;BETA;32,50;+850;-0,12;115",
    ].join("\n");
    const { bulls, errors, unknownColumns } = parseBullsCsv(csv, traitCodes);
    expect(errors).toEqual([]);
    expect(unknownColumns).toEqual([]);
    expect(bulls).toEqual([
      {
        name: "TORO",
        breed: "RH",
        supplier: "Swissgenetics",
        sire: "ALPHA",
        mgs: "BETA",
        price: 32.5,
        priceSexed: null,
        herdbookId: null,
        values: { lait_kg: 850, mg_pct: -0.12, cellules: 115 },
      },
    ]);
  });

  it("lit un copier-coller Excel (tabulations) et saute les cases vides", () => {
    const csv = "nom\tcellules\tlait_kg\nTORO\t\t400\nBRAVO\t108\t";
    const { bulls } = parseBullsCsv(csv, traitCodes);
    expect(bulls.map((b) => [b.name, b.values])).toEqual([
      ["TORO", { lait_kg: 400 }],
      ["BRAVO", { cellules: 108 }],
    ]);
  });

  it("signale les colonnes inconnues et les valeurs invalides", () => {
    const csv = "nom;couleur;cellules\nTORO;rouge;bon";
    const { bulls, errors, unknownColumns } = parseBullsCsv(csv, traitCodes);
    expect(unknownColumns).toEqual(["couleur"]);
    expect(errors).toHaveLength(1);
    expect(bulls[0].values).toEqual({});
  });

  it("refuse un fichier sans colonne nom", () => {
    const { bulls, errors } = parseBullsCsv("race;cellules\nRH;110", traitCodes);
    expect(bulls).toEqual([]);
    expect(errors).toEqual(["Colonne « nom » introuvable."]);
  });

  it("ignore une ligne sans nom", () => {
    const { bulls, errors } = parseBullsCsv("nom;cellules\n;110\nTORO;112", traitCodes);
    expect(bulls.map((b) => b.name)).toEqual(["TORO"]);
    expect(errors).toHaveLength(1);
  });
});
