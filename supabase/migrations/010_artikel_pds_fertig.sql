-- 010_artikel_pds_fertig.sql
-- Macht jeden neu angelegten Shop-Artikel PDS-tauglich, unabhaengig davon, über
-- welchen Weg er entsteht: Beleg-Import, KI aus Link oder Screenshot, oder von
-- Hand im Katalog-Dialog.
--
-- Anlass: Der Beleg-Import uebernimmt die Einheit unveraendert aus der Rechnung
-- (src/app/pages/AdminImportPage.jsx: einheit: pos.ki_einheit). Lieferanten
-- schreiben dort "ST", "STK", "MTR", "lfdm" — der Katalog soll aber durchgehend
-- die deutsche Langform fuehren, und nur eine eindeutige Einheit laesst sich
-- ueber shop_pds_einheiten nach PDS uebersetzen. Und lieferant_id bleibt leer,
-- obwohl der Beleg den Lieferanten vom Rechnungskopf kennt.
--
-- Beides hier per Trigger zu loesen statt in jeder Oberflaeche einzeln: es gibt
-- drei Anlagewege, und ein vierter kommt bestimmt. Die Regel gehoert an die
-- Tabelle, nicht dreifach ins Frontend.

-- ─── Aliasse: wie Lieferanten Einheiten schreiben ──────────────────────────
alter table public.shop_pds_einheiten
  add column if not exists aliasse text[] not null default '{}';

comment on column public.shop_pds_einheiten.aliasse is
  'Schreibweisen aus Lieferantenrechnungen, die auf diese Einheit abgebildet '
  'werden. Vergleich ohne Gross-/Kleinschreibung und ohne Punkte.';

-- Die Zielwerte sind die Shop-Schreibweisen aus Migration 008, nicht die
-- PDS-Kuerzel: der Katalog fuehrt weiter "Stück" und "Meter", uebersetzt wird
-- erst beim Uebertragen. Die Aliasse sind das, was auf Rechnungen steht.
update public.shop_pds_einheiten set aliasse = '{stueck,stuck,stk,st,stck,pce,pcs,pc,piece,pieces,stg}' where shop_einheit = 'Stück';
update public.shop_pds_einheiten set aliasse = '{meter,mtr,mt,m,m1}'                                    where shop_einheit = 'Meter';
update public.shop_pds_einheiten set aliasse = '{lfm,lfdm,laufender meter,lfd m,laufender-meter}'        where shop_einheit = 'Laufmeter';
update public.shop_pds_einheiten set aliasse = '{pack,pck,pkg,ve,gebinde,geb}'                           where shop_einheit = 'Packung';
update public.shop_pds_einheiten set aliasse = '{ktn,kt,kart}'                                           where shop_einheit = 'Karton';
update public.shop_pds_einheiten set aliasse = '{btl,btlv}'                                              where shop_einheit = 'Beutel';
update public.shop_pds_einheiten set aliasse = '{rol,rll,ring,spule}'                                    where shop_einheit = 'Rolle';
update public.shop_pds_einheiten set aliasse = '{kg,kilo}'                                               where shop_einheit = 'Kilogramm';
update public.shop_pds_einheiten set aliasse = '{set,satz,sortiment}'                                    where shop_einheit = 'Satz';

-- Dieselbe Zuordnung steht als EINHEIT_ALIASE auch im Artikel-Dialog. Sie ist
-- dort naeher am Nutzer (er sieht die Korrektur sofort im Formular), hier greift
-- sie fuer alle Wege, die den Dialog nicht durchlaufen.

-- ─── Normalisierung ────────────────────────────────────────────────────────
create or replace function public.normalisiere_einheit(roh text)
returns text
language sql
stable
as $$
  with kandidat as (
    select shop_einheit, aliasse,
           lower(btrim(replace(coalesce(roh, ''), '.', ''))) as gesucht
      from public.shop_pds_einheiten
  )
  select shop_einheit from kandidat
   where gesucht <> ''
     and (lower(shop_einheit) = gesucht or gesucht = any (aliasse))
   -- Exakter Treffer auf shop_einheit schlaegt einen Alias-Treffer, damit 'm'
   -- nicht ueber den lfm-Alias landet.
   order by (lower(shop_einheit) = gesucht) desc, shop_einheit
   limit 1;
$$;

comment on function public.normalisiere_einheit(text) is
  'Bildet eine Einheit aus einer Lieferantenrechnung auf den festen Satz ab. '
  'Gibt NULL zurueck, wenn nichts passt — dann bleibt der Rohwert stehen und der '
  'PDS-Sync meldet die Luecke, statt eine falsche Einheit zu setzen.';

-- ─── Trigger auf shop_artikel ──────────────────────────────────────────────
create or replace function public.tg_artikel_pds_felder()
returns trigger
language plpgsql
as $$
declare
  normiert text;
begin
  -- 1. Einheit auf den festen Satz bringen. Passt nichts, bleibt der Rohwert
  --    stehen: er ist die Information, was in der Rechnung stand, und die
  --    Sync-Pruefung macht die Luecke sichtbar. Stilles Ueberschreiben mit
  --    einem Standardwert waere schlimmer als eine sichtbare Luecke.
  if new.einheit is not null and btrim(new.einheit) <> '' then
    normiert := public.normalisiere_einheit(new.einheit);
    if normiert is not null then
      new.einheit := normiert;
    end if;
  end if;

  -- 2. Lieferantenbezug aus dem Freitext herstellen, solange keiner gesetzt ist.
  --    Der Beleg-Import kennt den Lieferanten nur als Text vom Rechnungskopf.
  if new.lieferant_id is null and new.lieferant is not null and btrim(new.lieferant) <> '' then
    select l.id into new.lieferant_id
      from public.shop_lieferanten l
     where lower(btrim(l.name)) = lower(btrim(new.lieferant))
        or lower(btrim(l.slug)) = lower(btrim(new.lieferant))
     limit 1;
  end if;

  return new;
end;
$$;

drop trigger if exists shop_artikel_pds_felder on public.shop_artikel;
create trigger shop_artikel_pds_felder
  before insert or update of einheit, lieferant, lieferant_id
  on public.shop_artikel
  for each row execute function public.tg_artikel_pds_felder();

-- ─── Bestand nachziehen ────────────────────────────────────────────────────
-- Einmalig fuer die Artikel, die vor diesem Trigger entstanden sind.
update public.shop_artikel a
   set einheit = public.normalisiere_einheit(a.einheit)
 where a.einheit is not null
   and public.normalisiere_einheit(a.einheit) is not null
   and public.normalisiere_einheit(a.einheit) <> a.einheit;

update public.shop_artikel a
   set lieferant_id = l.id
  from public.shop_lieferanten l
 where a.lieferant_id is null
   and a.lieferant is not null
   and lower(btrim(a.lieferant)) = lower(btrim(l.name));
