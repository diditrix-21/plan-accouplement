// Vérifie que la migration et le seed s'exécutent sur un Postgres local
// (PGlite, en mémoire), puis que les règles RLS font ce qu'on attend.
// Supabase fournit le schéma `auth` et le rôle `authenticated` : ici on les simule.
//
//   npm run db:check

import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
let failures = 0;

function check(label, ok) {
  console.log(`${ok ? "✓" : "✗"} ${label}`);
  if (!ok) failures += 1;
}

async function expectError(label, sql) {
  try {
    await db.exec(sql);
    check(label, false);
  } catch {
    check(label, true);
  }
}

async function as(userId, fn) {
  await db.exec(`set role authenticated; select set_config('test.uid', '${userId}', false);`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role;");
  }
}

// --- Simulation de l'environnement Supabase ---------------------------------
await db.exec(`
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  grant usage on schema auth to authenticated;
  grant usage on schema public to authenticated;
`);

const ALICE = "00000000-0000-0000-0000-00000000000a";
const BOB = "00000000-0000-0000-0000-00000000000b";
await db.exec(`insert into auth.users (id, email) values ('${ALICE}', 'alice@test'), ('${BOB}', 'bob@test');`);

// --- Migration + seed --------------------------------------------------------
for (const file of readdirSync("supabase/migrations").sort()) {
  await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
  check(`migration ${file}`, true);
}
await db.exec(readFileSync("supabase/seed.sql", "utf8"));
check("seed.sql", true);

const counts = await db.query(`
  select
    (select count(*) from public.traits)::int as traits,
    (select count(*) from public.bulls where is_example)::int as bulls,
    (select count(*) from public.bull_traits)::int as bull_traits,
    (select count(*) from public.bull_traits bt
      left join public.traits t on t.code = bt.trait_code where t.code is null)::int as orphans
`);
const { traits, bulls, bull_traits: bullTraits, orphans } = counts.rows[0];
check(`seed : ${traits} critères, ${bulls} taureaux d'exemple, ${bullTraits} valeurs`, traits === 22 && bulls === 6 && bullTraits > 0 && orphans === 0);

await db.exec(readFileSync("supabase/seed.sql", "utf8").split("-- Taureaux d'EXEMPLE")[0]);
check("seed des référentiels rejouable sans doublon", true);

// --- RLS ---------------------------------------------------------------------
await as(ALICE, async () => {
  await db.exec(`insert into public.farms default values;`);
  await db.exec(`
    insert into public.cows (farm_id, name) select id, 'Bella' from public.farms;
    insert into public.cow_traits (cow_id, trait_code, value) select id, 'cellules', 88 from public.cows;
    insert into public.breeding_goals (farm_id, trait_code, weight) select id, 'cellules', 5 from public.farms;
    insert into public.bulls (name, breed_code) values ('TORO ALICE', 'RH');
    insert into public.bull_traits (bull_id, trait_code, value)
      select id, 'cellules', 115.5 from public.bulls where name = 'TORO ALICE';
  `);
  const own = await db.query(`select count(*)::int as n from public.cows`);
  check("Alice voit sa vache", own.rows[0].n === 1);
  await expectError("une seule exploitation par utilisateur", `insert into public.farms default values;`);
  await expectError("poids d'objectif limité à 0–5", `update public.breeding_goals set weight = 9;`);
  await expectError("référentiel des critères en lecture seule", `insert into public.traits (code, label, category) values ('x', 'X', 'production');`);
});

const aliceFarm = (await db.query(`select id from public.farms`)).rows[0].id;

await as(BOB, async () => {
  const cows = await db.query(`select count(*)::int as n from public.cows`);
  const cowTraits = await db.query(`select count(*)::int as n from public.cow_traits`);
  const goals = await db.query(`select count(*)::int as n from public.breeding_goals`);
  const farms = await db.query(`select count(*)::int as n from public.farms`);
  check(
    "Bob ne voit ni l'exploitation, ni les vaches, ni les objectifs d'Alice",
    cows.rows[0].n === 0 && cowTraits.rows[0].n === 0 && goals.rows[0].n === 0 && farms.rows[0].n === 0,
  );

  const catalogue = await db.query(`select count(*)::int as n, count(*) filter (where name = 'TORO ALICE')::int as alice from public.bulls`);
  const aliceTraits = await db.query(`select count(*)::int as n from public.bull_traits where value = 115.5`);
  check(
    "Bob voit le catalogue officiel, mais pas le taureau perso d'Alice ni ses valeurs",
    catalogue.rows[0].n === 6 && catalogue.rows[0].alice === 0 && aliceTraits.rows[0].n === 0,
  );

  const updated = await db.query(`update public.bulls set name = 'PIRATE' returning id`);
  const deleted = await db.query(`delete from public.bulls returning id`);
  const traitEdit = await db.query(`update public.bull_traits set value = 0 returning bull_id`);
  const traitDelete = await db.query(`delete from public.bull_traits returning bull_id`);
  check(
    "Bob ne peut modifier ni supprimer aucun taureau du catalogue",
    updated.rows.length === 0 && deleted.rows.length === 0 && traitEdit.rows.length === 0 && traitDelete.rows.length === 0,
  );

  await expectError(
    "Bob ne peut pas ajouter de vache dans l'exploitation d'Alice",
    `insert into public.cows (farm_id, name) values ('${aliceFarm}', 'Intruse');`,
  );
  await expectError(
    "Bob ne peut pas créer un taureau au nom d'Alice",
    `insert into public.bulls (name, created_by) values ('FAUX', '${ALICE}');`,
  );
});

