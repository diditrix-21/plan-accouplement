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

## Importer le catalogue Swissgenetics

Sur le site Swissgenetics, exporte la liste des taureaux de chaque race en CSV. Dans l'appli :
**Taureaux → Importer → Importer le catalogue Swissgenetics**, sélectionne tous les fichiers d'un
coup. Un taureau déjà présent (même identité) est mis à jour : refais l'import après chaque
estimation des valeurs d'élevage (avril, août, décembre).

Ce qui est repris (`src/lib/swissgenetics.ts`) :

- nom, identité, race, père, grand-père maternel, prix (dose normale et sexée), sans cornes,
  caséines, base des valeurs d'élevage (colonne « VE ») ;
- les critères de l'appli, selon la base du taureau :
  - **base suisse** (« G/GA/GI … ») et Allemagne/Autriche : valeurs telles quelles ;
  - **France** (Montbéliarde) : fonctionnels publiés en écarts-types (0 ± 1) → `100 + 12 × valeur` ;
  - **Canada** (Jersey) : fonctionnels 100 ± 5 et conformation 0 ± 5 → échelle 100 ± 12 ;
  - **pays nordiques** (Jersey) : index 100 ± 10 → échelle 100 ± 12, production (publiée en
    index) non reprise ;
  - **base non indiquée** (races à viande, races spéciales) : taureau importé sans critères.

Limites : la conversion des bases étrangères est une approximation (les populations de référence
diffèrent) ; la facilité de naissance/vêlage française n'est pas reprise (échelle non confirmée) ;
les index globaux (ISET, VEG, IPL…) et les critères viande ne sont pas encore dans l'appli ; le
catalogue appartient au compte qui l'a importé, lui seul peut le mettre à jour.

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
