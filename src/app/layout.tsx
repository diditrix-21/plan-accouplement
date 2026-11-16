import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Plan d'accouplement",
  description: "Le bon taureau pour chaque vache, selon tes objectifs d'élevage.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
