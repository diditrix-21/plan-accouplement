import Link from "next/link";
import { Message } from "@/components/Message";
import { TraitInputs } from "@/components/TraitInputs";
import {
  getFarm,
  loadBreeds,
  loadCows,
  loadTraits,
  requireUser,
  valuesByCode,
  type BreedRow,
  type CowRow,
  type TraitRow,
} from "@/lib/data";
import { addExampleCows, deleteCow, importHerd, saveCow } from "./actions";

function HerdImportForm() {
  return (
    <form action={importHerd} className="card mb-6 space-y-3">
      <h2 className="text-lg font-semibold">Importer mon troupeau</h2>
      <p className="text-sm text-stone-600">
        Deux fichiers Excel de swissherdbook, à importer l&apos;un après l&apos;autre :
      </p>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-stone-600">
        <li>
          la liste <strong>« Tous les animaux »</strong> : crée les vaches avec leur ascendance et
          leurs lactations (les mâles sont ignorés) ;
        </li>
        <li>
          la <strong>« Liste des valeurs d&apos;élevage »</strong> : ajoute les chiffres
          (production, santé, morphologie) que le plan utilise pour corriger les défauts.
        </li>
      </ol>
      <p className="text-sm text-stone-600">
        Une vache déjà présente (même N° BDTA) est mise à jour. Refais l&apos;import après chaque
        nouvelle estimation.
      </p>
      <input className="input" type="file" name="file" accept=".xlsx" required />
      <div className="flex gap-3">
        <button className="btn">Importer</button>
        <Link href="/vaches" className="btn-secondary">
          Annuler
        </Link>
      </div>
    </form>
  );
}

