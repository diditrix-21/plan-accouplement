import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink, DetailSections, Facts, PedigreeTree, TraitTable } from "@/components/Sheet";
import { loadCow, loadTraits, requireUser, valuesByCode } from "@/lib/data";

function age(birthDate: string | null): string | null {
  if (!birthDate) return null;
  const born = new Date(birthDate);
  if (Number.isNaN(born.getTime())) return null;
  const formatted = born.toLocaleDateString("fr-CH");
  const years = Math.floor((Date.now() - born.getTime()) / (365.25 * 24 * 3600 * 1000));
  return years >= 0 ? `${formatted} (${years} an${years > 1 ? "s" : ""})` : formatted;
}

/** Certificat d'une vache : identité, ascendance, critères, chiffres importés. */
export default async function CowSheetPage({ params }: PageProps<"/vaches/[id]">) {
  const { id } = await params;
  const { supabase } = await requireUser();
  const [cow, traits] = await Promise.all([loadCow(supabase, id), loadTraits(supabase)]);
  if (!cow) notFound();

  const exact = cow.cow_traits.filter((t) => !t.estimated);
  const weak = cow.cow_traits.filter((t) => t.estimated).map((t) => t.trait_code);
  const pedigree = cow.details?.pedigree ?? {
    sire: cow.sire_name ?? undefined,
    ds: cow.mgs_name ?? undefined,
  };

  return (
    <div className="space-y-4">
      <BackLink href="/vaches" label="Troupeau" />

      <section className="card space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold">
            {cow.name}
            {cow.lactation_no === 0 && (
              <span className="ml-2 rounded bg-stone-100 px-2 py-0.5 align-middle text-xs font-medium text-stone-600">
                Génisse
              </span>
            )}
          </h1>
          <div className="flex gap-2">
            <Link href={`/plan#vache-${cow.id}`} className="btn-secondary">
              Voir dans le plan
            </Link>
            <Link href={`/vaches?edit=${cow.id}`} className="btn-secondary">
              Modifier
            </Link>
          </div>
        </div>
        <Facts
          items={[
            ["N° de marque", cow.ear_tag],
            ["Race", cow.breed?.name ?? cow.breed_code],
            ["Lactations", cow.lactation_no === 0 ? "Génisse" : String(cow.lactation_no)],
            ["Née le", age(cow.birth_date)],
            ["Remarques", cow.notes],
          ]}
        />
      </section>

      <PedigreeTree pedigree={pedigree} />

      <TraitTable
        traits={traits}
        values={valuesByCode(exact)}
        weak={weak}
        title="Critères utilisés par le plan"
      />

      {cow.details && cow.details.sections.length > 0 && (
        <>
          <h2 className="pt-2 text-lg font-semibold">Certificat complet</h2>
          <DetailSections sections={cow.details.sections} />
        </>
      )}
    </div>
  );
}
