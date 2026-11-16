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
      select id, 'cellules', 115 from public.bulls where name = 'TORO ALICE';
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

  const catalogue = await db.query(`select count(*)::int as n from public.bulls`);
  check("Bob voit tout le catalogue de taureaux", catalogue.rows[0].n === 7);

  const updated = await db.query(`update public.bulls set name = 'PIRATE' where name = 'TORO ALICE' returning id`);
  const deleted = await db.query(`delete from public.bulls where is_example returning id`);
  const traitEdit = await db.query(`update public.bull_traits set value = 0 returning bull_id`);
  check(
    "Bob ne peut modifier ni les taureaux d'Alice, ni ceux d'exemple",
    updated.rows.length === 0 && deleted.rows.length === 0 && traitEdit.rows.length === 0,
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

// Suppression en cascade
await db.exec(`delete from auth.users where id = '${ALICE}';`);
const leftovers = await db.query(`
  select (select count(*) from public.farms)::int + (select count(*) from public.cows)::int
       + (select count(*) from public.cow_traits)::int + (select count(*) from public.breeding_goals)::int as n,
         (select count(*) from public.bulls where name = 'TORO ALICE')::int as kept
`);
check(
  "supprimer un compte efface son exploitation mais garde ses taureaux au catalogue",
  leftovers.rows[0].n === 0 && leftovers.rows[0].kept === 1,
);

console.log(failures === 0 ? "\nTout est bon." : `\n${failures} vérification(s) en échec.`);
process.exit(failures === 0 ? 0 : 1);