function CowForm({
  cow,
  traits,
  breeds,
}: {
  cow?: CowRow;
  traits: TraitRow[];
  breeds: BreedRow[];
}) {
  const exact = cow?.cow_traits.filter((t) => !t.estimated) ?? [];
  const weak = cow?.cow_traits.filter((t) => t.estimated).map((t) => t.trait_code) ?? [];

  return (
    <form action={saveCow} className="card mb-6 space-y-5">
      <h2 className="text-lg font-semibold">{cow ? `Modifier ${cow.name}` : "Nouvelle vache"}</h2>
      {cow && <input type="hidden" name="id" value={cow.id} />}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="label" htmlFor="name">
            Nom
          </label>
          <input className="input" id="name" name="name" defaultValue={cow?.name} required />
        </div>
        <div>
          <label className="label" htmlFor="ear_tag">
            N° de marque auriculaire
          </label>
          <input className="input" id="ear_tag" name="ear_tag" defaultValue={cow?.ear_tag ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="breed_code">
            Race
          </label>
          <select className="input" id="breed_code" name="breed_code" defaultValue={cow?.breed_code ?? ""}>
            <option value="">—</option>
            {breeds.map((breed) => (
              <option key={breed.code} value={breed.code}>
                {breed.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="lactation_no">
            Nombre de lactations (0 = génisse)
          </label>
          <input
            className="input"
            id="lactation_no"
            name="lactation_no"
            type="number"
            min={0}
            defaultValue={cow?.lactation_no ?? 0}
          />
        </div>
        <div>
          <label className="label" htmlFor="sire_name">
            Père
          </label>
          <input className="input" id="sire_name" name="sire_name" defaultValue={cow?.sire_name ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="mgs_name">
            Grand-père maternel
          </label>
          <input className="input" id="mgs_name" name="mgs_name" defaultValue={cow?.mgs_name ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="birth_date">
            Date de naissance
          </label>
          <input
            className="input"
            id="birth_date"
            name="birth_date"
            type="date"
            defaultValue={cow?.birth_date ?? ""}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="notes">
            Remarques
          </label>
          <input className="input" id="notes" name="notes" defaultValue={cow?.notes ?? ""} />
        </div>
      </div>

      <div>
        <p className="mb-3 text-sm text-stone-600">
          Pour chaque critère : saisis la valeur d&apos;élevage si tu l&apos;as, sinon coche
          simplement « faible » sur les points à corriger. Vide = vache dans la moyenne.
        </p>
        <TraitInputs traits={traits} values={valuesByCode(exact)} weak={weak} withWeakness />
      </div>

      <div className="flex gap-3">
        <button className="btn">Enregistrer</button>
        <Link href="/vaches" className="btn-secondary">
          Annuler
        </Link>
      </div>
    </form>
  );
}

export default async function CowsPage({ searchParams }: PageProps<"/vaches">) {
  const params = await searchParams;
  const { edit, add, message } = params;
  const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const { supabase } = await requireUser();
  const farm = await getFarm(supabase);
  const [cows, traits, breeds] = await Promise.all([
    loadCows(supabase, farm.id),
    loadTraits(supabase),
    loadBreeds(supabase),
  ]);
  const labels = new Map(traits.map((t) => [t.code, t.label]));
  const editing = typeof edit === "string" ? cows.find((c) => c.id === edit) : undefined;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Mon troupeau</h1>
          <p className="text-sm text-stone-600">Clique sur une vache pour ouvrir sa fiche.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/vaches?import=1" className="btn-secondary">
            Importer (Excel)
          </Link>
          <Link href="/vaches?add=1" className="btn">
            Ajouter une vache
          </Link>
        </div>
      </div>

      <Message code={message} />
      {one(params.herd) !== undefined && (
        <p className="notice-ok mb-4">
          Troupeau importé : {one(params.herd)} animal(aux), dont {one(params.created)} nouveau(x).
          {one(params.males) && ` Mâle(s) ignoré(s) : ${one(params.males)}.`} Ouvre une vache pour
          voir sa fiche.
        </p>
      )}
      {one(params.values) !== undefined && (
        <p className="notice-ok mb-4">
          Valeurs d&apos;élevage importées pour {one(params.values)} vache(s). Le plan en tient
          compte dès maintenant.
          {one(params.unknown) &&
            ` Pas dans le troupeau (importe d'abord la liste des animaux) : ${one(params.unknown)}.`}
        </p>
      )}
      {params.import && <HerdImportForm />}

      {(editing || add) && <CowForm cow={editing} traits={traits} breeds={breeds} />}

      {cows.length === 0 ? (
        <div className="card space-y-3 text-sm text-stone-700">
          <p>Aucune vache pour l&apos;instant.</p>
          <Link href="/vaches?import=1" className="btn">
            Importer mon troupeau depuis swissherdbook (Excel)
          </Link>
          <form action={addExampleCows}>
            <button className="btn-secondary">Ajouter 4 vaches d&apos;exemple pour essayer</button>
          </form>
        </div>
      ) : (
        <div className="card overflow-x-auto p-0 sm:p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-stone-200 text-stone-500">
              <tr>
                <th className="px-4 py-3 font-medium">Nom</th>
                <th className="px-4 py-3 font-medium">Race</th>
                <th className="px-4 py-3 font-medium">Lactations</th>
                <th className="px-4 py-3 font-medium">Père</th>
                <th className="px-4 py-3 font-medium">Points faibles</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {cows.map((cow) => {
                const weak = cow.cow_traits
                  .filter((t) => t.estimated)
                  .map((t) => labels.get(t.trait_code) ?? t.trait_code);
                return (
                  <tr key={cow.id}>
                    <td className="px-4 py-3">
                      <Link href={`/vaches/${cow.id}`} className="font-medium text-brand hover:underline">
                        {cow.name}
                      </Link>
                      {cow.ear_tag && <span className="ml-2 text-stone-400">{cow.ear_tag}</span>}
                    </td>
                    <td className="px-4 py-3">{cow.breed?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      {cow.lactation_no === 0 ? "Génisse" : cow.lactation_no}
                    </td>
                    <td className="px-4 py-3">{cow.sire_name ?? "—"}</td>
                    <td className="px-4 py-3 text-stone-600">{weak.join(", ") || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-4">
                        <Link href={`/vaches?edit=${cow.id}`} className="text-sm font-medium text-brand hover:underline">
                          Modifier
                        </Link>
                        <form action={deleteCow}>
                          <input type="hidden" name="id" value={cow.id} />
                          <button className="btn-danger">Supprimer</button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
