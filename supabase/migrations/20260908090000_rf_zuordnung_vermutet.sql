-- R+F-Zuordnung: dritte Quelle "vermutet" fuer den automatisch uebernommenen
-- bestplatzierten Kandidaten bei Einschaetzung "unsicher". Entscheidung
-- Patrick 08.09.2026: beste Vermutung uebernehmen statt 51 % stehen lassen,
-- aber sichtbar getrennt von "automatisch" (= alle Pruefregeln bestanden) und
-- "manuell". Auswertungen koennen damit "vermutet" jederzeit herausfiltern.
alter table public.shop_gut_positionen
  drop constraint if exists shop_gut_positionen_rf_zuordnung_quelle_check;

alter table public.shop_gut_positionen
  add constraint shop_gut_positionen_rf_zuordnung_quelle_check
  check (rf_zuordnung_quelle in ('automatisch', 'vermutet', 'manuell', 'kein_treffer'));

comment on column public.shop_gut_positionen.rf_zuordnung_quelle is
  'automatisch = Suchtreffer bestand alle Pruefregeln (Zahlen, Gewinde, Bauart); '
  'vermutet = bestplatzierter Kandidat trotz nicht bestandener Regel, per Entscheidung '
  'vom 08.09.2026 uebernommen; manuell = aus der Pruefliste; kein_treffer = R+F fuehrt nichts.';
