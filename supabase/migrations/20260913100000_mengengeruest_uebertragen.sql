-- Mengengerüst von C-Stahl auf Heizungsedelstahl übertragen.
--
-- Patricks Entscheidung vom 13.09.2026. Das Problem: ein Mischsatz ist ein
-- mengengewichteter Mittelwert, und Heizungsedelstahl trägt nur 2,9 % des
-- Mengengerüsts (296 von 10 191 Stück), weil das System neu ist. 15 der 24
-- Edelstahl-Regalartikel haben Menge null und damit Gewicht null — ihr Preis
-- fließt in keinen Satz ein.
--
-- Geprüft und tragfähig: der Teile-Mix ist über die Systeme hinweg fast gleich
-- (Bogen 43-53 %, Übergang 27-38 %, T-Stück 8-17 %). Wie oft ein Bogen
-- gebraucht wird, hängt an der Installation, nicht am Werkstoff. Also: Anteile
-- je Teileart aus C-Stahl, Preise aus dem Edelstahl-Regal.
--
-- C-Stahl als Basis, nicht Kupfer: es war das letzte Pressystem vor dem
-- Edelstahl, die Bauweise ist näher dran. Der Übergangs-Anteil schwankt am
-- stärksten und ist zugleich der teuerste Posten — dort wirkt die Wahl.
--
-- Nebenbefund, der die Übertragung zusätzlich rechtfertigt: die bisherigen
-- Edelstahl-Sätze ruhen teils auf falschen Preisen. Die 56 Stück
-- "Übergangsstück 35mm x 1 AG" tragen 6,92 € aus einer `vermutet`-Zuordnung,
-- der echte Regalpreis ist 8,52 €. Auch das T-Stück 35x15x35 (30 Stück,
-- 14,55 € vermutet) und das Reduzierstück 35x22 (12 Stück, 5,89 € vermutet)
-- haben kein Gegenstück im Regal.

-- ─── Übertragene Sätze ────────────────────────────────────────────────────
create table if not exists public.shop_formteil_gruppenpreis_uebertragen (
  formteil_system   text not null,
  dimensionsgruppe  text not null,
  preisklasse       text not null,
  ek_stueck         numeric(10,4) not null check (ek_stueck > 0),
  basis_system      text not null,
  anzahl_artikel    integer not null,
  zusammensetzung   jsonb not null,
  begruendung       text,
  gueltig_ab        date not null default current_date,
  primary key (formteil_system, dimensionsgruppe, preisklasse)
);

comment on table public.shop_formteil_gruppenpreis_uebertragen is
  'Mischsätze, deren Mengengerüst von einem anderen System übernommen wurde, '
  'weil die eigene Historie zu dünn ist. zusammensetzung haelt Anteil und '
  'Durchschnittspreis je Teileart fest, damit der Satz nachvollziehbar und '
  'nachrechenbar bleibt. Faellt weg, sobald die eigene Historie traegt — '
  'Faustregel: ab etwa 300 Stueck je Gruppe.';

alter table public.shop_formteil_gruppenpreis_uebertragen enable row level security;

drop policy if exists gruppenpreis_uebertragen_lesen on public.shop_formteil_gruppenpreis_uebertragen;
create policy gruppenpreis_uebertragen_lesen
  on public.shop_formteil_gruppenpreis_uebertragen for select
  to authenticated using (public.has_shop_access());

drop policy if exists gruppenpreis_uebertragen_pflegen on public.shop_formteil_gruppenpreis_uebertragen;
create policy gruppenpreis_uebertragen_pflegen
  on public.shop_formteil_gruppenpreis_uebertragen for all
  to authenticated using (public.is_shop_admin()) with check (public.is_shop_admin());

-- Die vier Edelstahl-Gruppen.
-- Teileart-Anteile aus C-Stahl derselben Gruppe; Teilearten ohne Regalartikel
-- fallen weg, der Rest wird anteilig hochgerechnet.
insert into public.shop_formteil_gruppenpreis_uebertragen
  (formteil_system, dimensionsgruppe, preisklasse, ek_stueck, basis_system,
   anzahl_artikel, zusammensetzung, begruendung)
