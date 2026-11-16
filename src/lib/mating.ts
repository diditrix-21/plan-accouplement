/**
 * Moteur de plan d'accouplement.
 *
 * Fonctions pures, sans base de données : faciles à tester et à faire évoluer.
 *
 * Principe
 * 1. Chaque valeur est ramenée sur une échelle commune (écarts-types par
 *    rapport à la moyenne de la race), positive = favorable.
 * 2. Le veau attendu vaut la moyenne de ses deux parents.
 * 3. Un veau en dessous de la moyenne sur un critère coûte plus cher qu'un
 *    veau au-dessus ne rapporte (`weaknessFactor`). C'est ce qui fait qu'un
 *    taureau fort en cellules ressort d'abord sur les vaches faibles en
 *    cellules, au lieu de proposer le même taureau à tout le troupeau.
 * 4. Le score d'un couple = gain pondéré par les objectifs de l'éleveur,
 *    par rapport à un taureau moyen.
 */

export type Trait = {
  code: string;
  label: string;
  mean: number;
  sd: number;
  /** 1 = valeur haute favorable, -1 = valeur basse favorable */
  direction: 1 | -1;
};

type Animal = {
  id: string;
  name: string;
  breedGroup: string | null;
  sireName: string | null;
  /** Grand-père maternel */
  mgsName: string | null;
  /** Valeurs par code de critère. Absent = inconnu. */
  values: Record<string, number>;
};

export type Cow = Animal & { isHeifer: boolean };
export type Bull = Animal & { supplier: string | null; priceChf: number | null };

/** Poids par code de critère, de 0 (ignoré) à 5 (priorité absolue). */
export type Goals = Record<string, number>;

export type Options = {
  /** Multiplicateur appliqué quand le veau attendu est sous la moyenne. */
  weaknessFactor: number;
  /** Critère utilisé pour la règle génisses. */
  calvingEaseTrait: string;
  /** Valeur minimale de ce critère pour un taureau utilisé sur génisse. */
  heiferMinCalvingEase: number;
  /** Autoriser les croisements entre groupes de races. */
  allowCrossbreeding: boolean;
  /** Nombre de taureaux proposés par vache. */
  top: number;
  /**
   * Part maximale du troupeau confiée à un même taureau (0.3 = 30 %).
   * 1 = pas de limite. Évite de tout miser sur un seul taureau.
   */
  maxBullShare: number;
};

export const DEFAULT_OPTIONS: Options = {
  weaknessFactor: 2,
  calvingEaseTrait: "velage_direct",
  heiferMinCalvingEase: 100,
  allowCrossbreeding: false,
  top: 3,
  maxBullShare: 0.3,
};

export type Contribution = { code: string; label: string; points: number };

export type PairScore = {
  bull: Bull;
  /** Score global, 0 = équivalent à un taureau moyen. */
  score: number;
  /** Critères où le taureau apporte le plus, du plus fort au plus faible. */
  strengths: Contribution[];
  /** Critères où le taureau dégrade le veau attendu. */
  drawbacks: Contribution[];
  warnings: string[];
  /** Critères pondérés pour lesquels le taureau n'a pas de valeur. */
  missingTraits: string[];
};

export type Exclusion = { bull: Bull; reason: string };

export type CowPlan = {
  cow: Cow;
  /** Critères pondérés où la vache est nettement sous la moyenne. */
  weaknesses: string[];
  recommendations: PairScore[];
  /** Taureau retenu pour cette vache, une fois la limite par taureau appliquée. */
  chosen: PairScore | null;
  /** Rang du taureau retenu dans le classement de la vache (1 = premier choix). */
  chosenRank: number | null;
  exclusions: Exclusion[];
};

/** Valeur ramenée en écarts-types, positive = favorable. */
export function standardize(trait: Trait, value: number): number {
  return (trait.direction * (value - trait.mean)) / trait.sd;
}

function utility(z: number, weaknessFactor: number): number {
  return z >= 0 ? z : z * weaknessFactor;
}

/** Normalise un nom d'animal pour comparer des pedigrees saisis à la main. */
export function normalizeName(name: string | null | undefined): string | null {
  if (!name) return null;
  const cleaned = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
  return cleaned || null;
}

export type Kinship = { level: "none" | "warning" | "blocked"; reason?: string };

/**
 * Contrôle de parenté simplifié, sur deux générations, par comparaison des
 * noms. Ce n'est PAS un calcul de consanguinité : il attrape les cas évidents
 * (père × fille, demi-frère × demi-sœur) et rien de plus.
 */
