import Link from "next/link";
import { getFarm, requireUser } from "@/lib/data";
import { signOut } from "../login/actions";

const NAV = [
  { href: "/", label: "Accueil" },
  { href: "/vaches", label: "Troupeau" },
  { href: "/taureaux", label: "Taureaux" },
  { href: "/objectifs", label: "Objectifs" },
  { href: "/plan", label: "Plan" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await requireUser();
  const farm = await getFarm(supabase);

  return (
    <div className="min-h-screen">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/" className="font-semibold text-brand">
            Plan d&apos;accouplement
          </Link>
          <nav className="flex flex-1 flex-wrap gap-x-4 gap-y-1 text-sm">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="text-stone-700 hover:text-brand">
                {item.label}
              </Link>
            ))}
          </nav>
          <form action={signOut} className="flex items-center gap-3 text-sm text-stone-500">
            <span className="font-medium text-stone-700">{farm.name}</span>
            <span className="hidden md:inline">{user.email}</span>
            <button className="hover:text-stone-900 hover:underline">Déconnexion</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
