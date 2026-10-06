# EduPage School Board / školská nástenka

Návrh samostatného Home Assistant dashboardu zobrazovaného v sidebare ako **Škola**. Cieľom nie je kopírovať EduPage, ale zredukovať ho na rodinný prehľad: **čo sa deje teraz, čo bude najbližšie a na čo netreba zabudnúť**.

Primárny scenár je široký desktop/tablet panel s dvoma deťmi. Ľavá polovica obrazovky patrí prvému dieťaťu, pravá polovica druhému. Obe strany majú rovnakú informačnú štruktúru, ale vlastný stav a vlastné zvýraznenia.

## 1. Základný layout

Dashboard je dvojstĺpcový: **ľavá polovica = dieťa A, pravá polovica = dieťa B**. Obe polovice používajú rovnakú komponentovú štruktúru a líšia sa iba dátami a jemným orientačným akcentom.

Poradie v každom paneli je záväzné:

1. hlavička dieťaťa,
2. týždenný rozvrh,
3. posledné správy / udalosti,
4. Úlohy + Známky vedľa seba,
5. ostatné menšie informácie.

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ ŠKOLA                                                   dátum / stav dát    │
├───────────────────────────────────┬──────────────────────────────────────────┤
│ MENO A                             │ MENO B                                   │
│ trieda                             │ trieda                                   │
│ zsbieloruska.edupage.sk           │ zsbieloruska.edupage.sk                 │
│ [DÚ] [písomky] [zmeny]            │ [DÚ] [písomky] [zmeny]                  │
├───────────────────────────────────┼──────────────────────────────────────────┤
│ ROZVRH: Po–Pi × 1.–N. hodina      │ ROZVRH: Po–Pi × 1.–N. hodina            │
│ aktuálna bunka = TERAZ             │ aktuálna bunka = TERAZ                  │
├───────────────────────────────────┼──────────────────────────────────────────┤
│ POSLEDNÉ SPRÁVY – plné znenie     │ POSLEDNÉ SPRÁVY – plné znenie           │
├────────────────┬──────────────────┼──────────────────┬───────────────────────┤
│ ÚLOHY          │ ZNÁMKY           │ ÚLOHY            │ ZNÁMKY                │
├────────────────┴──────────────────┼──────────────────┴───────────────────────┤
│ ostatné: suplovanie, zvonenie...  │ ostatné: suplovanie, zvonenie...        │
└───────────────────────────────────┴──────────────────────────────────────────┘
```

Na mobilnej šírke sa panely skladajú pod seba. Primárny cieľ je desktop/tablet landscape.
## 2. Vizuálny štýl

- moderný Home Assistant vzhľad, nie imitácia webu EduPage,
- tmavý aj svetlý HA theme bez natvrdo definovaného globálneho pozadia,
- veľké zaoblené bloky, jemné deliace čiary, minimum rámikov,
- jeden jemný orientačný akcent pre každé dieťa,
- **rozvrh nemá byť farebná mozaika podľa predmetov**; jeho základ je neutrálny a prehľadný,
- rozvrhové bunky používajú konzistentnú typografiu, jemný kontrast pozadia a jasnú mriežku,
- farby významu sa používajú iba na stav:
  - červená/oranžová = po termíne, zrušené, problém,
  - žltá = test / upozornenie,
  - zelená = splnené,
  - HA accent = práve prebiehajúca hodina,
- aktuálna hodina má byť jediný výrazný prvok v rozvrhu; ostatné bunky ostávajú pokojné a neutrálne.
## 3. Hlavička dieťaťa

Fotografia/avatar sa nepoužíva.

Každá polovica začína kompaktnou textovou hlavičkou:

- **meno dieťaťa** – najvýraznejší text,
- **trieda** – sekundárny text namiesto avataru,
- **doména školy** – napr. `zsbieloruska.edupage.sk`,
- malé info chipy iba z dnešných stabilných dát:
  - počet nesplnených DÚ,
  - počet nadchádzajúcich písomiek,
  - počet dnešných zmien rozvrhu, ak existujú.

Chipy s nulovou hodnotou môžu zmiznúť. V hlavičke sa nepoužíva tlačidlo „Detail žiaka“ ani iné akcie bez existujúceho dátového/UX flow.
## 4. Rozvrh – hlavný prvok nástenky

Rozvrh je **týždenná tabuľka**, nie denný zoznam.

### Orientácia tabuľky

- **os Y = pondelok až piatok**,
- **os X = 1. hodina až posledná dostupná hodina**,
- prvý stĺpec je pevný a obsahuje `Po / Ut / St / Št / Pi`,
- hlavička každého stĺpca obsahuje číslo hodiny a pod ním malým textom časový rozsah.

### Prehľadnosť mriežky

- všetky hodiny majú rovnakú šírku stĺpca,
- všetky dni majú rovnakú výšku riadku,
- výraznejšie oddeľovať hlavičku hodín a názvy dní od obsahu,
- predmet je v bunke dominantný, učebňa alebo učiteľ sú malé sekundárne údaje,
- dlhé názvy predmetov sa zalomia maximálne na 2 riadky; bunka sa nerozťahuje podľa textu,
- prázdna hodina ostáva čistá neutrálna bunka,
- dnešný deň možno označiť iba jemne (napr. tučnejší label dňa alebo slabý podklad), nie ďalšou výraznou farbou.

### Aktuálna hodina

Ak hodina práve prebieha, zvýrazní sa **iba konkrétna bunka** na priesečníku dnešného dňa a čísla hodiny.

Odporúčané zvýraznenie:

- HA accent outline alebo veľmi jemný accent fill,
- malý badge `TERAZ`,
- prípadne jemný glow/shadow,
- ostatné bunky ostávajú neutrálne, aby aktívna bunka okamžite vyskočila.

### Najbližšia hodina

Ak nič práve neprebieha, možno jemne označiť najbližšiu hodinu. Toto označenie musí byť citeľne slabšie než stav `TERAZ`.

### DÚ, testy, zmeny a odpadnuté hodiny

Bunka môže mať malý rohový marker alebo badge:

- `DÚ`,
- `TEST`,
- `ZMENA`,
- `ODPADLO`.

Badge nesmie prefarbiť celú bunku. Odpadnutá hodina zostáva na svojom mieste v mriežke, ale je utlmená/prečiarknutá.

### Dátový zdroj

MVP skladá pracovný týždeň z existujúceho kalendára rozvrhu cez `calendar.get_events` pre interval pondelok–piatok. Nepredpokladá novú backend entitu.
## 5. Posledné správy / udalosti

Sekcia správ je **hneď pod rozvrhom** a používa existujúci notification senzor `Upozornenia.events`.

Každá správa je samostatný box. Box obsahuje:

- autora, ak je dostupný,
- čas/dátum,
- prípadne typ udalosti,
- **celé znenie textu bez skracovania, ellipsis alebo dvojriadkového limitu**.

Výška boxu sa prispôsobí obsahu. Pri dlhšom texte sa obsah prirodzene zalomí na viac riadkov. Na nástenke je lepšie zobraziť menej posledných správ v plnom znení než veľa useknutých náhľadov.

Odporúčané MVP: 2–4 najnovšie relevantné položky podľa dostupného priestoru.

Integrácia zatiaľ nemá spoľahlivý samostatný inbox ani read/unread model, preto sa táto sekcia chápe ako **posledné správy/udalosti**, nie ako plnohodnotná schránka EduPage.
## 6. DÚ a termíny

Pod správami nasleduje blok **Úlohy**, vedľa ktorého je blok **Známky**.

Poradie DÚ:

1. po termíne,
2. najbližší termín,
3. ostatné s dátumom,
4. úlohy bez dátumu,
5. splnené položky až na konci alebo vizuálne utlmené.

Riadok DÚ obsahuje:

- predmet,
- text zadania,
- termín,
- stav.

Aktuálny dátový zdroj: natívna `todo` entita + kalendár DÚ/písomiek + súhrnné assignment senzory.
## 7. Známky

Blok **Známky** je vedľa Úloh a používa dnešné predmetové grade senzory.

MVP zobrazuje po predmetoch:

- názov predmetu,
- poslednú známku,
- dátum poslednej známky,
- voliteľne názov hodnotenia.

Detail môže neskôr využiť existujúce atribúty `latest_grade_teacher`, `latest_grade_comment`, `latest_grade_percent`, `latest_grade_max_points` a `latest_grade_class_avg_grade`.

Chronologický globálny feed známok sa v MVP nepredstiera, pretože dnes neexistuje ako samostatný stabilný zdroj.
## 8. Ostatné informácie

Až pod blokmi Správy, Úlohy a Známky môžu byť menšie sekundárne karty:

- Suplovanie,
- Chýbajúci učitelia,
- Zvonenie,
- Priemer 1. polrok,
- Priemer 2. polrok.

Tieto karty sú vizuálne menšie a nemajú konkurovať rozvrhu ani správam.
## 9. Správanie podľa času

### Ráno

Rozvrh ostáva celý týždenný, ale dnešný deň je jemne orientačne označený a najbližšia hodina môže byť zvýraznená.

### Počas vyučovania

Zvýrazní sa konkrétna bunka aktuálnej hodiny stavom `TERAZ`.

### Po vyučovaní

Týždenná tabuľka sa neprepína na iný layout. Aktívny stav zmizne; voliteľne sa jemne označí prvá relevantná hodina najbližšieho školského dňa.

### Víkend / deň bez vyučovania

Rozvrh zostáva týždenný. Fokus je na úlohách, správach a ďalšom školskom dni, bez umelého prefarbovania celej tabuľky.
## 10. Čo vieme postaviť z dnešných entít

| Časť UI | Dnešný zdroj | Stav |
| --- | --- | --- |
| aktuálna/najbližšia hodina | kalendár Rozvrh | dostupné |
| týždenný rozvrh Po–Pi | `calendar.get_events` nad pracovným týždňom | dostupné |
| odpadnuté hodiny | kalendár Rozvrh | dostupné |
| DÚ zoznam | `todo` DÚ | dostupné |
| termíny DÚ/písomiek | kalendár DÚ a písomky | dostupné |
| počty DÚ / po termíne | assignment senzory | dostupné |
| písomky | upcoming exams + assignment calendar | dostupné |
| správy/udalosti v plnom texte | `Upozornenia.events` | dostupné, typovo zmiešané |
| známky predmetu | predmetové senzory | dostupné |
| posledná známka predmetu | `latest_grade*` atribúty | dostupné |
| chronologický feed známok | — | chýba |
| suplovanie/zmeny | senzor Suplovanie | dostupné |
| chýbajúci učitelia | senzor Chýbajúci učitelia | dostupné |
| zvonenie | senzor Zvonenie | dostupné |
| priemery | senzory Priemer 1./2. polrok | dostupné |

MVP nesmie používať údaje len preto, že by sa do dizajnu hodili. Ak nie sú dnes stabilne exponované integráciou, do nástenky zatiaľ nepatria.
## 11. Odporúčaná technická cesta

### Fáza A – dashboard z dnešných entít

Samostatný Lovelace dashboard **Škola**, nastavený `show_in_sidebar: true`.

Backend integrácie zostane zdrojom dát. Týždenný rozvrh sa v MVP skladá z `calendar.get_events` pre pondelok–piatok. Správy sa čítajú z `Upozornenia.events`, DÚ z `todo` a assignment senzorov a známky z predmetových senzorov.

### Fáza B – dashboard-friendly model

Až keď sa MVP osvedčí, môže integrácia doplniť kompaktné štruktúrované entity/atribúty pre:

- týždenný rozvrh,
- agregované posledné známky,
- čistejší message feed,
- školský súhrn.

### Fáza C – vlastná Lovelace karta

Custom karta má zmysel až po stabilizovaní layoutu a dátového modelu. Nezačínať vlastným panelom ani novými backend entitami len kvôli mockupu.
## 12. Issue backlog / návrhy na vylepšenie

> GitHub Issues sú momentálne v repozitári vypnuté. Nasledujúce bloky sú pripravené ako issue návrhy na vytvorenie po ich zapnutí.

### Issue A — Structured weekly timetable data for dashboard UI

**Cieľ:** sprístupniť pracovný týždeň Po–Pi ako stabilnú štruktúru bez potreby opakovaného `calendar.get_events` a frontendovej rekonštrukcie mriežky.

Navrhované dáta:

- `week_start`,
- `days[]` pre Po–Pi,
- `lessons[]` v každom dni,
- `current_day_index`,
- `current_lesson_index`,
- `next_day_index`,
- `next_lesson_index`,
- predmet, čas, učiteľ, učebňa, `cancelled`, `changed`.

Akceptácia:

- aktuálna hodina je určiteľná podľa HA local time,
- po skončení školy je dostupný najbližší školský deň,
- odpadnuté a zmenené hodiny zostávajú v zozname,
- multi-student konfigurácie ostanú izolované.

### Issue B — Recent grades feed per student

**Cieľ:** jeden chronologický feed posledných známok naprieč predmetmi.

Navrhovaný item:

- subject,
- grade,
- date,
- title,
- teacher,
- comment,
- percent,
- max_points,
- class_average.

Dôvod: dnešné subject senzory sú dobré pre automatizácie a detail predmetu, ale dashboard musí prechádzať každú entitu zvlášť.

### Issue C — Dedicated message / communication feed

**Cieľ:** oddeliť používateľsky relevantné správy od všeobecného notification feedu.

Navrhované minimum:

- id,
- timestamp,
- author,
- recipient,
- text,
- type,
- read/unread iba ak EduPage API poskytuje dôveryhodný stav.

Bez overeného read/unread API sa tento príznak nemá predstierať.

### Issue D — Daily school overview entity

**Cieľ:** ľahká súhrnná entita pre dashboard/automatizácie.

Navrhované polia:

- display day,
- current/next lesson,
- school start/end,
- open homework count,
- homework due for display day,
- exams for display day,
- timetable changes count,
- stale-data flag.

Toto je dashboardový „index“, nie náhrada detailných entít.

### Issue E — EduPage School Board Lovelace card

**Cieľ:** po stabilizovaní vyššie uvedeného dátového modelu vytvoriť modernú HA kartu pre jedno dieťa.

Karta má vedieť:

- týždenný rozvrh Po–Pi × 1.–N. hodina,
- zvýraznenie konkrétnej bunky aktuálnej hodiny,
- jemné označenie najbližšej hodiny,
- DÚ/test/zmena badges priamo pri hodinách,
- správy v samostatných boxoch a v plnom znení,
- kompaktný zoznam DÚ a známok,
- responzívne použitie v grid dashboarde.

Dve inštancie karty vedľa seba vytvoria rodinnú nástenku pre dve deti. Tým sa multi-child layout nevkladá natvrdo do jednej obrovskej karty.

## 13. MVP poradie

1. prototyp dvojstĺpcového dashboardu z dnešných entít,
2. structured weekly timetable,
3. recent grades feed,
4. message feed,
5. daily overview,
6. až potom vlastná Lovelace karta.

Toto poradie zámerne odkladá frontendový custom komponent. Najprv treba zistiť, či informačná hierarchia funguje v reálnom používaní; inak len veľmi elegantne zakódujeme zlý layout.
