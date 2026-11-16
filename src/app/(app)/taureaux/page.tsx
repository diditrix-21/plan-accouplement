import Link from "next/link";
import { Message } from "@/components/Message";
import { TraitInputs } from "@/components/TraitInputs";
import {
  loadBreeds,
  loadBulls,
  loadSuppliers,
  loadTraits,
  requireUser,
  valuesByCode,
  type BreedRow,
  type BullRow,
  type SupplierRow,
  type TraitRow,
} from "@/lib/data";
import { formatChf } from "@/lib/forms";
import { deleteBull, importBulls, importCatalog, saveBull } from "./actions";

/** Au-delà, on demande de filtrer plutôt que d'afficher un tableau interminable. */
const MAX_ROWS = 300;

function BullForm({
  bull,
  traits,
  breeds,
  suppliers,
}: {
  bull?: BullRow;
  traits: TraitRow[];
  breeds: BreedRow[];
  suppliers: SupplierRow[];
}) {
  return (
    <form action={saveBull} className="card mb-6 space-y-5">
      <h2 className="text-lg font-semibold">{bull ? `Modifier ${bull.name}` : "Nouveau taureau"}</h2>
      {bull && <input type="hidden" name="id" value={bull.id} />}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="label" htmlFor="name">
            Nom
          </label>
          <input className="input" id="name" name="name" defaultValue={bull?.name} required />
        </div>
        <div>
          <label className="label" htmlFor="breed_code">
            Race
          </label>
          <select className="input" id="breed_code" name="breed_code" defaultValue={bull?.breed_code ?? ""}>
            <option value="">—</option>
            {breeds.map((breed) => (
              <option key={breed.code} value={breed.code}>
                {breed.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="supplier_id">
            Vendeur
          </label>
          <select className="input" id="supplier_id" name="supplier_id" defaultValue={bull?.supplier_id ?? ""}>
            <option value="">—</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="sire_name">
            Père
          </label>
          <input className="input" id="sire_name" name="sire_name" defaultValue={bull?.sire_name ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="mgs_name">
            Grand-père maternel
          </label>
          <input className="input" id="mgs_name" name="mgs_name" defaultValue={bull?.mgs_name ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="herdbook_id">
            N° herd-book
          </label>
          <input className="input" id="herdbook_id" name="herdbook_id" defaultValue={bull?.herdbook_id ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="price_chf">
            Prix de la dose (CHF)
          </label>
          <input
            className="input"
            id="price_chf"
            name="price_chf"
            inputMode="decimal"
            defaultValue={bull?.price_chf ?? ""}
          />
        </div>
        <div>
          <label className="label" htmlFor="price_sexed_chf">
            Prix dose sexée (CHF)
          </label>
          <input
            className="input"
            id="price_sexed_chf"
            name="price_sexed_chf"
            inputMode="decimal"
            defaultValue={bull?.price_sexed_chf ?? ""}
          />
        </div>
      </div>

      <div>
        <p className="mb-3 text-sm text-stone-600">
          Recopie les valeurs de la fiche du vendeur. Un critère laissé vide compte comme « moyen ».
        </p>
        <TraitInputs traits={traits} values={valuesByCode(bull?.bull_traits ?? [])} />
      </div>

      <div className="flex gap-3">
        <button className="btn">Enregistrer</button>
        <Link href="/taureaux" className="btn-secondary">
          Annuler
        </Link>
      </div>
    </form>
  );
}

function CatalogImportForm() {
  return (
    <form action={importCatalog} className="card mb-6 space-y-3">
      <h2 className="text-lg font-semibold">Importer le catalogue Swissgenetics</h2>
      <p className="text-sm text-stone-600">
        Choisis les fichiers CSV exportés depuis le site Swissgenetics (un par race, tu peux en
        sélectionner plusieurs d&apos;un coup). Un taureau déjà présent est mis à jour : refais
        l&apos;import après chaque nouvelle estimation des valeurs d&apos;élevage.
      </p>
      <input
        className="input"
        type="file"
        name="files"
        accept=".csv,text/csv"
        multiple
        required
      />
      <p className="text-xs text-stone-500">
        Les valeurs suisses sont reprises telles quelles. Les valeurs sur base étrangère (France,
        Canada, pays nordiques) sont ramenées à l&apos;échelle suisse : c&apos;est une approximation.
        Les races sans base indiquée sont importées sans critères.
      </p>
      <div className="flex gap-3">
        <button className="btn">Importer le catalogue</button>
        <Link href="/taureaux" className="btn-secondary">
          Annuler
        </Link>
      </div>
    </form>
  );
}

function ImportForm({ traits }: { traits: TraitRow[] }) {
  return (
    <form action={importBulls} className="card mb-6 space-y-3">
      <h2 className="text-lg font-semibold">Importer depuis un tableur</h2>
      <p className="text-sm text-stone-600">
        Copie-colle depuis Excel, première ligne = en-têtes. Colonnes reconnues :{" "}
        <code className="text-xs">nom, race, vendeur, pere, gpm, prix, prix_sexe, no_herdbook</code>, puis
        un code de critère par colonne.
      </p>
      <details className="text-sm text-stone-600">
        <summary className="cursor-pointer font-medium text-stone-700">Codes des critères</summary>
        <p className="mt-2 text-xs leading-6">
          {traits.map((t) => (
            <span key={t.code} className="mr-3 inline-block">
              <code>{t.code}</code> = {t.label}
            </span>
          ))}
        </p>
      </details>
      <textarea
        className="input h-40 font-mono text-xs"
        name="csv"
        placeholder={"nom;race;vendeur;pere;gpm;prix;lait_kg;cellules;membres\nTORO;RH;Swissgenetics;ALPHA;BETA;32;850;115;108"}
        required
      />
      <div className="flex gap-3">
        <button className="btn">Importer</button>
        <Link href="/taureaux" className="btn-secondary">
          Annuler
        </Link>
      </div>
    </form>
  );
}

function first(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

export default async function BullsPage({ searchParams }: PageProps<"/taureaux">) {
  const params = await searchParams;
  const { supabase, user } = await requireUser();
  const race = first(params.race);
  const vendeur = first(params.vendeur);
  const search = first(params.q);
  const [bulls, traits, breeds, suppliers] = await Promise.all([
    loadBulls(supabase, {
      breedCodes: race ? [race] : undefined,
      supplierId: vendeur,
      search,
    }),
    loadTraits(supabase),
    loadBreeds(supabase),
    loadSuppliers(supabase),
  ]);

  const editing = bulls.find((b) => b.id === first(params.edit) && b.created_by === user.id);
  const visible = bulls.slice(0, MAX_ROWS);
  const catalog = first(params.catalog);
  const imported = first(params.imported);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Catalogue de taureaux</h1>
        <div className="flex gap-2">
          <Link href="/taureaux?import=1" className="btn-secondary">
            Importer
          </Link>
          <Link href="/taureaux?add=1" className="btn">
            Ajouter un taureau
          </Link>
        </div>
      </div>

      <Message code={params.message} />
      {imported !== undefined && (
        <p className={`mb-4 ${first(params.failed) === "0" ? "notice-ok" : "notice"}`}>
          {imported} taureau(x) importé(s)
          {first(params.failed) !== "0" && `, ${first(params.failed)} erreur(s)`}
          {first(params.unknown) !== "0" && `, ${first(params.unknown)} colonne(s) non reconnue(s)`}.
        </p>
      )}
      {catalog !== undefined && (
        <p className="notice-ok mb-4">
          Catalogue importé : {catalog} taureau(x), {first(params.values) ?? 0} valeur(s)
          d&apos;élevage
          {first(params.novalues) !== "0" &&
            `, dont ${first(params.novalues)} taureau(x) sans critères (races à viande ou base non indiquée)`}
          .
        </p>
      )}
      {bulls.some((b) => b.is_example) && (
        <p className="notice mb-4">
          Les taureaux « EXEMPLE » sont inventés pour tester l&apos;appli. Leurs valeurs ne
          correspondent à aucun vrai taureau.
        </p>
      )}

      {params.import && (
        <>
          <CatalogImportForm />
          <ImportForm traits={traits} />
        </>
      )}
      {(editing || params.add) && (
        <BullForm bull={editing} traits={traits} breeds={breeds} suppliers={suppliers} />
      )}

      <form className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="race">
            Race
          </label>
          <select className="input" id="race" name="race" defaultValue={race ?? ""}>
            <option value="">Toutes</option>
            {breeds.map((breed) => (
              <option key={breed.code} value={breed.code}>
                {breed.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="vendeur">
            Vendeur
          </label>
          <select className="input" id="vendeur" name="vendeur" defaultValue={vendeur ?? ""}>
            <option value="">Tous</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="q">
            Nom
          </label>
          <input className="input" id="q" name="q" defaultValue={search ?? ""} placeholder="ex. ORKAN" />
        </div>
        <button className="btn-secondary">Filtrer</button>
      </form>

      <p className="mb-3 text-sm text-stone-600">
        {bulls.length} taureau(x)
        {bulls.length > MAX_ROWS &&
          ` — les ${MAX_ROWS} premiers sont affichés, filtre par race ou par nom pour voir les autres`}
        .
      </p>

      {visible.length === 0 ? (
        <p className="card text-sm text-stone-700">Aucun taureau ne correspond.</p>
      ) : (
        <div className="card overflow-x-auto p-0 sm:p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-stone-200 text-stone-500">
              <tr>
                <th className="px-4 py-3 font-medium">Nom</th>
                <th className="px-4 py-3 font-medium">Race</th>
                <th className="px-4 py-3 font-medium">Vendeur</th>
                <th className="px-4 py-3 font-medium">Père × GPM</th>
                <th className="px-4 py-3 font-medium">Dose</th>
                <th className="px-4 py-3 font-medium">Critères</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {visible.map((bull) => (
                <tr key={bull.id}>
                  <td className="px-4 py-3">
                    <span className="font-medium">{bull.name}</span>
                    {bull.polled && <span className="ml-1 text-xs text-stone-500">{bull.polled}</span>}
                    {bull.full_name && bull.full_name !== bull.name && (
                      <span className="block text-xs text-stone-500">{bull.full_name}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{bull.breed?.name ?? "—"}</td>
                  <td className="px-4 py-3">{bull.supplier?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-stone-600">
                    {bull.sire_name ?? "?"} × {bull.mgs_name ?? "?"}
                  </td>
                  <td className="px-4 py-3">{formatChf(bull.price_chf)}</td>
                  <td className="px-4 py-3 text-stone-600">
                    {bull.bull_traits.length} / {traits.length}
                    {bull.eval_base && (
                      <span className="block text-xs text-stone-500">base {bull.eval_base}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {bull.created_by === user.id && (
                      <div className="flex justify-end gap-4">
                        <Link
                          href={`/taureaux?edit=${bull.id}`}
                          className="text-sm font-medium text-brand hover:underline"
                        >
                          Modifier
                        </Link>
                        <form action={deleteBull}>
                          <input type="hidden" name="id" value={bull.id} />
                          <button className="btn-danger">Supprimer</button>
                        </form>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
