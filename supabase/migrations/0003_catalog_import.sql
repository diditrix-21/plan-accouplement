-- Import de catalogues vendeurs (exports CSV Swissgenetics).

alter table public.bulls
  add column full_name text,
  -- Base des valeurs d'élevage telle que publiée, ex. « GA HO 08.26 », « FR 08.26 »
  add column eval_base text,
  add column polled text check (polled in ('PP', 'Pp')),
  add column kappa_casein text,
  add column beta_casein text,
  add column catalog_imported_at timestamptz;

-- Un taureau n'existe qu'une fois par vendeur : c'est la clé de mise à jour
-- lors d'un réimport. (Plusieurs lignes sans identité restent possibles.)
drop index public.bulls_supplier_idx;
create unique index bulls_supplier_herdbook_key on public.bulls (supplier_id, herdbook_id);

-- Races présentes dans le catalogue Swissgenetics. Quand la signification
-- d'un code n'est pas sûre, le nom reste le code lui-même.
insert into public.breeds (code, name, breed_group) values
  ('RF', 'Holstein facteur rouge', 'holstein'),
  -- Races à viande
  ('AN', 'Angus', 'angus'),
  ('AU', 'Aubrac', 'aubrac'),
  ('BB', 'Blanc-Bleu Belge', 'blanc-bleu'),
  ('BD', 'Blonde d''Aquitaine', 'blonde-aquitaine'),
  ('BZ', 'Bazadaise', 'bazadaise'),
  ('CH', 'Charolais', 'charolais'),
  ('DR', 'Dexter', 'dexter'),
  ('GA', 'Galloway', 'galloway'),
  ('GC', 'Gasconne', 'gasconne'),
  ('HI', 'Highland', 'highland'),
  ('HP', 'Hereford', 'hereford'),
  ('IN', 'INRA 95', 'inra95'),
  ('LG', 'Luing', 'luing'),
  ('LM', 'Limousin', 'limousin'),
  ('PA', 'Parthenaise', 'parthenaise'),
  ('PI', 'Piémontaise', 'piemontaise'),
  ('SH', 'Shorthorn', 'shorthorn'),
  ('SL', 'Salers', 'salers'),
  ('SM', 'Simmental (viande)', 'simmental-viande'),
  ('WY', 'Wagyu', 'wagyu'),
  ('ZE', 'Zébu', 'zebu'),
  ('XX', 'Mélange / autres', 'autres'),
  ('BM', 'BM', 'bm'),
  ('SK', 'SK', 'sk'),
  -- Races spéciales
  ('EV', 'Evolène', 'evolene'),
  ('HR', 'Hérens', 'herens'),
  ('HW', 'Hinterwald', 'hinterwald'),
  ('KC', 'KiwiCross', 'kiwicross'),
  ('NO', 'Normande', 'normande'),
  ('NR', 'Rouge norvégienne', 'rouge-norvegienne'),
  ('PS', 'Pustertaler Sprinzen', 'pustertaler'),
  ('PZ', 'Pinzgauer', 'pinzgauer'),
  ('RG', 'Grise rhétique', 'grise-rhetique'),
  ('SR', 'Rouge suédoise', 'rouge-suedoise'),
  ('TA', 'Tarentaise', 'tarentaise'),
  ('TX', 'Tux-Zillertal', 'tux'),
  ('VS', 'Vosgienne', 'vosgienne'),
  ('AL', 'AL', 'al'),
  ('BF', 'BF', 'bf'),
  ('LC', 'LC', 'lc')
on conflict (code) do nothing;