export function checkKinship(cow: Cow, bull: Bull): Kinship {
  const bullName = normalizeName(bull.name);
  const bullSire = normalizeName(bull.sireName);
  const bullMgs = normalizeName(bull.mgsName);
  const cowSire = normalizeName(cow.sireName);
  const cowMgs = normalizeName(cow.mgsName);

  if (bullName && bullName === cowSire) {
    return { level: "blocked", reason: "c'est le père de la vache" };
  }
  if (bullName && bullName === cowMgs) {
    return { level: "blocked", reason: "c'est le grand-père maternel de la vache" };
  }
  if (bullSire && bullSire === cowSire) {
    return { level: "blocked", reason: `même père que la vache (${bull.sireName})` };
  }
  if (bullSire && bullSire === cowMgs) {
    return { level: "warning", reason: `son père (${bull.sireName}) est le grand-père maternel de la vache` };
  }
  if (bullMgs && bullMgs === cowSire) {
    return { level: "warning", reason: `son grand-père maternel (${bull.mgsName}) est le père de la vache` };
  }
  if (bullMgs && bullMgs === cowMgs) {
    return { level: "warning", reason: `même grand-père maternel que la vache (${bull.mgsName})` };
  }
  return { level: "none" };
}

type Evaluation = { excluded: true; reason: string } | { excluded: false; result: PairScore };

export function scorePair(
  cow: Cow,
  bull: Bull,
  traits: Trait[],
  goals: Goals,
  options: Options = DEFAULT_OPTIONS,
): Evaluation {
  if (
    !options.allowCrossbreeding &&
    cow.breedGroup &&
    bull.breedGroup &&
    cow.breedGroup !== bull.breedGroup
  ) {
    return { excluded: true, reason: "autre race" };
  }

  const kinship = checkKinship(cow, bull);
  if (kinship.level === "blocked") {
    return { excluded: true, reason: `parenté : ${kinship.reason}` };
  }

  const warnings: string[] = [];
  if (kinship.level === "warning") warnings.push(`Parenté : ${kinship.reason}`);

  if (cow.isHeifer) {
    const ease = bull.values[options.calvingEaseTrait];
    if (ease === undefined) {
      warnings.push("Génisse : facilité de vêlage du taureau inconnue");
    } else if (ease < options.heiferMinCalvingEase) {
      return {
        excluded: true,
        reason: `vêlage trop difficile pour une génisse (${ease} < ${options.heiferMinCalvingEase})`,
      };
    }
  }

  let weighted = 0;
  let totalWeight = 0;
  const contributions: Contribution[] = [];
  const missingTraits: string[] = [];

  for (const trait of traits) {
    const weight = goals[trait.code] ?? 0;
    if (weight <= 0) continue;
    totalWeight += weight;

    const bullValue = bull.values[trait.code];
    if (bullValue === undefined) {
      // Valeur inconnue : on suppose un taureau moyen, donc aucun gain.
      missingTraits.push(trait.label);
      continue;
    }

    const cowValue = cow.values[trait.code];
    const zCow = cowValue === undefined ? 0 : standardize(trait, cowValue);
    const zBull = standardize(trait, bullValue);

    const withBull = utility((zCow + zBull) / 2, options.weaknessFactor);
    const withAverageBull = utility(zCow / 2, options.weaknessFactor);
    const points = weight * (withBull - withAverageBull);

    weighted += points;
    contributions.push({ code: trait.code, label: trait.label, points });
  }

  const score = totalWeight > 0 ? (100 * weighted) / totalWeight : 0;
  const threshold = 0.05;

  return {
    excluded: false,
    result: {
      bull,
      score,
      strengths: contributions
        .filter((c) => c.points > threshold)
        .sort((a, b) => b.points - a.points),
      drawbacks: contributions
        .filter((c) => c.points < -threshold)
        .sort((a, b) => a.points - b.points),
      warnings,
      missingTraits,
    },
  };
}

type RankedCow = Omit<CowPlan, "recommendations" | "chosen" | "chosenRank"> & {
  ranked: PairScore[];
};

function rankForCow(
  cow: Cow,
  bulls: Bull[],
  traits: Trait[],
  goals: Goals,
  options: Options,
): RankedCow {
  const ranked: PairScore[] = [];
  const exclusions: Exclusion[] = [];

  for (const bull of bulls) {
    const evaluation = scorePair(cow, bull, traits, goals, options);
    if (evaluation.excluded) exclusions.push({ bull, reason: evaluation.reason });
    else ranked.push(evaluation.result);
  }

  ranked.sort((a, b) => b.score - a.score || a.bull.name.localeCompare(b.bull.name));

  const weaknesses = traits
    .filter((t) => (goals[t.code] ?? 0) > 0)
    .filter((t) => {
      const value = cow.values[t.code];
      return value !== undefined && standardize(t, value) <= -0.5;
    })
    .map((t) => t.label);

  return { cow, weaknesses, ranked, exclusions };
}