values
  ('connect-inox', '22-28mm', 'presse', 4.2481, 'prestabo-stahl', 8,
   '[{"teileart":"Bogen","anteil":83.0,"preis":3.8983,"artikel":6},
     {"teileart":"T-Stück","anteil":12.7,"preis":6.9200,"artikel":1},
     {"teileart":"Reduzierung","anteil":4.2,"preis":3.0800,"artikel":1}]'::jsonb,
   'Muffe ohne Anteil: in C-Stahl wurde in dieser Groesse keine verbaut.'),

  ('connect-inox', '22-28mm', 'gewinde', 6.6333, 'prestabo-stahl', 3,
   '[{"teileart":"Übergang","anteil":100.0,"preis":6.6333,"artikel":3}]'::jsonb,
   'C-Stahl kennt in dieser Gruppe nur Uebergaenge. Die beiden Edelstahl-'
   'T-Stuecke mit Innengewinde bleiben damit ohne Gewicht.'),

  ('connect-inox', '35mm und groesser', 'presse', 8.4800, 'prestabo-stahl', 7,
   '[{"teileart":"Bogen","anteil":79.6,"preis":8.2950,"artikel":4},
     {"teileart":"T-Stück","anteil":16.7,"preis":10.3250,"artikel":2},
     {"teileart":"Muffe","anteil":3.7,"preis":4.1700,"artikel":1}]'::jsonb,
   'Reduzierung hatte in C-Stahl 8,9 % Anteil, im Edelstahl-Regal gibt es aber '
   'kein 35er Reduzierstueck. Anteile auf die drei vorhandenen Teilearten '
   'hochgerechnet.'),

  ('connect-inox', '35mm und groesser', 'gewinde', 9.5800, 'prestabo-stahl', 2,
   '[{"teileart":"Übergang","anteil":100.0,"preis":9.5800,"artikel":2}]'::jsonb,
   'Uebergangsstueck AG 35 x R 1 (8,52) und UE-Muffe IG/IG 35 x Rp 1 1/4 '
   '(10,64). Loest den falschen Satz von 6,92 ab, der aus einer vermuteten '
   'Zuordnung auf ein 28er Teil stammte.')
on conflict (formteil_system, dimensionsgruppe, preisklasse) do update
  set ek_stueck = excluded.ek_stueck,
      basis_system = excluded.basis_system,
      anzahl_artikel = excluded.anzahl_artikel,
      zusammensetzung = excluded.zusammensetzung,
      begruendung = excluded.begruendung,
      gueltig_ab = current_date;

-- ─── Wirksamer Mischsatz ──────────────────────────────────────────────────
-- shop_formteil_gruppenpreis bleibt unveraendert: das ist die gemessene
-- Historie und soll es bleiben. Die neue Sicht legt die Uebertragung darueber
-- und sagt in `herkunft`, woher der Satz kommt.
create or replace view public.shop_formteil_gruppenpreis_effektiv
with (security_invoker = true) as
  select coalesce(g.formteil_system, u.formteil_system)   as formteil_system,
         coalesce(g.dimensionsgruppe, u.dimensionsgruppe) as dimensionsgruppe,
         coalesce(g.preisklasse, u.preisklasse)           as preisklasse,
         coalesce(u.ek_stueck, g.ek_stueck_mengengewichtet) as ek_stueck_mengengewichtet,
         case when u.ek_stueck is not null then 'uebertragen' else 'historie' end as herkunft,
         u.basis_system,
         coalesce(u.anzahl_artikel, g.anzahl_artikel)     as anzahl_artikel,
         g.menge_gesamt,
         g.ek_stueck_mengengewichtet                      as ek_historie,
         g.ek_stueck_min, g.ek_stueck_max,
         g.davon_echter_lagerpreis
    from public.shop_formteil_gruppenpreis g
    full outer join public.shop_formteil_gruppenpreis_uebertragen u
      on u.formteil_system = g.formteil_system
     and u.dimensionsgruppe = g.dimensionsgruppe
     and u.preisklasse = g.preisklasse;

comment on view public.shop_formteil_gruppenpreis_effektiv is
  'Der Mischsatz, mit dem gerechnet wird. Nimmt die Uebertragung, wo eine '
  'hinterlegt ist, sonst die gemessene Historie. herkunft sagt welches von '
  'beiden, ek_historie haelt den gemessenen Wert zum Vergleich fest.';

grant select on public.shop_formteil_gruppenpreis_effektiv to authenticated;

-- ─── Die Kunstartikel tragen den wirksamen Satz ───────────────────────────
-- shop_pds_formteil_gruppen liest den Preis vom Artikel, nicht aus der Sicht.
update public.shop_artikel a
   set preis_netto = e.ek_stueck_mengengewichtet
  from public.shop_formteil_gruppenpreis_effektiv e
 where a.formteil_dimensionsgruppe = e.dimensionsgruppe
   and a.formteil_preisklasse = e.preisklasse
   and a.name = 'Formteil ' || e.formteil_system || ' '
              || e.dimensionsgruppe || ' ' || e.preisklasse
   and a.preis_netto is distinct from e.ek_stueck_mengengewichtet;

select formteil_system, dimensionsgruppe, preisklasse, herkunft,
       round(ek_historie, 2) as vorher,
       round(ek_stueck_mengengewichtet, 2) as jetzt
  from public.shop_formteil_gruppenpreis_effektiv
 where herkunft = 'uebertragen'
 order by dimensionsgruppe, preisklasse;
