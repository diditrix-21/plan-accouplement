-- Une politique par action d'écriture sur bull_traits, pour ne pas évaluer
-- deux politiques à chaque lecture (avis « multiple permissive policies »).

drop policy "bull_traits_write" on public.bull_traits;

create policy "bull_traits_insert" on public.bull_traits
  for insert to authenticated
  with check (exists (
    select 1 from public.bulls b
    where b.id = bull_id and b.created_by = (select auth.uid())
  ));

create policy "bull_traits_update" on public.bull_traits
  for update to authenticated
  using (exists (
    select 1 from public.bulls b
    where b.id = bull_id and b.created_by = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.bulls b
    where b.id = bull_id and b.created_by = (select auth.uid())
  ));

create policy "bull_traits_delete" on public.bull_traits
  for delete to authenticated
  using (exists (
    select 1 from public.bulls b
    where b.id = bull_id and b.created_by = (select auth.uid())
  ));
