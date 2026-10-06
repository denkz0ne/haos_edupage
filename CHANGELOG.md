# Changelog

Verzie tohto forku používajú formát `YYYY.MM.N`, kde `N` je poradové číslo vydania v danom mesiaci. Každá používateľsky viditeľná aktualizácia má zvýšiť verziu v `manifest.json` a pridať krátky záznam sem.

## 2026.10.5

- Označenie DÚ priamo v bunke rozvrhu je väčšie a ľahšie čitateľné.

## 2026.10.4

- Dnešný riadok rozvrhu je jemne modrý, aktuálna hodina výraznejšia a nasledujúca nemá osobitné označenie; správy sa pred rozbalením zobrazia najviac v počte 10.
- Skratka predmetu sa preberá z poľa `short` v EduPage API (napr. VLA); popis hodiny obsahuje API triedy a skupiny.
- Trieda dieťaťa sa pri chýbajúcom výsledku `get_classes()` doplní z jeho rozvrhu. Triedne správy a úlohy bez potvrdenej zhody triedy sa nezdieľajú medzi deťmi.
- Pridaný senzor dochádzky so stavom a posledným príchodom/odchodom; udalosti rozlišujú oba smery.

## 2026.10.3

- Opravené obnovenie uloženej EduPage relácie po aktualizácii `edupage-api` 0.13.1: knižnica presunula `reload_data()` z `Login` do `LoginSession`.
- Rovnaká oprava sa používa po dokončení dvojfaktorového prihlásenia.

## 2026.10.2

- Aktualizovaná knižnica `edupage-api` na 0.13.1 vrátane opráv detského kontextu, nových typov udalostí a prázdneho jedálneho lístka.
- Pri rodičovskom účte sa pred načítaním dát prepne API na nakonfigurované dieťa; udalosti s konkrétnym príjemcom sa filtrujú podľa dieťaťa aj v senzoroch a event entite.
- Chyba rozvrhu v jednom dni už nepreruší načítanie ostatných dní; čiastočne načítaný týždeň sa označí.
- Správy v sidepaneli sa radia podľa skutočného času zostupne, pri rovnakom čase stabilne podľa ID a položky bez platného dátumu zostanú na konci.

## 2026.10.1

- Prepracované zobrazenie podľa mocku: jedna stránka bez vnútornej navigácie a uvítacieho bloku, väčšie písmo, kompaktné sekcie a neutrálny rozvrh.
- Správy zobrazujú celé znenie aj pri samostatnom nadpise; ďalšie správy, úlohy a známky sa rozbaľujú priamo na stránke.
- Hlavičky, správy a známky sa zobrazia hneď. Rozvrhy a úlohy sa dopĺňajú nezávisle pre každé dieťa, pri opakovanom otvorení sa využijú už načítané údaje.
- Opravená mriežka pre rozdielne časy zvonenia a dvojhodinovky, prázdny rozvrh má jasné vysvetlenie. Odstránené zobrazenie `undefined` pri priemeroch.
- Zvýšená verzia frontendového súboru pre obnovenie cache po aktualizácii.

## 2026.10.0

- Pridaný vlastný natívny EduPage panel v sidebare Home Assistanta podľa návrhu rodinnej nástenky.
- Panel zobrazuje týždenný rozvrh, správy, úlohy, známky a školské súhrny pre nakonfigurovaných žiakov.
- Rozvrh sa načítava od pondelka, aby sa zachoval celý týždeň aj po obnove uprostred týždňa.

## 2026.09.2

- Skrátené predvolené názvy entít na formát `[IN] Názov` podľa iniciál dieťaťa, napr. `[PE] Dejepis` alebo `[PE] Nesplnené DÚ`.
- Odstránené opakujúce sa reťazce `EduPage`, celé meno dieťaťa a zbytočne dlhé názvy entít bez zmeny ich identity v Home Assistante.
- Upratané GitHub Actions tak, aby sa validácie nespúšťali duplicitne ani zbytočne každý deň.

## 2026.09.1

- Prvé vlastné vydanie slovenského forku.
- Doplnená a zjednotená slovenská lokalizácia názvov, entít, kalendárov a akcií.
- Pridaná privacy-safe diagnostika schopností a dostupných údajov EduPage účtu.
- Upravená dokumentácia a HACS metadata pre repozitár `denkz0ne/haos_edupage`.
