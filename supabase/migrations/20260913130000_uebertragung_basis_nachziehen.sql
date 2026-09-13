-- Begruendung der uebertragenen Gewinde-Saetze nachziehen.
--
-- Die Uebertragung stuetzte sich auf "C-Stahl Gewinde = 100 % Uebergaenge",
-- gemessen an 92 Stueck in 22-28mm und 439 Stueck in 35mm+. Die 439 Stueck
-- sind mit der Megapress-Korrektur (Migration 20260913120000) weggefallen.
--
-- Nachgerechnet: C-Stahl Gewinde traegt weiterhin 100 % Uebergaenge, jetzt
-- gemessen an 87 Stueck aus der Gruppe 22-28mm. Der uebertragene Satz bleibt
-- damit inhaltlich richtig, nur die Grundlage ist duenner — und das gehoert
-- dokumentiert, sonst steht in der Tabelle eine Zahl mit einer Herleitung,
-- die sich nicht mehr nachvollziehen laesst.

update public.shop_formteil_gruppenpreis_uebertragen
   set begruendung = 'C-Stahl Gewinde besteht zu 100 % aus Uebergaengen '
                   || '(87 Stueck, Gruppe 22-28mm, Stand 13.09.2026). Die beiden '
                   || 'Edelstahl-T-Stuecke mit Innengewinde bleiben damit ohne '
                   || 'Gewicht. Die urspruengliche Basis von 439 Stueck aus der '
                   || 'Gruppe 35mm+ ist mit der Megapress-Korrektur entfallen.'
 where formteil_system = 'connect-inox'
   and dimensionsgruppe = '22-28mm'
   and preisklasse = 'gewinde';

update public.shop_formteil_gruppenpreis_uebertragen
   set begruendung = 'Uebergangsstueck AG 35 x R 1 (8,52) und UE-Muffe IG/IG '
                   || '35 x Rp 1 1/4 (10,64). Anteil 100 % Uebergang aus C-Stahl '
                   || 'Gewinde (87 Stueck, Gruppe 22-28mm; die 35er C-Stahl-Gruppe '
                   || 'ist mit der Megapress-Korrektur entfallen). Loest den '
                   || 'falschen Satz von 6,92 ab, der aus einer vermuteten '
                   || 'Zuordnung auf ein 28er Teil stammte.'
 where formteil_system = 'connect-inox'
   and dimensionsgruppe = '35mm und groesser'
   and preisklasse = 'gewinde';

select dimensionsgruppe, preisklasse, round(ek_stueck, 2) as satz, basis_system,
       left(begruendung, 60) as begruendung
  from public.shop_formteil_gruppenpreis_uebertragen
 order by dimensionsgruppe, preisklasse;
