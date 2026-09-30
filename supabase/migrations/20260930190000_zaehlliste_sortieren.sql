-- Zählliste ordnen: Dimension zuerst, dann Teileart (30.09.2026)
--
-- Patricks Befund: „Übergänge und Reduzierungen sind durcheinander." Stimmt,
-- und die Ursache ist nicht die eine Rubrik, sondern der Weg, auf dem Zeilen
-- entstehen: jede neue Position bekommt `sortierung = max + 10` und landet
-- damit **am Ende der Rubrik**, egal welche Dimension sie hat. Nach den
-- Korrekturen vom 17.09. und den Artikeln aus der R+F-Suchleiste standen in
-- „HZ Edelstahlsystem" deshalb vier 28er-Teile hinter dem letzten 28er-Block
-- und sieben 35er hinter dem 35er-Block — und ein Übergangsstück d = 35
-- mitten zwischen den 28ern.
--
-- Zwei Funktionen statt eines einmaligen Updates, damit sich das nach jedem
-- Hinzufügen wiederholen lässt (die Suchleiste kann sie aufrufen).

-- ─── 1) Sortierwert aus dem Artikelnamen ──────────────────────────────────
-- Zwei Teile: Dimension in Millimetern (Hauptkriterium, so wollen es die
-- Heizungsbauer) und Teileart (innerhalb einer Dimension).
--
-- Die Dimension ist die **Anschlussgröße**, nicht die Länge. Genau daran ist
-- der Parser am 17.09. gescheitert: „Doppelnippel DN 25 (R 1) x 150 mm" wurde
-- nach 150 sortiert. Reihenfolge der Regeln deshalb: erst `d = NN`, dann
-- `DN NN`, dann Zoll — und blanke Millimeter nie.
create or replace function public.aufmass_dimension_mm(p_name text)
returns numeric language sql immutable as $$
  select coalesce(
    -- 1. Pressfittinge mit Bezeichner: „d = 28", „d 28", „d= 28"
    nullif((regexp_match(n, 'd\s*=?\s*(\d{1,3})'))[1], '')::numeric,
    -- 2. Gewindeteile mit Nennweite: „DN 25". Muss vor den blanken
    --    Millimetern stehen, sonst liest „DN 15 (R 1/2) x 100 mm" die 100.
    nullif((regexp_match(n, 'DN\s*(\d{1,3})'))[1], '')::numeric,
    -- 3. Blanke Millimeter -- so schreiben Viega, Sudo und Prestabo:
    --    „PROFIPRESS Bogen 90 Grad I/I aus Kupfer 22 mm", „Übergangsst. 22 mm
    --    x 3/4 AG". Das muss VOR der Zoll-Regel stehen, sonst sortiert das
    --    Übergangsstück nach seinem Gewinde (3/4 = 20 mm) statt nach dem Rohr
    --    (22 mm) -- 15 Kupfer-Zeilen standen deshalb in der falschen
    --    Dimension. Erlaubt ist nur, was als Rohrdimension vorkommt; „Modell
    --    2416" und Längen fallen damit heraus. Der erste Treffer gilt, bei
    --    „22x22x15" also der Strang.
    (select k[1]::numeric
       from regexp_matches(n, '(?:^|[^0-9,.])(\d{2})\s*(?:mm|x|\s*$)', 'g') as k
      where k[1]::numeric in (10,12,14,15,16,18,20,22,25,28,32,35,40,42,50,54,63,75,90,110)
      limit 1),
    -- 4. Zoll. 1 1/2 und 1 1/4 VOR 1/2 und 1/4, sonst liest „R 11/4" die 1/4.
    case
      -- Der Lookahead ist nicht Zierde: „R 1/2" matcht sonst die Regel für
      -- R 1, weil der Schrägstrich als Wortgrenze gilt. Dadurch standen alle
      -- halbzölligen Rotguss-Teile im 1"-Block.
      when n ~ '\m(R|Rp|G)\s*2(?![0-9/])' then 50
      when n ~ '1\s*1/2'                  then 40
      when n ~ '1\s*1/4'                  then 32
      when n ~ '\m(R|Rp|G)\s*1(?![0-9/])' then 25
      when n ~ '3/4'                      then 20
      when n ~ '1/2'                      then 15
      when n ~ '3/8'                      then 10
      when n ~ '1/4'                      then 8
      -- Zoll in Anführungszeichen, ohne R/Rp/G: „OPTILINE Kugelhahn MS 1" IG".
      -- Nach den Brüchen, sonst liest 1 1/2" die 1.
      when n ~ '\m2\s*"'          then 50
      when n ~ '\m1\s*"'          then 25
    end,
    -- 5. Uponor schreibt die Paarung ohne Einheit: „Übergang auf Kupfer
    --    S-Press PLUS 16-15CU" -- der erste Wert ist das Uponor-Rohr.
    nullif((regexp_match(n, '\m(\d{2})-\d{2}\s*(?:CU|MS)?\M'))[1], '')::numeric,
    9999  -- nicht erkannt: ans Ende, damit es auffällt statt sich zu verstecken
  )
  from (select coalesce(p_name, '') as n) s;
