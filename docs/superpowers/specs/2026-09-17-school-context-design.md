# EduPage školský kontext pre Home Assistant — návrh 2026.09.2

## Cieľ

Rozšíriť fork `denkz0ne/haos_edupage` o použiteľný školský kontext pre Home Assistant automácie, Recorder a dashboardy. Integrácia nebude meniť `person.*`, `device_tracker.*` ani zóny. Telefón/GPS zostáva samostatným zdrojom fyzickej polohy; EduPage poskytuje školské fakty.

## Rozsah verzie 2026.09.2

Pridať pre každé dieťa/config entry:

- `sensor.posledne_pipnutie`
- `sensor.posledny_prichod_do_skoly`
- `sensor.posledny_odchod_zo_skoly`
- `binary_sensor.prichod_do_skoly_dnes`
- `binary_sensor.odchod_zo_skoly_dnes`
- `binary_sensor.v_skole_podla_edupage`
- `sensor.posledny_vydaj_stravy`
- `binary_sensor.obed_vydany_dnes`
- `sensor.aktualna_hodina`
- `sensor.dalsia_hodina`
- `sensor.prva_hodina`
- `sensor.koniec_vyucovania`
- `binary_sensor.skola_dnes`

Existujúce kalendáre, známky, TODO, jedáleň, zvonenie, suplovanie a event entity zostávajú zachované.

## Význam `pipnutie`

Reálne údaje používateľa potvrdili, že `pipnutie` nie je iba príchod do školy. Je to všeobecná timeline udalosť vznikajúca po priložení čipu k čítačke. EduPage UI pri rovnakom event type zobrazuje napríklad `Príchod 17.09.2026 07:56:58` aj `Odchod 17.09.2026 11:58:26`.

Preto sa `pipnutie` nesmie automaticky mapovať na príchod. Smer sa klasifikuje samostatne:

1. ak neskôr diagnostika odhalí bezpečný strojový údaj v `additional_data`, môže dostať prioritu,
2. pre 2026.09.2 je overený fallback začiatok textu `Príchod` / `Odchod` (case-insensitive, diakritika tolerantná),
3. iné `pipnutie` je `other/unknown` a nesmie meniť stav `v škole`.

`strava_vydaj` zostáva samostatným a presnejším zdrojom skutočného výdaja jedla. Obed sa nebude odvodzovať iba z generic `pipnutie`.

## Zdroje dát

Spoľahlivo použiteľné:

- `pipnutie` + klasifikácia `Príchod`/`Odchod`,
- `strava_vydaj` (`FOOD_SERVED`),
- `timetable` a `cancelled_lessons`,
- `next_ringing`,
- timeline typy zmeny rozvrhu/suplovania.

Zatiaľ diagnostické iba:

- `h_attendance` — bez potvrdeného attendance modelu/endpointu,
- `h_process`, `h_processtypes` — bez interpretácie vyzdvihovania/družiny.

## Architektúra pollingu

Zachovať jeden `DataUpdateCoordinator`, ale rozdeliť dáta na dve frekvencie.

### Fast data — každé približne 2 minúty

- timeline/notifications,
- nové `pipnutie`,
- `strava_vydaj`,
- detekcia udalostí, ktoré invalidujú rozvrh/suplovanie.

### Slow data — približne každých 30 minút

- timetable a cancelled lessons,
- canteen menu,
- timetable changes,
- missing teachers,
- ringing,
- grades,
- subjects,
- grades per term,
- school year,
- class metadata.

Koordinátor tickuje približne každé 2 minúty. Slow sekcie sa opätovne sťahujú len po TTL približne 30 minút. Pri prvom štarte sa načítajú fast aj slow dáta.

Ak fast timeline objaví nový `substitution`, `h_substitution`, `timetable`, `h_timetable`, `changeroom` alebo `bookroom`, slow cache rozvrhu/suplovania sa invaliduje a obnoví v tom istom alebo najbližšom fast cykle bez čakania na TTL.

Fast zlyhanie nesmie zmazať posledné známe notifications ani slow cache. Zlyhanie jednej slow sekcie nesmie zmazať predchádzajúcu úspešnú hodnotu danej sekcie ani ostatné sekcie.

## Filtrovanie podľa dieťaťa

Všetky `pipnutie` a `strava_vydaj` udalosti musia prejsť existujúcim `event_matches_student(...)`. Ak event nemožno bezpečne priradiť konkrétnemu dieťaťu, nesmie ovplyvniť jeho stavové entity.

## Nové entity

### `sensor.posledne_pipnutie`

Timestamp najnovšieho `pipnutie` pre dieťa. Device class `timestamp`. Malý atribút `direction` má hodnotu `arrival`, `departure` alebo `other`.

### `sensor.posledny_prichod_do_skoly`

Timestamp najnovšieho rozpoznaného `Príchod` eventu pre dieťa.

### `sensor.posledny_odchod_zo_skoly`

Timestamp najnovšieho rozpoznaného `Odchod` eventu pre dieťa.

### `binary_sensor.prichod_do_skoly_dnes`

`on`, ak existuje dnešný rozpoznaný príchod.

### `binary_sensor.odchod_zo_skoly_dnes`

`on`, ak existuje dnešný rozpoznaný odchod.

### `binary_sensor.v_skole_podla_edupage`

- `on`, ak najnovší dnešný rozpoznaný príchod/odchod je `Príchod`,
- `off`, ak najnovší dnešný rozpoznaný príchod/odchod je `Odchod`,
- `unknown`/`None`, ak dnes neexistuje žiadny rozpoznaný príchod/odchod.

