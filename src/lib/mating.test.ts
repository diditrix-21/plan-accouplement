import { describe, expect, it } from "vitest";
import {
  DEFAULT_OPTIONS,
  assignBulls,
  bullCap,
  checkKinship,
  dosesNeeded,
  normalizeName,
  planForCow,
  planForHerd,
  scorePair,
  standardize,
  type Bull,
  type Cow,
  type Trait,
  allowedBullBreeds,
  calfCoat,
} from "./mating";

const traits: Trait[] = [
  { code: "lait_kg", label: "Lait", mean: 0, sd: 500, direction: 1 },
  { code: "cellules", label: "Cellules somatiques", mean: 100, sd: 12, direction: 1 },
  { code: "velage_direct", label: "Vêlage direct", mean: 100, sd: 12, direction: 1 },
];

function cow(partial: Partial<Cow> = {}): Cow {
  return {
    id: "c1",
    name: "Bella",
    breedCode: "HO",
    breedGroup: "holstein",
    sireName: null,
    mgsName: null,
    values: {},
    isHeifer: false,
    ...partial,
  };
}

function bull(partial: Partial<Bull> = {}): Bull {
  return {
    id: "b1",
    name: "TORO",
    breedCode: "HO",
    breedGroup: "holstein",
    sireName: null,
    mgsName: null,
    values: {},
    supplier: null,
    priceChf: null,
    ...partial,
  };
}

const milkBull = bull({ id: "milk", name: "LAITIER", values: { lait_kg: 1000, cellules: 100 } });
const cellBull = bull({ id: "cell", name: "SANTE", values: { lait_kg: 0, cellules: 124 } });

describe("standardize", () => {
  it("exprime la valeur en écarts-types", () => {
    expect(standardize(traits[1], 112)).toBe(1);
    expect(standardize(traits[0], -250)).toBe(-0.5);
  });

  it("inverse le signe quand une valeur basse est favorable", () => {
    expect(standardize({ ...traits[1], direction: -1 }, 112)).toBe(-1);
  });
});

describe("scorePair", () => {
  it("donne 0 à un taureau moyen", () => {
    const average = bull({ values: { lait_kg: 0, cellules: 100 } });
    const evaluation = scorePair(cow(), average, traits, { lait_kg: 3, cellules: 3 });
    expect(evaluation.excluded).toBe(false);
    if (!evaluation.excluded) expect(evaluation.result.score).toBe(0);
  });

  it("ignore les critères sans poids", () => {
    const evaluation = scorePair(cow(), milkBull, traits, { cellules: 3 });
    if (evaluation.excluded) throw new Error("ne devrait pas être exclu");
    expect(evaluation.result.score).toBe(0);
    expect(evaluation.result.strengths).toEqual([]);
  });

  it("signale les critères pondérés sans valeur côté taureau", () => {
    const evaluation = scorePair(cow(), bull({ values: { lait_kg: 500 } }), traits, {
      lait_kg: 2,
      cellules: 2,
    });
    if (evaluation.excluded) throw new Error("ne devrait pas être exclu");
    expect(evaluation.result.missingTraits).toEqual(["Cellules somatiques"]);
  });

  it("liste ce que le taureau dégrade", () => {
    const bad = bull({ values: { lait_kg: 1000, cellules: 82 } });
    const evaluation = scorePair(cow(), bad, traits, { lait_kg: 3, cellules: 3 });
    if (evaluation.excluded) throw new Error("ne devrait pas être exclu");
    expect(evaluation.result.strengths.map((c) => c.code)).toEqual(["lait_kg"]);
    expect(evaluation.result.drawbacks.map((c) => c.code)).toEqual(["cellules"]);
  });
});

