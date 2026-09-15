-- Gegenpruefung der Mischsaetze aus echten Einzelaufmassen (15.09.2026)
--
-- Patricks Vorhaben: die Sammelansicht fuer einige Wochen sperren, Projekte
-- ueber die Zaehlliste erfassen lassen und danach pruefen, ob die
-- Mischkostensaetze stimmen. Diese Sicht macht daraus eine Zahl.
--
-- Der Mischsatz steht und faellt mit dem Teile-Mix: in "Edelstahl / 22-28mm /
-- presse" kostet ein Bogen 2,99 EUR und ein T-Stueck 8,65 EUR. Zaehlt der
-- Monteur ueberwiegend Boegen, ist der kalkulierte Satz zu hoch; zaehlt er
-- viele T-Stuecke, zu niedrig. Der Ist-Satz ist deshalb der mengengewichtete
-- Mittelwert der tatsaechlich gezaehlten Teile -- genau so gerechnet wie der
-- Soll-Satz, nur mit dem Mengengeruest der Stichprobe statt der Historie.
--
-- Besonders wichtig fuer Heizungsedelstahl: dessen Mengengeruest ist von
-- C-Stahl uebertragen (shop_formteil_gruppenpreis_uebertragen), also eine
-- Annahme. Hier wird sie erstmals gemessen.

create or replace view public.shop_mischsatz_ist
with (security_invoker = true) as
-- Was in Detail-Aufmassen tatsaechlich gezaehlt wurde, je Formteil-Gruppe.
-- Nur abgeschlossene Erfassungen: ein offenes Aufmass ist kein Messwert.
  select a.formteil_system,
         a.formteil_dimensionsgruppe as dimensionsgruppe,
         a.formteil_preisklasse      as preisklasse,
         count(distinct e.id)        as aufmasse,
         count(distinct a.id)        as verschiedene_artikel,
         sum(f.anzahl)               as menge,
         round(sum(f.anzahl * a.preis_netto) / nullif(sum(f.anzahl), 0), 4)
           as ek_stueck_mengengewichtet,
         min(a.preis_netto)          as ek_stueck_min,
         max(a.preis_netto)          as ek_stueck_max
    from public.aufmass_formteile f
    join public.aufmass_erfassung e on e.id = f.erfassung_id
    join public.aufmass_kategorie k on k.id = f.kategorie_id
    join public.aufmass_kategorie_position p on p.id = f.position_id
    join public.shop_artikel a on a.id = p.artikel_id
   where k.ansicht = 'detail'
     and e.status = 'abgeschlossen'
     and f.anzahl > 0
     and a.formteil_system is not null
     and a.formteil_dimensionsgruppe is not null
     and a.preis_netto is not null
   group by 1, 2, 3;

comment on view public.shop_mischsatz_ist is
  'Ist-Mischsatz je Formteil-Gruppe aus abgeschlossenen Einzelaufmassen '
  '(Zaehllisten-Ansicht). Mengengewichtet wie der Soll-Satz, nur mit dem '
  'Mengengeruest der Stichprobe. Braucht Preise, laeuft daher nur fuer '
  'Shop-Admins.';

create or replace view public.shop_mischsatz_vergleich
with (security_invoker = true) as
  select coalesce(s.formteil_system, i.formteil_system)     as formteil_system,
         coalesce(s.dimensionsgruppe, i.dimensionsgruppe)   as dimensionsgruppe,
         coalesce(s.preisklasse, i.preisklasse)             as preisklasse,
         s.herkunft                                          as soll_herkunft,
         round(s.ek_stueck_mengengewichtet, 4)              as soll_satz,
         s.menge_gesamt                                      as soll_menge,
         i.ek_stueck_mengengewichtet                        as ist_satz,
         i.menge                                             as ist_menge,
         i.aufmasse                                          as ist_aufmasse,
         i.verschiedene_artikel                              as ist_artikel,
         round(i.ek_stueck_mengengewichtet - s.ek_stueck_mengengewichtet, 4)
           as abweichung_eur,
         round(100 * (i.ek_stueck_mengengewichtet - s.ek_stueck_mengengewichtet)
               / nullif(s.ek_stueck_mengengewichtet, 0), 1) as abweichung_prozent,
         -- Eine Stichprobe aus drei Teilen sagt nichts. Die Schwelle ist
         -- bewusst niedrig gehalten (30 Stueck), weil eine Gruppe je Baustelle
         -- nur ein paar Dutzend Teile sieht -- sie trennt nur "zum Rechnen zu
         -- duenn" von "erste Tendenz".
         case
           when i.menge is null then 'keine Stichprobe'
           when i.menge < 30 then 'zu duenn (' || i.menge || ' Stueck)'
           when abs(i.ek_stueck_mengengewichtet - s.ek_stueck_mengengewichtet)
                <= 0.10 * s.ek_stueck_mengengewichtet then 'bestaetigt'
           when i.ek_stueck_mengengewichtet > s.ek_stueck_mengengewichtet
             then 'Satz zu niedrig'
           else 'Satz zu hoch'
         end as befund
    from public.shop_formteil_gruppenpreis_effektiv s
    full join public.shop_mischsatz_ist i
      on i.formteil_system = s.formteil_system
     and i.dimensionsgruppe = s.dimensionsgruppe
     and i.preisklasse = s.preisklasse;

comment on view public.shop_mischsatz_vergleich is
  'Soll gegen Ist je Formteil-Gruppe. soll_herkunft sagt, ob der Satz gemessen '
  'oder von einem anderen System uebertragen ist -- bei uebertragenen Saetzen '
  'ist die Gegenpruefung am wichtigsten. befund hebt nur Gruppen mit '
  'ausreichender Stichprobe hervor (ab 30 Stueck) und nennt alles innerhalb '
  'von 10 Prozent bestaetigt.';

grant select on public.shop_mischsatz_ist to authenticated;
grant select on public.shop_mischsatz_vergleich to authenticated;

select formteil_system, dimensionsgruppe, preisklasse, soll_herkunft,
       soll_satz, ist_satz, befund
  from public.shop_mischsatz_vergleich
 order by formteil_system, dimensionsgruppe, preisklasse;
