const MESSAGES: Record<string, { text: string; kind: string }> = {
  saved: { text: "Enregistré.", kind: "notice-ok" },
  deleted: { text: "Supprimé.", kind: "notice-ok" },
  name: { text: "Le nom est obligatoire.", kind: "notice-error" },
  error: { text: "L'enregistrement a échoué. Réessaie.", kind: "notice-error" },
  nofile: { text: "Choisis au moins un fichier CSV.", kind: "notice-error" },
  format: {
    text: "Un des fichiers n'est pas un export du catalogue Swissgenetics (en-têtes « Nom court », « Identité », « Race »).",
    kind: "notice-error",
  },
  catalog_error: {
    text: "L'import du catalogue a échoué. Réessaie : l'import peut être relancé sans risque.",
    kind: "notice-error",
  },
  herd_format: {
    text: "Ce fichier n'est pas une liste des animaux swissherdbook (il faut au moins les colonnes « N° BDTA » et « Nom »).",
    kind: "notice-error",
  },
  stock_empty: {
    text: "Plus de dose de ce taureau dans le container.",
    kind: "notice-error",
  },
  stock_quantity: { text: "Indique un nombre de doses entre 1 et 999.", kind: "notice-error" },
  farmname: { text: "Le nom de l'exploitation est obligatoire.", kind: "notice-error" },
  admin: {
    text: "Seul l'administrateur du catalogue peut importer ou modifier le catalogue officiel.",
    kind: "notice-error",
  },
  forbidden: {
    text: "Ce taureau fait partie du catalogue officiel : tu ne peux pas le modifier. Tu peux ajouter ta propre fiche avec « Ajouter un taureau ».",
    kind: "notice-error",
  },
};

/** Affiche le message correspondant au paramètre `?message=` de l'URL. */
export function Message({ code }: { code: string | string[] | undefined }) {
  const message = typeof code === "string" ? MESSAGES[code] : undefined;
  if (!message) return null;
  return <p className={`mb-4 ${message.kind}`}>{message.text}</p>;
}
