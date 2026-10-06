import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../../custom_components/homeassistantedupage/www/edupage-school-board-panel.js', import.meta.url), 'utf8');
const createEnvironment = (now = '2026-10-06T08:05:00Z') => {
  class TestDate extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return new Date(now).getTime(); }
  }
  const registry = new Map();
  class Element {
    attachShadow() {
      this.shadowRoot = { innerHTML: '', querySelectorAll: () => [], querySelector: () => null };
    }
  }
  const context = vm.createContext({
    HTMLElement: Element, customElements: { get: (key) => registry.get(key), define: (key, klass) => registry.set(key, klass) },
    window: { setTimeout, clearTimeout, setInterval, clearInterval },
    Date: TestDate, Intl, Map, Set, WeakMap, console,
  });
  vm.runInContext(source, context);
  return registry.get('edupage-school-board-panel');
};
const student = (key) => ({
  key, name: key === 'a' ? 'Emka' : 'Tomáš', school_domain: 'skola.edupage.org', class_names: ['5.A'],
  entities: { timetable: `calendar.${key}`, assignments: `calendar.${key}_tasks`, todo: `todo.${key}`, notifications: `sensor.${key}_messages`, subjects: [] },
});
const tick = () => new Promise((resolve) => setImmediate(resolve));
const response = (id, events) => ({ response: { [id]: { events } } });
const lesson = (day, hour, minute, duration, summary = 'Matematika') => ({
  start: `2026-10-${day}T${hour}:${minute}:00+02:00`,
  end: new Date(new Date(`2026-10-${day}T${hour}:${minute}:00+02:00`).getTime() + duration * 60000).toISOString(),
  summary, location: 'A1',
});

test('slow calendar and todo do not block state-backed content or the other pupil', async () => {
  const Panel = createEnvironment();
  let finishCalendar;
  let finishTodo;
  const requests = [];
  const hass = {
    config: { time_zone: 'Europe/Bratislava' }, connection: {},
    states: { 'sensor.a_messages': { state: '1', attributes: { events: [{ text: 'Celé znenie správy zo školy.', author: 'Triedny učiteľ', type: 'sprava' }] } } },
    callWS: async (message) => {
      requests.push(message);
      if (message.type === 'homeassistantedupage/panel') return { students: [student('a'), student('b')] };
      const id = message.target.entity_id;
      if (id === 'calendar.a') return new Promise((resolve) => { finishCalendar = resolve; });
      if (id === 'todo.a') return new Promise((resolve) => { finishTodo = resolve; });
      return id.startsWith('todo.') ? { response: { [id]: { items: [] } } } : response(id, []);
    },
  };
  const panel = new Panel();
  panel.hass = hass;
  await tick();
  assert.match(panel.shadowRoot.innerHTML, /Celé znenie správy zo školy/);
  assert.match(panel.shadowRoot.innerHTML, /Tomáš/);
  assert.match(panel.shadowRoot.innerHTML, /Načítavam rozvrh/);
  assert.match(panel.shadowRoot.innerHTML, /EduPage pre tento týždeň neposkytlo/);
  assert.equal(requests.filter((message) => message.domain === 'calendar').length, 4);
  assert.ok(requests.filter((message) => message.domain === 'calendar').every((message) => typeof message.target.entity_id === 'string'));
  finishCalendar(response('calendar.a', []));
  finishTodo({ response: { 'todo.a': { items: [] } } });
  await tick();
  assert.ok(!panel.shadowRoot.innerHTML.includes('Načítavam rozvrh'));
});

test('reopening on the same HA connection reuses fetched data and refresh explicitly refetches', async () => {
  const Panel = createEnvironment();
  let calls = 0;
  const hass = {
    config: { time_zone: 'Europe/Bratislava' }, connection: {}, states: {},
    callWS: async (message) => {
      calls++;
      if (message.type === 'homeassistantedupage/panel') return { students: [student('a')] };
      const id = message.target.entity_id;
      return id.startsWith('todo.') ? { response: { [id]: { items: [] } } } : response(id, []);
    },
  };
  const first = new Panel();
  first.hass = hass;
  await tick();
  const afterFirst = calls;
  assert.equal(afterFirst, 4);
  const second = new Panel();
  second.hass = hass;
  await tick();
  assert.equal(calls, afterFirst);
  await second.load(true);
  assert.equal(calls, 8);
  const otherConnection = new Panel();
  otherConnection.hass = { ...hass, connection: {} };
  await tick();
  assert.equal(calls, 12, 'another authenticated connection must not receive the cached pupil data');
});

