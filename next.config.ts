import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Appli 100 % connectée (chaque page dépend de l'utilisateur) : on reste sur
  // le rendu dynamique classique plutôt que Cache Components.
  experimental: {
    // Import de catalogue : plusieurs fichiers CSV d'un coup (1 Mo par défaut).
    serverActions: { bodySizeLimit: "5mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