Iné čipnutia stav nemenia. Tento senzor je iba stav podľa EduPage čipu; nemení `person.*` a môže byť nepresný, ak dieťa čip nepoužije.

### `sensor.posledny_vydaj_stravy`

Timestamp najnovšieho `strava_vydaj` pre dieťa.

### `binary_sensor.obed_vydany_dnes`

`on`, ak existuje dnešný `strava_vydaj`. Neodvodzuje sa z objednaného menu.

### `binary_sensor.skola_dnes`

`on`, ak má dnešok aspoň jednu neodpadnutú hodinu.

### `sensor.prva_hodina`

Timestamp začiatku prvej neodpadnutej dnešnej hodiny.

### `sensor.koniec_vyucovania`

Timestamp konca poslednej neodpadnutej dnešnej hodiny. Odpadnutá posledná hodina sa nepočíta.

### `sensor.aktualna_hodina`

Textový stav = predmet práve prebiehajúcej hodiny. Atribúty: začiatok, koniec, učebňa, učitelia, ak sú dostupné.

### `sensor.dalsia_hodina`

Textový stav = najbližšia budúca neodpadnutá hodina, najprv dnes, potom ďalší deň v načítanom horizonte. Atribúty: dátum, začiatok, koniec, učebňa, učitelia.

## Event entity a automácie

Existujúci `pipnutie -> arrival_at_school` mapping je príliš široký. V 2026.09.2 sa `pipnutie` mapuje dynamicky:

- rozpoznaný príchod -> `arrival_at_school`,
- rozpoznaný odchod -> `departure_from_school`,
- ostatné/neurčené čipnutie -> `chip_scan`.

Existujúci `arrival_at_school` trigger zostáva zachovaný pre príchody. Pribudnú `departure_from_school` a `chip_scan`.

## Recorder a história

Nové entity sú štandardné HA entity a zapisujú sa do Recorderu podľa používateľovej konfigurácie. Timestamp/binary stavy ostávajú malé; celé timeline payloady sa do stavových atribútov nových entít nevkladajú.

História umožní sledovať napríklad príchody, odchody, výdaj jedla, dni so školou a zmeny začiatku/konca vyučovania.

## Vzťah k `person.*` a GPS

Integrácia nesmie zapisovať ani meniť `person.*`, `device_tracker.*` ani zóny. `binary_sensor.v_skole_podla_edupage` je samostatný školský fakt. Výsledný stav `doma / v škole / vonku` sa skladá neskôr v HA z EduPage + GPS/telefónu.

## Diagnostika

Rozšíriť privacy-safe diagnostiku o technický prehľad pre:

- `pipnutie`,
- `strava_vydaj`,
- `h_attendance`,
- `h_process`,
- `h_processtypes`.

Diagnostika nesmie obsahovať meno, student ID, username, PHPSESSID, subdomain, text správ/eventov, mená autorov/príjemcov ani voľný text.

Povolené:

- počet eventov,
- názvy kľúčov `additional_data`,
- typy hodnôt,
- názvy timestamp-like kľúčov,
- privacy-safe klasifikácia `pipnutie` (`arrival/departure/other`),
- anonymizovaný tvar payloadu ako mapa `key -> type`, bez hodnôt.

Cieľom je pripraviť ďalšiu verziu pre reálnu dochádzku (`absent / excused / late`) a prípadne družinu bez hádania.

## Chybové stavy

- fast timeline failure zachová posledné známe udalosti,
- slow section failure zachová poslednú úspešnú hodnotu sekcie,
- timestamp senzory držia poslednú známu hodnotu cez restore-state tam, kde to dáva význam,
- denné binary senzory sa prepočítajú pri najbližšom fast cykle po zmene dátumu,
- chyba timetable nesmie znefunkčniť fast školské eventy.

## Testovanie

Regresné testy musia pokryť:

- prvý refresh = fast + slow,
- ďalší fast refresh pred TTL nevolá slow API,
- slow refresh po TTL,
- timetable/substitution event invaliduje slow cache,
- klasifikáciu `Príchod`, `Odchod`, unknown `pipnutie`,
- filtrovanie `pipnutie` a `strava_vydaj` podľa dieťaťa,
- posledné čipnutie/príchod/odchod,
- príchod dnes, odchod dnes a stav `v škole podľa EduPage`,
- dnešný výdaj obeda,
- prvú/aktuálnu/ďalšiu/poslednú hodinu,
- zrušenú poslednú hodinu a deň bez školy,
- dynamické HA eventy `arrival_at_school`, `departure_from_school`, `chip_scan`,
- privacy-safe diagnostiku,
- dve deti bez krížového miešania dát.

Existujúca test suite musí zostať zelená.

## Verzia a changelog

Zvýšiť `manifest.json` na `2026.09.2` a doplniť changelog:

- rýchlejšie spracovanie timeline udalostí,
- príchod/odchod a stav v škole podľa čipu,
- výdaj stravy,
- aktuálna/ďalšia/prvá/posledná hodina,
- `Škola dnes`,
- okamžitejšie obnovenie rozvrhu po zmene,
- rozšírená privacy-safe diagnostika.

## Mimo rozsahu 2026.09.2

- Vyzdvihovanie/družina.
- Priame ovládanie `person.*`.
- Finálny kombinovaný stav `doma / v škole / vonku` vo vnútri integrácie.
- Mark homework done, message read/reply/star, attachments, excuse absence.
- Interpretácia `h_attendance` ako konkrétnej absencie bez overeného payloadu.
- Skracovanie friendly names na `[PE]/[EE]`; to príde v samostatnej zmene až po merge 2026.09.2.