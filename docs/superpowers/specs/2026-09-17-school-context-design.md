# EduPage školský kontext pre Home Assistant — návrh 2026.09.2

## Cieľ

Rozšíriť fork `denkz0ne/haos_edupage` tak, aby neposkytoval iba rozvrh, známky a jedáleň, ale aj použiteľné školské fakty pre Home Assistant automácie, Recorder a dashboardy. Integrácia nebude meniť `person.*` ani `device_tracker.*`; telefón/GPS zostáva samostatným zdrojom polohy a EduPage poskytuje školský kontext.

## Rozsah verzie 2026.09.2

Pridať tieto entity pre každé dieťa/config entry:

- `sensor.posledny_prichod_do_skoly`
- `binary_sensor.prichod_do_skoly_dnes`
- `sensor.posledny_vydaj_stravy`
- `binary_sensor.obed_vydany_dnes`
- `sensor.aktualna_hodina`
- `sensor.dalsia_hodina`
- `sensor.prva_hodina`
- `sensor.koniec_vyucovania`
- `binary_sensor.skola_dnes`

Existujúce kalendáre a entity ostávajú zachované, vrátane kalendára rozvrhu, jedálne, DÚ/písomiek, event entity a TODO.

## Zdroje dát a istota významu

### Spoľahlivo použiteľné

- `pipnutie` — EduPage API ho explicitne označuje ako `ARRIVAL_TO_SCHOOL`; používa sa na posledný príchod do školy a príchod dnes.
- `strava_vydaj` — EduPage API ho explicitne označuje ako `FOOD_SERVED`; používa sa na posledný výdaj stravy a obed vydaný dnes.
- `timetable` / `cancelled_lessons` — používajú sa na časové školské entity.
- `next_ringing` — ostáva existujúcim údajom/senzorom.

### Zatiaľ iba diagnostické

- `h_attendance` — v aktuálnom `edupage-api` ide iba o timeline event type bez samostatného attendance modelu alebo endpointu. V tejto verzii sa z neho nebude odvodzovať konkrétna absencia, ospravedlnenie ani meškanie.
- `h_process`, `h_processtypes` — nebudú použité na vyzdvihovanie/družinu v 2026.09.2.

## Architektúra pollingu

Zachovať jeden `DataUpdateCoordinator`, ale rozdeliť dáta na dve frekvencie.

### Fast data — približne každé 2 minúty

- timeline/notifications
- odvodené školské udalosti z `pipnutie` a `strava_vydaj`

### Slow data — približne každých 30 minút

- timetable
- cancelled lessons
- canteen menu
- timetable changes
- missing teachers
- ringing
- grades
- subjects
- grades per term
- school year

Koordinátor bude tickovať približne každé 2 minúty. Slow sekcie sa znovu stiahnu iba vtedy, keď od ich posledného úspešného fetchu uplynulo približne 30 minút; inak sa použije posledná cache v koordinátore. Cieľom je nezdvojnásobiť existujúcu záťaž na EduPage API iba kvôli rýchlejším timeline udalostiam.

Pri prvom štarte config entry sa načítajú fast aj slow dáta.

## Filtrovanie udalostí podľa dieťaťa

Všetky `pipnutie` a `strava_vydaj` udalosti musia prejsť existujúcou logikou `event_matches_student(...)`, aby dve deti v jednom rodičovskom účte nedostali rovnaký stav.

Ak event nie je možné bezpečne priradiť ku konkrétnemu dieťaťu, nesmie ovplyvniť jeho stavovú entitu.

## Význam nových entít

### Posledný príchod do školy

Timestamp najnovšieho `pipnutie` eventu patriaceho danému dieťaťu. Použiť device class `timestamp`.

### Príchod do školy dnes

`on`, ak existuje `pipnutie` pre dané dieťa s lokálnym dátumom zhodným s dneškom Home Assistantu. O polnoci sa prirodzene zmení na `off`, aj keď nepríde nový EduPage update.

### Posledný výdaj stravy

Timestamp najnovšieho `strava_vydaj` eventu patriaceho danému dieťaťu. Device class `timestamp`.

### Obed vydaný dnes

`on`, ak existuje dnešný `strava_vydaj` event daného dieťaťa. Neodvodzovať z objednaného menu; ide o reálny evidovaný výdaj.

### Škola dnes

`on`, ak má dnešný deň aspoň jednu neodpadnutú vyučovaciu hodinu v timetable dátach. Samotné `pipnutie` tento senzor neurčuje.

### Prvá hodina

Začiatok prvej neodpadnutej dnešnej hodiny ako timestamp. Ak dnes nie je vyučovanie, stav je `unknown`/`None`.

### Koniec vyučovania

Koniec poslednej neodpadnutej dnešnej hodiny ako timestamp. Ak posledná hodina odpadne, výsledok sa odvodí z poslednej zostávajúcej hodiny.

