-- 008_status_wechsel_haerten.sql
-- Haertet die Status-Uebergaenge bei Bestellwuenschen und Bedarfsmeldungen.
--
-- WARUM: die alte Policy shop_req_update_own hat in USING zwar den ALTEN Status
-- geprueft, in WITH CHECK aber nur die user_id. WITH CHECK sieht die NEUE Zeile —
-- ein Nutzer konnte seinen eigenen 'pending'-Wunsch also per PATCH selbst auf
-- 'approved' setzen und damit die Freigabe komplett umgehen. Dieselbe Bauform
-- steckte in shop_bedarf_update_own.
--
-- Zweiter Punkt: der Knopf "Abgeholt" schreibt 'received' → 'closed'. Das war in
-- USING nicht enthalten, also scheiterte er fuer jeden Nicht-Admin an der RLS.
--
-- ANSATZ: RLS ist die grobe Tuer (wer darf welche Zeile ueberhaupt anfassen),
-- der Trigger die Zustandsmaschine (welcher Uebergang ist erlaubt). Beides ist
-- noetig, weil WITH CHECK die alte Zeile nicht kennt und Postgres erlaubte
-- (alt, neu)-Paare deshalb nicht in einer Policy ausdruecken kann. Mehrere
-- permissive Policies werden mit OR verknuepft — das waere die Vereinigung, nicht
-- die gewuenschte Praezision.

-- ─── Zustandsmaschine fuer shop_order_requests ─────────────────────────────
create or replace function public.tg_shop_req_status_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Ohne JWT laeuft der Aufruf serverseitig (service_role, Bestell-Bot, Migration).
  -- Die duerfen alles; RLS haelt anon ohnehin schon draussen.
  if auth.uid() is null then return new; end if;
  if public.is_shop_admin() then return new; end if;

  -- Der Ablehnungsgrund gehoert dem Admin.
  if new.reject_grund is distinct from old.reject_grund then
    raise exception 'reject_grund darf nur von Shop-Admins geaendert werden'
      using errcode = '42501';
  end if;

  -- Ab 'approved' ist die Bestellung aus der Hand des Nutzers: dann darf er nur
  -- noch den Status weiterschieben, keine Mengen oder Artikel mehr aendern.
  if old.status not in ('draft', 'pending') and (
       new.user_id     is distinct from old.user_id
    or new.artikel_id  is distinct from old.artikel_id
    or new.variante_id is distinct from old.variante_id
    or new.gebinde_id  is distinct from old.gebinde_id
    or new.menge       is distinct from old.menge
    or new.notiz       is distinct from old.notiz
    or new.projekt_ref is distinct from old.projekt_ref
  ) then
    raise exception 'Eine Bestellung im Status % kann inhaltlich nicht mehr geaendert werden', old.status
      using errcode = '42501';
  end if;

  if new.status = old.status then return new; end if;

  -- Erlaubte Uebergaenge fuer den Besitzer der Zeile:
  --   draft    → pending    Warenkorb abschicken
  --   draft    → cancelled  Position verwerfen (Loeschen laeuft ueber die eigene Policy)
  --   pending  → cancelled  Wunsch zurueckziehen
  --   received → closed     Ware abgeholt
  if (old.status, new.status) in (
      ('draft', 'pending'),
      ('draft', 'cancelled'),
      ('pending', 'cancelled'),
      ('received', 'closed')
  ) then
    return new;
  end if;

  raise exception 'Statuswechsel % → % ist nur fuer Shop-Admins erlaubt', old.status, new.status
    using errcode = '42501';
end;
$$;

drop trigger if exists shop_req_status_guard on public.shop_order_requests;
create trigger shop_req_status_guard
  before update on public.shop_order_requests
  for each row execute function public.tg_shop_req_status_guard();

-- ─── RLS: 'received' rein (fuer "Abgeholt"), Ziel-Status eingegrenzt ───────
drop policy if exists shop_req_update_own on public.shop_order_requests;

create policy shop_req_update_own on public.shop_order_requests for update
  using (
    user_id = auth.uid()
    and status in ('draft', 'pending', 'cancelled', 'received')
  )
  with check (
    user_id = auth.uid()
    and status in ('draft', 'pending', 'cancelled', 'closed')
  );

-- ─── Bedarfsmeldungen: Status bleibt 'offen' ───────────────────────────────
-- Der Nutzer darf seine offene Meldung nachbessern, aber nicht selbst auf
-- 'in_katalog' oder 'abgelehnt' setzen. Hier genuegt WITH CHECK, weil es fuer
-- den Nutzer gar keinen erlaubten Statuswechsel gibt.
drop policy if exists shop_bedarf_update_own on public.shop_bedarfsmeldungen;

create policy shop_bedarf_update_own on public.shop_bedarfsmeldungen for update
  using (user_id = auth.uid() and status = 'offen')
  with check (user_id = auth.uid() and status = 'offen');
