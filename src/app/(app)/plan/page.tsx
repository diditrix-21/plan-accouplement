import Link from "next/link";
import { requireUser } from "@/lib/data";
import { formatChf, formatNumber } from "@/lib/forms";
import type { CowPlan, DoseNeed, PairScore } from "@/lib/mating";
import { buildPlan } from "@/lib/plan";

function labels(items: { label: string }[], max = 3): string {
  return items
    .slice(0, max)
    .map((i) => i.label)
    .join(", ");
}

function Recommendation({ rank, pair, chosen }: { rank: number; pair: PairScore; chosen: boolean }) {
  const { bull } = pair;
  return (
    <li className={`rounded-lg border p-3 ${chosen ? "border-brand bg-brand-soft" : "border-stone-200"}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-medium">
          <span className="mr-2 text-stone-500">{rank}.</span>
          {bull.name}
          {chosen && (
            <span className="ml-2 rounded bg-brand px-2 py-0.5 text-xs font-medium text-white">
              Retenu
            </span>
          )}
          <span className="ml-2 text-sm font-normal text-stone-500">
            {[bull.supplier, bull.priceChf === null ? null : formatChf(bull.priceChf)]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </p>
        <p className="text-sm tabular-nums text-stone-700">
          Score {pair.score > 0 ? "+" : ""}
          {formatNumber(pair.score)}
        </p>
      </div>
      {pair.strengths.length > 0 && (
        <p className="mt-1 text-sm text-stone-700">
          <span className="font-medium text-green-800">Apporte :</span> {labels(pair.strengths)}
        </p>
      )}
      {pair.drawbacks.length > 0 && (
        <p className="mt-1 text-sm text-stone-700">
          <span className="font-medium text-amber-800">Dégrade :</span> {labels(pair.drawbacks)}
        </p>
      )}
      {pair.warnings.map((warning) => (
        <p key={warning} className="mt-1 text-sm font-medium text-amber-800">
          ⚠ {warning}
        </p>
      ))}
      {pair.missingTraits.length > 0 && (
        <p className="mt-1 text-xs text-stone-500">
          Valeurs manquantes (comptées comme moyennes) : {pair.missingTraits.join(", ")}
        </p>
      )}
    </li>
  );
}

function CowCard({ plan }: { plan: CowPlan }) {
  return (
    <section className="card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">
          {plan.cow.name}
          {plan.cow.isHeifer && (
            <span className="ml-2 rounded bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">
              Génisse
            </span>
          )}
        </h2>
        {plan.weaknesses.length > 0 && (
          <p className="text-sm text-stone-600">À corriger : {plan.weaknesses.join(", ")}</p>
        )}
      </div>

      {plan.recommendations.length === 0 ? (
        <p className="notice mt-3">Aucun taureau du catalogue ne convient à cette vache.</p>
      ) : (
        <ol className="mt-3 space-y-2">
          {plan.recommendations.map((pair, index) => {
            const chosen = pair.bull.id === plan.chosen?.bull.id;
            return (
              <Recommendation
                key={pair.bull.id}
                rank={chosen && plan.chosenRank ? plan.chosenRank : index + 1}
                pair={pair}
                chosen={chosen}
              />
            );
          })}
        </ol>
      )}
      {plan.chosenRank !== null && plan.chosenRank > 1 && (
        <p className="mt-2 text-sm text-stone-600">
          Le 1er choix est déjà au maximum de vaches : il est réservé à celles qui en ont le plus
          besoin.
        </p>
      )}

      {plan.exclusions.length > 0 && (
        <details className="mt-3 text-sm text-stone-600">
          <summary className="cursor-pointer">
            {plan.exclusions.length} taureau(x) écarté(s)
          </summary>
          <ul className="mt-2 space-y-1">
            {plan.exclusions.map((exclusion) => (
              <li key={exclusion.bull.id}>
                {exclusion.bull.name} : {exclusion.reason}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function Order({ doses, cap }: { doses: DoseNeed[]; cap: number }) {
  const total = doses.reduce((sum, d) => sum + d.doses * (d.bull.priceChf ?? 0), 0);
  const missingPrice = doses.some((d) => d.bull.priceChf === null);

  return (
    <section className="card">
      <h2 className="text-lg font-semibold">Doses à prévoir</h2>
      <p className="mb-3 text-sm text-stone-600">
        Une dose par vache, pour le taureau retenu
        {Number.isFinite(cap) ? ` (${cap} vache(s) maximum par taureau)` : ""}. Compte les retours
        en plus.
      </p>
      <table className="w-full text-left text-sm">
        <thead className="border-b border-stone-200 text-stone-500">
          <tr>
            <th className="py-2 font-medium">Taureau</th>
            <th className="py-2 font-medium">Vendeur</th>
            <th className="py-2 text-right font-medium">Doses</th>
            <th className="py-2 text-right font-medium">Montant</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {doses.map((need) => (
            <tr key={need.bull.id}>
              <td className="py-2">
                <span className="font-medium">{need.bull.name}</span>
                <span className="block text-xs text-stone-500">{need.cows.join(", ")}</span>
              </td>
              <td className="py-2">{need.bull.supplier ?? "—"}</td>
              <td className="py-2 text-right tabular-nums">{need.doses}</td>
              <td className="py-2 text-right tabular-nums">
                {need.bull.priceChf === null ? "—" : formatChf(need.doses * need.bull.priceChf)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t border-stone-200 font-medium">
          <tr>
            <td className="py-2" colSpan={2}>
              Total{missingPrice ? " (hors taureaux sans prix)" : ""}
            </td>
            <td className="py-2 text-right tabular-nums">{doses.reduce((s, d) => s + d.doses, 0)}</td>
            <td className="py-2 text-right tabular-nums">{formatChf(total)}</td>
          </tr>
        </tfoot>
      </table>
    </section>
  );
}

function Missing({ text, href, action }: { text: string; href: string; action: string }) {
  return (
    <div className="card flex flex-wrap items-center justify-between gap-3 text-sm">
      <p>{text}</p>
      <Link href={href} className="btn">
        {action}
      </Link>
    </div>
  );
}

export default async function PlanPage() {
  const { supabase } = await requireUser();
  const plan = await buildPlan(supabase);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Plan d&apos;accouplement</h1>

      {plan.cowCount === 0 && (
        <Missing text="Il n'y a pas encore de vache dans le troupeau." href="/vaches" action="Ajouter des vaches" />
      )}
      {plan.cowCount > 0 && plan.bullCount === 0 && (
        <Missing
          text="Aucun taureau du catalogue pour les races de ton troupeau. Vérifie la race de tes vaches, ou importe un catalogue."
          href="/taureaux"
          action="Voir le catalogue"
        />
      )}
      {plan.activeGoals.length === 0 && (
        <Missing
          text="Tu n'as pas encore dit ce que tu veux améliorer : sans objectifs, tous les taureaux se valent."
          href="/objectifs"
          action="Définir mes objectifs"
        />
      )}

      {plan.activeGoals.length > 0 && (
        <p className="text-sm text-stone-600">
          Objectifs :{" "}
          {plan.activeGoals.map((goal) => `${goal.label} (${goal.weight})`).join(", ")}.{" "}
          <Link href="/objectifs" className="text-brand hover:underline">
            Modifier
          </Link>
        </p>
      )}

      {plan.hasExampleBulls && plan.cowCount > 0 && (
        <p className="notice">
          Le catalogue contient des taureaux « EXEMPLE » aux valeurs inventées. Ce plan sert à
          essayer l&apos;outil, pas à choisir de vraies doses.
        </p>
      )}

      {plan.activeGoals.length > 0 && plan.doses.length > 0 && <Order doses={plan.doses} cap={plan.cap} />}

      {plan.activeGoals.length > 0 && plan.plans.map((cowPlan) => <CowCard key={cowPlan.cow.id} plan={cowPlan} />)}

      {plan.cowCount > 0 && plan.activeGoals.length > 0 && (
        <p className="text-xs leading-5 text-stone-500">
          Comment c&apos;est calculé : le veau attendu vaut la moyenne de ses deux parents sur chaque
          critère ; un veau sous la moyenne coûte deux fois plus qu&apos;un veau au-dessus ne
          rapporte, ce qui pousse à corriger les points faibles de chaque vache. Le score compare
          le taureau à un taureau moyen (0). Quand un taureau atteint sa part maximale du
          troupeau, il reste sur les vaches qui perdraient le plus à en changer. Le contrôle de parenté ne regarde que le père et le
          grand-père maternel saisis : ce n&apos;est pas un calcul de consanguinité.
        </p>
      )}
    </div>
  );
}
