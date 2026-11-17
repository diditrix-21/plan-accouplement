import { signIn, signUp } from "./actions";

const MESSAGES: Record<string, { text: string; kind: "notice-error" | "notice-ok" }> = {
  invalid: { text: "E-mail ou mot de passe incorrect.", kind: "notice-error" },
  farm: {
    text: "Pour créer un compte, indique le nom de ton exploitation.",
    kind: "notice-error",
  },
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
        <button className="btn w-full" formAction={signIn}>
          Se connecter
        </button>

        <div className="space-y-3 border-t border-stone-200 pt-4">
          <p className="text-sm font-medium">Pas encore de compte ?</p>
          <p className="text-sm text-stone-600">
            Remplis l&apos;e-mail et le mot de passe ci-dessus (8 caractères au moins), puis le nom
            de ton exploitation.
          </p>
          <div>
            <label className="label" htmlFor="farm_name">
              Nom de l&apos;exploitation
            </label>
            <input
              className="input"
              id="farm_name"
              name="farm_name"
              maxLength={80}
              autoComplete="organization"
              placeholder="ex. Du Clos"
            />
          </div>
          <button className="btn-secondary w-full" formAction={signUp}>
            Créer un compte
          </button>
          <p className="text-xs text-stone-500">
            Ton troupeau et tes objectifs ne sont visibles que par toi.
          </p>
        </div>
      </form>
    </main>
  );
}
