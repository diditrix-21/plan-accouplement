import { signIn, signUp } from "./actions";

const MESSAGES: Record<string, { text: string; kind: "notice-error" | "notice-ok" }> = {
  invalid: { text: "E-mail ou mot de passe incorrect.", kind: "notice-error" },
  short: { text: "Le mot de passe doit faire au moins 8 caractères.", kind: "notice-error" },
  signup: { text: "Impossible de créer le compte. Essaie de te connecter.", kind: "notice-error" },
  confirm: { text: "Compte créé. Confirme ton adresse via l'e-mail reçu, puis connecte-toi.", kind: "notice-ok" },
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { message } = await searchParams;
  const notice = typeof message === "string" ? MESSAGES[message] : undefined;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-10">
      <h1 className="text-2xl font-semibold">Plan d&apos;accouplement</h1>
      <p className="mt-1 text-sm text-stone-600">
        Le bon taureau pour chaque vache, selon tes objectifs d&apos;élevage.
      </p>

      {notice && <p className={`mt-6 ${notice.kind}`}>{notice.text}</p>}

      <form className="card mt-6 space-y-4">
        <div>
          <label className="label" htmlFor="email">
            E-mail
          </label>
          <input className="input" id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div>
          <label className="label" htmlFor="password">
            Mot de passe
          </label>
          <input
            className="input"
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <button className="btn" formAction={signIn}>
            Se connecter
          </button>
          <button className="btn-secondary" formAction={signUp}>
            Créer un compte
          </button>
        </div>
      </form>
    </main>
  );
}
