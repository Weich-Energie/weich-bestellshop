-- 009_aktive_bestell_zaehler.sql
-- Zaehler fuer den Doppelbestell-Hinweis im Katalog.
--
-- WARUM: listAktiveOrderCounts hat direkt auf shop_order_requests gezaehlt. RLS
-- gibt einem Monteur dort aber nur seine eigenen Zeilen — er sah also nur seine
-- eigenen offenen Bestellungen. Genau der Fall, den der Hinweis verhindern soll
-- ("der Kollege hat das schon bestellt"), war fuer ihn unsichtbar; nur Admins
-- sahen die echten Zahlen.
--
-- Die Funktion laeuft mit den Rechten des Eigentuemers und gibt ausschliesslich
-- Aggregate zurueck: Artikel, Variante, Anzahl, Gesamtmenge, letztes Datum.
-- KEIN user_id, keine Notiz, kein Projekt-Bezug — der Monteur erfaehrt, DASS
-- etwas offen ist, nicht von wem. Mehr braucht der Hinweis nicht.

create or replace function public.shop_aktive_bestell_zaehler()
returns table (
  artikel_id uuid,
  variante_id uuid,
  anzahl bigint,
  menge_summe bigint,
  letztes_datum timestamptz
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  -- Fail-closed: ohne Shop-Zugang eine leere Menge. Kein Fehler, weil der
  -- Hinweis dann einfach nicht erscheint statt die Katalog-Seite zu stoeren.
  if not public.has_shop_access() then
    return;
  end if;

  return query
    select
      r.artikel_id,
      r.variante_id,
      count(*)::bigint,
      sum(r.menge)::bigint,
      max(r.created_at)
    from public.shop_order_requests r
    where r.status in ('pending', 'approved', 'ordered')
    group by r.artikel_id, r.variante_id;
end;
$$;

comment on function public.shop_aktive_bestell_zaehler() is
  'Aggregierte offene Bestellwuensche fuer den Doppelbestell-Hinweis. security '
  'definer, weil RLS einem Nutzer die Zeilen seiner Kollegen verbirgt. Gibt nur '
  'Zaehler zurueck, nie wer bestellt hat.';

-- Nur eingeloggte Shop-Nutzer duerfen die Funktion aufrufen; die Pruefung auf
-- Shop-Zugang steckt zusaetzlich in der Funktion selbst.
revoke all on function public.shop_aktive_bestell_zaehler() from public;
revoke all on function public.shop_aktive_bestell_zaehler() from anon;
grant execute on function public.shop_aktive_bestell_zaehler() to authenticated;
