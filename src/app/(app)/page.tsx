import Link from "next/link";
import { Message } from "@/components/Message";
import {
  DEFAULT_FARM_NAME,
  countBulls,
  getFarm,
  loadCows,
  loadGoals,
  requireUser,
} from "@/lib/data";
import { renameFarm } from "./actions";

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

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const { supabase } = await requireUser();
  const farm = await getFarm(supabase);
  const [cows, bullCount, goals] = await Promise.all([
    loadCows(supabase, farm.id),
    countBulls(supabase),
    loadGoals(supabase, farm.id),
  ]);
  const goalCount = Object.values(goals).filter((weight) => weight > 0).length;
  const ready = cows.length > 0 && bullCount > 0 && goalCount > 0;
  const unnamed = farm.name === DEFAULT_FARM_NAME;
  const renaming = unnamed || params.rename !== undefined;

  return (
    <>
      <div className="mb-1 flex flex-wrap items-baseline gap-x-3">
        <h1 className="text-2xl font-semibold">{farm.name}</h1>
        {!renaming && (
          <Link href="/?rename=1" className="text-sm text-stone-500 hover:text-brand hover:underline">
            Renommer
          </Link>
        )}
      </div>

      <Message code={params.message} />
      {renaming && (
        <form action={renameFarm} className="card my-4 flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            <label className="label" htmlFor="farm_name">
              {unnamed ? "Comment s'appelle ton exploitation ?" : "Nom de l'exploitation"}
            </label>
            <input
              className="input"
              id="farm_name"
              name="farm_name"
              maxLength={80}
              required
              defaultValue={unnamed ? "" : farm.name}
              placeholder="ex. Du Clos"
            />
          </div>
          <button className="btn">Enregistrer</button>
          {!unnamed && (
            <Link href="/" className="btn-secondary">
              Annuler
            </Link>
          )}
        </form>
      )}
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
          status={bullCount === 0 ? "Catalogue vide" : `${bullCount} taureau(x) à disposition`}
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