test('one failed source keeps independently loaded content usable and shows a specific error', async () => {
  const Panel = createEnvironment();
  const panel = new Panel();
  panel.hass = {
    config: { time_zone: 'Europe/Bratislava' }, connection: {}, states: {},
    callWS: async (message) => {
      if (message.type === 'homeassistantedupage/panel') return { students: [student('a')] };
      const id = message.target.entity_id;
      if (id === 'calendar.a') throw new Error('Rozvrh nedostupný');
      return id.startsWith('todo.') ? { response: { [id]: { items: [{ summary: 'Matematika: Úloha 4', status: 'needs_action' }] } } } : response(id, []);
    },
  };
  await tick();
  assert.match(panel.shadowRoot.innerHTML, /Rozvrh nedostupný/);
  assert.match(panel.shadowRoot.innerHTML, /Úloha 4/);
  assert.ok(!panel.shadowRoot.innerHTML.includes('class="rail"'));
  assert.ok(!panel.shadowRoot.innerHTML.includes('Dobrý deň'));
  assert.ok(!panel.shadowRoot.innerHTML.includes('data-view'));
  assert.ok(!panel.shadowRoot.innerHTML.includes('undefined'));
});

test('timetable columns belong to each pupil; double lessons span both periods', () => {
  const Panel = createEnvironment();
  const panel = new Panel();
  panel._hass = { config: { time_zone: 'Europe/Bratislava' }, states: {} };
  panel._events['calendar.a'] = [
    lesson('05', '08', '00', 100, 'Slovenský jazyk a literatúra'),
    lesson('06', '08', '00', 45), lesson('06', '08', '55', 45), lesson('06', '09', '50', 45),
  ];
  panel._events['calendar.b'] = [lesson('06', '07', '10', 45)];
  const tableA = panel.schedule(student('a'));
  assert.match(tableA, /colspan="2"/);
  assert.match(tableA, /08:00–08:45/);
  assert.ok(!tableA.includes('07:10'));
  assert.match(tableA, />SJL</);
  assert.match(tableA, /title="Slovenský jazyk a literatúra"/);
  assert.match(tableA, /scope="row"/);
  assert.match(tableA, /<tr class="today">/);
  panel._events['calendar.a'].push(lesson('06', '12', '00', 45, 'VLA'));
  assert.match(panel.schedule(student('a')), />VLA</);
  panel._events['calendar.a_tasks'] = [lesson('06', '12', '00', 45, '[DÚ] Matematika')];
  assert.match(panel.schedule(student('a')), /class="tag amber homework">DÚ<\/span>/);
  assert.match(source, /\.tag\.homework\{font-size:12px/);
});

test('message title never hides the complete body, and user content is escaped', () => {
  const Panel = createEnvironment();
  const panel = new Panel();
  panel._hass = {
    config: { time_zone: 'Europe/Bratislava' },
    states: { 'sensor.a_messages': { attributes: { events: [
      { title: 'Pripomienka', text: 'Úplný text & pokyny\nDruhý riadok.', type: 'sprava', author: 'Učiteľ <3' },
    ] } } },
  };
  const html = panel.messages(student('a'));
  assert.match(html, /Pripomienka/);
  assert.match(html, /Úplný text &amp; pokyny\nDruhý riadok/);
  assert.match(html, /Učiteľ &lt;3/);
});

test('messages sort by actual time newest first, with stable IDs and undated items last', () => {
  const Panel = createEnvironment();
  const panel = new Panel();
  panel._hass = {
    config: { time_zone: 'Europe/Bratislava' },
    states: { 'sensor.a_messages': { attributes: { events: [
      { id: 1, timestamp: '2026-10-06T08:00:00+02:00', text: 'Lokálny čas', author: 'ID1', type: 'sprava' },
      { id: 4, timestamp: '2026-10-06T07:30:00Z', text: 'Najnovšia', author: 'ID4', type: 'sprava' },
      { id: 2, timestamp: '2026-10-06T07:30:00Z', text: 'Rovnaký čas', author: 'ID2', type: 'sprava' },
      { id: 3, timestamp: 'neplatný dátum', text: 'Bez času', author: 'ID3', type: 'sprava' },
    ] } } },
  };

  const html = panel.messages(student('a'));

  assert.ok(html.indexOf('ID2') < html.indexOf('ID4'));
  assert.ok(html.indexOf('ID4') < html.indexOf('ID1'));
  assert.ok(html.indexOf('ID1') < html.indexOf('ID3'));
});

test('messages show the newest ten first and expand older items in order', () => {
  const Panel = createEnvironment();
  const panel = new Panel();
  panel._hass = {
    config: { time_zone: 'Europe/Bratislava' },
    states: { 'sensor.a_messages': { attributes: { events: Array.from({ length: 12 }, (_, index) => ({
      id: 12 - index, timestamp: `2026-10-06T${String(19 - index).padStart(2, '0')}:00:00+02:00`,
      text: `Správa ${index + 1}`, type: 'sprava',
    })) } } },
  };

  const html = panel.messages(student('a'));
  assert.ok(html.indexOf('Správa 1') < html.indexOf('Správa 10'));
  assert.match(html, /Ďalšie položky \(2\)/);
  assert.ok(html.indexOf('Správa 10') < html.indexOf('Správa 11'));
  assert.ok(html.indexOf('Správa 11') < html.indexOf('Správa 12'));
});

test('canteen menu is loaded only when the top-bar link is activated', async () => {
  const Panel = createEnvironment();
  const panel = new Panel();
  let menuCalls = 0;
  const canteen = { ...student('a'), entities: { ...student('a').entities, canteen: 'calendar.canteen' } };
  panel._hass = {
    config: { time_zone: 'Europe/Bratislava' }, connection: {}, states: {},
    callWS: async (message) => {
      if (message.domain === 'calendar' && message.target.entity_id === 'calendar.canteen') {
        menuCalls++;
        return response('calendar.canteen', [{ start: '2026-10-06T00:00:00+02:00', summary: 'Obed', description: 'Paradajková polievka' }]);
      }
      return { response: { [message.target.entity_id]: { events: [] } } };
    },
  };
  panel._students = [canteen];

  assert.equal(menuCalls, 0);
  panel._menuOpen = true;
  await panel.loadCanteen();
  const html = panel.canteenModal();
  assert.equal(menuCalls, 1);
  assert.match(html, /Jedálny lístok/);
  assert.match(html, /Paradajková polievka/);
});

test('unrelated HA state changes cause no render and no extra data requests', async () => {
  const Panel = createEnvironment();
  const panel = new Panel();
  let calls = 0;
  const hass = {
    config: { time_zone: 'Europe/Bratislava' }, connection: {}, states: {},
    callWS: async (message) => {
      calls++;
      if (message.type === 'homeassistantedupage/panel') return { students: [student('a')] };
      const id = message.target.entity_id;
      return id.startsWith('todo.') ? { response: { [id]: { items: [] } } } : response(id, []);
    },
  };
  panel.hass = hass;
  await tick();
  const original = panel.shadowRoot.innerHTML;
  panel.hass = { ...hass, states: { 'sensor.unrelated': { state: '100' } } };
  assert.equal(panel.shadowRoot.innerHTML, original);
  assert.equal(calls, 4);
});

test('the calendar window starts on Monday in HA time after the autumn DST change', async () => {
  const Panel = createEnvironment('2026-10-28T12:00:00Z');
  const requests = [];
  const panel = new Panel();
  panel.hass = {
    config: { time_zone: 'Europe/Bratislava' }, connection: {}, states: {},
    callWS: async (message) => {
      if (message.type === 'homeassistantedupage/panel') return { students: [student('a')] };
      requests.push(message);
      const id = message.target.entity_id;
      return id.startsWith('todo.') ? { response: { [id]: { items: [] } } } : response(id, []);
    },
  };
  await tick();
  const range = requests.find((message) => message.domain === 'calendar').service_data;
  assert.equal(range.start_date_time, '2026-10-25T23:00:00.000Z');
  assert.equal(range.end_date_time, '2026-10-30T23:00:00.000Z');
});

test('dateTime objects parse correctly and only the current lesson is emphasized', () => {
  const Panel = createEnvironment();
  const panel = new Panel();
  panel._hass = { config: { time_zone: 'Europe/Bratislava' }, states: {} };
  const current = lesson('06', '09', '50', 45);
  panel._events['calendar.a'] = [
    { ...current, start: { dateTime: current.start }, end: { dateTime: current.end } },
    lesson('06', '10', '55', 45, 'Anglický jazyk'),
  ];
  const html = panel.schedule(student('a'));
  assert.match(html, /TERAZ/);
  assert.ok(!html.includes('ĎALEJ'));
});

test('switching connections discards a late mapping response from the previous session', async () => {
  const Panel = createEnvironment();
  const panel = new Panel();
  let finishOldMapping;
  panel.hass = {
    config: { time_zone: 'Europe/Bratislava' }, connection: {}, states: {},
    callWS: () => new Promise((resolve) => { finishOldMapping = resolve; }),
  };
  panel.hass = {
    config: { time_zone: 'Europe/Bratislava' }, connection: {}, states: {},
    callWS: async (message) => {
      if (message.type === 'homeassistantedupage/panel') return { students: [{ ...student('b'), name: 'Nový účet' }] };
      const id = message.target.entity_id;
      return id.startsWith('todo.') ? { response: { [id]: { items: [] } } } : response(id, []);
    },
  };
  await tick();
  finishOldMapping({ students: [{ ...student('a'), name: 'Starý účet' }] });
  await tick();
  assert.match(panel.shadowRoot.innerHTML, /Nový účet/);
  assert.ok(!panel.shadowRoot.innerHTML.includes('Starý účet'));
});

test('late calendar and todo responses cannot overwrite a new authenticated connection', async () => {
  const Panel = createEnvironment();
  const panel = new Panel();
  let finishOldCalendar;
  let finishOldTodo;
  panel.hass = {
    config: { time_zone: 'Europe/Bratislava' }, connection: {}, states: {},
    callWS: async (message) => {
      if (message.type === 'homeassistantedupage/panel') return { students: [student('a')] };
      const id = message.target.entity_id;
      if (id === 'calendar.a') return new Promise((resolve) => { finishOldCalendar = resolve; });
      if (id === 'todo.a') return new Promise((resolve) => { finishOldTodo = resolve; });
      return response(id, []);
    },
  };
  await tick();
  panel.hass = {
    config: { time_zone: 'Europe/Bratislava' }, connection: {}, states: {},
    callWS: async (message) => {
      if (message.type === 'homeassistantedupage/panel') return { students: [student('a')] };
      const id = message.target.entity_id;
      return id.startsWith('todo.') ? { response: { [id]: { items: [{ summary: 'Nové zadanie', status: 'needs_action' }] } } } : response(id, []);
    },
  };
  await tick();
  finishOldCalendar(response('calendar.a', [lesson('06', '08', '00', 45, 'Stará hodina')]));
  finishOldTodo({ response: { 'todo.a': { items: [{ summary: 'Staré zadanie', status: 'needs_action' }] } } });
  await tick();
  assert.match(panel.shadowRoot.innerHTML, /Nové zadanie/);
  assert.ok(!panel.shadowRoot.innerHTML.includes('Staré zadanie'));
  assert.ok(!panel.shadowRoot.innerHTML.includes('Stará hodina'));
  assert.equal(panel._pendingTodos.size, 0);
});

test('assignment marker errors are visible without blocking a loaded timetable', async () => {
  const Panel = createEnvironment();
  const panel = new Panel();
  panel.hass = {
    config: { time_zone: 'Europe/Bratislava' }, connection: {}, states: {},
    callWS: async (message) => {
      if (message.type === 'homeassistantedupage/panel') return { students: [student('a')] };
      const id = message.target.entity_id;
      if (id === 'calendar.a_tasks') throw new Error('DÚ kalendár nedostupný');
      return id.startsWith('todo.') ? { response: { [id]: { items: [] } } } : response(id, [lesson('06', '08', '00', 45)]);
    },
  };
  await tick();
  assert.match(panel.shadowRoot.innerHTML, /Týždenný rozvrh/);
  assert.match(panel.shadowRoot.innerHTML, /Označenia DÚ a písomiek sa nepodarilo načítať/);
  assert.match(panel.shadowRoot.innerHTML, /Niektoré údaje sa nenačítali/);
});

test('stale subject grades contribute to the pupil data warning', () => {
  const Panel = createEnvironment();
  const panel = new Panel();
  panel._hass = { config: { time_zone: 'Europe/Bratislava' }, states: { 'sensor.grade': { attributes: { data_stale: true, latest_grade: 2 } } } };
  const child = student('a');
  child.entities.subjects = [{ name: 'Matematika', entity_id: 'sensor.grade' }];
  assert.match(panel.studentCard(child), /Niektoré údaje sú z posledného úspešného načítania/);
});
