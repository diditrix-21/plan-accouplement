import { describe, expect, it } from "vitest";
import {
  isSwissgeneticsCsv,
  mergeCatalogs,
  parseDelimited,
  parsePrice,
  parseSwissgeneticsCsv,
  profileOf,
} from "./swissgenetics";

const SWISS = [
  '"Nom court";"Nom complet";Identité;Race;VE;"Sans cornes PP";"Sans cornes Pp";"Nom du père";"Nom PM";κ-cas.;β-cas.;"Lait kg";"Graisse %";"Cellules somatiques";"Vitesse de traite";"Aptitude à la traite";"Vêlage direct";"Système mammaire";"X [CHF]";"N [CHF]"',
  'TORO;"Ferme\'s Alpha TORO";"CH 120.0000.0001.1";HO;"GA HO 08.26";;1;ALPHA;"BETA <br/>";AB;A2/A2;1250;-0.12;118;104;2.95;96;121;64.00;"18.00*** / 43.00"',
  'VIDE;VIDE;;HO;"GA HO 08.26";;;;;;;;;;;;;;;',
].join("\n");

describe("parseDelimited", () => {
  it("gère les guillemets, les points-virgules cités et le BOM", () => {
    expect(parseDelimited('﻿a;"b;c";"d ""e"""\r\n1;2;3\n')).toEqual([
      ["a", "b;c", 'd "e"'],
      ["1", "2", "3"],
    ]);
  });
});

describe("profileOf", () => {
  it("reconnaît la base des valeurs d'élevage", () => {
    expect(profileOf("GA HO 08.26")).toBe("suisse");
    expect(profileOf("G 60 08.26")).toBe("suisse");
    expect(profileOf("GA DE/AT 08.26")).toBe("de_at");
    expect(profileOf("FR 08.26")).toBe("france");
    expect(profileOf("CA 08.26")).toBe("canada");
    expect(profileOf("DK 08.26")).toBe("nordique");
    expect(profileOf("CH 08.26")).toBe("inconnue");
    expect(profileOf(null)).toBe("inconnue");
  });
});

describe("parsePrice", () => {
  it("prend le prix normal quand une action est affichée", () => {
    expect(parsePrice("43.00")).toBe(43);
    expect(parsePrice("18.00*** / 43.00")).toBe(43);
    expect(parsePrice("")).toBeNull();
  });
});

describe("parseSwissgeneticsCsv", () => {
  it("reconnaît un export Swissgenetics", () => {
    expect(isSwissgeneticsCsv(SWISS)).toBe(true);
    expect(isSwissgeneticsCsv("nom;race;lait_kg\nTORO;HO;500")).toBe(false);
  });

  it("lit un taureau sur base suisse", () => {
    const { bulls, warnings } = parseSwissgeneticsCsv(SWISS);
    expect(warnings).toEqual(["Ligne 3 : pas d'identité, ignorée."]);
    expect(bulls).toHaveLength(1);
    expect(bulls[0]).toMatchObject({
      name: "TORO",
      fullName: "Ferme's Alpha TORO",
      herdbookId: "CH 120.0000.0001.1",
      breed: "HO",
      evalBase: "GA HO 08.26",
      profile: "suisse",
      sire: "ALPHA",
      mgs: "BETA",
      price: 43,
      priceSexed: 64,
      polled: "Pp",
      kappaCasein: "AB",
      betaCasein: "A2/A2",
    });
    // « Aptitude à la traite » (kg/min) est ignorée quand « Vitesse de traite » existe.
    expect(bulls[0].values).toEqual({
      lait_kg: 1250,
      mg_pct: -0.12,
      cellules: 118,
      vitesse_traite: 104,
      velage_direct: 96,
      systeme_mammaire: 121,
    });
  });

  it("ramène les index français à l'échelle 100 ± 12", () => {
    const csv = [
      'Nom court;Nom complet;Identité;Race;VE;Lait kg;Cellules;Longévité;Membres;"Facilité de naissance des veaux"',
      "MONTO;MONTO;FR 01;MO;FR 08.26;900;1.5;-0.5;112;95",
    ].join("\n");
    expect(parseSwissgeneticsCsv(csv).bulls[0].values).toEqual({
      lait_kg: 900,
      cellules: 118,
      duree_utilisation: 94,
      membres: 112,
    });
  });

  it("ramène les index canadiens et nordiques à l'échelle 100 ± 12", () => {
    const csv = [
      "Nom court;Nom complet;Identité;Race;VE;Lait kg;Fertilité;Santé du pis;Membres;Mamelle;Note globale;Cellules somatiques",
      "CANA;CANA;CA 01;JE;CA 08.26;300;105;95;5;10;-5;107|107",
      "NORD;NORD;DK 01;JE;DK 08.26;;110;90;120;100;;",
    ].join("\n");
    const [canada, nordic] = parseSwissgeneticsCsv(csv).bulls;
    expect(canada.values).toEqual({
      lait_kg: 300,
      fertilite: 112,
      mammites: 88,
      membres: 112,
      systeme_mammaire: 124,
      note_globale: 88,
      cellules: 116.8,
    });
    expect(nordic.values).toEqual({
      fertilite: 112,
      mammites: 88,
      membres: 124,
      systeme_mammaire: 100,
    });
  });

  it("n'importe aucun critère quand la base n'est pas indiquée, ni les valeurs hors échelle", () => {
    const csv = [
      "Nom court;Nom complet;Identité;Race;VE;Lait kg;Membres",
      "HERENS;HERENS;CH 02;HR;;400;1.2",
      "BIZARRE;BIZARRE;CH 03;HO;GA HO 08.26;400;1.2",
    ].join("\n");
    const { bulls, warnings } = parseSwissgeneticsCsv(csv);
    expect(bulls[0].values).toEqual({});
    expect(bulls[1].values).toEqual({ lait_kg: 400 });
    expect(warnings).toEqual(["1 valeur(s) hors échelle attendue, non importée(s)."]);
  });
});

describe("mergeCatalogs", () => {
  it("garde la fiche la plus complète d'un taureau présent deux fois", () => {
    const poor = parseSwissgeneticsCsv("Nom court;Nom complet;Identité;Race\nORKAN;ORKAN;CH 9;OB");
    const rich = parseSwissgeneticsCsv(
      "Nom court;Nom complet;Identité;Race;VE;Lait kg\nORKAN;ORKAN;CH 9;OB;G OB 08.26;82",
    );
    const merged = mergeCatalogs([poor, rich]);
    expect(merged.bulls).toHaveLength(1);
    expect(merged.bulls[0].values).toEqual({ lait_kg: 82 });
  });
});
