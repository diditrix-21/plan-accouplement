import Link from "next/link";
import { CATEGORY_LABELS, type TraitRow } from "@/lib/data";
import { formatNumber } from "@/lib/forms";
import type { DetailSection, Pedigree } from "@/lib/swissgenetics";

/** Morceaux communs aux fiches taureau et vache (certificat). */

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="mb-3 inline-block text-sm text-stone-600 hover:text-brand">
      ← {label}
    </Link>
  );
}

/** Une ligne « libellé : valeur » du bandeau d'identité. */
export function Facts({ items }: { items: [string, string | null | undefined][] }) {
  const shown = items.filter(([, value]) => value);
  if (shown.length === 0) return null;
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3 lg:grid-cols-4">
      {shown.map(([label, value]) => (
        <div key={label}>
          <dt className="text-stone-500">{label}</dt>
          <dd className="font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Ancestor({
  role,
  name,
  id,
  link,
}: {
  role: string;
  name?: string | null;
  id?: string | null;
  link: boolean;
}) {
  return (
    <div className="rounded-lg border border-stone-200 px-3 py-2">
      <p className="text-xs text-stone-500">{role}</p>
      {name ? (
        link ? (
          <Link
            href={`/taureaux?q=${encodeURIComponent(name)}`}
            className="font-medium text-brand hover:underline"
          >
            {name}
          </Link>
        ) : (
          <p className="font-medium">{name}</p>
        )
      ) : (
        <p className="text-stone-400">—</p>
      )}
      {id && <p className="text-xs text-stone-500">{id}</p>}
    </div>
  );
}

/**
 * Ascendance sur trois générations. Les mâles renvoient vers le catalogue
 * (recherche par nom), pour ouvrir leur fiche s'ils y sont.
 */
export function PedigreeTree({ pedigree }: { pedigree: Pedigree }) {
  return (
    <section className="card">
      <h2 className="mb-3 text-base font-semibold">Ascendance</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Ancestor role="Père" name={pedigree.sire} id={pedigree.sireId} link />
          <div className="grid grid-cols-2 gap-2 pl-4">
            <Ancestor role="Grand-père paternel" name={pedigree.ss} id={pedigree.ssId} link />
            <Ancestor role="Grand-mère paternelle" name={pedigree.sd} id={pedigree.sdId} link={false} />
          </div>
        </div>
        <div className="space-y-2">
          <Ancestor role="Mère" name={pedigree.dam} id={pedigree.damId} link={false} />
          <div className="grid grid-cols-2 gap-2 pl-4">
            <Ancestor role="Grand-père maternel" name={pedigree.ds} id={pedigree.dsId} link />
            <Ancestor role="Grand-mère maternelle" name={pedigree.dd} id={pedigree.ddId} link={false} />
          </div>
          {(pedigree.dds || pedigree.ddd) && (
            <div className="grid grid-cols-2 gap-2 pl-8">
              <Ancestor role="Arrière-grand-père (mère de la mère)" name={pedigree.dds} link />
              <Ancestor role="Arrière-grand-mère (mère de la mère)" name={pedigree.ddd} link={false} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/** Barre centrée sur la moyenne : à droite = mieux pour l'élevage. */
function Bar({ trait, value }: { trait: TraitRow; value: number }) {
  const z = ((value - trait.mean) / trait.sd) * trait.direction;
  const width = Math.min(50, Math.abs(z) * 16.6);
  return (
    <div className="relative h-2 w-full rounded bg-stone-100" aria-hidden>
      <div className="absolute inset-y-0 left-1/2 w-px bg-stone-300" />
      <div
        className={`absolute inset-y-0 rounded ${z >= 0 ? "bg-brand" : "bg-amber-500"}`}
        style={z >= 0 ? { left: "50%", width: `${width}%` } : { right: "50%", width: `${width}%` }}
      />
    </div>
  );
}

/**
 * Les critères utilisés par le plan, avec une barre par rapport à la moyenne.
 * `weak` : critères marqués « faible » sans chiffre (vaches).
 */
export function TraitTable({
  traits,
  values,
  weak = [],
  title = "Critères utilisés par le plan",
}: {
  traits: TraitRow[];
  values: Record<string, number>;
  weak?: string[];
  title?: string;
}) {
  const categories: TraitRow["category"][] = ["production", "fonctionnel", "morphologie"];
  const known = traits.filter((t) => values[t.code] !== undefined || weak.includes(t.code));

  return (
    <section className="card">
      <h2 className="mb-1 text-base font-semibold">{title}</h2>
      <p className="mb-3 text-xs text-stone-500">
        Barre verte = mieux que la moyenne, orange = moins bien.
      </p>
      {known.length === 0 ? (
        <p className="text-sm text-stone-600">Aucune valeur enregistrée : comptée comme moyenne.</p>
      ) : (
        <div className="grid gap-x-8 gap-y-4 md:grid-cols-3">
          {categories.map((category) => {
            const group = known.filter((t) => t.category === category);
            if (group.length === 0) return null;
            return (
              <div key={category}>
                <h3 className="mb-2 text-sm font-medium text-stone-600">
                  {CATEGORY_LABELS[category]}
                </h3>
                <ul className="space-y-2 text-sm">
                  {group.map((trait) => {
                    const value = values[trait.code];
                    return (
                      <li key={trait.code}>
                        <div className="flex justify-between gap-2">
                          <span>{trait.label}</span>
                          <span className="font-medium tabular-nums">
                            {value === undefined
                              ? "faible"
                              : formatNumber(value, Math.abs(value) < 5 && value % 1 !== 0 ? 2 : 0)}
                          </span>
                        </div>
                        {value !== undefined && <Bar trait={trait} value={value} />}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/** Toutes les rubriques du certificat, telles que publiées. */
export function DetailSections({ sections }: { sections: DetailSection[] }) {
  if (sections.length === 0) return null;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {sections.map((section) => (
        <section key={section.title} className="card">
          <h2 className="mb-3 text-base font-semibold">{section.title}</h2>
          <dl className="divide-y divide-stone-100 text-sm">
            {section.items.map(([label, value], index) => (
              <div key={`${label}-${index}`} className="flex justify-between gap-4 py-1.5">
                <dt className="text-stone-600">{label}</dt>
                <dd className="text-right font-medium tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