$$;

comment on function public.aufmass_dimension_mm(text) is
  'Anschlussgroesse einer Zaehllisten-Zeile in mm, aus dem Artikelnamen. '
  'Nie die Laenge (Doppelnippel-Falle 17.09.2026). 9999 = nicht erkannt.';

-- Teileart. Die Reihenfolge der Zweige ist die Sortierreihenfolge und
-- gleichzeitig die Erkennungsreihenfolge: „Ue-Muffe" muss vor „Muffe" stehen
-- und „T-Stueck red." vor „T-Stueck", sonst greift die kuerzere Regel zuerst.
create or replace function public.aufmass_teileart_rang(p_name text)
returns integer language sql immutable as $$
  select case
    when coalesce(p_name, '') ~* 'systemrohr|rohr .*stange|stange\s*=?\s*6' then 10
    when coalesce(p_name, '') ~* 'bogen\s*90.*I/A'                          then 21
    when coalesce(p_name, '') ~* 'bogen\s*90'                               then 20
    when coalesce(p_name, '') ~* 'bogen\s*45.*I/A'                          then 31
    when coalesce(p_name, '') ~* 'bogen\s*45'                               then 30
    when coalesce(p_name, '') ~* 'winkel'                                   then 40
    when coalesce(p_name, '') ~* 't-st(ü|ue)ck\s*red'                       then 52
    when coalesce(p_name, '') ~* 't-st(ü|ue)ck.*(IG|Rp)'                    then 51
    when coalesce(p_name, '') ~* 't-st(ü|ue)ck'                             then 50
    when coalesce(p_name, '') ~* '(ü|ue|Ü)-?\s*(bergangs)?muffe'            then 61
    when coalesce(p_name, '') ~* 'muffe'                                    then 60
    when coalesce(p_name, '') ~* 'reduzier|reduktion'                       then 70
    when coalesce(p_name, '') ~* '(ü|ue|Ü)bergang'                          then 80
    when coalesce(p_name, '') ~* 'pumpenverschraub'                         then 88
    when coalesce(p_name, '') ~* 'r(ü|ue)cklaufverschr'                     then 89
    when coalesce(p_name, '') ~* 'verschraub'                               then 90
    when coalesce(p_name, '') ~* 'doppelnippel|nippel'                      then 100
    when coalesce(p_name, '') ~* 'hahnverl(ä|ae)ngerung'                    then 105
    when coalesce(p_name, '') ~* 'kappe'                                    then 110
    when coalesce(p_name, '') ~* 'stopfen'                                  then 120
    else 200
  end;
$$;

comment on function public.aufmass_teileart_rang(text) is
  'Reihenfolge der Teilearten innerhalb einer Dimension. Laengere Muster vor '
  'kuerzeren: Ue-Muffe vor Muffe, T-Stueck red. vor T-Stueck.';

