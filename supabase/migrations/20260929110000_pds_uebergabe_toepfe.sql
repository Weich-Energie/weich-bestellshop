-- Welche Aufmaß-Zeile gehört in welche PDS-Position (29.09.2026)
--
-- Patricks Vorgabe: im Auftrag steht **zuerst eine Leistung** mit Rohren und
-- Formteilen, **dahinter alles andere als Artikel**. Diese Sicht sagt je Zeile
-- der Strichliste, in welchen Topf sie fällt — die Regel liegt damit in der
-- Datenbank und ist per SQL prüfbar, statt in der Edge Function zu stecken.
--
-- Die Trennlinie ist nicht der Rubrikname, sondern die Sache:
--   * `formteil_system` gesetzt  → ein Formteil, das über einen Mischsatz
--     bewertet wird (232 Zeilen).
--   * Klassifikation `rohr`      → Rohr, in Metern oder Stangen (14 Zeilen).
--   * alles andere               → Ventile, Schellen, Dämmung, Verschraubungen
--     und die Regal-Artikel ohne GUT-Gegenstück (109 Zeilen). Die haben eigene
--     Preise und gehören einzeln in den Auftrag.
--
-- Warum nicht über die Rubrik: ein Rohr steht in „CU Fittinge & Rohre"
-- zwischen Formteilen, und „Sonstiges" enthält beides. Die Klassifikation des
-- GUT-Gegenstücks ist die einzige belastbare Quelle.

create or replace view public.aufmass_position_pds_topf
with (security_invoker = true) as
  select
    p.id                as position_id,
    p.kategorie_id,
    k.ansicht,
    k.name              as rubrik,
    p.art,
    p.artikel_id,
    a.artikelnr,
    coalesce(a.name, p.bezeichnung) as name,
    a.einheit,
    a.preis_netto,
    a.formteil_system,
    kl.kategorie        as gut_kategorie,
    case
      -- Eine Gruppen-Zeile der Sammelansicht IST ein Formteil-Sammelposten
      -- (Presse/Gewinde/Meter je Dimension) und traegt keinen eigenen Artikel.
      -- Ihr Preis kommt aus dem Kunstartikel, nicht aus shop_artikel -- diese
      -- Sicht liefert dort deshalb keinen Preis, nur den Topf.
      when p.art = 'gruppe'              then 'leistung'
      when a.formteil_system is not null then 'leistung'
      when kl.kategorie = 'rohr'         then 'leistung'
      else 'artikel'
    end                 as topf
  from public.aufmass_kategorie_position p
  join public.aufmass_kategorie k on k.id = p.kategorie_id
  left join public.shop_artikel a on a.id = p.artikel_id
  left join public.shop_gut_rf_zuordnung z on z.rf_artikelnummer = a.artikelnr
  left join public.shop_gut_artikel_klassifikation kl on kl.artikelnummer = z.gut_artikelnummer
 where p.aktiv;

comment on view public.aufmass_position_pds_topf is
  'Je Zeile der Strichliste: gehoert sie in die Leistung "Rohre und Formteile" '
  '(topf = leistung) oder als eigene Artikelposition in den Auftrag '
  '(topf = artikel)? Patricks Vorgabe vom 29.09.2026. Traegt Preise und laeuft '
  'daher nur fuer Shop-Admins (security_invoker).';

grant select on public.aufmass_position_pds_topf to authenticated;

-- Kontrolle: die Verteilung je Ansicht.
select ansicht, topf, count(*) as zeilen,
       count(*) filter (where preis_netto is null) as ohne_preis
  from public.aufmass_position_pds_topf
 group by 1, 2 order by 1, 2;