describe("accouplement correctif", () => {
  const goals = { lait_kg: 3, cellules: 3 };

  it("propose le taureau cellules à la vache faible en cellules", () => {
    const weakCells = cow({ values: { lait_kg: 0, cellules: 76 } });
    const plan = planForCow(weakCells, [milkBull, cellBull], traits, goals);
    expect(plan.recommendations[0].bull.id).toBe("cell");
    expect(plan.weaknesses).toEqual(["Cellules somatiques"]);
  });

  it("propose le taureau laitier à la vache faible en lait", () => {
    const weakMilk = cow({ values: { lait_kg: -1000, cellules: 100 } });
    const plan = planForCow(weakMilk, [milkBull, cellBull], traits, goals);
    expect(plan.recommendations[0].bull.id).toBe("milk");
  });

  it("suit les priorités de l'éleveur quand la vache est moyenne", () => {
    const average = cow({ values: {} });
    const milkFirst = planForCow(average, [milkBull, cellBull], traits, { lait_kg: 5, cellules: 1 });
    const cellsFirst = planForCow(average, [milkBull, cellBull], traits, { lait_kg: 1, cellules: 5 });
    expect(milkFirst.recommendations[0].bull.id).toBe("milk");
    expect(cellsFirst.recommendations[0].bull.id).toBe("cell");
  });
});

describe("stock du container", () => {
  const goals = { lait_kg: 3 };
  const strong = bull({ id: "fort", name: "FORT", values: { lait_kg: 1000 } });
  const medium = bull({ id: "moyen", name: "MOYEN", values: { lait_kg: 300 } });
  const weakCow = cow({ id: "faible", name: "Faible", values: { lait_kg: -800 } });
  const goodCow = cow({ id: "bonne", name: "Bonne", values: { lait_kg: 600 } });

  it("propose la meilleure dose en stock à côté de la meilleure du marché", () => {
    const [plan] = planForHerd([goodCow], [strong, medium], traits, goals, DEFAULT_OPTIONS, { moyen: 2 });
    expect(plan.chosen?.bull.name).toBe("FORT");
    expect(plan.fromStock?.bull.name).toBe("MOYEN");
    expect(plan.fromStockRank).toBe(2);
  });

  it("donne la dernière dose à la vache qui en profite le plus", () => {
    const plans = planForHerd([goodCow, weakCow], [strong], traits, goals, DEFAULT_OPTIONS, { fort: 1 });
    const byName = Object.fromEntries(plans.map((p) => [p.cow.name, p]));
    expect(byName.Faible.fromStock?.bull.name).toBe("FORT");
    expect(byName.Bonne.fromStock).toBeNull();
    expect(byName.Bonne.stockTakenByOthers).toBe(true);
  });

  it("ne propose rien du stock sans doses compatibles", () => {
    const [plan] = planForHerd([goodCow], [strong], traits, goals, DEFAULT_OPTIONS, {});
    expect(plan.fromStock).toBeNull();
    expect(plan.stockTakenByOthers).toBe(false);
  });
});

describe("race et couleur", () => {
  const goals = { lait_kg: 3 };
  const red = cow({ breedCode: "RH" });

  it("ne met que des taureaux rouges sur une vache rouge", () => {
    expect(allowedBullBreeds("RH")).toEqual(["RH"]);
    expect(scorePair(red, bull({ breedCode: "HO" }), traits, goals)).toEqual({
      excluded: true,
      reason: "taureau noir sur vache rouge",
    });
    expect(scorePair(red, bull({ breedCode: "RF" }), traits, goals).excluded).toBe(true);
    expect(scorePair(red, bull({ breedCode: "RH" }), traits, goals).excluded).toBe(false);
  });

  it("ne met que des taureaux noirs sur une vache noire", () => {
    expect(allowedBullBreeds("HO")).toEqual(["HO", "RF"]);
    expect(scorePair(cow(), bull({ breedCode: "RH" }), traits, goals)).toEqual({
      excluded: true,
      reason: "taureau rouge sur vache noire",
    });
  });

  it("reste dans la race pour les autres races, et ne propose rien sans race", () => {
    expect(allowedBullBreeds("SI")).toEqual(["SI"]);
    expect(allowedBullBreeds(null)).toEqual([]);
    expect(allowedBullBreeds("XX")).toEqual([]);
    const plan = planForCow(cow({ breedCode: null }), [bull()], traits, goals);
    expect(plan.note).toBe("breed_unknown");
    expect(plan.recommendations).toEqual([]);
  });

  it("ne classe pas des taureaux sans aucune valeur (races à viande)", () => {
    const plan = planForCow(cow({ breedCode: "PI" }), [bull({ breedCode: "PI" })], traits, goals);
    expect(plan.note).toBe("no_data");
    expect(plan.candidates).toBe(1);
    expect(plan.recommendations).toEqual([]);
  });

  it("calcule la couleur du veau (le noir domine le rouge)", () => {
    expect(calfCoat("RH", "RH")).toBe("veau rouge");
    expect(calfCoat("RH", "HO")).toBe("veau noir, porteur du facteur rouge");
    expect(calfCoat("RH", "RF")).toBe("50 % rouge, 50 % noir porteur du rouge");
    expect(calfCoat("RF", "RF")).toBe("25 % rouge, 75 % noir");
    expect(calfCoat("HO", "HO")).toBe("veau noir");
    expect(calfCoat("SI", "SI")).toBeNull();
  });
});