function toPlan(entry: RankedCow, chosenIndex: number | null, top: number): CowPlan {
  const { ranked, ...rest } = entry;
  const recommendations = ranked.slice(0, top);
  const chosen = chosenIndex === null ? null : ranked[chosenIndex];
  // Le taureau retenu reste visible même s'il est au-delà des premiers rangs.
  if (chosen && chosenIndex !== null && chosenIndex >= top) recommendations.push(chosen);
  return {
    ...rest,
    recommendations,
    chosen,
    chosenRank: chosenIndex === null ? null : chosenIndex + 1,
  };
}

/** Classement des taureaux pour une vache seule (sans limite par taureau). */
export function planForCow(
  cow: Cow,
  bulls: Bull[],
  traits: Trait[],
  goals: Goals,
  options: Options = DEFAULT_OPTIONS,
): CowPlan {
  const entry = rankForCow(cow, bulls, traits, goals, options);
  return toPlan(entry, entry.ranked.length > 0 ? 0 : null, options.top);
}

/**
 * Répartit les taureaux en respectant un nombre maximum de vaches par taureau.
 *
 * Chaque vache part sur son premier choix. Quand un taureau dépasse la limite,
 * on déplace vers leur choix suivant les vaches qui y perdent le moins.
 * Une vache n'est jamais déplacée vers un taureau qui ne lui apporte rien
 * (score ≤ 0) : dans ce cas la limite est dépassée plutôt que de dégrader.
 * C'est une heuristique simple, pas une optimisation globale.
 *
 * Renvoie, pour chaque vache, l'indice du taureau retenu dans son classement.
 */
export function assignBulls(ranked: PairScore[][], cap: number): (number | null)[] {
  const choice: (number | null)[] = ranked.map((list) => (list.length > 0 ? 0 : null));
  const settled = new Set<string>();

  for (;;) {
    const users = new Map<string, number[]>();
    choice.forEach((index, cow) => {
      if (index === null) return;
      const id = ranked[cow][index].bull.id;
      users.set(id, [...(users.get(id) ?? []), cow]);
    });

    const overloaded = [...users.entries()].find(
      ([id, cows]) => cows.length > cap && !settled.has(id),
    );
    if (!overloaded) return choice;

    const [bullId, cows] = overloaded;
    const movable = cows
      .map((cow) => {
        const index = choice[cow] as number;
        const next = ranked[cow][index + 1];
        return { cow, index, next, regret: next ? ranked[cow][index].score - next.score : Infinity };
      })
      .filter((c) => c.next !== undefined && c.next.score > 0)
      .sort((a, b) => a.regret - b.regret);

    const excess = cows.length - cap;
    if (movable.length < excess) settled.add(bullId);
    for (const move of movable.slice(0, excess)) choice[move.cow] = move.index + 1;
  }
}

/** Nombre maximum de vaches par taureau pour un troupeau donné. */
export function bullCap(cowCount: number, maxBullShare: number): number {
  if (maxBullShare >= 1) return Infinity;
  return Math.max(1, Math.ceil(cowCount * maxBullShare));
}

export function planForHerd(
  cows: Cow[],
  bulls: Bull[],
  traits: Trait[],
  goals: Goals,
  options: Options = DEFAULT_OPTIONS,
): CowPlan[] {
  const entries = cows.map((cow) => rankForCow(cow, bulls, traits, goals, options));
  const withOptions = entries.filter((e) => e.ranked.length > 0).length;
  const choice = assignBulls(
    entries.map((e) => e.ranked),
    bullCap(withOptions, options.maxBullShare),
  );
  return entries.map((entry, i) => toPlan(entry, choice[i], options.top));
}

export type DoseNeed = { bull: Bull; doses: number; cows: string[] };

/** Nombre de doses nécessaires si on suit le taureau retenu pour chaque vache. */
export function dosesNeeded(plans: CowPlan[]): DoseNeed[] {
  const byBull = new Map<string, DoseNeed>();
  for (const plan of plans) {
    const chosen = plan.chosen;
    if (!chosen) continue;
    const need = byBull.get(chosen.bull.id) ?? { bull: chosen.bull, doses: 0, cows: [] };
    need.doses += 1;
    need.cows.push(plan.cow.name);
    byBull.set(chosen.bull.id, need);
  }
  return [...byBull.values()].sort(
    (a, b) => b.doses - a.doses || a.bull.name.localeCompare(b.bull.name),
  );
}
