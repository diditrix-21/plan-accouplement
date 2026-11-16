-- Plan d'accouplement — schéma initial
-- À exécuter dans Supabase (SQL Editor) ou via `supabase db push`.

-- ---------------------------------------------------------------------------
-- Référentiels (lecture seule pour les utilisateurs)
-- ---------------------------------------------------------------------------

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  website text
);

create table public.breeds (
  code text primary key,
  name text not null,
  -- Les races d'un même groupe peuvent être accouplées entre elles
  -- (ex. Holstein et Red Holstein).
  breed_group text not null
);

create table public.traits (
  code text primary key,
  label text not null,
  category text not null check (category in ('production', 'fonctionnel', 'morphologie')),
  unit text,
  -- Moyenne et écart-type de l'échelle publiée, pour comparer les critères
  -- entre eux (ex. index 100 ± 12, lait 0 ± 500 kg).
  mean numeric not null default 100,
  sd numeric not null default 12 check (sd > 0),
  -- 1 = une valeur élevée est souhaitable, -1 = une valeur basse est souhaitable
  direction smallint not null default 1 check (direction in (1, -1)),
  low_label text,
  high_label text,
  sort_order integer not null default 0
);

-- ---------------------------------------------------------------------------
-- Catalogue de taureaux (partagé entre tous les utilisateurs)
-- ---------------------------------------------------------------------------

create table public.bulls (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  herdbook_id text,
  breed_code text references public.breeds (code),
  supplier_id uuid references public.suppliers (id),
  sire_name text,
  mgs_name text, -- grand-père maternel
  price_chf numeric(8, 2) check (price_chf >= 0),
  price_sexed_chf numeric(8, 2) check (price_sexed_chf >= 0),
  is_example boolean not null default false,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index bulls_breed_idx on public.bulls (breed_code);
create index bulls_supplier_idx on public.bulls (supplier_id);
create index bulls_created_by_idx on public.bulls (created_by);

create table public.bull_traits (
  bull_id uuid not null references public.bulls (id) on delete cascade,
  trait_code text not null references public.traits (code),
  value numeric not null,
  primary key (bull_id, trait_code)
);

-- ---------------------------------------------------------------------------
-- Exploitation, troupeau, objectifs d'élevage (privés, par utilisateur)
-- ---------------------------------------------------------------------------

create table public.farms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users (id) on delete cascade default auth.uid(),
  name text not null default 'Mon exploitation',
  -- Index « vêlage direct » minimum pour un taureau utilisé sur génisse
  heifer_min_calving_ease numeric not null default 100,
  -- Part maximale du troupeau confiée à un même taureau (0.3 = 30 %)
  max_bull_share numeric not null default 0.3 check (max_bull_share > 0 and max_bull_share <= 1),
  created_at timestamptz not null default now()
);

create table public.cows (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  name text not null,
  ear_tag text,
  breed_code text references public.breeds (code),
  birth_date date,
  lactation_no integer not null default 0 check (lactation_no >= 0), -- 0 = génisse
  sire_name text,
  mgs_name text,
  notes text,
  created_at timestamptz not null default now()
);

create index cows_farm_idx on public.cows (farm_id);

create table public.cow_traits (
  cow_id uuid not null references public.cows (id) on delete cascade,
  trait_code text not null references public.traits (code),
  value numeric not null,
  -- true = valeur déduite d'une case « point faible », pas une vraie valeur d'élevage
  estimated boolean not null default false,
  primary key (cow_id, trait_code)
);

create table public.breeding_goals (
  farm_id uuid not null references public.farms (id) on delete cascade,
  trait_code text not null references public.traits (code),
  weight smallint not null check (weight between 0 and 5),
  primary key (farm_id, trait_code)
);

-- ---------------------------------------------------------------------------
-- Sécurité : RLS sur toutes les tables
-- ---------------------------------------------------------------------------

alter table public.suppliers enable row level security;
alter table public.breeds enable row level security;
alter table public.traits enable row level security;
alter table public.bulls enable row level security;
alter table public.bull_traits enable row level security;
alter table public.farms enable row level security;
alter table public.cows enable row level security;
alter table public.cow_traits enable row level security;
alter table public.breeding_goals enable row level security;

grant select on public.suppliers, public.breeds, public.traits to authenticated;
grant select, insert, update, delete on
  public.bulls, public.bull_traits, public.farms, public.cows,
  public.cow_traits, public.breeding_goals
to authenticated;

-- Référentiels : lecture pour tout utilisateur connecté
create policy "suppliers_read" on public.suppliers
  for select to authenticated using (true);
create policy "breeds_read" on public.breeds
  for select to authenticated using (true);
create policy "traits_read" on public.traits
  for select to authenticated using (true);

-- Taureaux : tout le monde lit, chacun modifie ce qu'il a créé
create policy "bulls_read" on public.bulls
  for select to authenticated using (true);
create policy "bulls_insert" on public.bulls
  for insert to authenticated with check (created_by = (select auth.uid()));
create policy "bulls_update" on public.bulls
  for update to authenticated
  using (created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()));
create policy "bulls_delete" on public.bulls
  for delete to authenticated using (created_by = (select auth.uid()));

create policy "bull_traits_read" on public.bull_traits
  for select to authenticated using (true);
create policy "bull_traits_write" on public.bull_traits
  for all to authenticated
  using (exists (
    select 1 from public.bulls b
    where b.id = bull_id and b.created_by = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.bulls b
    where b.id = bull_id and b.created_by = (select auth.uid())
  ));

-- Exploitation : uniquement son propriétaire
create policy "farms_owner" on public.farms
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "cows_owner" on public.cows
  for all to authenticated
  using (exists (
    select 1 from public.farms f
    where f.id = farm_id and f.owner_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.farms f
    where f.id = farm_id and f.owner_id = (select auth.uid())
  ));

create policy "cow_traits_owner" on public.cow_traits
  for all to authenticated
  using (exists (
    select 1 from public.cows c
    join public.farms f on f.id = c.farm_id
    where c.id = cow_id and f.owner_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.cows c
    join public.farms f on f.id = c.farm_id
    where c.id = cow_id and f.owner_id = (select auth.uid())
  ));

create policy "breeding_goals_owner" on public.breeding_goals
  for all to authenticated
  using (exists (
    select 1 from public.farms f
    where f.id = farm_id and f.owner_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.farms f
    where f.id = farm_id and f.owner_id = (select auth.uid())
  ));
