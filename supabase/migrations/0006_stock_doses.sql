-- Stock de doses de semence de l'exploitation (le container).
--
-- semen_stock     : nombre de doses par taureau, toujours >= 0.
-- semen_movements : historique de chaque changement (+ achat, − insémination…).
-- adjust_semen_stock() change le stock et écrit l'historique en une seule
-- opération : impossible de passer sous zéro.

create table public.semen_stock (
  farm_id uuid not null references public.farms (id) on delete cascade,
  bull_id uuid not null references public.bulls (id) on delete cascade,
  doses integer not null default 0 check (doses >= 0),
  updated_at timestamptz not null default now(),
  primary key (farm_id, bull_id)
);
create index semen_stock_bull_idx on public.semen_stock (bull_id);

create table public.semen_movements (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  bull_id uuid not null references public.bulls (id) on delete cascade,
  delta integer not null check (delta <> 0),
  reason text not null check (reason in ('stock_initial', 'achat', 'insemination', 'correction')),
  created_at timestamptz not null default now()
);
create index semen_movements_farm_idx on public.semen_movements (farm_id, created_at desc);
create index semen_movements_bull_idx on public.semen_movements (bull_id);

alter table public.semen_stock enable row level security;
alter table public.semen_movements enable row level security;
grant select, insert, update, delete on public.semen_stock to authenticated;
grant select on public.semen_movements to authenticated;

-- Chacun ne voit et ne touche que le stock de sa propre exploitation.
create policy "semen_stock_owner" on public.semen_stock
  for all to authenticated
  using (exists (
    select 1 from public.farms f where f.id = farm_id and f.owner_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.farms f where f.id = farm_id and f.owner_id = (select auth.uid())
  ));

-- L'historique ne s'écrit que par adjust_semen_stock() (pas de droit d'écriture direct).
create policy "semen_movements_owner_read" on public.semen_movements
  for select to authenticated
  using (exists (
    select 1 from public.farms f where f.id = farm_id and f.owner_id = (select auth.uid())
  ));

create function public.adjust_semen_stock(p_bull uuid, p_delta integer, p_reason text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_farm uuid;
  v_doses integer;
begin
  if v_user is null then
    raise exception 'Non connecté';
  end if;
  if p_delta = 0 then
    raise exception 'Variation nulle';
  end if;

  select id into v_farm from public.farms where owner_id = v_user;
  if v_farm is null then
    raise exception 'Exploitation introuvable';
  end if;

  -- Le taureau doit être visible par l'éleveur : catalogue officiel ou un des siens.
  if not exists (
    select 1 from public.bulls b
    where b.id = p_bull and (b.is_catalog or b.created_by = v_user)
  ) then
    raise exception 'Taureau introuvable';
  end if;

  update public.semen_stock
    set doses = doses + p_delta, updated_at = now()
    where farm_id = v_farm and bull_id = p_bull
    returning doses into v_doses;

  if not found then
    if p_delta < 0 then
      raise exception 'Stock insuffisant' using errcode = '23514';
    end if;
    insert into public.semen_stock as s (farm_id, bull_id, doses)
    values (v_farm, p_bull, p_delta)
    on conflict (farm_id, bull_id)
      do update set doses = s.doses + excluded.doses, updated_at = now()
    returning doses into v_doses;
  end if;

  insert into public.semen_movements (farm_id, bull_id, delta, reason)
  values (v_farm, p_bull, p_delta, p_reason);

  return v_doses;
end;
$$;

revoke all on function public.adjust_semen_stock(uuid, integer, text) from public, anon;
grant execute on function public.adjust_semen_stock(uuid, integer, text) to authenticated;