-- ─── 2) Eine Rubrik neu durchnummerieren ──────────────────────────────────
-- Gruppenzeilen der Sammelansicht (art = 'gruppe') tragen keinen Artikelnamen
-- und werden nicht angefasst: dort ist die Reihenfolge vom Vordruck gesetzt.
create or replace function public.aufmass_rubrik_sortieren(p_kategorie uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare geaendert integer;
begin
  with neu as (
    select p.id,
           row_number() over (
             order by public.aufmass_dimension_mm(coalesce(a.name, p.bezeichnung)),
                      public.aufmass_teileart_rang(coalesce(a.name, p.bezeichnung)),
                      -- Doppelnippel innerhalb der Art nach Laenge.
                      coalesce(nullif((regexp_match(coalesce(a.name, p.bezeichnung),
                                                    'x\s*(\d{2,3})\s*mm'))[1], '')::numeric, 0),
                      -- Dann nach Anschlussgroesse, also dem Teil hinter dem
                      -- ersten „x": „d = 28 x Rp 1/2" vor „x Rp 3/4" vor
                      -- „x Rp 1". Alphabetisch stand 1 vor 11/4 vor 3/4.
                      public.aufmass_dimension_mm(
                        regexp_replace(coalesce(a.name, p.bezeichnung), '^[^xX]*[xX]', '')),
                      coalesce(a.name, p.bezeichnung)
           ) * 10 as sortierung
      from public.aufmass_kategorie_position p
      left join public.shop_artikel a on a.id = p.artikel_id
     where p.kategorie_id = p_kategorie
       and p.aktiv
       and p.art <> 'gruppe'
  )
  update public.aufmass_kategorie_position p
     set sortierung = neu.sortierung
    from neu
   where p.id = neu.id and p.sortierung is distinct from neu.sortierung;
  get diagnostics geaendert = row_count;
  return geaendert;
end $$;

comment on function public.aufmass_rubrik_sortieren(uuid) is
  'Nummeriert die Artikelzeilen einer Rubrik neu: Dimension zuerst, dann '
  'Teileart. Gedacht zum Wiederholen -- neue Zeilen bekommen sonst '
  'sortierung = max + 10 und landen am Ende statt bei ihrer Dimension.';

revoke all on function public.aufmass_rubrik_sortieren(uuid) from public;
grant execute on function public.aufmass_rubrik_sortieren(uuid) to authenticated;

-- ─── 3) Dubletten ausblenden ──────────────────────────────────────────────
-- Fünf Artikel standen zweimal in derselben Rubrik, jeweils mit **derselben**
-- Artikelnummer -- keine Varianten, sondern doppelt angelegt. Ausblenden statt
-- löschen: eine gezählte Zeile darf nicht verschwinden.
with doppelt as (
  select p.id,
         row_number() over (partition by p.kategorie_id, p.artikel_id
                            order by p.sortierung) as lfd
    from public.aufmass_kategorie_position p
   where p.aktiv and p.artikel_id is not null
)
update public.aufmass_kategorie_position p
   set aktiv = false
  from doppelt d
 where p.id = d.id and d.lfd > 1;

-- ─── 4) Alle Zähllisten-Rubriken einmal ordnen ────────────────────────────
do $$
declare k record;
begin
  for k in select id from public.aufmass_kategorie
            where aktiv and ansicht = 'detail'
  loop
    perform public.aufmass_rubrik_sortieren(k.id);
  end loop;
end $$;

-- Kontrolle: wie viele Zeilen ohne erkannte Dimension bleiben (die stehen am
-- Ende ihrer Rubrik), mit zwei Beispielen je Rubrik.
select k.name as rubrik,
       count(*) as ohne_dimension,
       left(string_agg(coalesce(a.name, p.bezeichnung), ' | '), 110) as beispiele
  from public.aufmass_kategorie_position p
  join public.aufmass_kategorie k on k.id = p.kategorie_id
  left join public.shop_artikel a on a.id = p.artikel_id
 where p.aktiv and k.ansicht = 'detail' and p.art <> 'gruppe'
   and public.aufmass_dimension_mm(coalesce(a.name, p.bezeichnung)) = 9999
 group by 1 order by 2 desc;
