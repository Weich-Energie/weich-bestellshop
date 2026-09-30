-- Von Hand bearbeitete Aufmasszeilen vor einem erneuten Lesen schuetzen.
--
-- leseAufmassFoto() raeumt vor jedem Lauf die offenen Zeilen weg, damit ein
-- zweiter Durchgang nichts doppelt anlegt. Das war richtig, solange die Zeilen
-- reine Maschinenausgabe waren - ist es aber nicht mehr, sobald jemand eine
-- Menge korrigiert, einen Artikel zuordnet oder eine Entscheidung als Notiz
-- festhaelt.
--
-- Am 30.09.2026 haetten so 20 Zeilen Handarbeit verschwinden koennen: die
-- Korrektur des FI-Schutzschalters (Zettelnummer gehoerte zu einem Typ A,
-- eingebaut war Typ B), die Wahl der 5-m-Stange beim Uponor-Rohr und die
-- Entscheidung Prestabo statt Profipress. Alles Dinge, die kein zweiter
-- Lesedurchgang wiederherstellen kann, weil sie nicht auf dem Blatt stehen.
alter table public.shop_aufmass_foto_zeile
  add column if not exists von_hand boolean not null default false;

comment on column public.shop_aufmass_foto_zeile.von_hand is
  'Jemand hat an dieser Zeile etwas geaendert: Menge korrigiert, Artikel '
  'zugeordnet oder verworfen. Ein erneutes Lesen laesst sie stehen - die '
  'Entscheidung dahinter steht nicht auf dem Blatt und waere sonst verloren.';

-- Die bereits geleistete Arbeit ruecksetzend kennzeichnen: alles, was eine
-- Notiz traegt oder einem Artikel zugeordnet ist, ist durch Menschenhand
-- gegangen (die Vision selbst ordnet nur zu, schreibt aber keine Notiz).
update public.shop_aufmass_foto_zeile
set von_hand = true
where von_hand = false
  and (notiz is not null or artikel_id is not null);
