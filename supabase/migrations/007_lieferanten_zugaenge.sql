-- 007_lieferanten_zugaenge.sql
-- Lieferanten mit Login-Zugang und Playbook fuer den Browser-Bot (Phase 7/8).
--
-- ABWEICHUNG VON ADR 0004: Die Verschluesselung passiert NICHT mit pgcrypto in
-- Postgres, sondern ausserhalb (AES-256-GCM im Bot bzw. in einer Edge Function).
-- Grund: bei pgcrypto muesste der Master-Key bei jedem Schreiben und Lesen an
-- Postgres uebergeben werden — also aus dem Browser oder aus einem Admin-Werkzeug
-- heraus. Damit waere der Schluessel genau dort, wo er nicht sein darf. So sieht
-- Postgres nur einen opaken Blob, und der Schluessel verlaesst den Bot-Host nie.
-- ADR 0004 ist entsprechend zu aktualisieren.

create table public.shop_lieferanten (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique,          -- 'frigotechnik' — stabiler Bezug fuer den Bot
  name               text not null,
  login_url          text,
  produkt_url_muster text,                          -- optional, z.B. fuer Suche per Artikelnummer
  playbook           jsonb not null default '{}'::jsonb,  -- Selektoren + Ablauf, siehe unten
  zugang_chiffre     text,                          -- AES-256-GCM(base64), Schluessel nur im Bot
  zugang_gesetzt_am  timestamptz,
  aktiv              boolean not null default true,
  notiz              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table public.shop_lieferanten is
  'Lieferanten mit Login-Zugang fuer den Browser-Bot. Zugangsdaten liegen verschluesselt '
  'in zugang_chiffre; entschluesselt wird ausschliesslich im Bot-Dienst auf weich-code.';

comment on column public.shop_lieferanten.zugang_chiffre is
  'AES-256-GCM, base64: iv|tag|ciphertext von {"benutzer":...,"passwort":...}. '
  'NICHT fuer authenticated lesbar (Spalten-REVOKE) — nur service_role kommt dran.';

comment on column public.shop_lieferanten.playbook is
  'Ablauf fuer diesen Shop: {login: {benutzer_selektor, passwort_selektor, absenden_selektor, '
  'erfolg_selektor}, produkt: {preis_selektor, artikelnr_selektor, ...}}. Leer = noch nicht erprobt.';

create trigger shop_lieferanten_touch
  before update on public.shop_lieferanten
  for each row execute function public.tg_touch_updated_at();

-- ─── RLS: nur Shop-Admins, und die Chiffre fuer niemanden ──────────────────
alter table public.shop_lieferanten enable row level security;

create policy shop_lief_read on public.shop_lieferanten
  for select to authenticated
  using (public.is_shop_admin());

create policy shop_lief_write on public.shop_lieferanten
  for all to authenticated
  using (public.is_shop_admin())
  with check (public.is_shop_admin());

-- Spalten-REVOKE nach dem Muster der employees-Tabelle: selbst ein Shop-Admin
-- darf die Chiffre nicht SELECTen. Schreiben ja, zurueckholen nein — damit ist
-- der Zugang aus der App heraus setzbar, aber nicht auslesbar.
-- (Ein "update ... returning zugang_chiffre" scheitert ebenfalls, weil Postgres
-- fuer RETURNING das SELECT-Recht auf der Spalte prueft.)
revoke all on public.shop_lieferanten from anon, authenticated;

grant select (
  id, slug, name, login_url, produkt_url_muster, playbook,
  zugang_gesetzt_am, aktiv, notiz, created_at, updated_at
) on public.shop_lieferanten to authenticated;

grant insert, update, delete on public.shop_lieferanten to authenticated;

-- Erster Eintrag: Frigotechnik. login_url und playbook kommen, sobald erprobt.
insert into public.shop_lieferanten (slug, name, notiz)
values ('frigotechnik', 'Frigotechnik', 'Kaelte-/Klimatechnik-Grosshandel; Netto-Preise nur nach Login.')
on conflict (slug) do nothing;
