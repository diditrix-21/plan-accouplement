-- Catalogue officiel / taureaux personnels.
--
-- * Catalogue officiel (is_catalog = true) : visible par tous les éleveurs,
--   modifiable uniquement par les administrateurs du catalogue.
-- * Taureau personnel (is_catalog = false) : visible et modifiable uniquement
--   par l'éleveur qui l'a ajouté.

-- Qui a le droit de gérer le catalogue officiel. Les lignes s'ajoutent à la
-- main, depuis l'éditeur SQL de Supabase :
--   insert into public.catalog_admins (user_id)
--     select id from auth.users where email = 'toi@exemple.ch';
create table public.catalog_admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.catalog_admins enable row level security;
grant select on public.catalog_admins to authenticated;
-- Chacun peut seulement savoir s'il est lui-même administrateur.
create policy "catalog_admins_self" on public.catalog_admins
  for select to authenticated using (user_id = (select auth.uid()));

alter table public.bulls add column is_catalog boolean not null default false;
update public.bulls set is_catalog = true where catalog_imported_at is not null;
create index bulls_catalog_idx on public.bulls (is_catalog);

-- L'unicité « un taureau par vendeur » ne vaut que pour le catalogue officiel :
-- deux éleveurs peuvent chacun noter le même taureau de leur côté.
drop index public.bulls_supplier_herdbook_key;
create unique index bulls_catalog_key on public.bulls (supplier_id, herdbook_id) where is_catalog;
create index bulls_supplier_idx on public.bulls (supplier_id);

-- --- Taureaux ---------------------------------------------------------------
drop policy "bulls_read" on public.bulls;
drop policy "bulls_insert" on public.bulls;
drop policy "bulls_update" on public.bulls;
drop policy "bulls_delete" on public.bulls;

create policy "bulls_read" on public.bulls
  for select to authenticated
  using (is_catalog or created_by = (select auth.uid()));

create policy "bulls_insert" on public.bulls
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (
      not is_catalog
      or exists (select 1 from public.catalog_admins a where a.user_id = (select auth.uid()))
    )
  );

create policy "bulls_update" on public.bulls
  for update to authenticated
  using (
    (not is_catalog and created_by = (select auth.uid()))
    or (is_catalog and exists (select 1 from public.catalog_admins a where a.user_id = (select auth.uid())))
  )
  with check (
    (not is_catalog and created_by = (select auth.uid()))
    or (is_catalog and exists (select 1 from public.catalog_admins a where a.user_id = (select auth.uid())))
  );

create policy "bulls_delete" on public.bulls
  for delete to authenticated
  using (
    (not is_catalog and created_by = (select auth.uid()))
    or (is_catalog and exists (select 1 from public.catalog_admins a where a.user_id = (select auth.uid())))
  );

-- --- Critères des taureaux : mêmes règles que le taureau lui-même ------------
drop policy "bull_traits_read" on public.bull_traits;
drop policy "bull_traits_insert" on public.bull_traits;
drop policy "bull_traits_update" on public.bull_traits;
drop policy "bull_traits_delete" on public.bull_traits;

create policy "bull_traits_read" on public.bull_traits
  for select to authenticated
  using (exists (
    select 1 from public.bulls b
    where b.id = bull_id and (b.is_catalog or b.created_by = (select auth.uid()))
  ));

create policy "bull_traits_insert" on public.bull_traits
  for insert to authenticated
  with check (exists (
    select 1 from public.bulls b
    where b.id = bull_id and (
      (not b.is_catalog and b.created_by = (select auth.uid()))
      or (b.is_catalog and exists (select 1 from public.catalog_admins a where a.user_id = (select auth.uid())))
    )
  ));

create policy "bull_traits_update" on public.bull_traits
  for update to authenticated
  using (exists (
    select 1 from public.bulls b
    where b.id = bull_id and (
      (not b.is_catalog and b.created_by = (select auth.uid()))
      or (b.is_catalog and exists (select 1 from public.catalog_admins a where a.user_id = (select auth.uid())))
    )
  ))
  with check (exists (
    select 1 from public.bulls b
    where b.id = bull_id and (
      (not b.is_catalog and b.created_by = (select auth.uid()))
      or (b.is_catalog and exists (select 1 from public.catalog_admins a where a.user_id = (select auth.uid())))
    )
  ));

create policy "bull_traits_delete" on public.bull_traits
  for delete to authenticated
  using (exists (
    select 1 from public.bulls b
    where b.id = bull_id and (
      (not b.is_catalog and b.created_by = (select auth.uid()))
      or (b.is_catalog and exists (select 1 from public.catalog_admins a where a.user_id = (select auth.uid())))
    )
  ));
