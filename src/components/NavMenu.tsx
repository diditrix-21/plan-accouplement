"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV = [
  { href: "/", label: "Accueil", hint: "Où j'en suis" },
  { href: "/vaches", label: "Mon troupeau", hint: "Mes vaches et leurs fiches" },
  { href: "/objectifs", label: "Mes objectifs", hint: "Ce que je veux améliorer" },
  { href: "/plan", label: "Plan d'accouplement", hint: "Le bon taureau pour chaque vache" },
  { href: "/taureaux", label: "Taureaux", hint: "Le catalogue et mes taureaux" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Menu principal : onglets sur ordinateur, bouton « Menu » qui ouvre la liste
 * sur téléphone. La page en cours est surlignée.
 */
export function NavMenu({ farmName, email, signOut }: {
  farmName: string;
  email: string | undefined;
  signOut: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-20 border-b border-stone-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
        <Link href="/" className="font-semibold text-brand">
          Plan d&apos;accouplement
          <span className="block text-xs font-normal text-stone-500">{farmName}</span>
        </Link>

        <nav className="hidden flex-1 gap-1 md:flex" aria-label="Menu principal">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(pathname, item.href) ? "page" : undefined}
              className={`rounded-lg px-3 py-2 text-sm font-medium ${
                isActive(pathname, item.href)
                  ? "bg-brand-soft text-brand"
                  : "text-stone-700 hover:bg-stone-100"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <form action={signOut} className="ml-auto hidden md:block">
          <button className="text-sm text-stone-500 hover:text-stone-900 hover:underline" title={email}>
            Déconnexion
          </button>
        </form>

        <button
          type="button"
          className="ml-auto inline-flex items-center gap-2 rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium md:hidden"
          aria-expanded={open}
          aria-controls="menu-mobile"
          onClick={() => setOpen((value) => !value)}
        >
          <span aria-hidden className="text-lg leading-none">{open ? "✕" : "☰"}</span>
          Menu
        </button>
      </div>

      {open && (
        <nav id="menu-mobile" className="border-t border-stone-200 bg-white md:hidden" aria-label="Menu principal">
          <ul className="mx-auto max-w-5xl divide-y divide-stone-100 px-2 py-1">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={isActive(pathname, item.href) ? "page" : undefined}
                  className={`block rounded-lg px-3 py-3 ${
                    isActive(pathname, item.href) ? "bg-brand-soft text-brand" : "text-stone-800"
                  }`}
                >
                  <span className="font-medium">{item.label}</span>
                  <span className="block text-xs text-stone-500">{item.hint}</span>
                </Link>
              </li>
            ))}
            <li className="px-3 py-3">
              <p className="mb-2 text-xs text-stone-500">{email}</p>
              <form action={signOut}>
                <button className="btn-secondary w-full">Déconnexion</button>
              </form>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
