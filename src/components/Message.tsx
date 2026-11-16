const MESSAGES: Record<string, { text: string; kind: string }> = {
  saved: { text: "Enregistré.", kind: "notice-ok" },
  deleted: { text: "Supprimé.", kind: "notice-ok" },
  name: { text: "Le nom est obligatoire.", kind: "notice-error" },
  error: { text: "L'enregistrement a échoué. Réessaie.", kind: "notice-error" },
  forbidden: {
    text: "Ce taureau a été ajouté par quelqu'un d'autre : tu ne peux pas le modifier.",
    kind: "notice-error",
  },
};

/** Affiche le message correspondant au paramètre `?message=` de l'URL. */
export function Message({ code }: { code: string | string[] | undefined }) {
  const message = typeof code === "string" ? MESSAGES[code] : undefined;
  if (!message) return null;
  return <p className={`mb-4 ${message.kind}`}>{message.text}</p>;
}