// Catalogue officiel : réservé aux administrateurs, réimportable sans doublon
const CATALOG = (name, price) => `
  insert into public.bulls (name, herdbook_id, supplier_id, breed_code, price_chf, is_catalog)
  values ('${name}', 'CH 120.0000.0001.1', (select id from public.suppliers where name = 'Swissgenetics'), 'AN', ${price}, true)
  on conflict (supplier_id, herdbook_id) where is_catalog do update
    set name = excluded.name, price_chf = excluded.price_chf;`;
await as(ALICE, async () => {
  await expectError("sans droit d'administration, Alice ne peut pas ajouter au catalogue officiel", CATALOG("CATALOGUE", 40));
});
await db.exec(`insert into public.catalog_admins (user_id) values ('${ALICE}');`);
await as(ALICE, async () => {
  await db.exec(CATALOG("CATALOGUE", 40));
  await db.exec(CATALOG("CATALOGUE", 45));
  const rows = (await db.query(`select price_chf::int as price from public.bulls where herdbook_id = 'CH 120.0000.0001.1'`)).rows;
  check("réimporter un catalogue met à jour le taureau au lieu de le dupliquer", rows.length === 1 && rows[0].price === 45);
  const edited = await db.query(`update public.bulls set price_chf = 30 where name = 'EXEMPLE LAITIER' returning id`);
  check("l'administratrice peut corriger un taureau du catalogue", edited.rows.length === 1);
});
await as(BOB, async () => {
  await expectError("Bob ne peut pas écraser le catalogue officiel", CATALOG("PIRATE", 1));
  const admins = await db.query(`select count(*)::int as n from public.catalog_admins`);
  check("Bob ne voit pas qui administre le catalogue", admins.rows[0].n === 0);
  await expectError("Bob ne peut pas se nommer administrateur", `insert into public.catalog_admins (user_id) values ('${BOB}');`);
  await expectError("Bob ne peut pas faire passer un taureau perso au catalogue", `
    insert into public.bulls (name) values ('PERSO BOB');
    update public.bulls set is_catalog = true where name = 'PERSO BOB';`);
  await db.exec(`
    insert into public.bulls (name, herdbook_id, supplier_id)
    values ('MON TORO', 'CH 120.0000.0001.1', (select id from public.suppliers where name = 'Swissgenetics'));
    insert into public.bull_traits (bull_id, trait_code, value) select id, 'membres', 101.5 from public.bulls where name = 'MON TORO';`);
  const mine = await db.query(`select count(*)::int as n from public.bulls where not is_catalog`);
  check("Bob peut noter pour lui un taureau déjà au catalogue, et ne voit que ses taureaux perso", mine.rows[0].n >= 1 && (await db.query(`select count(*)::int as n from public.bulls where name = 'TORO ALICE'`)).rows[0].n === 0);
});
await as(ALICE, async () => {
  const seen = await db.query(`select count(*)::int as n from public.bulls where name in ('MON TORO', 'PERSO BOB')`);
  const traits = await db.query(`select count(*)::int as n from public.bull_traits where value = 101.5`);
  check("Alice, même administratrice, ne voit pas les taureaux perso de Bob", seen.rows[0].n === 0 && traits.rows[0].n === 0);
});

// Suppression en cascade
await db.exec(`delete from auth.users where id = '${ALICE}';`);
const leftovers = await db.query(`
  select (select count(*) from public.farms)::int + (select count(*) from public.cows)::int
       + (select count(*) from public.cow_traits)::int + (select count(*) from public.breeding_goals)::int as n,
         (select count(*) from public.bulls where herdbook_id = 'CH 120.0000.0001.1' and is_catalog)::int as kept
`);
check(
  "supprimer un compte efface son exploitation mais garde le catalogue officiel",
  leftovers.rows[0].n === 0 && leftovers.rows[0].kept === 1,
);

console.log(failures === 0 ? "\nTout est bon." : `\n${failures} vérification(s) en échec.`);
process.exit(failures === 0 ? 0 : 1);
