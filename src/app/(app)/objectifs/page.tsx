import { Message } from "@/components/Message";
import { CATEGORY_LABELS, getFarm, loadGoals, loadTraits, requireUser, type TraitRow } from "@/lib/data";
import { saveGoals } from "./actions";

const CATEGORIES: TraitRow["category"][] = ["production", "fonctionnel", "morphologie"];

const WEIGHTS = [
  { value: 0, label: "— pas un objectif" },
  { value: 1, label: "1 · un peu" },
  { value: 2, label: "2" },
  { value: 3, label: "3 · important" },
  { value: 4, label: "4" },
  { value: 5, label: "5 · à améliorer en premier" },
];

export default async function GoalsPage({ searchParams }: PageProps<"/objectifs">) {
  const { message } = await searchParams;
  const { supabase } = await requireUser();
  const farm = await getFarm(supabase);
  const [traits, goals] = await Promise.all([loadTraits(supabase), loadGoals(supabase, farm.id)]);

  return (
    <>
      <h1 className="mb-1 text-2xl font-semibold">Objectifs d&apos;élevage</h1>
      <p className="mb-4 text-sm text-stone-600">
        Qu&apos;est-ce que tu veux améliorer en premier ? Donne un poids aux critères qui comptent
        pour toi. Le plan cherche, vache par vache, le taureau qui fait le plus avancer ces
        critères.
      </p>

      <Message code={message} />

      <form action={saveGoals} className="space-y-4">
        {CATEGORIES.map((category) => (
          <section key={category} className="card">
            <h2 className="mb-3 text-base font-semibold">
              {CATEGORY_LABELS[category]}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {traits
                .filter((t) => t.category === category)
                .map((trait) => (
                  <div key={trait.code}>
                    <label className="label" htmlFor={`goal:${trait.code}`}>
                      {trait.label}
                    </label>
                    <select
                      className="input"
                      id={`goal:${trait.code}`}
                      name={`goal:${trait.code}`}
                      defaultValue={goals[trait.code] ?? 0}
                    >
                      {WEIGHTS.map((w) => (
                        <option key={w.value} value={w.value}>
                          {w.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
            </div>
          </section>
        ))}

        <section className="card">
          <h2 className="mb-3 text-base font-semibold">Règles</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="heifer_min_calving_ease">
                Index « vêlage direct » minimum sur génisse
              </label>
              <input
                className="input max-w-32"
                id="heifer_min_calving_ease"
                name="heifer_min_calving_ease"
                inputMode="decimal"
                defaultValue={farm.heifer_min_calving_ease}
              />
              <p className="mt-2 text-sm text-stone-600">
                Les taureaux en dessous ne sont jamais proposés sur une génisse.
              </p>
            </div>
            <div>
              <label className="label" htmlFor="max_bull_share">
                Part maximale du troupeau par taureau (%)
              </label>
              <input
                className="input max-w-32"
                id="max_bull_share"
                name="max_bull_share"
                inputMode="decimal"
                defaultValue={Math.round(Number(farm.max_bull_share) * 100)}
              />
              <p className="mt-2 text-sm text-stone-600">
                Pour ne pas tout miser sur un seul taureau. 100 = pas de limite.
              </p>
            </div>
          </div>
        </section>

        <button className="btn">Enregistrer les objectifs</button>
      </form>
    </>
  );
}
