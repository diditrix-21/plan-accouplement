-- Fiches complètes (certificats) : tout ce que publie le vendeur pour un
-- taureau, et tout ce que l'éleveur importe pour une vache (ascendance,
-- production, morphologie...). Format : { pedigree: {...}, sections: [...] }.
alter table public.bulls add column details jsonb;
alter table public.cows add column details jsonb;
