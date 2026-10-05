# EduPage School Board / školská nástenka

Návrh samostatného Home Assistant dashboardu zobrazovaného v sidebare ako **Škola**. Cieľom nie je kopírovať EduPage, ale zredukovať ho na rodinný prehľad: **čo sa deje teraz, čo bude najbližšie a na čo netreba zabudnúť**.

Primárny scenár je široký desktop/tablet panel s dvoma deťmi. Ľavá polovica obrazovky patrí prvému dieťaťu, pravá polovica druhému. Obe strany majú rovnakú informačnú štruktúru, ale vlastný stav a vlastné zvýraznenia.

## 1. Základný layout

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ ŠKOLA                         pondelok 5. 10.              23:41 / stav dát │
├───────────────────────────────────┬──────────────────────────────────────────┤
│ DIEŤA A                            │ DIEŤA B                                  │
│ meno · trieda                      │ meno · trieda                            │
│ [teraz / zajtra] [DÚ] [testy]     │ [teraz / zajtra] [DÚ] [testy]           │
├───────────────────────────────────┼──────────────────────────────────────────┤
│ ROZVRH                             │ ROZVRH                                   │
│ 1  08:00–08:45  Matematika        │ 1  08:00–08:45  Slovenský jazyk         │
│ 2  08:55–09:40  Angličtina        │ 2  08:55–09:40  Matematika              │
│▶3  09:50–10:35  Fyzika      TERAZ │▶3  09:50–10:35  Dejepis            TERAZ │
│ 4  10:45–11:30  ...               │ 4  10:45–11:30  ...                     │
│        DÚ zajtra / test / zmena    │        DÚ zajtra / test / zmena          │
├───────────────────────────────────┼──────────────────────────────────────────┤
│ DÚ A TERMÍNY                       │ DÚ A TERMÍNY                             │
│ ! Matematika · zajtra              │ ! Angličtina · zajtra                    │
│   pracovný zošit 24/3              │   naučiť slovíčka                        │
├───────────────────────────────────┼──────────────────────────────────────────┤
│ SPRÁVY                             │ SPRÁVY                                   │
│ učiteľ · stručný text · čas        │ učiteľ · stručný text · čas              │
├───────────────────────────────────┼──────────────────────────────────────────┤
│ ZNÁMKY                             │ ZNÁMKY                                   │
│ MAT 1 · dnes        SJL 2 · piatok │ ANJ 1 · dnes         FYZ 2 · štvrtok     │
└───────────────────────────────────┴──────────────────────────────────────────┘
```

Na mobilnej šírke sa stĺpce skladajú pod seba, ale tento projekt je prioritne navrhnutý ako nástenka na väčšom displeji.

## 2. Vizuálny štýl

- moderný Home Assistant vzhľad, nie imitácia webu EduPage,
- tmavý aj svetlý HA theme bez natvrdo definovaného pozadia,
- veľké zaoblené bloky, jemné deliace čiary, minimum rámikov,
- jeden akcent pre každé dieťa len ako orientačný prvok,
- farby významu používať striedmo:
  - červená/oranžová = po termíne, zrušené, kritická zmena,
  - žltá = DÚ alebo písomka na najbližší školský deň,
  - zelená = splnené,
  - HA accent = práve prebiehajúca hodina,
- žiadne farebné konfety podľa každého predmetu; po piatich minútach by z toho bol EduPage cirkus.

## 3. Hlavička dieťaťa

Každá polovica začína kompaktnou hlavičkou:

- meno,
- trieda, ak je dostupná,
- stav školského dňa,
- 3–4 malé informačné chipy:
  - aktuálna/najbližšia hodina,
  - počet nesplnených DÚ,
  - počet blízkych písomiek,
  - zmena rozvrhu, ak existuje.

Chipy bez problému zmiznú, ak je hodnota nulová. Cieľom nie je ukázať štyri nuly.

## 4. Rozvrh – hlavný prvok nástenky

Rozvrh má byť dominantný blok a nie klasická Home Assistant kalendárová karta.

### Jeden riadok = jedna hodina

Navrhované stĺpce:

1. číslo hodiny,
2. čas,
3. predmet,
4. voliteľne učiteľ / učebňa v menšom texte,
5. stavové ikony/chipy na pravej strane.

Príklady stavov:

- **TERAZ** – aktuálne prebiehajúca hodina,
- **ĎALEJ** – nasledujúca hodina,
- **DÚ** – na predmet je naviazaná úloha s termínom na zobrazovaný deň,
- **TEST** – písomka/skúšanie,
- **ZMENA** – suplovanie alebo zmena rozvrhu,
- **ODPADLO** – riadok ostáva na svojom mieste, ale je utlmený/prečiarknutý.

### Aktuálna hodina

Počas vyučovania sa celý riadok aktuálnej hodiny zvýrazní HA accent farbou. Vľavo môže byť úzky progress indikátor podľa času od začiatku do konca hodiny.

Takto používateľ jedným pohľadom vidí nielen predmet, ale aj približne koľko z hodiny zostáva.

### Pred školou

Zobrazí sa dnešný rozvrh a zvýrazní prvá hodina / čas do začiatku školy.

### Počas školy

Zobrazí sa dnešný rozvrh a zvýrazní sa aktuálna hodina. Nasledujúca je jemne označená.

### Po poslednej hodine

Rozvrh sa prepne na **najbližší školský deň**. Typicky teda zajtra, ale v piatok rovno pondelok; rovnako musí preskočiť deň bez vyučovania.

Toto je dôležité: večer rodiča nezaujíma sivý pondelkový rozvrh, ktorý už skončil. Zaujíma ho, čo treba nachystať na ďalší školský deň.

### Víkend / deň bez vyučovania

Zobrazí sa najbližší deň, pre ktorý existujú hodiny, s textom napr. **Najbližšie: pondelok 12. 10.**

## 5. DÚ a termíny

Pod rozvrhom je karta s najbližšími nesplnenými úlohami.

Poradie:

1. po termíne,
2. na najbližší školský deň,
3. ostatné podľa dátumu,
4. úlohy bez dátumu na konci.

Riadok DÚ:

- predmet,
- krátky text zadania,
- termín,
- stav,
- voliteľne autor.

DÚ na deň, ktorý je práve zobrazený v rozvrhu, sa zrkadlí aj malým badge pri príslušnom predmete v rozvrhu. Tak je hneď vidieť **na ktorú hodinu niečo treba**.

Aktuálny dátový zdroj: natívna `todo` entita + kalendár DÚ/písomiek + súhrnné assignment senzory.

## 6. Správy

Karta ukáže posledné 2–4 relevantné správy/udalosti:

- autor,
- skrátený text,
- relatívny čas,
- typ udalosti.

Klik/tap otvorí detail s celým textom.

Aktuálne sa dá prvá verzia postaviť z `Upozornenia.events`, ale integrácia zatiaľ nemá ideálnu samostatnú message-feed entitu ani spoľahlivý unread/read model.

Preto správy v MVP chápeme ako **posledné správy/udalosti**, nie ako plnohodnotný inbox EduPage.

## 7. Známky

Zobrazovať posledné známky naprieč predmetmi, nie dvanásť samostatných senzorových kariet.

Jeden riadok/čip:

- skratka alebo názov predmetu,
- známka,
- dátum,
- pri rozbalení názov hodnotenia, učiteľ, komentár, percentá a priemer triedy, ak ich EduPage poskytne.

Súčasné predmetové senzory majú podrobné atribúty vrátane `latest_grade`, ale chýba spoločný chronologický feed posledných známok naprieč predmetmi.

## 8. Udalosti a zmeny

Zmeny rozvrhu, suplovanie, písomky a ďalšie dôležité udalosti nemajú zaberať samostatné obrovské karty.

Navrhnutý model je krátky kontextový pás medzi rozvrhom a DÚ:

```text
⚠ 4. hodina: zmena učebne     🧪 Zajtra: prírodoveda – test
```

Ak nič dôležité nie je, pás úplne zmizne.

## 9. Správanie podľa času

### Ráno

Priorita: dnešný rozvrh, prvá hodina, zmeny rozvrhu, dnešné testy.

### Počas vyučovania

Priorita: aktuálna hodina, nasledujúca hodina, prípadné zmeny.

### Popoludní a večer

Priorita: najbližší školský deň + DÚ/písomky na tento deň.

### Víkend

Priorita: najbližší školský deň a všetky nesplnené úlohy do neho.

UI teda nemení len farbu. Mení informačnú prioritu podľa času.

## 10. Čo vieme postaviť z dnešných entít

| Časť UI | Dnešný zdroj | Stav |
| --- | --- | --- |
| aktuálna/najbližšia hodina | kalendár Rozvrh | dostupné |
| celý denný rozvrh | `calendar.get_events` | dostupné, ale nepraktické pre čistú kartu |
| odpadnuté hodiny | kalendár Rozvrh | dostupné |
| DÚ zoznam | `todo` DÚ | dostupné |
| termíny DÚ/písomiek | kalendár DÚ a písomky | dostupné |
| počty DÚ / po termíne | assignment senzory | dostupné |
| písomky | upcoming exams + assignment calendar | dostupné |
| správy/udalosti | `Upozornenia.events` | čiastočne dostupné |
| známky predmetu | predmetové senzory | dostupné |
| posledná známka predmetu | `latest_grade*` atribúty | dostupné |
| chronologický feed známok | — | chýba |
| suplovanie/zmeny | senzor Suplovanie | dostupné |
| zvonenie | senzor Zvonenie | dostupné |

## 11. Odporúčaná technická cesta

### Fáza A – dashboard bez zásahu do API

Samostatný Lovelace dashboard **Škola**, nastavený `show_in_sidebar: true`.

Backend integrácie zostane zdrojom dát. Dashboard môže prvú verziu skladať z dnešných entít a `calendar.get_events`.

Výhoda: rýchly prototyp a overenie, čo je na rodinnej nástenke naozaj užitočné.

Nevýhoda: rozvrh bude vyžadovať viac templatingu a pomocných dát, než je zdravé.

### Fáza B – dashboard-friendly entity model

Integrácia doplní kompaktné štruktúrované entity/atribúty pre:

- denný rozvrh,
- posledné známky,
- správy,
- školský denný súhrn.

Tým prestane frontend rekonštruovať logiku z viacerých entít.

### Fáza C – vlastná Lovelace karta

Až keď sa potvrdí layout a dátový model, má zmysel vlastná `edupage-school-board-card` alebo dvojica menších kariet.

Neodporúčam začínať vlastným custom panelom v integrácii. Samostatný HA dashboard v sidebare je jednoduchší, stabilnejší a rešpektuje štandardný Lovelace routing.

## 12. Issue backlog / návrhy na vylepšenie

> GitHub Issues sú momentálne v repozitári vypnuté. Nasledujúce bloky sú pripravené ako issue návrhy na vytvorenie po ich zapnutí.

### Issue A — Structured daily timetable data for dashboard UI

**Cieľ:** sprístupniť celý zobrazovaný školský deň ako stabilnú štruktúru bez potreby opakovaného `calendar.get_events` a frontendovej rekonštrukcie stavu.

Navrhované dáta:

- `display_date`,
- `school_day_state`,
- `current_lesson_index`,
- `next_lesson_index`,
- `lessons[]` s číslom, predmetom, časom, učiteľom, učebňou, `cancelled`, `changed`,
- `next_school_day`.

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

- tabuľkový rozvrh po riadkoch,
- current lesson progress,
- automatický prechod na najbližší školský deň,
- DÚ/test/zmena badges priamo pri hodinách,
- kompaktný zoznam DÚ, správ a známok,
- responzívne použitie v grid dashboarde.

Dve inštancie karty vedľa seba vytvoria rodinnú nástenku pre dve deti. Tým sa multi-child layout nevkladá natvrdo do jednej obrovskej karty.

## 13. MVP poradie

1. prototyp dvojstĺpcového dashboardu z dnešných entít,
2. structured daily timetable,
3. recent grades feed,
4. message feed,
5. daily overview,
6. až potom vlastná Lovelace karta.

Toto poradie zámerne odkladá frontendový custom komponent. Najprv treba zistiť, či informačná hierarchia funguje v reálnom používaní; inak len veľmi elegantne zakódujeme zlý layout.