describe("exclusions", () => {
  const goals = { lait_kg: 3 };

  it("écarte un taureau d'une autre race", () => {
    const evaluation = scorePair(cow(), bull({ breedCode: "BS", breedGroup: "brune" }), traits, goals);
    expect(evaluation).toEqual({ excluded: true, reason: "autre race" });
  });

  it("garde un taureau d'une autre race si le croisement est autorisé", () => {
    const evaluation = scorePair(cow(), bull({ breedCode: "BS", breedGroup: "brune" }), traits, goals, {
      ...DEFAULT_OPTIONS,
      allowCrossbreeding: true,
    });
    expect(evaluation.excluded).toBe(false);
  });

  it("écarte un taureau à vêlage difficile sur une génisse, pas sur une vache", () => {
    const hard = bull({ values: { lait_kg: 800, velage_direct: 92 } });
    expect(scorePair(cow({ isHeifer: true }), hard, traits, goals).excluded).toBe(true);
    expect(scorePair(cow({ isHeifer: false }), hard, traits, goals).excluded).toBe(false);
  });

  it("avertit quand la facilité de vêlage est inconnue sur une génisse", () => {
    const evaluation = scorePair(cow({ isHeifer: true }), bull({ values: { lait_kg: 800 } }), traits, goals);
    if (evaluation.excluded) throw new Error("ne devrait pas être exclu");
    expect(evaluation.result.warnings).toHaveLength(1);
  });
});

describe("parenté", () => {
  it("normalise les noms saisis à la main", () => {
    expect(normalizeName("  Éliandro-ET ")).toBe("ELIANDRO ET");
    expect(normalizeName("")).toBeNull();
    expect(normalizeName(null)).toBeNull();
  });

  it("bloque père × fille", () => {
    const k = checkKinship(cow({ sireName: "toro" }), bull({ name: "TORO" }));
    expect(k.level).toBe("blocked");
  });

  it("bloque les demi-frères et sœurs par le père", () => {
    const k = checkKinship(cow({ sireName: "Alpha" }), bull({ sireName: "ALPHA" }));
    expect(k.level).toBe("blocked");
  });

  it("avertit quand un ancêtre est partagé plus loin", () => {
    const k = checkKinship(cow({ mgsName: "Alpha" }), bull({ mgsName: "Alpha" }));
    expect(k.level).toBe("warning");
  });

  it("ne dit rien sans pedigree", () => {
    expect(checkKinship(cow(), bull()).level).toBe("none");
  });

  it("sort le taureau apparenté des recommandations", () => {
    const plan = planForCow(cow({ sireName: "LAITIER" }), [milkBull, cellBull], traits, { lait_kg: 5 });
    expect(plan.recommendations.map((r) => r.bull.id)).toEqual(["cell"]);
    expect(plan.exclusions).toHaveLength(1);
  });
});

