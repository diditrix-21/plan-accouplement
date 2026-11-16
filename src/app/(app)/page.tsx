import Link from "next/link";
import { countBulls, getFarm, loadCows, loadGoals, requireUser } from "@/lib/data";

function Step({
  number,
  title,
  status,
  done,
  href,
  action,
}: {
  number: number;
  title: string;
  status: string;
  done: boolean;
  href: string;
  action: string;
}) {
  return (
    <li className="card flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-4">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
            done ? "bg-brand text-white" : "bg-stone-100 text-stone-600"
          }`}
        >
          {done ? "✓" : number}
        </span>
        <div>
          <p className="font-medium">{title}</p>
          <p className="text-sm text-stone-600">{status}</p>
        </div>
      </div>
      <Link href={href} className={done ? "btn-secondary" : "btn"}>
        {action}
      </Link>
    </li>
  );
}

export default async function HomePage() {
  const { supabase } = await requireUser();
  const farm = await getFarm(supabase);
  const [cows, bullCount, goals] = await Promise.all([
    loadCows(supabase, farm.id),
    countBulls(supabase),
    loadGoals(supabase, farm.id),
  ]);
  const goalCount = Object.values(goals).filter((weight) => weight > 0).length;
  const ready = cows.length > 0 && bullCount > 0 && goalCount > 0;

  return (
    <>
      <h1 className="mb-1 text-2xl font-semibold">{farm.name}</h1>
      <p className="mb-5 text-sm text-stone-600">
        Trois choses à renseigner, puis le plan se calcule tout seul.
      </p>

      <ol className="space-y-3">
        <Step
          number={1}
          title="Ton troupeau"
          status={cows.length === 0 ? "Aucune vache enregistrée" : `${cows.length} vache(s)`}
          done={cows.length > 0}
          href="/vaches"
          action={cows.length === 0 ? "Ajouter des vaches" : "Voir le troupeau"}
        />
        <Step
          number={2}
          title="Le catalogue de taureaux"
          status={bullCount === 0 ? "Catalogue vide" : `${bullCount} taureau(x), tous vendeurs confondus`}
          done={bullCount > 0}
          href="/taureaux"
          action={bullCount === 0 ? "Ajouter des taureaux" : "Voir le catalogue"}
        />
        <Step
          number={3}
          title="Tes objectifs d'élevage"
          status={goalCount === 0 ? "Rien de défini" : `${goalCount} critère(s) à améliorer`}
          done={goalCount > 0}
          href="/objectifs"
          action={goalCount === 0 ? "Définir mes objectifs" : "Modifier"}
        />
      </ol>

      <div className="mt-6">
        {ready ? (
          <Link href="/plan" className="btn">
            Voir le plan d&apos;accouplement
          </Link>
        ) : (
          <p className="text-sm text-stone-500">Le plan sera disponible une fois les trois étapes remplies.</p>
        )}
      </div>
    </>
  );
}
