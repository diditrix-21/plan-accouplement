# Plan d'accouplement

Le bon taureau pour chaque vache, selon les objectifs d'élevage de l'éleveur, tous vendeurs
de semences confondus.

Next.js 16 (App Router, TypeScript, Tailwind 4) + Supabase (Postgres, Auth, RLS).

## Démarrer

La base est déjà en place : projet Supabase `plan-accouplement` (région Zurich), tables,
règles d'accès et données de départ. `.env.local` pointe dessus.

```bash
npm install
npm run dev
```

Ouvrir http://localhost:3000, créer un compte, puis suivre les trois étapes de l'accueil.

À la création du compte, Supabase envoie un e-mail de confirmation. Pour s'en passer en
développement : Authentication → Sign In / Providers → Email → désactiver « Confirm email ».

### Repartir de zéro sur un autre projet Supabase

1. Exécuter dans l'ordre les fichiers de `supabase/migrations/`, puis `supabase/seed.sql`.
2. Copier `.env.example` vers `.env.local` avec l'URL et la clé publique du projet.

## Ce que fait l'appli

| Écran | Rôle |
| --- | --- |
| Troupeau | Les vaches, leur pedigree court (père, grand-père maternel) et leurs points faibles |
| Taureaux | Catalogue partagé, tous vendeurs. Saisie à la main ou import depuis un tableur |
| Objectifs | Un poids de 0 à 5 par critère (« qu'est-ce que tu veux améliorer en premier ») + règles |
| Plan | Pour chaque vache : les 3 meilleurs taureaux, pourquoi, et les doses à prévoir |

## Comment le plan est calculé

Tout est dans `src/lib/mating.ts` (fonctions pures, testées dans `mating.test.ts`).

1. Chaque valeur est ramenée en écarts-types par rapport à la moyenne du critère
   (`traits.mean`, `traits.sd`).
2. Le veau attendu vaut la moyenne de ses deux parents.
3. Un veau sous la moyenne coûte deux fois plus qu'un veau au-dessus ne rapporte
   (`weaknessFactor`). Sans ça, le même taureau sortirait premier pour toutes les vaches ;
   avec, un taureau fort en cellules ressort d'abord sur les vaches faibles en cellules.
4. Le score est le gain pondéré par les objectifs, comparé à un taureau moyen (score 0).
5. Sont écartés : les taureaux d'une autre race, les parents proches (père, grand-père
   maternel, même père), et sur génisse les taureaux sous le seuil de facilité de vêlage.
6. Un taureau ne dépasse pas une part maximale du troupeau (30 % par défaut). Quand il est
   plein, il reste sur les vaches qui perdraient le plus à en changer.

## Limites connues

- **Les écarts-types des critères sont des valeurs de départ** (12 pour les index centrés sur
  100, 500 kg pour le lait, etc.). À vérifier avec la documentation des fédérations avant de
  s'y fier : ils changent le poids relatif de la production face aux index.
- **Le contrôle de parenté compare des noms** sur deux générations. Ce n'est pas un calcul de
  consanguinité.
- Tous les critères sont traités comme « plus haut = mieux ». Les caractères à optimum
  intermédiaire (certains postes linéaires de morphologie) ne sont pas gérés.
- Les valeurs des vaches sont saisies à la main. Pas d'import depuis les fédérations.
- Les taureaux `EXEMPLE …` sont inventés. Les retirer avant un vrai usage :
  `delete from public.bulls where is_example;`
- Le catalogue est partagé : tout utilisateur connecté peut y ajouter un taureau, et seul
  celui qui l'a ajouté peut le modifier.

## Vérifications

```bash
npm test          # moteur d'accouplement + import tableur
npm run typecheck
npm run lint
npm run db:check  # exécute migration + seed sur un Postgres en mémoire et teste les règles d'accès
```

## Suite prévue : le stock de doses

Le plan affiche déjà les « doses à prévoir ». L'étape suivante ajoute :

- `semen_stock` : doses par taureau et par exploitation (conteneur, canister)
- `inseminations` : quelle vache a reçu quel taureau, quand
- une option du plan « uniquement parmi les doses que j'ai déjà »
- une alerte quand il reste peu de doses d'un taureau
