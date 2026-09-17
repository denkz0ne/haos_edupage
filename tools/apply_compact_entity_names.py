"""Apply compact [initials] friendly names to all EduPage entity platforms."""

from pathlib import Path


def replace(path: str, old: str, new: str, *, count: int = 1) -> None:
    file_path = Path(path)
    text = file_path.read_text(encoding="utf-8")
    actual = text.count(old)
    if actual != count:
        raise SystemExit(
            f"{path}: expected {count} occurrence(s) of {old!r}, found {actual}"
        )
    file_path.write_text(text.replace(old, new), encoding="utf-8")


# sensor.py
sensor = "custom_components/homeassistantedupage/sensor.py"
replace(
    sensor,
    "from .entity_helpers import student_device_info",
    "from .entity_helpers import compact_entity_name, student_device_info",
)
replace(
    sensor,
    'self._attr_name = f"EduPage - Nesplnené domáce úlohy {self._student_name}"',
    'self._attr_name = compact_entity_name(self._student_name, "Nesplnené DÚ")',
)
replace(
    sensor,
    'self._attr_name = f"EduPage - Domáce úlohy po termíne {self._student_name}"',
    'self._attr_name = compact_entity_name(self._student_name, "DÚ po termíne")',
)
replace(
    sensor,
    'self._attr_name = (\n            f"EduPage - Najbližší termín domácej úlohy {self._student_name}"\n        )',
    'self._attr_name = compact_entity_name(self._student_name, "Termín DÚ")',
)
replace(
    sensor,
    'self._attr_name = (\n            f"EduPage - Nadchádzajúce písomky a skúšanie {self._student_name}"\n        )',
    'self._attr_name = compact_entity_name(self._student_name, "Písomky/skúšanie")',
)
replace(
    sensor,
    'self._attr_name = f"EduPage - {student_name} - {subject_name}"',
    'self._attr_name = compact_entity_name(student_name, subject_name)',
)
replace(
    sensor,
    'self._attr_name = f"EduPage - Upozornenia {student_name}"',
    'self._attr_name = compact_entity_name(student_name, "Upozornenia")',
)
replace(sensor, '"Zmeny rozvrhu a suplovanie"', '"Suplovanie"')
replace(
    sensor,
    'self._attr_name = f"EduPage - {label} {student_name}"',
    'self._attr_name = compact_entity_name(student_name, label)',
)
replace(
    sensor,
    'self._attr_name = f"EduPage - Najbližšie zvonenie {student_name}"',
    'self._attr_name = compact_entity_name(student_name, "Zvonenie")',
)
replace(
    sensor,
    'self._attr_name = f"EduPage - Priemer za {term_label} {student_name}"',
    'self._attr_name = compact_entity_name(student_name, f"Priemer {term_label}")',
)

# calendar.py
calendar = "custom_components/homeassistantedupage/calendar.py"
replace(
    calendar,
    "from .entity_helpers import student_device_info",
    "from .entity_helpers import compact_entity_name, student_device_info",
)
replace(
    calendar,
    'self._attr_name = f"EduPage - Rozvrh {self._student_name}"',
    'self._attr_name = compact_entity_name(self._student_name, "Rozvrh")',
)
replace(
    calendar,
    'return f"EduPage - Rozvrh {self._student_name}"',
    'return compact_entity_name(self._student_name, "Rozvrh")',
)
replace(
    calendar,
    'self._attr_name = f"EduPage - Jedálny lístok {self._student_name}"',
    'self._attr_name = compact_entity_name(self._student_name, "Jedálny lístok")',
)
replace(
    calendar,
    'return f"EduPage - Jedálny lístok {self._student_name}"',
    'return compact_entity_name(self._student_name, "Jedálny lístok")',
)
replace(
    calendar,
    'self._attr_name = f"EduPage - DÚ a písomky {self._student_name}"',
    'self._attr_name = compact_entity_name(self._student_name, "DÚ a písomky")',
)

# event.py
event = "custom_components/homeassistantedupage/event.py"
replace(
    event,
    "from .entity_helpers import student_device_info",
    "from .entity_helpers import compact_entity_name, student_device_info",
)
replace(
    event,
    'self._attr_name = f"EduPage - Udalosti {self._student_name}"',
    'self._attr_name = compact_entity_name(self._student_name, "Udalosti")',
)

# todo.py
todo = "custom_components/homeassistantedupage/todo.py"
replace(
    todo,
    "from .entity_helpers import student_device_info",
    "from .entity_helpers import compact_entity_name, student_device_info",
)
replace(
    todo,
    'self._attr_name = f"EduPage - Domáce úlohy {self._student_name}"',
    'self._attr_name = compact_entity_name(self._student_name, "DÚ")',
)

print("Compact entity names patched successfully")
