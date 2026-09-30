-- Die Stunden gehoeren zum Regieaufmass wie das Material.
--
-- Patrick, 30.09.2026: "du darfst nachkalkulation weniger als kalkulations
-- ding selbst sehen sondern als regie aufmass, welches wir in den auftrag von
-- pds ergaenzen muessen". Damit ist der Uebertrag nach PDS nicht der Abschluss,
-- sondern der Zweck - und was geleistet wurde, muss genauso hinein wie das,
-- was verbaut wurde. Sonst wird es nicht abgerechnet.
--
-- Eigener Merker statt pds_transport_at am Kopf: ein zweites Transportangebot
-- fuer nachgetragenes Material darf die Stunden nicht ein zweites Mal in den
-- Auftrag bringen.
alter table public.shop_nachkalkulation
  add column if not exists stunden_transport_at timestamptz;

comment on column public.shop_nachkalkulation.stunden_transport_at is
  'Wann die Ist-Stunden als LOHN-Positionen in ein Transportangebot gegangen '
  'sind. Gesetzt heisst: kein weiteres Angebot nimmt sie noch einmal mit. '
  'Wird beim Zuruecksetzen geleert.';