### Aktuálna hodina

Textový stav = názov predmetu práve prebiehajúcej hodiny. Atribúty môžu obsahovať začiatok, koniec, učebňu a učiteľov, ak sú dostupné. Ak práve neprebieha žiadna hodina, stav je `None`/`unknown`.

### Ďalšia hodina

Textový stav = názov najbližšej budúcej neodpadnutej hodiny, prednostne dnes, inak najbližší deň v načítanom horizonte. Atribúty môžu obsahovať dátum, začiatok, koniec, učebňu a učiteľov.

## Recorder a história

Nové entity budú štandardné HA entity a teda budú zapisované do Recorderu podľa bežnej HA konfigurácie používateľa.

Timestamp a binary entity musia mať malé stabilné stavy. Nevkladať celé timeline payloady ani dlhé zoznamy udalostí do atribútov stavových entít.

Tým vznikne použiteľná história napríklad pre:

- časy príchodov do školy,
- časy vydania obeda,
- dni so školou,
- zmeny prvej/poslednej hodiny.

## Vzťah k `person.*` a GPS

Integrácia nesmie zapisovať ani meniť:

- `person.*`
- `device_tracker.*`
- HA zones

EduPage entity sú samostatný zdroj faktov. Výsledný stav typu `doma / v škole / vonku` sa bude skladať neskôr v HA automatizácii/template z telefónu/GPS + školských entít.

V 2026.09.2 sa zámerne nepridáva `binary_sensor.v_skole`, pretože máme spoľahlivý príchod, ale zatiaľ nie spoľahlivý odchod/družinu.

## Diagnostika

Rozšíriť privacy-safe diagnostiku o technický prehľad pre event typy:

- `pipnutie`
- `strava_vydaj`
- `h_attendance`
- `h_process`
- `h_processtypes`

Diagnostika nesmie obsahovať:

- meno dieťaťa,
- student ID,
- username,
- PHPSESSID,
- subdomain,
- text správ,
- mená autorov/príjemcov,
- voľný text z eventov.

Povolené je uviesť napríklad:

- počet eventov,
- názvy kľúčov `additional_data`,
- typy hodnôt,
- prítomnosť timestamp-like polí,
- anonymizovanú ukážku tvaru payloadu bez identifikátorov a textového obsahu.

Cieľom je pripraviť podklady pre ďalšiu verziu s reálnou dochádzkou (`absent / excused / late`) bez hádania významu polí.

## Chybové stavy a odolnosť

- Fast timeline fetch failure nesmie zmazať posledné známe školské udalosti ani slow dáta.
- Slow fetch failure jednej sekcie nesmie zmazať ostatné sekcie; zachovať existujúci `data_ok` model.
- Timestamp senzory majú držať poslednú známu hodnotu cez existujúci restore-state vzor tam, kde to dáva význam.
- Entity založené na dnešnom dátume musia korektne reagovať na zmenu dňa aj bez nového EduPage eventu.
- Pri timetable chybe jedného dieťaťa nesmie dôjsť k zlyhaniu timeline/meal/attendance kontextu druhého dieťaťa ani tej istej config entry.

## Testovanie

Pridať regresné testy pre:

- oddelenie fast/slow fetchovania,
- prvý refresh načíta všetky sekcie,
- ďalší 2-minútový refresh nevolá slow API pred TTL,
- slow API sa po TTL obnoví,
- `pipnutie` sa filtruje podľa dieťaťa,
- `strava_vydaj` sa filtruje podľa dieťaťa,
- dnešný príchod a dnešný obed,
- reset denných binary senzorov po zmene dátumu,
- prvú/aktuálnu/ďalšiu/poslednú hodinu,
- zrušenú poslednú hodinu,
- deň bez školy,
- privacy-safe diagnostiku bez osobných údajov,
- dve config entry/dve deti bez krížového miešania dát.

Existujúca test suite musí zostať zelená.

## Verzia a changelog

Pri implementácii zvýšiť `manifest.json` na `2026.09.2` a doplniť krátky používateľský changelog, napríklad:

- rýchlejšie spracovanie EduPage udalostí,
- nové entity príchodu do školy a výdaja stravy,
- nové entity aktuálnej, ďalšej, prvej a poslednej hodiny,
- nové entity `Škola dnes`, `Príchod do školy dnes` a `Obed vydaný dnes`,
- rozšírená bezpečná diagnostika dochádzkových udalostí.

## Mimo rozsahu 2026.09.2

- Vyzdvihovanie/družina.
- Priame ovládanie `person.*`.
- Finálny stav `doma / v škole / vonku` vo vnútri integrácie.
- Mark homework done, message read/reply/star, attachments, excuse absence.
- Interpretácia `h_attendance` ako konkrétnej absencie bez overeného payloadu.
