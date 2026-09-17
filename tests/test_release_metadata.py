import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "custom_components" / "homeassistantedupage" / "manifest.json"
CHANGELOG = ROOT / "CHANGELOG.md"


def test_release_version_uses_calendar_version_scheme():
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))

    assert re.fullmatch(r"20\d{2}\.\d{2}\.\d+", manifest["version"])


def test_current_version_has_changelog_entry():
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    changelog = CHANGELOG.read_text(encoding="utf-8")

    assert f"## {manifest['version']}" in changelog
