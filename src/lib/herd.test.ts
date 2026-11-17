import { describe, expect, it } from "vitest";
import { isHerdList, parseHerdList } from "./herd";

const HEADERS = ["N°", "N° BDTA", "Nom", "Nom long", "CR", "Classe de HB", "Date naiss.", "Lact.", "Sexe",
  "Père", "No BDTA Père", "Mère", "No BDTA mère", "Mère NB", "Père de la mère", "Date vêl.", "Statut DLC"];

describe("parseHerdList", () => {
  it("reconnaît la liste des animaux swissherdbook", () => {
    expect(isHerdList(HEADERS)).toBe(true);
    expect(isHerdList(["Nom court", "Identité"])).toBe(false);
  });

  it("lit identité, ascendance et lactations, ignore les mâles", () => {
    const rows = [
      [2, { richText: [{ text: "CH 120.1754" }, { text: ".8582.1" }] }, "BELINDA", "Du Clos Atwood BELINDA", "HO", "HB-A", new Date(Date.UTC(2024, 9, 2)), 0,
        "F", "ATWOOD-ET", "CA 8956379.2", "BILLIE", "CH 120.1206.6039.6", "Non", "BRETAGNE-ET", null, ""],
      [3, "CH 120.1206.6045.7", "KANZA", "Du Clos Urimate KANZA", "KR", "HB-A", new Date(Date.UTC(2018, 9, 4)), 4,
        "F", "URIMATE", null, "KENZA", null, "Non", "TOUCHDOWN", new Date(Date.UTC(2025, 8, 9)), "normal abgeschlossen"],
      [null, "CH 120.0000.0000.1", "TORO", null, "HO", null, null, null, "M"],
      [null, null, null],
    ];
    const result = parseHerdList(HEADERS, rows, new Set(["HO", "RH"]));
    expect(result.skippedMales).toEqual(["TORO"]);
    expect(result.animals).toHaveLength(2);
    const [belinda, kanza] = result.animals;
    expect(belinda).toMatchObject({
      earTag: "CH 120.1754.8582.1",
      name: "BELINDA",
      breedCode: "HO",
      birthDate: "2024-10-02",
      lactationNo: 0,
      sireName: "ATWOOD-ET",
      mgsName: "BRETAGNE-ET",
    });
    expect(belinda.details.pedigree).toEqual({
      sire: "ATWOOD-ET", sireId: "CA 8956379.2", dam: "BILLIE", damId: "CH 120.1206.6039.6", ds: "BRETAGNE-ET",
    });
    // Race inconnue de l'appli : pas de code, mais gardée dans la fiche.
    expect(kanza.breedCode).toBeNull();
    expect(kanza.lactationNo).toBe(4);
    expect(kanza.details.sections[0].items).toContainEqual(["Race", "KR"]);
    expect(kanza.details.sections[1].items).toContainEqual(["Dernier vêlage", "09.09.2025"]);
  });
});
