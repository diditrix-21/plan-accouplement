import Link from "next/link";
import { Message } from "@/components/Message";
import {
  loadBull,
  loadBulls,
  loadMovements,
  loadStock,
  requireUser,
} from "@/lib/data";
import { adjustStock, removeFromStock } from "./actions";

const REASON_LABELS = {
  stock_initial: "stock de départ",
  achat: "achat",
  insemination: "insémination",
  correction: "correction",
} as const;

const MAX_RESULTS = 15;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function StockButton({
  bullId,
  delta,
  reason,
  label,
  title,
  className = "btn-secondary",
}: {
  bullId: string;
  delta: number;
  reason: keyof typeof REASON_LABELS;
  label: string;
  title: string;
  className?: string;
}) {
  return (
    <form action={adjustStock}>
      <input type="hidden" name="bull_id" value={bullId} />
      <input type="hidden" name="delta" value={delta} />
      <input type="hidden" name="reason" value={reason} />
      <button
        className={`${className} min-w-12 px-3`}
        title={title}
        aria-label={title}
      >
        {label}
      </button>
    </form>
  );
}

/** Le container : recherche dans le catalogue, doses par taureau, +/−. */
export default async function StockPage({ searchParams }: PageProps<"/stock">) {
  const params = await searchParams;
  const { supabase } = await requireUser();
  const search = first(params.q)?.trim() ?? "";
  const addId = first(params.add);

  const [stock, movements, results, adding] = await Promise.all([
    loadStock(supabase),
    loadMovements(supabase),
    search.length >= 2 ? loadBulls(supabase, { search }) : Promise.resolve([]),
    addId ? loadBull(supabase, addId) : Promise.resolve(null),
  ]);

  const dosesByBull = new Map(stock.map((row) => [row.bull_id, row.doses]));
  const total = stock.reduce((sum, row) => sum + row.doses, 0);
  const inStock = (id: string) => dosesByBull.get(id) ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Stock de doses</h1>
        <p className="text-sm text-stone-600">
          {stock.length === 0
            ? "Ton container est vide pour l'instant : cherche un taureau pour ajouter tes doses."
            : `${total} dose(s) de ${stock.filter((r) => r.doses > 0).length} taureau(x) dans le container.`}
        </p>
      </div>

      <Message code={params.message} />

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold">Ajouter des doses</h2>
        <form className="flex flex-wrap gap-2" action="/stock">
          <input
            className="input min-w-56 flex-1"
            name="q"
            defaultValue={search}
            placeholder="Nom du taureau, ex. HADLEY"
            aria-label="Chercher un taureau"
            autoComplete="off"
          />
          <button className="btn">Chercher</button>
        </form>

        {search.length === 1 && (
          <p className="text-sm text-stone-600">Tape au moins 2 lettres.</p>
        )}
        {search.length >= 2 && results.length === 0 && (
          <p className="text-sm text-stone-600">
            Aucun taureau trouvé pour « {search} ».
          </p>
        )}
        {results.length > 0 && !adding && (
          <ul className="divide-y divide-stone-100">
            {results.slice(0, MAX_RESULTS).map((bull) => (
              <li
                key={bull.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <div>
                  <p className="font-medium">
                    {bull.name}
                    {!bull.is_catalog && (
                      <span className="ml-2 rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-600">
                        Perso
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-stone-500">
                    {[
                      bull.full_name !== bull.name ? bull.full_name : null,
                      bull.breed?.name ?? bull.breed_code,
                      bull.supplier?.name,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    {inStock(bull.id) > 0 &&
                      ` · déjà ${inStock(bull.id)} en stock`}
                  </p>
                </div>
                <Link
                  href={`/stock?q=${encodeURIComponent(search)}&add=${bull.id}`}
                  className="btn-secondary"
                >
                  Choisir
                </Link>
              </li>
            ))}
            {results.length > MAX_RESULTS && (
              <li className="py-2 text-sm text-stone-500">
                {results.length - MAX_RESULTS} autre(s) : précise le nom.
              </li>
            )}
          </ul>
        )}

        {adding && (
          <form
            action={adjustStock}
            className="space-y-3 rounded-lg border border-brand bg-brand-soft p-4"
          >
            <p className="font-medium">
              Combien de doses de {adding.name} as-tu ?
              {inStock(adding.id) > 0 && (
                <span className="block text-sm font-normal text-stone-600">
                  Tu en as déjà {inStock(adding.id)} : le nombre s&apos;ajoute.
                </span>
              )}
            </p>
            <input type="hidden" name="bull_id" value={adding.id} />
            <input
              type="hidden"
              name="reason"
              value={inStock(adding.id) > 0 ? "achat" : "stock_initial"}
            />
            <div className="flex flex-wrap items-center gap-2">
              <input
                className="input w-28"
                type="number"
                name="delta"
                min={1}
                max={999}
                defaultValue={1}
                required
                autoFocus
                aria-label="Nombre de doses"
              />
              <button className="btn">Ajouter au stock</button>
              <Link
                href={`/stock?q=${encodeURIComponent(search)}`}
                className="btn-secondary"
              >
                Annuler
              </Link>
            </div>
          </form>
        )}
      </section>

      {stock.length > 0 && (
        <section className="card">
          <h2 className="mb-1 text-lg font-semibold">Mon container</h2>
          <p className="mb-3 text-sm text-stone-600">
            −1 quand tu insémines, +1 ou + quantité quand tu achètes.
          </p>
          <ul className="divide-y divide-stone-100">
            {stock.map((row) => {
              const bull = row.bull;
              if (!bull) return null;
              return (
                <li
                  key={row.bull_id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3"
                >
                  <div className="min-w-40 flex-1">
                    <Link
                      href={`/taureaux/${bull.id}`}
                      className="font-medium text-brand hover:underline"
                    >
                      {bull.name}
                    </Link>
                    <p className="text-xs text-stone-500">
                      {[
                        bull.breed?.name ?? bull.breed_code,
                        bull.supplier?.name,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <p
                    className={`w-20 text-right text-2xl font-semibold tabular-nums ${row.doses === 0 ? "text-stone-400" : ""}`}
                  >
                    {row.doses}
                    <span className="ml-1 text-xs font-normal text-stone-500">
                      dose{row.doses > 1 ? "s" : ""}
                    </span>
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {row.doses > 0 ? (
                      <StockButton
                        bullId={bull.id}
                        delta={-1}
                        reason="insemination"
                        label="−1"
                        title={`Une dose de ${bull.name} utilisée`}
                      />
                    ) : (
                      <form action={removeFromStock}>
                        <input type="hidden" name="bull_id" value={bull.id} />
                        <button className="btn-secondary">Retirer</button>
                      </form>
                    )}
                    <StockButton
                      bullId={bull.id}
                      delta={1}
                      reason="achat"
                      label="+1"
                      title={`Une dose de ${bull.name} achetée`}
                    />
                    <form
                      action={adjustStock}
                      className="flex items-center gap-1"
                    >
                      <input type="hidden" name="bull_id" value={bull.id} />
                      <input type="hidden" name="reason" value="achat" />
                      <input
                        className="input w-16 px-2"
                        type="number"
                        name="delta"
                        min={1}
                        max={999}
                        placeholder="+5"
                        aria-label={`Doses de ${bull.name} achetées`}
                        required
                      />
                      <button className="btn-secondary px-3">Ajouter</button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {movements.length > 0 && (
        <details className="card text-sm">
          <summary className="cursor-pointer font-semibold">
            Derniers mouvements
          </summary>
          <ul className="mt-3 divide-y divide-stone-100">
            {movements.map((movement) => (
              <li
                key={movement.id}
                className="flex justify-between gap-4 py-1.5"
              >
                <span>
                  {new Date(movement.created_at).toLocaleDateString("fr-CH")} ·{" "}
                  {movement.bull?.name}{" "}
                  <span className="text-stone-500">
                    ({REASON_LABELS[movement.reason]})
                  </span>
                </span>
                <span
                  className={`font-medium tabular-nums ${movement.delta < 0 ? "text-amber-800" : "text-green-800"}`}
                >
                  {movement.delta > 0
                    ? `+${movement.delta}`
                    : `−${Math.abs(movement.delta)}`}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
