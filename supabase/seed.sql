-- Données de départ : vendeurs, races, critères, et quelques taureaux d'EXEMPLE.
-- À exécuter après 0001_init.sql.

insert into public.suppliers (name, website) values
  ('Swissgenetics', 'https://www.swissgenetics.ch'),
  ('Select Star', 'https://www.selectstar.ch'),
  ('Semex', 'https://www.semex.com')
on conflict (name) do nothing;

insert into public.breeds (code, name, breed_group) values
  ('HO', 'Holstein', 'holstein'),
  ('RH', 'Red Holstein', 'holstein'),
  ('SF', 'Swiss Fleckvieh', 'fleckvieh'),
  ('SI', 'Simmental', 'simmental'),
  ('BS', 'Brown Swiss', 'brune'),
  ('OB', 'Brune originale', 'brune-originale'),
  ('MO', 'Montbéliarde', 'montbeliarde'),
  ('JE', 'Jersey', 'jersey')
on conflict (code) do nothing;

-- Critères. Les index fonctionnels et morphologiques sont publiés sur une
-- échelle centrée sur 100 où une valeur haute est favorable.
-- ATTENTION : les écarts-types (sd) sont des valeurs de départ à vérifier
-- avec la documentation de la fédération, surtout pour la production.
insert into public.traits (code, label, category, unit, mean, sd, low_label, high_label, sort_order) values
  ('lait_kg',          'Lait',                    'production',  'kg', 0, 500,  'peu',        'beaucoup', 10),
  ('mg_kg',            'Matière grasse (kg)',     'production',  'kg', 0, 20,   'peu',        'beaucoup', 20),
  ('mg_pct',           'Matière grasse (%)',      'production',  '%',  0, 0.25, 'faible',     'élevée',   30),
  ('prot_kg',          'Protéine (kg)',           'production',  'kg', 0, 15,   'peu',        'beaucoup', 40),
  ('prot_pct',         'Protéine (%)',            'production',  '%',  0, 0.12, 'faible',     'élevée',   50),
  ('cellules',         'Cellules somatiques',     'fonctionnel', null, 100, 12, 'élevées',    'faibles',  110),
  ('mammites',         'Résistance aux mammites', 'fonctionnel', null, 100, 12, 'faible',     'élevée',   120),
  ('onglons',          'Santé des onglons',       'fonctionnel', null, 100, 12, 'faible',     'élevée',   130),
  ('duree_utilisation','Durée d''utilisation',    'fonctionnel', null, 100, 12, 'courte',     'longue',   140),
  ('fertilite',        'Fertilité',               'fonctionnel', null, 100, 12, 'faible',     'élevée',   150),
  ('persistance',      'Persistance',             'fonctionnel', null, 100, 12, 'faible',     'élevée',   160),
  ('velage_direct',    'Vêlage direct',           'fonctionnel', null, 100, 12, 'difficile',  'facile',   170),
  ('velage_filles',    'Vêlage filles',           'fonctionnel', null, 100, 12, 'difficile',  'facile',   180),
  ('vitesse_traite',   'Vitesse de traite',       'fonctionnel', null, 100, 12, 'lente',      'rapide',   190),
  ('temperament',      'Tempérament',             'fonctionnel', null, 100, 12, 'nerveux',    'calme',    200),
  ('bcs',              'BCS',                     'fonctionnel', null, 100, 12, 'faible',     'élevé',    210),
  ('note_globale',     'Note globale',            'morphologie', null, 100, 12, 'faible',     'élevée',   310),
  ('format_capacite',  'Format & capacité',       'morphologie', null, 100, 12, 'faible',     'élevé',    320),
  ('croupe',           'Croupe',                  'morphologie', null, 100, 12, 'faible',     'élevée',   330),
  ('membres',          'Membres',                 'morphologie', null, 100, 12, 'faibles',    'bons',     340),
  ('systeme_mammaire', 'Système mammaire',        'morphologie', null, 100, 12, 'faible',     'bon',      350),
  ('trayons',          'Trayons',                 'morphologie', null, 100, 12, 'faibles',    'bons',     360)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- Taureaux d'EXEMPLE — noms et valeurs INVENTÉS, uniquement pour tester l'appli.