describe("plan du troupeau", () => {
  it("compte les doses du premier choix par taureau", () => {
    const herd = [
      cow({ id: "c1", name: "Bella", values: { cellules: 76 } }),
      cow({ id: "c2", name: "Fleur", values: { cellules: 80 } }),
      cow({ id: "c3", name: "Rosa", values: { lait_kg: -1000 } }),
    ];
    const plans = planForHerd(herd, [milkBull, cellBull], traits, { lait_kg: 3, cellules: 3 }, {
      ...DEFAULT_OPTIONS,
      maxBullShare: 1,
    });
    const needs = dosesNeeded(plans);
    expect(needs.map((n) => [n.bull.id, n.doses])).toEqual([
      ["cell", 2],
      ["milk", 1],
    ]);
    expect(needs[0].cows).toEqual(["Bella", "Fleur"]);
  });

  it("limite le nombre de propositions", () => {
    const many = Array.from({ length: 6 }, (_, i) =>
      bull({ id: `b${i}`, name: `T${i}`, values: { lait_kg: i * 100 } }),
    );
    const plan = planForCow(cow(), many, traits, { lait_kg: 3 });
    expect(plan.recommendations).toHaveLength(3);
    expect(plan.recommendations[0].bull.id).toBe("b5");
  });
});

describe("limite par taureau", () => {
  const star = bull({ id: "star", name: "STAR", values: { lait_kg: 1000, cellules: 124 } });
  const good = bull({ id: "good", name: "GOOD", values: { lait_kg: 600, cellules: 112 } });
  const poor = bull({ id: "poor", name: "POOR", values: { lait_kg: -600, cellules: 90 } });
  const goals = { lait_kg: 3, cellules: 3 };
  const herd = [
    cow({ id: "c1", name: "Bella", values: { cellules: 70 } }),
    cow({ id: "c2", name: "Fleur", values: {} }),
    cow({ id: "c3", name: "Rosa", values: {} }),
    cow({ id: "c4", name: "Luna", values: { lait_kg: 500, cellules: 112 } }),
  ];

  it("calcule le plafond à partir de la part du troupeau", () => {
    expect(bullCap(40, 0.3)).toBe(12);
    expect(bullCap(4, 0.3)).toBe(2);
    expect(bullCap(1, 0.1)).toBe(1);
    expect(bullCap(40, 1)).toBe(Infinity);
  });

  it("sans limite, le meilleur taureau prend tout le troupeau", () => {
    const plans = planForHerd(herd, [star, good], traits, goals, { ...DEFAULT_OPTIONS, maxBullShare: 1 });
    expect(dosesNeeded(plans).map((n) => [n.bull.id, n.doses])).toEqual([["star", 4]]);
  });

  it("avec une limite, il garde les vaches qui en ont le plus besoin", () => {
    const plans = planForHerd(herd, [star, good], traits, goals, { ...DEFAULT_OPTIONS, maxBullShare: 0.5 });
    const chosen = Object.fromEntries(plans.map((p) => [p.cow.name, p.chosen?.bull.id]));
    // Bella (très faible en cellules) est celle qui perdrait le plus à changer.
    expect(chosen.Bella).toBe("star");
    expect(Object.values(chosen).filter((id) => id === "star")).toHaveLength(2);
    expect(Object.values(chosen).filter((id) => id === "good")).toHaveLength(2);
    expect(plans.find((p) => p.cow.name === "Bella")?.chosenRank).toBe(1);
  });

  it("dépasse la limite plutôt que d'envoyer une vache sur un mauvais taureau", () => {
    const plans = planForHerd(herd, [star, poor], traits, goals, { ...DEFAULT_OPTIONS, maxBullShare: 0.5 });
    expect(dosesNeeded(plans).map((n) => [n.bull.id, n.doses])).toEqual([["star", 4]]);
  });

  it("garde le taureau retenu visible même hors des premiers rangs", () => {
    const plans = planForHerd(herd, [star, good], traits, goals, {
      ...DEFAULT_OPTIONS,
      maxBullShare: 0.5,
      top: 1,
    });
    const moved = plans.find((p) => p.chosenRank === 2);
    expect(moved?.recommendations.map((r) => r.bull.id)).toEqual(["star", "good"]);
  });

  it("gère les vaches sans aucun taureau possible", () => {
    expect(assignBulls([[], []], 1)).toEqual([null, null]);
  });
});
