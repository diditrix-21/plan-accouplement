import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink, DetailSections, Facts, PedigreeTree, TraitTable } from "@/components/Sheet";
import { isCatalogAdmin, loadBull, loadTraits, requireUser, valuesByCode } from "@/lib/data";
import { formatChf } from "@/lib/forms";

/** Certificat d'un taureau : identité, ascendance, critères du plan, fiche complète du vendeur. */
export default async function BullSheetPage({ params }: PageProps<"/taureaux/[id]">) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  const [bull, traits, isAdmin] = await Promise.all([
    loadBull(supabase, id),
    loadTraits(supabase),
    isCatalogAdmin(supabase),
  ]);
  if (!bull) notFound();

  const canEdit = bull.is_catalog ? isAdmin : bull.created_by === user.id;
  const pedigree = bull.details?.pedigree ?? {
    sire: bull.sire_name ?? undefined,
    ds: bull.mgs_name ?? undefined,
  };

  return (
    <div className="space-y-4">
      <BackLink href="/taureaux" label="Catalogue" />

      <section className="card space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">
              {bull.name}
              {!bull.is_catalog && (
                <span className="ml-2 rounded bg-stone-100 px-2 py-0.5 align-middle text-xs font-medium text-stone-600">
                  Perso
                </span>
              )}
            </h1>
            {bull.full_name && bull.full_name !== bull.name && (
              <p className="text-stone-600">{bull.full_name}</p>
            )}
          </div>
          {canEdit && (
            <Link href={`/taureaux?edit=${bull.id}`} className="btn-secondary">
              Modifier
            </Link>
          )}
        </div>
        <Facts
          items={[
            ["Race", bull.breed?.name ?? bull.breed_code],
            ["Vendeur", bull.supplier?.name],
            ["N° herdbook / identité", bull.herdbook_id],
            ["Base des valeurs", bull.eval_base],
            ["Dose conventionnelle", bull.price_chf === null ? null : formatChf(bull.price_chf)],
            ["Dose sexée", bull.price_sexed_chf === null ? null : formatChf(bull.price_sexed_chf)],
            ["Sans cornes", bull.polled],
            [
              "Caséines",
              [bull.kappa_casein && `κ ${bull.kappa_casein}`, bull.beta_casein && `β ${bull.beta_casein}`]
                .filter(Boolean)
                .join(" · "),
            ],
          ]}
        />
      </section>

      <PedigreeTree pedigree={pedigree} />

      <TraitTable traits={traits} values={valuesByCode(bull.bull_traits)} />

      {bull.details ? (
        <>
          <h2 className="pt-2 text-lg font-semibold">Fiche complète du vendeur</h2>
          <DetailSections sections={bull.details.sections} />
        </>
      ) : (
        // Message de maintenance : seul l'administrateur du catalogue peut y remédier.
        bull.is_catalog &&
        isAdmin && (
          <p className="notice">
            Fiche complète du vendeur pas encore chargée pour ce taureau. Réimporte le catalogue
            (Taureaux → Importer) pour l&apos;ajouter. Ce message n&apos;est visible que par toi.
          </p>
        )
      )}
    </div>
  );
}