-- À supprimer avant de montrer de vraies recommandations à un éleveur :
--   delete from public.bulls where is_example;
-- ---------------------------------------------------------------------------
with new_bulls as (
  insert into public.bulls
    (name, breed_code, supplier_id, sire_name, mgs_name, price_chf, price_sexed_chf, is_example, created_by)
  values
    ('EXEMPLE LAITIER',  'HO', (select id from public.suppliers where name = 'Swissgenetics'), 'PERE-A', 'GPM-A', 32, 62, true, null),
    ('EXEMPLE SANTE',    'RH', (select id from public.suppliers where name = 'Swissgenetics'), 'PERE-B', 'GPM-B', 28, 58, true, null),
    ('EXEMPLE MAMELLE',  'RH', (select id from public.suppliers where name = 'Select Star'),   'PERE-C', 'GPM-A', 36, 66, true, null),
    ('EXEMPLE TENEURS',  'HO', (select id from public.suppliers where name = 'Select Star'),   'PERE-D', 'GPM-C', 30, null, true, null),
    ('EXEMPLE GENISSES', 'RH', (select id from public.suppliers where name = 'Semex'),         'PERE-E', 'GPM-D', 26, 55, true, null),
    ('EXEMPLE COMPLET',  'HO', (select id from public.suppliers where name = 'Semex'),         'PERE-A', 'GPM-E', 45, 78, true, null)
  returning id, name
)
insert into public.bull_traits (bull_id, trait_code, value)
select b.id, v.trait_code, v.value
from new_bulls b
join (values
  ('EXEMPLE LAITIER', 'lait_kg', 1250), ('EXEMPLE LAITIER', 'mg_pct', -0.18), ('EXEMPLE LAITIER', 'prot_pct', -0.06),
  ('EXEMPLE LAITIER', 'cellules', 98), ('EXEMPLE LAITIER', 'mammites', 97), ('EXEMPLE LAITIER', 'duree_utilisation', 104),
  ('EXEMPLE LAITIER', 'fertilite', 94), ('EXEMPLE LAITIER', 'persistance', 108), ('EXEMPLE LAITIER', 'velage_direct', 96),
  ('EXEMPLE LAITIER', 'vitesse_traite', 106), ('EXEMPLE LAITIER', 'note_globale', 108), ('EXEMPLE LAITIER', 'membres', 102),
  ('EXEMPLE LAITIER', 'systeme_mammaire', 110),

  ('EXEMPLE SANTE', 'lait_kg', 250), ('EXEMPLE SANTE', 'mg_pct', 0.05), ('EXEMPLE SANTE', 'prot_pct', 0.04),
  ('EXEMPLE SANTE', 'cellules', 122), ('EXEMPLE SANTE', 'mammites', 119), ('EXEMPLE SANTE', 'onglons', 112),
  ('EXEMPLE SANTE', 'duree_utilisation', 124), ('EXEMPLE SANTE', 'fertilite', 114), ('EXEMPLE SANTE', 'persistance', 103),
  ('EXEMPLE SANTE', 'velage_direct', 105), ('EXEMPLE SANTE', 'vitesse_traite', 97), ('EXEMPLE SANTE', 'note_globale', 104),
  ('EXEMPLE SANTE', 'membres', 110), ('EXEMPLE SANTE', 'systeme_mammaire', 106),

  ('EXEMPLE MAMELLE', 'lait_kg', 600), ('EXEMPLE MAMELLE', 'mg_pct', -0.05), ('EXEMPLE MAMELLE', 'prot_pct', 0.00),
  ('EXEMPLE MAMELLE', 'cellules', 108), ('EXEMPLE MAMELLE', 'mammites', 106), ('EXEMPLE MAMELLE', 'duree_utilisation', 112),
  ('EXEMPLE MAMELLE', 'fertilite', 100), ('EXEMPLE MAMELLE', 'velage_direct', 99), ('EXEMPLE MAMELLE', 'vitesse_traite', 103),
  ('EXEMPLE MAMELLE', 'note_globale', 126), ('EXEMPLE MAMELLE', 'format_capacite', 112), ('EXEMPLE MAMELLE', 'croupe', 104),
  ('EXEMPLE MAMELLE', 'membres', 118), ('EXEMPLE MAMELLE', 'systeme_mammaire', 130), ('EXEMPLE MAMELLE', 'trayons', 115),

  ('EXEMPLE TENEURS', 'lait_kg', -150), ('EXEMPLE TENEURS', 'mg_pct', 0.45), ('EXEMPLE TENEURS', 'prot_pct', 0.22),
  ('EXEMPLE TENEURS', 'cellules', 104), ('EXEMPLE TENEURS', 'mammites', 102), ('EXEMPLE TENEURS', 'duree_utilisation', 108),
  ('EXEMPLE TENEURS', 'fertilite', 106), ('EXEMPLE TENEURS', 'velage_direct', 102), ('EXEMPLE TENEURS', 'note_globale', 106),
  ('EXEMPLE TENEURS', 'systeme_mammaire', 104),

  ('EXEMPLE GENISSES', 'lait_kg', 400), ('EXEMPLE GENISSES', 'mg_pct', 0.10), ('EXEMPLE GENISSES', 'prot_pct', 0.05),
  ('EXEMPLE GENISSES', 'cellules', 106), ('EXEMPLE GENISSES', 'duree_utilisation', 110), ('EXEMPLE GENISSES', 'fertilite', 108),
  ('EXEMPLE GENISSES', 'velage_direct', 121), ('EXEMPLE GENISSES', 'velage_filles', 114), ('EXEMPLE GENISSES', 'note_globale', 105),
  ('EXEMPLE GENISSES', 'systeme_mammaire', 107),

  ('EXEMPLE COMPLET', 'lait_kg', 850), ('EXEMPLE COMPLET', 'mg_pct', 0.12), ('EXEMPLE COMPLET', 'prot_pct', 0.08),
  ('EXEMPLE COMPLET', 'cellules', 112), ('EXEMPLE COMPLET', 'mammites', 110), ('EXEMPLE COMPLET', 'onglons', 106),
  ('EXEMPLE COMPLET', 'duree_utilisation', 116), ('EXEMPLE COMPLET', 'fertilite', 105), ('EXEMPLE COMPLET', 'persistance', 106),
  ('EXEMPLE COMPLET', 'velage_direct', 103), ('EXEMPLE COMPLET', 'vitesse_traite', 101), ('EXEMPLE COMPLET', 'note_globale', 116),
  ('EXEMPLE COMPLET', 'membres', 112), ('EXEMPLE COMPLET', 'systeme_mammaire', 118)
) as v (bull_name, trait_code, value) on v.bull_name = b.name;

-- Les taureaux d'exemple font partie du catalogue commun (visibles par tous).
update public.bulls set is_catalog = true where is_example;
