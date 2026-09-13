-- Patricks Eintraege aus der Arbeitsmappe vom 13.09.2026.
-- Von Hand vergeben, also Quelle 'manuell' — sie schlagen jede
-- maschinelle Aufloesung.

update public.shop_gut_positionen set
  rf_artikelnummer = '1036285300000', rf_zuordnung_quelle = 'manuell',
  rf_zuordnung_stand = now()
 where artikelnummer = 'KHHM2532IVFGP';

update public.shop_gut_positionen set
  rf_artikelnummer = '1011960350012', rf_zuordnung_quelle = 'manuell',
  rf_zuordnung_stand = now()
 where artikelnummer = 'CUS3512';

update public.shop_gut_positionen set
  rf_artikelnummer = '2024900003000', rf_zuordnung_quelle = 'manuell',
  rf_zuordnung_stand = now()
 where artikelnummer = 'COFALUK50';

update public.shop_gut_positionen set
  rf_artikelnummer = '7076526110639', rf_zuordnung_quelle = 'manuell',
  rf_zuordnung_stand = now()
 where artikelnummer = 'KHDVGW15D';

update public.shop_gut_positionen set
  rf_artikelnummer = '1014054310000', rf_zuordnung_quelle = 'manuell',
  rf_zuordnung_stand = now()
 where artikelnummer = '31302515';

update public.shop_gut_positionen set
  rf_artikelnummer = '1014036310000', rf_zuordnung_quelle = 'manuell',
  rf_zuordnung_stand = now()
 where artikelnummer = '35302510R';

update public.shop_gut_positionen set
  rf_artikelnummer = '7085472283000', rf_zuordnung_quelle = 'manuell',
  rf_zuordnung_stand = now()
 where artikelnummer = 'COCIUS3525ANL';

update public.shop_gut_positionen set
  rf_artikelnummer = '1005520035030', rf_zuordnung_quelle = 'manuell',
  rf_zuordnung_stand = now()
 where artikelnummer = 'COFW3530';

update public.shop_gut_positionen set
  rf_artikelnummer = '1005520035020', rf_zuordnung_quelle = 'manuell',
  rf_zuordnung_stand = now()
 where artikelnummer = 'RORS8003520';

update public.shop_gut_positionen set
  rf_artikelnummer = '1014048400000', rf_zuordnung_quelle = 'manuell',
  rf_zuordnung_stand = now()
 where artikelnummer = '333132';

update public.shop_gut_positionen set
  rf_artikelnummer = '7020900559496', rf_zuordnung_quelle = 'manuell',
  rf_zuordnung_stand = now()
 where artikelnummer = 'POVR35';

update public.shop_gut_positionen set
  rf_artikelnummer = '1029201070618', rf_zuordnung_quelle = 'manuell',
  rf_zuordnung_stand = now()
 where artikelnummer = 'UCUEK2522N';

update public.shop_gut_artikel_klassifikation set
  nicht_relevant_grund = 'Patrick 13.09.2026: projekt bestellung nicht notwendig'
 where artikelnummer = 'KV3390100L';

select count(*) as manuell from public.shop_gut_positionen where rf_zuordnung_quelle = 'manuell';
-- COFW3530 CONEL FLEX WOOL Isolierschale zeigt auf dieselbe Rockwool-Schale
-- wie RORS8003530 (35/30 mm). Von Patrick am 13.09.2026 bestaetigt: es ist
-- dieselbe Schale, nur unter zwei GUT-Nummern gefuehrt.
