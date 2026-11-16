import { CATEGORY_LABELS, type TraitRow } from "@/lib/data";

const CATEGORIES: TraitRow["category"][] = ["production", "fonctionnel", "morphologie"];

function placeholder(trait: TraitRow): string {
  return trait.mean === 0 ? "0" : String(trait.mean);
}

/**
 * Une case numérique par critère, regroupées par catégorie.
 * Les champs s'appellent `trait:<code>` ; avec `withWeakness`, une case à
 * cocher `weak:<code>` permet de marquer un point faible sans chiffre.
 */
export function TraitInputs({
  traits,
  values = {},
  weak = [],
  withWeakness = false,
}: {
  traits: TraitRow[];
  values?: Record<string, number>;
  weak?: string[];
  withWeakness?: boolean;
}) {
  return (
    <div className="space-y-5">
      {CATEGORIES.map((category) => {
        const group = traits.filter((t) => t.category === category);
        if (group.length === 0) return null;
        return (
          <fieldset key={category}>
            <legend className="mb-2 text-sm font-semibold text-stone-800">
              {CATEGORY_LABELS[category]}
            </legend>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.map((trait) => (
                <div key={trait.code}>
                  <label className="label" htmlFor={`trait:${trait.code}`}>
                    {trait.label}
                    {trait.unit && !trait.label.includes(`(${trait.unit})`) ? ` (${trait.unit})` : ""}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      className="input"
                      id={`trait:${trait.code}`}
                      name={`trait:${trait.code}`}
                      inputMode="decimal"
                      placeholder={placeholder(trait)}
                      defaultValue={values[trait.code] ?? ""}
                    />
                    {withWeakness && (
                      <label className="flex shrink-0 items-center gap-1 text-xs text-stone-600">
                        <input
                          type="checkbox"
                          name={`weak:${trait.code}`}
                          defaultChecked={weak.includes(trait.code)}
                        />
                        faible
                      </label>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
