[![HACS](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/hacs/integration)
[![Hassfest](https://github.com/denkz0ne/haos_edupage/actions/workflows/hassfest.yml/badge.svg)](https://github.com/denkz0ne/haos_edupage/actions/workflows/hassfest.yml)
[![Testy](https://github.com/denkz0ne/haos_edupage/actions/workflows/tests.yml/badge.svg)](https://github.com/denkz0ne/haos_edupage/actions/workflows/tests.yml)

# EduPage pre Home Assistant

EduPage pre Home Assistant je neoficiálna vlastná integrácia školského informačného systému [EduPage](https://www.edupage.org/) do Home Assistanta. Údaje zo školy sprístupňuje ako kalendáre, senzory, udalosti, zoznam úloh a akcie, takže ich možno zobrazovať na dashboardoch alebo používať v šablónach, skriptoch a automatizáciách.

Tento repozitár je slovenský fork projektu [`rine77/homeassistantedupage`](https://github.com/rine77/homeassistantedupage). Integrácia používa neoficiálnu Python knižnicu [`edupage-api`](https://github.com/EdupageAPI/edupage-api).

> [!IMPORTANT]
> Projekt nie je prepojený so spoločnosťou aSc Applied Software ani oficiálne podporovaný službou EduPage. Rozsah údajov dostupných v Home Assistante závisí od funkcií zapnutých školou, typu účtu a jeho oprávnení.

## Funkcie

- kalendár vyučovania s budúcimi aj odpadnutými hodinami,
- kalendár školskej jedálne pre desiatu, obed a olovrant,
- kalendár domácich úloh a písomiek/skúšania,
- natívny zoznam domácich úloh `todo` iba na čítanie,
- nastaviteľné senzory známok podľa predmetov,
- senzory priemerov známok za 1. a 2. polrok,
- senzor upozornení pokrývajúci dostupné typy udalostí EduPage,
- event entita a spúšťače zariadenia pre novú známku, domácu úlohu, správu, písomku/skúšanie, zmenu rozvrhu a zaznamenaný príchod do školy,
- súhrnné senzory nesplnených domácich úloh, úloh po termíne, najbližšieho termínu a nadchádzajúcich písomiek/skúšania,
- senzory suplovania/zmien rozvrhu a chýbajúcich učiteľov,
- senzor najbližšieho školského zvonenia,
- výber, odhlásenie a hodnotenie stravy,
- odosielanie správ cez EduPage,
- viac žiakov a účtov pomocou samostatných konfiguračných záznamov,
- dvojstupňové overenie pomocou kódu z aplikácie EduPage,
- opätovné prihlásenie po vypršaní relácie,
- obnova posledných známych stavov po reštarte Home Assistanta alebo dočasnom výpadku EduPage,
- diagnostika s anonymizovaným súhrnom dostupných schopností a údajov.

## Požiadavky

Verzia integrácie 0.8.0 a novšia vyžaduje Home Assistant 2023.11.0 alebo novší, pretože používa natívnu entitu zoznamu úloh.

## Inštalácia

### HACS – odporúčaný spôsob pre tento fork

Tento fork sa používa ako vlastný HACS repozitár a nie je potrebné kopírovať súbory ručne.

1. Otvorte **HACS**.
2. V ponuke vpravo hore zvoľte **Custom repositories / Vlastné repozitáre**.
3. Ako repozitár zadajte:

   `https://github.com/denkz0ne/haos_edupage`

4. Ako typ zvoľte **Integration**.
5. Pridajte repozitár a vyhľadajte **EduPage pre Home Assistant**.
6. Integráciu stiahnite/nainštalujte.
7. Reštartujte Home Assistant.
8. Otvorte **Nastavenia → Zariadenia a služby → Pridať integráciu** a vyhľadajte **EduPage**.

Ak ste predtým používali pôvodný repozitár `rine77/homeassistantedupage`, v HACS používajte iba jeden z oboch zdrojov. Doména integrácie zostáva `homeassistantedupage`, aby sa zachovala kompatibilita existujúcich konfiguračných záznamov, entít a automatizácií.

### Ručná inštalácia

1. Stiahnite tento repozitár.
2. Priečinok `custom_components/homeassistantedupage` skopírujte do priečinka `custom_components` v konfigurácii Home Assistanta.
3. Reštartujte Home Assistant.

Výsledná štruktúra má vyzerať približne takto:

```text
config/
└── custom_components/
    └── homeassistantedupage/
        ├── __init__.py
        ├── manifest.json
        └── ...
```

## Nastavenie integrácie

1. Otvorte **Nastavenia → Zariadenia a služby**.
2. Zvoľte **Pridať integráciu**.
3. Vyhľadajte **EduPage**.
4. Zadajte používateľské meno, heslo a subdoménu školy.
5. Ak EduPage vyžiada dvojstupňové overenie, zadajte aktuálny kód z aplikácie.
6. Vyberte žiaka, ktorého údaje chcete načítavať.

Ak má škola adresu napríklad `https://mojaskola.edupage.org`, ako subdoménu zadajte `mojaskola`.

Pre každého žiaka vytvorte samostatný konfiguračný záznam. Platí to aj vtedy, keď jeden rodičovský účet obsahuje viac detí alebo keď používate viac účtov tej istej školy.

## Prihlásenie, 2FA a opätovné prihlásenie

Integrácia podporuje moderné dvojstupňové overenie EduPage pomocou kódu z aplikácie. Pri bežnej prevádzke Home Assistant opakovane používa uloženú PHP reláciu, takže kód 2FA nevyžaduje pri každom načítaní údajov.

Od verzie 0.4.0 novovytvorené a opätovne prihlásené záznamy neuchovávajú heslo EduPage. Ukladá sa používateľské meno, subdoména, vybraný žiak a identifikátor PHP relácie potrebný na periodické načítavanie údajov. Ak relácia vyprší alebo prestane byť platná, Home Assistant spustí opätovné prihlásenie a heslo si vyžiada znova.

Hodnota PHP relácie umožňuje prístup k účtu EduPage a treba s ňou zaobchádzať rovnako citlivo ako s heslom.

## Entity

Presné `entity_id` prideľuje Home Assistant. Môžu sa preto líšiť od príkladov v tejto dokumentácii, najmä pri staršej existujúcej inštalácii.

| Entita | Stav | Obsah |
| --- | --- | --- |
| Kalendár vyučovania | aktuálna alebo najbližšia hodina | rozvrh a odpadnuté hodiny |
| Kalendár jedálne | aktuálne alebo najbližšie jedlo | desiata, obed a olovrant |
| Kalendár úloh | aktuálna alebo najbližšia položka | domáce úlohy a písomky/skúšanie |
| Senzor predmetu | počet známok | podrobnosti známok v atribútoch |
| Senzor upozornení | počet upozornení | štruktúrované udalosti a počty podľa typov |
| Event entita | čas poslednej podporovanej udalosti | známka, úloha, správa, písomka/skúšanie, rozvrh, príchod |
| Zoznam domácich úloh | počet nesplnených úloh | natívne položky `todo` s termínmi a stavom splnenia |
| Nesplnené domáce úlohy | počet | úlohy s termínom aj bez termínu |
| Domáce úlohy po termíne | počet | nesplnené úlohy so starším termínom |
| Najbližší termín domácej úlohy | dátum | predmet, zadanie a počet zostávajúcich dní |
| Najbližšia písomka alebo skúšanie | počet | budúce položky od dnešného dňa |
| Zmeny v rozvrhu | počet dnešných zmien | trieda, hodina, názov a typ zmeny |
| Chýbajúci učitelia | počet | mená a identifikátory osôb |
| Najbližšie zvonenie | čas | typ zvonenia a čas |
| Priemer za hodnotiace obdobie | číselný priemer | počet známok a priemery podľa predmetov |

EduPage môže vrátiť aj predmety, ktoré vybraný žiak reálne nenavštevuje, prípadne technické alebo triedne položky. V **Nastavenia → Zariadenia a služby → EduPage → Konfigurovať** možno vybrať predmety, pre ktoré sa majú vytvárať senzory známok. Ostatné entity tým nie sú ovplyvnené.

Existujúca inštalácia naďalej zobrazuje všetky vrátené predmety, kým výber výslovne neuložíte. Ak nevyberiete žiadny predmet, senzory známok podľa predmetov sa nevytvoria.

## Kalendáre

### Vyučovanie

V bočnom paneli Home Assistanta otvorte **Kalendár**. Stav kalendárovej entity bežne predstavuje iba práve prebiehajúcu alebo najbližšiu udalosť; ostatné hodiny sú stále dostupné v kalendári a cez akciu `calendar.get_events`.

Odpadnuté hodiny sú v slovenskej lokalizácii označené prefixom `[Odpadlo]`.

Príklad karty na dashboarde:

```yaml
type: calendar
entities:
  - calendar.edupage_priklad_ziaka
initial_view: listWeek
```

### Načítanie udalostí kalendára v automatizácii

Ak automatizácia potrebuje viac než aktuálnu alebo najbližšiu udalosť, použite `calendar.get_events`:

```yaml
action: calendar.get_events
target:
  entity_id: calendar.edupage_priklad_ziaka
data:
  duration:
    hours: 24
response_variable: skolsky_program
```

Výstup možno ďalej spracovať v šablónach, napríklad na zistenie prvej vyučovacej hodiny dňa.

Podrobnosti sú v [dokumentácii kalendára Home Assistanta](https://www.home-assistant.io/integrations/calendar/).

### Školská jedáleň

Kalendár jedálne sa vytvorí aj vtedy, keď EduPage práve neposkytuje žiadny jedálny lístok. Ak škola funkciu používa, kalendár obsahuje desiatu, obed a olovrant približne na najbližších 14 dní.

Prázdny alebo nedostupný jedálny lístok teda znamená prázdny kalendár, nie chýbajúcu entitu. Nie každá škola používa modul školskej jedálne v EduPage.

### Domáce úlohy a písomky/skúšanie

Kalendár úloh spája termíny domácich úloh a písomiek/skúšania, ktoré EduPage vráti. Zobrazujú sa ako celodenné udalosti v príslušnom dátume. Domáca úloha, ktorú EduPage eviduje ako splnenú, zostáva viditeľná a je označená prefixom `[Splnené]`.

Kalendár sa vytvára aj vtedy, keď momentálne nie je dostupná žiadna úloha. Obsah vychádza z upozornení poskytovaných EduPage; staršie položky preto môžu zmiznúť, keď ich EduPage prestane vracať.

```yaml
type: calendar
entities:
  - calendar.edupage_assignments_priklad_ziaka
initial_view: listWeek
```

Aj pre tento kalendár možno použiť `calendar.get_events`.

## Zoznam domácich úloh

Pre každého žiaka sa vytvorí natívna Home Assistant entita `todo`, aj keď EduPage momentálne nevracia žiadnu domácu úlohu. Jej stavom je počet nesplnených domácich úloh. Jednotlivé položky môžu obsahovať predmet, zadanie, termín, stav splnenia a autora.

Zoznam je momentálne iba na čítanie. Dostupné rozhranie EduPage poskytuje údaje o domácich úlohách, ale integrácia zatiaľ nemá overený podporovaný spôsob, ako z Home Assistanta meniť stav splnenia späť v EduPage.

Nesplnené domáce úlohy možno získať v automatizácii pomocou `todo.get_items`:

```yaml
action: todo.get_items
target:
  entity_id: todo.edupage_homework_priklad_ziaka
data:
  status:
    - needs_action
response_variable: domace_ulohy
```

## Súhrnné senzory domácich úloh a písomiek

Štyri senzory poskytujú jednoduché stavy vhodné na dashboard a automatizácie:

- **Počet nesplnených domácich úloh** – zahŕňa aj úlohy bez termínu,
- **Počet domácich úloh po termíne** – nesplnené úlohy s termínom pred dnešným dňom,
- **Najbližší termín domácej úlohy** – najbližší termín od dnešného dňa; atribúty obsahujú predmet, zadanie a počet zostávajúcich dní,
- **Najbližšia písomka alebo skúšanie** – počet budúcich položiek s dátumom dnes alebo neskôr.

Pri dočasnom výpadku upozornení z EduPage si senzory ponechajú posledný známy stav a pomocou atribútu `data_stale: true` označia, že údaje nie sú čerstvé.

```yaml
type: entities
title: Škola
entities:
  - entity: sensor.edupage_open_homework_priklad_ziaka
    name: Nesplnené domáce úlohy
  - entity: sensor.edupage_overdue_homework_priklad_ziaka
    name: Domáce úlohy po termíne
  - entity: sensor.edupage_next_homework_deadline_priklad_ziaka
    name: Najbližší termín
  - entity: sensor.edupage_upcoming_exams_priklad_ziaka
    name: Písomky a skúšanie
```

## Známky podľa predmetov

Integrácia predvolene vytvára senzor pre každý predmet, ktorý EduPage vráti. Výber predmetov v možnostiach integrácie môže tento zoznam obmedziť. Stav senzora je počet načítaných známok z daného predmetu.

Príklad atribútov:

```yaml
student:
  id: 12345
  name: Príklad Žiaka
grade_1_title: Písomná práca
grade_1_grade_n: 2
grade_1_date: "2026-08-20 08:00:00"
grade_1_teacher: Príklad Učiteľa
```

Podľa údajov poskytnutých školou môžu atribúty obsahovať aj maximálny počet bodov, percentá, priemer triedy a komentár učiteľa.

Pre jednoduchý prístup k najnovšej známke sú k dispozícii aj atribúty:

- `latest_grade`
- `latest_grade_title`
- `latest_grade_date`
- `latest_grade_teacher`
- `latest_grade_comment`
- `latest_grade_percent`
- `latest_grade_max_points`
- `latest_grade_class_avg_grade`

Najnovšia známka sa určuje podľa dátumu, nie podľa poradia, v akom ju EduPage vráti. Voliteľné atribúty sa nevytvoria, ak ich škola neposkytuje.

Skutočné `entity_id` a atribúty si môžete pozrieť v **Nástroje pre vývojárov → Stavy**.

Príklad šablóny:

```jinja2
{{ state_attr('sensor.edupage_priklad_ziaka_matematika',
              'grade_1_grade_n') }}
```

### Priemery za hodnotiace obdobie

Samostatné senzory zobrazujú aritmetický priemer číselných známok za 1. a 2. polrok. Nečíselné hodnotenia sa do priemeru nezapočítavajú. Atribúty zahŕňajú:

- `school_year`
- `term`
- `grade_count`
- `grade_average`
- `subject_averages`

Ak nie je dostupná žiadna číselná známka, stav senzora je neznámy.

## Upozornenia

Senzor upozornení počíta všetky typy upozornení vrátené EduPage. Atribút `events` obsahuje najnovšie udalosti, ktoré sa bezpečne zmestia pod limit veľkosti atribútov rekordéra Home Assistanta; zároveň platí pevný limit 50 udalostí.

Príklad štruktúrovanej udalosti:

```yaml
id: 123456
type: homework
text: Vypracovať cvičenia 1–5
timestamp: "2026-09-03 10:30:00"
deadline: "2026-09-05"
subject: Matematika
author: Príklad Učiteľa
```

Atribút `type_counts` obsahuje počty udalostí podľa typu. `event_count` vždy predstavuje celkový počet upozornení vrátených EduPage. `events_exposed` udáva počet udalostí, ktorých detaily sú skutočne uložené v atribútoch, a `events_truncated` označuje, že ďalšie udalosti boli vynechané kvôli veľkostnému limitu.

Pre spätnú kompatibilitu sa tie isté zahrnuté udalosti poskytujú aj ako ploché atribúty `event_1_text`, `event_1_deadline`, `event_1_subject` a podobne.

Príklad Markdown karty:

```yaml
type: markdown
title: Posledné upozornenie EduPage
content: >-
  {% set entity = 'sensor.edupage_notification_priklad_ziaka' %}
  {% set events = state_attr(entity, 'events') or [] %}
  {% if events %}
    **{{ events[0].subject or events[0].type }}**

    {{ events[0].text }}

    Termín: {{ events[0].deadline or 'neuvedený' }}
  {% else %}
    Nie sú dostupné žiadne upozornenia.
  {% endif %}
```

## Udalosti EduPage a automatizácie

Event entita zmení stav vždy, keď po spustení integrácie príde nová podporovaná položka časovej osi EduPage. Upozornenia dostupné pri štarte tvoria iba počiatočný základ a po nastavení alebo reštarte Home Assistanta sa spätne neprehrávajú.

Rovnaké typy sú dostupné aj ako spúšťače zariadenia vo vizuálnom editore automatizácií Home Assistanta.

Podporované interné typy udalostí sú:

- `new_grade` – nová známka,
- `new_homework` – nová domáca úloha,
- `new_message` – nová správa,
- `new_exam` – nová písomka alebo skúšanie,
- `timetable_change` – zmena rozvrhu alebo suplovanie,
- `arrival_at_school` – zaznamenaný príchod do školy.

Interné názvy typov udalostí zostávajú po anglicky zámerne, aby sa nerozbila spätná kompatibilita automatizácií.

Príklad automatizácie:

```yaml
triggers:
  - trigger: state
    entity_id: event.edupage_events_priklad_ziaka
conditions:
  - condition: template
    value_template: "{{ trigger.to.attributes.event_type == 'new_homework' }}"
actions:
  - action: notify.notify
    data:
      title: Nová domáca úloha
      message: >-
        {{ trigger.to.attributes.subject or 'EduPage' }}:
        {{ trigger.to.attributes.text }}
```

Podľa typu udalosti môžu atribúty obsahovať ID udalosti EduPage, žiaka, predmet, autora, čas, termín, stav splnenia, označenie hviezdičkou a ďalšie nespracované údaje.

Udalosť príchodu do školy znamená iba to, že EduPage zaznamenal príchod. Bez spoľahlivej informácie o odchode ju nemožno považovať za trvalý stav „žiak je v škole“.

Integrácia zatiaľ nemá vlastnú špeciálnu kartu dashboardu. Použiť možno štandardné karty Home Assistanta – Kalendár, Entity, Markdown a šablónové karty.

## Suplovanie, zmeny rozvrhu a zvonenie

Senzor zmien rozvrhu zobrazuje zmeny hlásené pre aktuálny deň. Jeho stav je počet zmien a podrobnosti sú v atribútoch `change_N_*`.

Senzor chýbajúcich učiteľov zobrazuje počet chýbajúcich učiteľov v aktuálnom dni a v atribútoch ich mená a identifikátory osôb.

Senzor najbližšieho zvonenia zobrazuje najbližší dostupný čas školského zvonenia a informáciu, či ide o začiatok/koniec vyučovania alebo prestávku podľa údajov EduPage.

Ak škola dané údaje cez EduPage nezverejňuje, tieto entity môžu zostať prázdne alebo nedostupné.

## Akcie integrácie

Integrácia registruje nasledujúce akcie v doméne `homeassistantedupage`:

| Akcia | Účel |
| --- | --- |
| `homeassistantedupage.choose_meal` | vybrať menu na konkrétny dátum a typ jedla |
| `homeassistantedupage.sign_off_meal` | odhlásiť vybrané jedlo |
| `homeassistantedupage.rate_meal` | ohodnotiť množstvo a kvalitu jedla |
| `homeassistantedupage.send_message` | odoslať správu žiakom alebo učiteľom |

V Home Assistante sa zobrazujú ako akcie v editore automatizácií a skriptov.

### Vybrať stravu

```yaml
action: homeassistantedupage.choose_meal
data:
  date: "2026-09-04"
  meal_type: lunch
  number: 2
```

Podporované interné typy jedla sú `snack`, `lunch` a `afternoon_snack`. Číslo menu je od 1 do 8.

### Odhlásiť stravu

```yaml
action: homeassistantedupage.sign_off_meal
data:
  date: "2026-09-04"
  meal_type: lunch
```

### Ohodnotiť stravu

```yaml
action: homeassistantedupage.rate_meal
data:
  date: "2026-09-04"
  meal_type: lunch
  menu_number: "2"
  quantity: 8
  quality: 9
```

Množstvo aj kvalita používajú stupnicu 1 až 10. Hodnotenie je možné iba vtedy, keď EduPage pre dané menu poskytne hodnotiaci objekt.

### Odoslať správu

```yaml
action: homeassistantedupage.send_message
data:
  recipients:
    - "12345"
    - "Príklad Učiteľa"
  body: "Prosím, prineste si zajtra domácu úlohu."
```

Príjemcu možno zadať číselným EduPage ID osoby alebo presným menom; porovnanie mena nerozlišuje veľké a malé písmená. Neznámy príjemca spôsobí chybu akcie, aby sa správa omylom neposlala inej osobe.

### Výber účtu pri akcii

Ak je načítaný iba jeden konfiguračný záznam EduPage, `entry_id` možno vynechať. Pri viacerých záznamoch musí akcia určiť cieľový záznam:

```yaml
action: homeassistantedupage.choose_meal
data:
  entry_id: "01J4EXAMPLEENTRYID"
  date: "2026-09-04"
  meal_type: lunch
  number: 2
```

Neznáme `entry_id` je odmietnuté, aby sa jedlo alebo správa omylom nespracovali pod iným účtom.

## Interval aktualizácie

Údaje EduPage sa z cloudu načítavajú približne každých 30 minút. Rozvrh a jedálny lístok sa žiadajú približne na nasledujúcich 14 dní. Zmeny preto nemusia byť v Home Assistante viditeľné okamžite.

EduPage nie je lokálne push API, preto nie je vhodné bez overenia znižovať interval na agresívne hodnoty.

## Diagnostika

Home Assistant umožňuje pre konfiguračný záznam stiahnuť diagnostiku. Tento fork pridáva diagnostický výstup zameraný na zisťovanie dostupných schopností účtu bez ďalšieho volania EduPage.

Diagnostika používa už načítané údaje koordinátora a sumarizuje napríklad:

- dostupné sekcie údajov,
- počet predmetov a známok,
- počty a typy upozornení,
- počet dní a hodín rozvrhu,
- dostupnosť údajov jedálne,
- zmeny rozvrhu a chýbajúcich učiteľov,
- dostupnosť najbližšieho zvonenia.

Citlivé identifikačné údaje, napríklad používateľské meno, `PHPSESSID`, subdoména a údaje žiaka, sa redigujú. Napriek tomu diagnostiku pred zverejnením vždy skontrolujte, pretože ide o údaje zo školského účtu.

## Riešenie problémov

### Nezobrazili sa žiadne entity

- Po inštalácii alebo aktualizácii integrácie reštartujte Home Assistant.
- Skontrolujte **Nastavenia → Systém → Protokoly** a záznamy obsahujúce `homeassistantedupage`.
- Overte používateľské meno, heslo a subdoménu školy.
- Overte, že rovnaký účet vo webovom EduPage vidí údaje vybraného žiaka.

### Nefunguje dvojstupňové overenie

- Použite aktuálny kód zobrazený aplikáciou EduPage.
- Overte, že Home Assistant má prístup na internet a vie komunikovať s EduPage školy.
- Ak výzva vypršala, začnite nastavenie znova.

### Home Assistant žiada opätovné prihlásenie

Uložená relácia EduPage vypršala alebo prestala byť platná. Zadajte heslo znova a podľa potreby dokončite 2FA. Heslo sa použije na získanie novej relácie a pri novších konfiguračných záznamoch sa trvalo neukladá.

### V kalendári vidím iba najbližšiu udalosť

Je to bežné správanie kalendárovej entity Home Assistanta. Všetky udalosti zobrazíte v paneli Kalendár, na kalendárovej karte alebo pomocou `calendar.get_events`.

### Predmet nemá atribúty známok

Škola môže predmet sprístupniť bez toho, aby pod daným účtom poskytovala známky. Senzor v takom prípade nemá čo zobraziť.

### Jedáleň, suplovanie alebo zvonenie sú prázdne

Škola nemusí danú funkciu používať, účet k nej nemusí mať oprávnenie alebo momentálne nemusia existovať relevantné údaje.

## Súkromie a bezpečnosť

- Chráňte konfiguračný priečinok Home Assistanta aj jeho zálohy.
- S identifikátorom PHP relácie zaobchádzajte ako s heslom.
- Nezverejňujte používateľské mená, heslá, session ID, mená žiakov, známky, obsah rozvrhu ani súkromné správy.
- Pred priložením protokolu k verejnému issue odstráňte osobné údaje; debug log môže obsahovať školské dáta.

Verzia 0.4.0 a novšia pri novom nastavení alebo opätovnom prihlásení heslo trvalo neukladá. Záznamy vytvorené staršími verziami však môžu historicky uložené heslo obsahovať dovtedy, kým sa znova neprihlásia alebo nevytvoria nanovo.

## Aktualizácie cez HACS

Ak repozitár nepoužíva GitHub Releases, HACS sleduje predvolenú vetvu repozitára. Po zmene v `main` preto môže ponúknuť aktualizáciu podľa nového commitu. Po aktualizácii Python kódu integrácie reštartujte Home Assistant.

Pri vývoji tohto forku sa používa postup:

`feature vetva → pull request → testy → merge do main → aktualizácia v HACS → reštart Home Assistanta`

## Hlásenie problému

Pred vytvorením issue:

1. aktualizujte integráciu na najnovšiu dostupnú verziu,
2. reštartujte Home Assistant,
3. skontrolujte protokoly Home Assistanta,
4. podľa potreby vytvorte diagnostiku,
5. overte, či rovnaké údaje vidíte aj priamo v EduPage.

Do hlásenia uveďte:

- verziu integrácie,
- verziu Home Assistanta,
- stručný opis očakávaného a skutočného správania,
- relevantnú anonymizovanú časť protokolu,
- informáciu, či účet používa 2FA,
- ktorých funkcií EduPage sa problém týka.

Nikdy neposielajte prihlasovacie údaje, `PHPSESSID` ani osobné údaje zo školského účtu.

Issues pre tento fork: <https://github.com/denkz0ne/haos_edupage/issues>

## Vývoj a prispievanie

Vývojová vetva pre konkrétnu funkciu má zostať tematicky úzka a zmeny sa majú dostať do `main` cez pull request po úspešnom behu testov. Všeobecne použiteľné opravy a preklady je vhodné ponúknuť aj pôvodnému projektu.

Podrobnosti k lokálnemu vývojovému prostrediu sú v [`SETUP_DEVENV.md`](SETUP_DEVENV.md).

### Pôvodný projekt

- upstream: [`rine77/homeassistantedupage`](https://github.com/rine77/homeassistantedupage)
- knižnica: [`EdupageAPI/edupage-api`](https://github.com/EdupageAPI/edupage-api)

Integrácia používa neoficiálne rozhranie EduPage. Zmena na strane EduPage preto môže niektoré funkcie bez upozornenia dočasne rozbiť.

## Poďakovanie

Vďaka autorom a prispievateľom pôvodnej integrácie, ľuďom, ktorí poskytli testovanie, preklady, hlásenia a spätnú väzbu, a správcom projektu `edupage-api`.

## Licencia

Projekt je distribuovaný pod licenciou GNU General Public License v3.0. Podrobnosti sú v súbore [`LICENSE`](LICENSE). Autorské práva pôvodného projektu a jeho prispievateľov zostávajú zachované.