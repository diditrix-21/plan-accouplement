import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Appli 100 % connectée (chaque page dépend de l'utilisateur) : on reste sur
  // le rendu dynamique classique plutôt que Cache Components.
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
