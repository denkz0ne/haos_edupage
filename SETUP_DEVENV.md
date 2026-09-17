# Vývojové prostredie vo VS Code

Tento stručný návod popisuje prípravu lokálneho vývojového prostredia pre integráciu EduPage.

## Požiadavky

- Git
- Visual Studio Code
- Python 3.12 alebo novší
- lokálna kópia Home Assistant Core

## Postup

1. Nainštalujte Visual Studio Code.

   Príklad pre Arch Linux:

   ```bash
   yay -S code
   ```

2. Vytvorte si priečinok na projekty:

   ```bash
   mkdir -p ~/projects
   cd ~/projects
   ```

3. Naklonujte tento fork a Home Assistant Core:

   ```bash
   git clone git@github.com:denkz0ne/haos_edupage.git
   git clone git@github.com:home-assistant/core.git
   ```

4. Otvorte repozitár vo VS Code:

   ```bash
   cd haos_edupage
   code .
   ```

5. Stlačte `Ctrl+Shift+P`, vyhľadajte **Python: Select Interpreter** a vytvorte nové virtuálne prostredie:

   - **Create Virtual Environment...**
   - **Venv**
   - vyberte Python 3.12 alebo novší.

6. Skontrolujte `.vscode/launch.json` a upravte cesty tak, aby zodpovedali vašim lokálnym priečinkom.

7. Aktivujte virtuálne prostredie a nainštalujte Home Assistant:

   ```bash
   source ~/projects/haos_edupage/.venv/bin/activate
   pip install homeassistant
   ```

8. Vývojovú/debug inštanciu spustite vo VS Code klávesom `F5`.

## Testy

Repozitár používa `pytest` a rovnaký základný testovací príkaz ako GitHub Actions:

```bash
pytest tests -v
```

Pri zmene používateľského rozhrania alebo prekladov skontrolujte aj súbory v:

```text
custom_components/homeassistantedupage/translations/
```

Pri custom integrácii Home Assistant načítava lokalizácie priamo z priečinka `translations`; `strings.json` slúži najmä ako vývojový/upstream podklad a nie ako jediný zdroj prekladu v nainštalovanom custom componente.
