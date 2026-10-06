/* Native, single-page EduPage school board. */
const REFRESH_MS = 15 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 20000;
// Reuse data only within the same authenticated HA connection; never persist it.
const CONNECTION_CACHE = new WeakMap();
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));
const eventDate = (value) => new Date(value?.dateTime || value?.date || value);
const parts = (value, timeZone) => Object.fromEntries(new Intl.DateTimeFormat('en-US', {
  timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit',
  minute: '2-digit', second: '2-digit', hourCycle: 'h23',
}).formatToParts(eventDate(value)).filter((part) => part.type !== 'literal').map(({ type, value: v }) => [type, Number(v)]));
const dateKey = (p) => `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
const fmtDate = (value, timeZone, options = { day: 'numeric', month: 'numeric' }) => {
  const date = eventDate(value);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('sk-SK', { ...options, timeZone }).format(date);
};
const fmtTime = (value, timeZone) => fmtDate(value, timeZone, { hour: '2-digit', minute: '2-digit' });
const clock = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
const attributes = (hass, id) => (id && hass.states[id]?.attributes) || {};
const textState = (hass, id, fallback = '—') => {
  const value = id && hass.states[id]?.state;
  return value != null && !['unknown', 'unavailable', 'none', ''].includes(String(value)) ? String(value) : fallback;
};
const plainText = (value) => {
  const text = String(value ?? '');
  if (!/<[a-z/]|&(?:[a-z]+|#\d+);/i.test(text)) return text;
  const template = document.createElement('template');
  template.innerHTML = text.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(?:p|div)>/gi, '\n');
  return template.content.textContent.trim();
};
const subjectLabel = (name) => ({
  'slovenský jazyk a literatúra': 'SJL', 'slovenský jazyk': 'SJ',
  'matematika': 'MAT', 'anglický jazyk': 'AJ', 'nemecký jazyk': 'NJ',
  'telesná a športová výchova': 'TSV', 'telesná výchova': 'TV',
  'výtvarná výchova': 'VV', 'hudobná výchova': 'HV', 'náboženská výchova': 'NV',
  'etická výchova': 'EV', 'informatika': 'INF', 'prírodoveda': 'PRI',
  'dejepis': 'DEJ', 'fyzika': 'FYZ', 'chémia': 'CHE', 'biológia': 'BIO',
  'geografia': 'GEO', 'občianska náuka': 'OBN', 'technika': 'TECH',
  'človek a príroda': 'ČaP', 'človek a spoločnosť': 'ČaS', 'človek a svet práce': 'ČaSP',
}[name.toLocaleLowerCase('sk')] || (name.length > 14 ? name.split(/\s+/).filter((word) => word.length > 1).slice(0, 5).map((word) => word[0]).join('').toLocaleUpperCase('sk') : name));
const icon = (name) => {
  const paths = {
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18M8 15h2M14 15h2"/>',
    food: '<path d="M7 3v7M4 3v4a3 3 0 0 0 6 0V3M7 10v11M17 3c-2 2-3 5-3 8h3v10M17 3v8"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
    tasks: '<rect x="4" y="4" width="16" height="17" rx="2"/><path d="M9 4V2h6v2M8 12l2 2 5-5M8 18h8"/>',
    grades: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>',
    swap: '<path d="M4 7h15l-3-3M20 17H5l3 3M19 7l-3 3M5 17l3-3"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    people: '<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M17 4a3 3 0 0 1 0 6M21 21v-3a6 6 0 0 0-4-5"/>',
    chart: '<path d="M4 21V10M10 21V3M16 21v-8M22 21H2"/>',
    refresh: '<path d="M20 8V3l-3 3a9 9 0 1 0 3 12M20 8h-5"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.calendar}</svg>`;
};
const localMidnightISO = (year, month, day, timeZone) => {
  const wall = Date.UTC(year, month - 1, day);
  const sample = new Date(wall + 12 * 60 * 60 * 1000);
  const p = parts(sample, timeZone);
  const offset = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - sample.getTime();
  return new Date(wall - offset).toISOString();
};
const schoolWeek = (now, timeZone) => {
  const p = parts(now, timeZone);
  const monday = new Date(Date.UTC(p.year, p.month - 1, p.day));
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  const days = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(monday);
    d.setUTCDate(d.getUTCDate() + i);
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
  });
  return {
    days: days.slice(0, 5).map((day) => ({ ...day, key: dateKey(day) })),
    start: localMidnightISO(days[0].year, days[0].month, days[0].day, timeZone),
    end: localMidnightISO(days[5].year, days[5].month, days[5].day, timeZone),
    key: dateKey(days[0]),
  };
};
const withTimeout = (promise) => new Promise((resolve, reject) => {
  const timeout = window.setTimeout(() => reject(new Error('Odpoveď Home Assistanta trvá príliš dlho. Skúste obnoviť údaje.')), REQUEST_TIMEOUT_MS);
  promise.then(resolve, reject).finally(() => window.clearTimeout(timeout));
});

const STYLES = `
  :host{display:block;min-height:100%;background:var(--primary-background-color,#f5f7fa);color:var(--primary-text-color,#1f2937);font-family:var(--paper-font-body1_-_font-family,Roboto,Arial,sans-serif);font-size:15px;--surface:var(--card-background-color,#fff);--text:var(--primary-text-color,#1f2937);--muted:var(--secondary-text-color,#64748b);--line:var(--divider-color,#e4e8ee);--accent:var(--primary-color,#0288d1);--soft:color-mix(in srgb,var(--text) 4%,var(--surface));--danger:color-mix(in srgb,var(--error-color,#db454f) 75%,var(--text));--success:color-mix(in srgb,#228b55 70%,var(--text));--warning:color-mix(in srgb,#c59121 70%,var(--text))}
  *{box-sizing:border-box}button,summary{font:inherit}button{color:inherit;cursor:pointer}button:disabled{cursor:wait}button:focus-visible,summary:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
  svg{height:21px;width:21px;flex-shrink:0}.topbar{min-height:56px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 16px;background:var(--surface);border-bottom:1px solid var(--line)}
  .page-title,.top-actions{display:flex;align-items:center;gap:12px}.page-title h1{font-size:22px;line-height:1.2;margin:0;font-weight:700;letter-spacing:-.4px}.top-meta{display:grid;gap:3px;text-align:right;font-size:13px;color:var(--muted)}.top-meta time{font-size:14px;color:var(--text)}.icon-button{display:grid;place-items:center;width:36px;height:36px;border:1px solid var(--line);border-radius:9px;background:var(--surface)}.icon-button.busy svg{animation:spin 1.3s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
  .board{padding:12px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;align-items:start}.board.single{grid-template-columns:minmax(0,1fr);max-width:1100px;margin:auto}.student{min-width:0;display:grid;gap:9px;padding:9px;border:1px solid var(--line);border-radius:14px;background:color-mix(in srgb,#ec669d 4%,var(--surface));--tone:#d8568d}.student:nth-child(even){background:color-mix(in srgb,#399ad6 4%,var(--surface));--tone:#368cc4}
  .student-head{display:flex;justify-content:space-between;align-items:center;gap:12px;min-height:64px;padding:3px 10px}.student-id h2{font-size:24px;line-height:1.15;letter-spacing:-.5px;margin:0 0 4px}.student-id p{margin:0;font-size:15px;line-height:1.4}.school-domain{font-size:13px;color:var(--muted);overflow-wrap:anywhere}.summary-chips{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}.summary-chip{display:flex;align-items:center;gap:7px;border:1px solid color-mix(in srgb,var(--tone) 24%,var(--line));border-radius:9px;padding:7px 9px;background:var(--surface);font-size:12px;line-height:1.25}.summary-chip strong{font-size:19px}.summary-chip.homework{color:var(--danger)}.summary-chip.exam{color:var(--warning)}.summary-chip.change{color:var(--accent)}
  .section{min-width:0;background:var(--surface);border:1px solid color-mix(in srgb,var(--line) 65%,transparent);border-radius:10px;overflow:hidden}.section-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 11px;border-bottom:1px solid var(--line);min-height:36px}.section-head h3{display:flex;align-items:center;gap:8px;margin:0;font-size:17px;line-height:1.25}.section-head h3 svg{color:var(--accent);width:20px;height:20px}.section-head small{font-size:12px;color:var(--muted);text-align:right}.messages-section h3 svg{color:#e35e76}.tasks-section h3 svg{color:#289c74}.grades-section h3 svg{color:#d3a226}.section-body{padding:3px 10px 5px}
  .timetable-scroll{overflow-x:auto;padding:4px 6px 6px}.timetable{width:100%;min-width:480px;table-layout:fixed;border-collapse:separate;border-spacing:3px}.timetable th,.timetable td{padding:0}.timetable col.day-col{width:35px}.period-head{text-align:center;height:35px;font-size:14px;font-weight:700;color:var(--text)}.period-head span{display:block;font-size:11px;font-weight:400;color:var(--muted);margin-top:3px;white-space:nowrap}.day-label{text-align:center;font-size:14px;color:var(--muted)}.day-label span{display:block;font-size:10px;font-weight:400;margin-top:2px}.day-label.today{color:var(--accent);font-weight:800}.timetable td{height:44px;background:var(--soft);border:1px solid color-mix(in srgb,var(--line) 70%,transparent);border-radius:6px;vertical-align:middle}.timetable td.empty{background:color-mix(in srgb,var(--text) 1.5%,var(--surface));border-color:color-mix(in srgb,var(--line) 45%,transparent)}
  .timetable tr.today td:not(.active){background:color-mix(in srgb,#58a8ef 12%,var(--surface));border-color:color-mix(in srgb,#58a8ef 24%,var(--line))}.timetable tr.today td.empty{background:color-mix(in srgb,#58a8ef 8%,var(--surface))}.lesson{display:grid;justify-items:center;align-content:center;padding:2px 3px;gap:1px;position:relative;height:42px;min-height:42px;line-height:1.2}.lesson abbr{font-size:16px;font-weight:700;text-decoration:none;text-align:center;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.lesson small{font-size:12px;color:var(--muted);text-align:center}.timetable td.active{border:2px solid var(--accent);background:color-mix(in srgb,var(--accent) 24%,var(--surface));box-shadow:0 0 0 1px color-mix(in srgb,var(--accent) 26%,transparent)}.lesson.cancelled abbr{text-decoration:line-through;color:var(--muted)}.lesson:has(.lesson-flags) small{justify-self:start;max-width:calc(100% - 32px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lesson-flags{position:absolute;bottom:2px;top:auto;right:2px;left:auto;display:flex;gap:3px;flex-wrap:wrap;justify-content:center}.tag{font-size:8px;font-weight:700;border-radius:4px;padding:1px 2px;background:var(--soft);color:var(--muted)}.tag.now{background:var(--accent);color:var(--text-primary-color,#fff)}.tag.amber{background:color-mix(in srgb,#f6be37 20%,var(--surface));color:var(--warning)}.tag.red{background:color-mix(in srgb,var(--danger) 10%,var(--surface));color:var(--danger)}
  .message{display:grid;grid-template-columns:7px 112px minmax(0,1fr) 74px;column-gap:8px;padding:3px 0;border-bottom:1px solid var(--line)}.message:last-child{border:0}.message-dot{width:6px;height:6px;margin-top:7px;background:var(--tone);border-radius:50%}.message-author{font-size:13px;line-height:1.4}.message time{font-size:11px;color:var(--muted);text-align:right;line-height:1.5}.message p{margin:0;white-space:pre-line;overflow-wrap:anywhere;font-size:14px;line-height:1.45}.message-title{display:block;font-size:14px;margin-bottom:3px}
  .two-panels{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;align-items:start}.task{display:grid;grid-template-columns:16px minmax(0,1fr);gap:8px;padding:3px 0;border-bottom:1px solid var(--line)}.task:last-child{border:0}.checkbox{width:15px;height:15px;border:1.5px solid var(--muted);border-radius:3px;margin-top:2px;display:grid;place-items:center;font-size:11px}.task.done .checkbox{background:#279467;border-color:#279467;color:white}.task.done{color:var(--muted)}.task.done .task-text{text-decoration:line-through}.task-main{display:flex;justify-content:space-between;align-items:baseline;gap:6px;margin-bottom:3px;font-size:14px}.task-main strong{font-weight:700}.task-main time{font-size:12px;white-space:nowrap;color:var(--muted)}.task-text{font-size:13px;line-height:1.4;white-space:pre-line;overflow-wrap:anywhere}.task.overdue .task-main{color:var(--danger)}.task.overdue .checkbox{border-color:var(--danger)}.task-status{font-size:11px;margin-top:3px;color:var(--muted)}.task.overdue .task-status{color:var(--danger)}
  .grade-row{display:grid;grid-template-columns:minmax(0,1fr) 29px 42px;align-items:center;gap:7px;padding:5px 0;border-bottom:1px solid var(--line);min-height:36px}.grade-row:last-child{border:0}.grade-row b{font-size:14px;line-height:1.25;font-weight:600;overflow-wrap:anywhere}.grade-row small{display:block;font-size:12px;line-height:1.3;color:var(--muted);margin-top:3px}.grade-row time{font-size:12px;color:var(--muted);text-align:right}.grade{display:grid;place-items:center;width:27px;height:27px;border-radius:50%;font-size:16px;font-weight:700;background:var(--soft);color:var(--text)}.grade.good{background:color-mix(in srgb,#38ab73 18%,var(--surface));color:var(--success)}.grade.warning{background:color-mix(in srgb,#f6be37 23%,var(--surface));color:var(--warning)}.grade.bad{background:color-mix(in srgb,var(--danger) 16%,var(--surface));color:var(--danger)}
  .extras{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.metric{display:flex;align-items:center;gap:7px;min-width:0;padding:8px;border-radius:9px;background:var(--surface);border:1px solid color-mix(in srgb,var(--line) 65%,transparent)}.metric>svg{color:var(--accent);width:20px;height:20px}.metric-content{flex:1;min-width:0}.metric-label{font-size:12px;color:var(--muted);margin-bottom:3px}.metric-value{font-size:16px;line-height:1.25;font-weight:700;overflow-wrap:anywhere}.term-values{display:flex;gap:3px 8px;flex-wrap:wrap;font-size:15px}.term-values small{font-size:11px;color:var(--muted);font-weight:400;margin-left:4px}.empty-state{padding:13px 11px;color:var(--muted);font-size:14px;line-height:1.5}.schedule-empty{min-height:278px;display:grid;align-content:center;text-align:center;gap:6px}.schedule-empty strong{font-size:16px;color:var(--text)}.error{color:var(--danger)}.board-notice{grid-column:1/-1;background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:18px}.all-records{margin-top:4px}.all-records summary{cursor:pointer;color:var(--accent);font-size:12px;padding:5px 0;list-style-position:inside}.all-records[open] summary{border-bottom:1px solid var(--line)}.data-note{font-size:12px;color:var(--muted);padding:5px 10px}.spinner{display:inline-block;width:12px;height:12px;border:2px solid var(--line);border-top-color:var(--accent);border-radius:50%;animation:spin 1s linear infinite;margin-right:6px;vertical-align:middle}
  @media(min-width:1900px){.board{gap:18px;padding:16px}.lesson abbr{font-size:18px}.lesson small{font-size:13px}.timetable td{height:53px}.message p{font-size:15px}}
  .attendance-times{display:block;font-size:11px;line-height:1.35;color:var(--muted);margin-top:3px;white-space:nowrap}.menu-button{width:auto;padding:0 10px;display:flex;gap:6px;align-items:center;color:var(--accent);font-size:13px}.menu-button svg{width:18px;height:18px}.menu-modal{position:fixed;inset:0;z-index:20;display:grid;place-items:center;padding:18px;background:rgba(15,23,42,.48)}.menu-dialog{width:min(680px,100%);max-height:min(80vh,760px);overflow:auto;background:var(--surface);color:var(--text);border:1px solid var(--line);border-radius:14px;box-shadow:0 18px 55px rgba(15,23,42,.25)}.menu-dialog-head{position:sticky;top:0;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;background:var(--surface);border-bottom:1px solid var(--line)}.menu-dialog-head h2{margin:0;font-size:20px}.menu-days{padding:4px 16px 14px}.menu-day{padding:12px 0;border-bottom:1px solid var(--line)}.menu-day:last-child{border:0}.menu-day h3{margin:0 0 7px;font-size:16px;text-transform:capitalize}.menu-meal{display:grid;grid-template-columns:96px 1fr;gap:8px;padding:4px 0;line-height:1.4}.menu-meal strong{font-size:13px}.menu-meal span{white-space:pre-line;font-size:14px}
  .extras{grid-template-columns:repeat(5,minmax(0,1fr))}
  @media(max-width:1200px){.extras{grid-template-columns:repeat(2,minmax(0,1fr))}.message{grid-template-columns:7px 93px minmax(0,1fr) 62px}.message time{font-size:10px}}
  @media(max-width:980px){.board{grid-template-columns:minmax(0,1fr);padding:10px;gap:12px}.student-head{min-height:64px}.student-id h2{font-size:23px}}
  @media(max-width:540px){.topbar{padding:8px 10px;min-height:54px}.message{grid-template-columns:7px minmax(0,1fr) auto}.message .message-text{grid-column:2/-1;grid-row:2}.message time{font-size:11px}.page-title h1{font-size:19px}.top-meta time{font-size:12px}.top-meta span{display:none}.board{padding:8px}.student{padding:6px;gap:7px}.student-head{flex-wrap:wrap;padding:6px}.summary-chips{justify-content:flex-start}.summary-chip{padding:5px 7px}.student-id h2{font-size:23px}.two-panels{grid-template-columns:minmax(0,1fr)}.section-head h3{font-size:17px}.extras{gap:6px}.metric{padding:8px}.metric-label{font-size:12px}.timetable-scroll{padding:3px}.schedule-empty{min-height:180px}}
  @media(prefers-reduced-motion:reduce){.spinner,.icon-button.busy svg{animation:none}}
`;

class EduPageSchoolBoardPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._generation = 0;
    this._students = [];
    this._events = {};
    this._todos = {};
    this._calendarErrors = {};
    this._todoErrors = {};
    this._pendingCalendars = new Set();
    this._pendingTodos = new Set();
    this._localCache = { students: null, mappingAt: 0, records: new Map() };
    this._seenStates = new Map();
    this._mappingLoading = false;
    this._menuOpen = false;
    this._menuLoading = false;
    this._menuItems = null;
    this._menuError = '';
  }

  connectedCallback() {
    this._timer = window.setInterval(() => this.render(), 60000);
    this._refreshTimer = window.setInterval(() => this.load(true), REFRESH_MS);
  }

  disconnectedCallback() {
    window.clearInterval(this._timer);
    window.clearInterval(this._refreshTimer);
  }

  set narrow(value) { this._narrow = value; this.render(); }

  set hass(value) {
    if (!value) { this._hass = value; return; }
    if (this._loaded && this._connection !== value.connection) {
      this._generation += 1;
      this._loaded = false;
      this._mappingLoading = false;
      this._students = [];
      this._events = {};
      this._todos = {};
      this._calendarErrors = {};
      this._todoErrors = {};
      this._pendingCalendars = new Set();
      this._pendingTodos = new Set();
      this._seenStates = new Map();
      this._localCache = { students: null, mappingAt: 0, records: new Map() };
    }
    this._connection = value.connection;
    this._hass = value;
    if (!this._loaded) {
      this._loaded = true;
      this.load();
    } else if (this._timeZone !== value.config.time_zone || this.relevantIds().some((id) => this._seenStates.get(id) !== value.states[id])) {
      this.render();
    }
  }

  cache() {
    const connection = this._hass?.connection;
    if (!connection || typeof connection !== 'object') return this._localCache;
    if (!CONNECTION_CACHE.has(connection)) CONNECTION_CACHE.set(connection, { students: null, mappingAt: 0, records: new Map() });
    return CONNECTION_CACHE.get(connection);
  }

  relevantIds() {
    return this._students.flatMap((student) => Object.values(student.entities || {}).flatMap((value) => (
      Array.isArray(value) ? value.map((subject) => subject.entity_id) : [value]
    ))).filter(Boolean);
  }

  async load(force = false) {
    if (!this._hass || this._mappingLoading) return;
    const generation = this._generation;
    const hass = this._hass;
    const cache = this.cache();
    this._error = '';
    if (!force && cache.students && Date.now() - cache.mappingAt < REFRESH_MS) {
      this._students = cache.students;
    } else {
      this._mappingLoading = true;
      this.render();
      try {
        const result = await withTimeout(hass.callWS({ type: 'homeassistantedupage/panel' }));
        if (generation !== this._generation) return;
        this._students = Array.isArray(result.students) ? result.students : [];
        cache.students = this._students;
        cache.mappingAt = Date.now();
      } catch (error) {
        if (generation === this._generation) this._error = error?.message || 'Účty EduPage sa nepodarilo načítať.';
      } finally {
        if (generation === this._generation) this._mappingLoading = false;
      }
    }
    if (generation !== this._generation) return;
    // State-backed sections appear before any calendar/todo response arrives.
    this.render();
    await Promise.allSettled([this.loadCalendars(force), this.loadTodos(force)]);
  }

  async readRecord(key, request, force, cache = this.cache()) {
    let record = cache.records.get(key);
    if (!record) {
      record = { data: undefined, fetchedAt: 0, pending: null };
      cache.records.set(key, record);
    }
    if (!force && record.data !== undefined && Date.now() - record.fetchedAt < REFRESH_MS) return record.data;
    if (!record.pending) {
      record.pending = withTimeout(Promise.resolve().then(request)).then((data) => {
        record.data = data;
        record.fetchedAt = Date.now();
        return data;
      }).finally(() => { record.pending = null; });
    }
    return record.pending;
  }

  async loadCalendars(force = false) {
    const generation = this._generation;
    const hass = this._hass;
    const cache = this.cache();
    const week = schoolWeek(new Date(), hass.config.time_zone || 'UTC');
    const ids = [...new Set(this._students.flatMap((student) => [student.entities?.timetable, student.entities?.assignments]).filter(Boolean))];
    await Promise.allSettled(ids.map(async (id) => {
      const key = `calendar:${id}:${week.start}:${week.end}`;
      const cached = cache.records.get(key)?.data;
      if (cached !== undefined) this._events[id] = cached;
      this._pendingCalendars.add(id);
      this._calendarErrors[id] = '';
      this.render();
      try {
        const data = await this.readRecord(key, async () => {
          const result = await hass.callWS({
            type: 'call_service', domain: 'calendar', service: 'get_events',
            target: { entity_id: id }, return_response: true,
            service_data: { start_date_time: week.start, end_date_time: week.end },
          });
          const response = result?.response || result || {};
          const items = response[id];
          if (!Array.isArray(items) && !Array.isArray(items?.events)) throw new Error('Home Assistant nevrátil údaje kalendára.');
          return Array.isArray(items) ? items : items.events;
        }, force, cache);
        if (generation === this._generation) this._events[id] = data;
      } catch (error) {
        if (generation === this._generation) this._calendarErrors[id] = error?.message || 'Rozvrh sa nepodarilo načítať.';
      } finally {
        if (generation === this._generation) {
          this._pendingCalendars.delete(id);
          this.render();
        }
      }
    }));
  }

  async loadTodos(force = false) {
    const generation = this._generation;
    const hass = this._hass;
    const cache = this.cache();
    const ids = [...new Set(this._students.map((student) => student.entities?.todo).filter(Boolean))];
    await Promise.allSettled(ids.map(async (id) => {
      const key = `todo:${id}`;
      const cached = cache.records.get(key)?.data;
      if (cached !== undefined) this._todos[id] = cached;
      this._pendingTodos.add(id);
      this._todoErrors[id] = '';
      this.render();
      try {
        const data = await this.readRecord(key, async () => {
          const result = await hass.callWS({
            type: 'call_service', domain: 'todo', service: 'get_items',
            target: { entity_id: id }, return_response: true,
            service_data: { status: ['needs_action', 'completed'] },
          });
          const response = result?.response || result || {};
          const items = response[id];
          if (!Array.isArray(items) && !Array.isArray(items?.items)) throw new Error('Home Assistant nevrátil zoznam úloh.');
          return Array.isArray(items) ? items : items.items;
        }, force, cache);
        if (generation === this._generation) this._todos[id] = data;
      } catch (error) {
        if (generation === this._generation) this._todoErrors[id] = error?.message || 'Úlohy sa nepodarilo načítať.';
      } finally {
        if (generation === this._generation) {
          this._pendingTodos.delete(id);
          this.render();
        }
      }
    }));
  }

  eventList(id) { return this._events[id] || []; }

  schedule(student) {
    const id = student.entities?.timetable;
    const timeZone = this._hass.config.time_zone || 'UTC';
    const now = new Date();
    const week = schoolWeek(now, timeZone);
    const events = this.eventList(id).map((event) => {
      const start = eventDate(event.start);
      const end = eventDate(event.end);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return null;
      const p = parts(start, timeZone);
      return { ...event, start, end, day: dateKey(p), minute: p.hour * 60 + p.minute };
    }).filter((event) => event && week.days.some((day) => day.key === event.day));
    if (!events.length) {
      const error = this._calendarErrors[id];
      if (error) return `<div class="empty-state schedule-empty error" role="status">${esc(error)}</div>`;
      if (id && (this._pendingCalendars.has(id) || this._events[id] === undefined)) return '<div class="empty-state schedule-empty" role="status"><span><i class="spinner"></i>Načítavam rozvrh…</span></div>';
      return `<div class="empty-state schedule-empty"><strong>${id ? 'Rozvrh nie je k dispozícii' : 'Kalendár rozvrhu nie je dostupný'}</strong><span>${id ? 'EduPage pre tento týždeň neposkytlo žiadne hodiny.' : 'Skontrolujte načítanie integrácie EduPage.'}</span></div>`;
    }
    // Each pupil has their own bell times. Group nearby starts (e.g. 11:45/11:50)
    // instead of mixing both schools into one set of columns.
    const starts = [...new Set(events.map((event) => event.minute))].sort((a, b) => a - b);
    const periods = [];
    for (const start of starts) {
      const previous = periods[periods.length - 1];
      if (previous && start - previous.start <= 10) previous.starts.push(start);
      else periods.push({ start, starts: [start] });
    }
    periods.forEach((period) => {
      const group = events.filter((event) => period.starts.includes(event.minute));
      const durations = group.map((event) => Math.round((event.end - event.start) / 60000)).sort((a, b) => a - b);
      period.end = period.start + Math.min(45, durations[Math.floor(durations.length / 2)] || 45);
    });
    const usable = events.filter((event) => !/^\[Odpadlo\]/i.test(event.summary || ''));
    const assignments = this.eventList(student.entities?.assignments);
    const today = dateKey(parts(now, timeZone));
    const rows = week.days.map((day, dayIndex) => {
      const dayEvents = events.filter((event) => event.day === day.key);
      let cells = '';
      for (let i = 0; i < periods.length;) {
        const period = periods[i];
        const group = dayEvents.filter((event) => period.starts.includes(event.minute));
        if (!group.length) {
          cells += '<td class="empty"></td>';
          i += 1;
          continue;
        }
        // A double lesson occupies both periods. Concurrent clubs share one cell.
        let span = 1;
        const latestEnd = Math.max(...group.map((event) => {
          const p = parts(event.end, timeZone);
          return p.hour * 60 + p.minute;
        }));
        while (i + span < periods.length && periods[i + span].start < latestEnd
          && !dayEvents.some((event) => periods[i + span].starts.includes(event.minute))) span += 1;
        const active = group.some((event) => usable.includes(event) && now >= event.start && now < event.end);
        const bySubject = new Map();
        group.forEach((event) => {
          const subject = plainText(event.summary || event.message || 'Hodina').replace(/^\[Odpadlo\]\s*/i, '');
          const cancelled = /^\[Odpadlo\]/i.test(event.summary || '');
          const key = `${subject}:${cancelled}`;
          if (!bySubject.has(key)) bySubject.set(key, { subject, cancelled, events: [] });
          bySubject.get(key).events.push(event);
        });
        const lessons = [...bySubject.values()].map(({ subject, cancelled, events: same }) => {
          const matches = assignments.filter((task) => {
            const start = eventDate(task.start);
            if (Number.isNaN(start.getTime()) || dateKey(parts(start, timeZone)) !== day.key) return false;
            return plainText(task.summary).toLocaleLowerCase('sk').includes(subject.toLocaleLowerCase('sk')) && !/^\[Splnené\]/i.test(task.summary || '');
          });
          const flags = [
            active && !cancelled ? '<span class="tag now">TERAZ</span>' : '',
            cancelled ? '<span class="tag red">ODPADLO</span>' : '',
            matches.some((task) => /\[(?:Písomka|Test|Skúšanie)\]/i.test(task.summary)) ? '<span class="tag amber">TEST</span>' : '',
            matches.some((task) => /\[DÚ\]/i.test(task.summary)) ? '<span class="tag amber">DÚ</span>' : '',
          ].join('');
          const rooms = [...new Set(same.map((event) => event.location).filter(Boolean))].join(', ');
          const tooltip = same.map((event) => `${subject}\n${fmtTime(event.start, timeZone)}–${fmtTime(event.end, timeZone)}\n${plainText(event.description || '')}`).join('\n\n');
          return `<div class="lesson ${cancelled ? 'cancelled' : ''}" title="${esc(tooltip)}"><abbr title="${esc(subject)}">${esc(subjectLabel(subject))}</abbr><small>${esc(rooms || (same.length > 1 ? `${same.length} skupiny` : ''))}</small>${flags ? `<span class="lesson-flags">${flags}</span>` : ''}</div>`;
        }).join('');
        cells += `<td colspan="${span}" class="${active ? 'active' : ''}">${lessons}</td>`;
        i += span;
      }
      return `<tr class="${day.key === today ? 'today' : ''}"><th scope="row" class="day-label ${day.key === today ? 'today' : ''}">${['Po', 'Ut', 'St', 'Št', 'Pi'][dayIndex]}<span>${day.day}. ${day.month}.</span></th>${cells}</tr>`;
    }).join('');
    return `<div class="timetable-scroll" data-scroll-key="${esc(student.key)}"><table class="timetable" aria-label="Týždenný rozvrh: ${esc(student.name)}"><colgroup><col class="day-col">${periods.map(() => '<col>').join('')}</colgroup><thead><tr><th scope="col" aria-label="Deň"></th>${periods.map((period, i) => `<th scope="col" class="period-head">${i + 1}<span>${clock(period.start)}–${clock(period.end)}</span></th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>${this._calendarErrors[id] ? `<p class="data-note error">${esc(this._calendarErrors[id])} Zobrazený je posledný načítaný rozvrh.</p>` : ''}`;
  }

  inlineRows(rows, key, limit) {
    if (rows.length <= limit) return rows.join('');
    return `${rows.slice(0, limit).join('')}<details class="all-records" data-section="${esc(key)}"><summary>Ďalšie položky (${rows.length - limit})</summary>${rows.slice(limit).join('')}</details>`;
  }

  messages(student) {
    const events = attributes(this._hass, student.entities?.notifications).events || [];
    const items = (Array.isArray(events) ? events : []).filter((item) => (
      (item.text || item.description || item.title || item.name)
      && !/(?:homework|grade|mark|test|exam)/i.test(String(item.type || item.event_type || ''))
    )).map((item, index) => ({ item, index, time: eventDate(item.timestamp || item.date).getTime() }))
      .sort((a, b) => {
        const aValid = Number.isFinite(a.time);
        const bValid = Number.isFinite(b.time);
        if (aValid !== bValid) return bValid - aValid;
        if (aValid && a.time !== b.time) return b.time - a.time;
        const aId = String(a.item.id ?? a.item.event_id ?? '');
        const bId = String(b.item.id ?? b.item.event_id ?? '');
        return aId.localeCompare(bId, undefined, { numeric: true }) || a.index - b.index;
      }).map(({ item }) => item);
    const timeZone = this._hass.config.time_zone || 'UTC';
    const rows = items.map((item) => {
      const text = plainText(item.text || item.description || item.title || item.name);
      const title = plainText(item.title);
      const author = typeof (item.author || item.from) === 'object' ? (item.author || item.from).name : item.author || item.from;
      const when = item.timestamp || item.date;
      const whenDate = eventDate(when);
      const whenLabel = !Number.isNaN(whenDate.getTime()) && dateKey(parts(whenDate, timeZone)) === dateKey(parts(new Date(), timeZone)) ? fmtTime(when, timeZone) : fmtDate(when, timeZone);
      return `<article class="message"><span class="message-dot"></span><strong class="message-author">${esc(author || 'Správa zo školy')}</strong><div class="message-text">${title && title !== text ? `<b class="message-title">${esc(title)}</b>` : ''}<p>${esc(text)}</p></div>${when ? `<time title="${esc(fmtDate(when, timeZone))} ${esc(fmtTime(when, timeZone))}">${esc(whenLabel)}</time>` : '<span></span>'}</article>`;
    });
    return this.inlineRows(rows, `${student.key}:messages`, 10) || '<div class="empty-state">Žiadne posledné správy na zobrazenie.</div>';
  }

  todos(student) {
    const id = student.entities?.todo;
    if (this._todos[id] === undefined) {
      if (this._todoErrors[id]) return `<div class="empty-state error">${esc(this._todoErrors[id])}</div>`;
      return `<div class="empty-state" role="status">${id ? '<i class="spinner"></i>Načítavam úlohy…' : 'Zoznam úloh nie je dostupný.'}</div>`;
    }
    const timeZone = this._hass.config.time_zone || 'UTC';
    const today = dateKey(parts(new Date(), timeZone));
    const items = this._todos[id].map((item) => {
      const summary = plainText(item.summary || item.title || 'Domáca úloha');
      const description = plainText(item.description);
      const subject = description.match(/(?:^|\n)Predmet:\s*(.+)/i)?.[1] || (summary.includes(':') ? summary.split(':')[0] : '');
      const due = item.due ? (String(item.due).includes('T') ? dateKey(parts(item.due, timeZone)) : String(item.due).slice(0, 10)) : '';
      return { ...item, subject, text: subject && summary.startsWith(`${subject}:`) ? summary.slice(subject.length + 1).trim() : summary, due, done: item.status === 'completed' };
    }).sort((a, b) => Number(a.done) - Number(b.done) || (a.due || '9999').localeCompare(b.due || '9999'));
    const rows = items.map((item) => {
      const overdue = !item.done && item.due && item.due < today;
      const due = item.due === today ? 'Dnes' : item.due ? fmtDate(`${item.due}T12:00:00`, timeZone) : 'Bez termínu';
      return `<article class="task ${overdue ? 'overdue' : ''} ${item.done ? 'done' : ''}"><span class="checkbox" aria-label="${item.done ? 'Splnené' : 'Nesplnené'}">${item.done ? '✓' : ''}</span><div><div class="task-main"><strong>${esc(item.subject || 'Domáca úloha')}</strong><time>${esc(due)}</time></div><div class="task-text">${esc(item.text)}</div>${overdue || item.done ? `<div class="task-status">${overdue ? 'Po termíne' : 'Splnené'}</div>` : ''}</div></article>`;
    });
    const note = this._todoErrors[id] ? `<p class="data-note error">${esc(this._todoErrors[id])} Zobrazené sú posledné načítané úlohy.</p>` : '';
    return (this.inlineRows(rows, `${student.key}:tasks`, 4) || '<div class="empty-state">Žiadne úlohy na zobrazenie.</div>') + note;
  }

  grades(student) {
    const timeZone = this._hass.config.time_zone || 'UTC';
    const items = (student.entities?.subjects || []).map(({ entity_id: id, name }) => {
      const attrs = attributes(this._hass, id);
      const grade = attrs.latest_grade ?? attrs.last_grade ?? attrs.grade;
      return grade == null || grade === '' ? null : { name, grade, date: attrs.latest_grade_date || attrs.last_grade_date || '', title: attrs.latest_grade_title || '' };
    }).filter(Boolean).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const rows = items.map((item) => {
      const numeric = Number(item.grade);
      const color = numeric > 0 && numeric <= 2 ? 'good' : numeric >= 4 ? 'bad' : numeric === 3 ? 'warning' : '';
      return `<article class="grade-row"><div><b>${esc(item.name)}</b>${item.title ? `<small>${esc(item.title)}</small>` : ''}</div><strong class="grade ${color}">${esc(item.grade)}</strong><time>${esc(fmtDate(item.date, timeZone))}</time></article>`;
    });
    return this.inlineRows(rows, `${student.key}:grades`, 4) || '<div class="empty-state">Posledné známky zatiaľ nie sú dostupné.</div>';
  }

  metric(student, key, label, glyph) {
    return `<div class="metric">${icon(glyph)}<div class="metric-content"><div class="metric-label">${esc(label)}</div><div class="metric-value">${esc(textState(this._hass, student.entities?.[key]))}</div></div></div>`;
  }

  async loadCanteen() {
    if (this._menuLoading || this._menuItems !== null) return;
    const entityId = this._students.find((item) => item.entities?.canteen)?.entities.canteen;
    if (!entityId) {
      this._menuError = 'Kalendár jedálne nie je dostupný.';
      this.render();
      return;
    }
    this._menuLoading = true;
    this._menuError = '';
    this.render();
    const timeZone = this._hass.config.time_zone || 'UTC';
    const today = parts(new Date(), timeZone);
    const end = new Date(Date.UTC(today.year, today.month - 1, today.day + 14));
    const startDate = localMidnightISO(today.year, today.month, today.day, timeZone);
    const endDate = localMidnightISO(end.getUTCFullYear(), end.getUTCMonth() + 1, end.getUTCDate(), timeZone);
    try {
      this._menuItems = await this.readRecord(`canteen:${entityId}:${dateKey(today)}`, async () => {
        const result = await this._hass.callWS({
          type: 'call_service', domain: 'calendar', service: 'get_events',
          target: { entity_id: entityId }, return_response: true,
          service_data: { start_date_time: startDate, end_date_time: endDate },
        });
        const response = result?.response || result || {};
        const items = response[entityId];
        if (!Array.isArray(items) && !Array.isArray(items?.events)) throw new Error('Home Assistant nevrátil jedálny lístok.');
        return Array.isArray(items) ? items : items.events;
      });
    } catch (error) {
      this._menuError = error?.message || 'Jedálny lístok sa nepodarilo načítať.';
    } finally {
      this._menuLoading = false;
      this.render();
    }
  }

  canteenModal() {
    if (!this._menuOpen) return '';
    let body = '';
    if (this._menuLoading) body = '<div class="empty-state" role="status"><i class="spinner"></i>Načítavam jedálny lístok…</div>';
    else if (this._menuError) body = `<div class="empty-state error" role="status">${esc(this._menuError)}</div>`;
    else {
      const timeZone = this._hass.config.time_zone || 'UTC';
      const grouped = new Map();
      for (const item of [...(this._menuItems || [])].sort((a, b) => eventDate(a.start) - eventDate(b.start))) {
        const key = dateKey(parts(item.start, timeZone));
        if (!grouped.has(key)) grouped.set(key, { date: item.start, meals: [] });
        grouped.get(key).meals.push(item);
      }
      body = grouped.size ? [...grouped.values()].map(({ date, meals }) => `<section class="menu-day"><h3>${esc(fmtDate(date, timeZone, { weekday: 'long', day: 'numeric', month: 'long' }))}</h3>${meals.map((meal) => `<div class="menu-meal"><strong>${esc(meal.summary || 'Jedlo')}</strong><span>${esc(plainText(meal.description || meal.message || ''))}</span></div>`).join('')}</section>`).join('') : '<div class="empty-state">Jedálny lístok zatiaľ nie je zverejnený.</div>';
    }
    return `<div class="menu-modal" data-action="close-menu" role="presentation"><section class="menu-dialog" role="dialog" aria-modal="true" aria-labelledby="canteen-title"><header class="menu-dialog-head"><h2 id="canteen-title">Jedálny lístok</h2><button class="icon-button" data-action="close-menu" aria-label="Zavrieť jedálny lístok">×</button></header><div class="menu-days">${body}</div></section></div>`;
  }

  attendance(student) {
    const id = student.entities?.attendance;
    const attrs = attributes(this._hass, id);
    const timeZone = this._hass.config.time_zone || 'UTC';
    const state = textState(this._hass, id, '—');
    const arrival = attrs.last_arrival ? fmtTime(attrs.last_arrival, timeZone) : '—';
    const departure = attrs.last_departure ? fmtTime(attrs.last_departure, timeZone) : '—';
    return `<div class="metric" aria-label="Dochádzka: ${esc(state)}">${icon('people')}<div class="metric-content"><div class="metric-label">Dochádzka</div><div class="metric-value">${esc(state)}</div><small class="attendance-times">Príchod ${esc(arrival)} · odchod ${esc(departure)}</small></div></div>`;
  }

  studentCard(student) {
    const timeZone = this._hass.config.time_zone || 'UTC';
    const days = schoolWeek(new Date(), timeZone).days;
    const chips = [['open_homework', 'nesplnené DÚ', 'homework'], ['upcoming_exams', 'písomky', 'exam'], ['timetable_changes', 'zmeny', 'change']].map(([key, label, kind]) => {
      const value = Number(textState(this._hass, student.entities?.[key], '0'));
      const text = key === 'upcoming_exams' ? (value === 1 ? 'písomka' : value < 5 ? 'písomky' : 'písomiek') : key === 'timetable_changes' ? (value === 1 ? 'zmena' : value < 5 ? 'zmeny' : 'zmien') : value === 1 ? 'nesplnená DÚ' : label;
      return value > 0 ? `<span class="summary-chip ${kind}"><strong>${value}</strong><span>${text}</span></span>` : '';
    }).join('');
    const sectionHead = (name, glyph, suffix = '') => `<div class="section-head"><h3>${icon(glyph)}${name}</h3>${suffix ? `<small>${suffix}</small>` : ''}</div>`;
    const className = (student.class_names || [])[0];
    const studentIds = Object.values(student.entities || {}).flatMap((value) => Array.isArray(value) ? value.map((subject) => subject.entity_id) : [value]).filter(Boolean);
    const stale = studentIds.some((id) => attributes(this._hass, id).data_stale);
    const assignmentId = student.entities?.assignments;
    const assignmentNote = this._calendarErrors[assignmentId]
      ? `<p class="data-note error" role="status">Označenia DÚ a písomiek sa nepodarilo načítať. ${esc(this._calendarErrors[assignmentId])}</p>`
      : assignmentId && this._events[assignmentId] === undefined && this._pendingCalendars.has(assignmentId)
        ? '<p class="data-note" role="status"><i class="spinner"></i>Načítavam označenia DÚ a písomiek…</p>' : '';
    return `<article class="student" aria-label="${esc(student.name)}"><header class="student-head"><div class="student-id"><h2>${esc(student.name)}</h2>${className ? `<p>${esc(className)}</p>` : ''}<div class="school-domain">${esc(student.school_domain || 'EduPage')}</div></div><div class="summary-chips">${chips}</div></header>
      ${stale ? '<div class="data-note">Niektoré údaje sú z posledného úspešného načítania.</div>' : ''}
      <section class="section timetable-section">${sectionHead('Rozvrh hodín', 'calendar', `${days[0].day}. ${days[0].month}. – ${days[4].day}. ${days[4].month}.`)}${this.schedule(student)}${assignmentNote}</section>
      <section class="section messages-section">${sectionHead('Posledné správy', 'mail')}<div class="section-body">${this.messages(student)}</div></section>
      <div class="two-panels"><section class="section tasks-section">${sectionHead('Úlohy', 'tasks')}<div class="section-body">${this.todos(student)}</div></section><section class="section grades-section">${sectionHead('Známky', 'grades')}<div class="section-body">${this.grades(student)}</div></section></div>
      <div class="extras">${this.metric(student, 'timetable_changes', 'Suplovanie / zmeny', 'swap')}${this.metric(student, 'next_ringing', 'Najbližšie zvonenie', 'clock')}${this.metric(student, 'missing_teachers', 'Chýbajúci učitelia', 'people')}${this.attendance(student)}<div class="metric">${icon('chart')}<div class="metric-content"><div class="metric-label">Priemer známok</div><div class="term-values"><strong>${esc(textState(this._hass, student.entities?.term_first))}<small>1. polrok</small></strong><strong>${esc(textState(this._hass, student.entities?.term_second))}<small>2. polrok</small></strong></div></div></div></div></article>`;
  }

  render() {
    if (!this._hass) return;
    this._timeZone = this._hass.config.time_zone;
    this._seenStates = new Map(this.relevantIds().map((id) => [id, this._hass.states[id]]));
    const focused = this.shadowRoot.activeElement;
    const focusedAction = focused?.dataset?.action;
    const focusedSection = focused?.tagName === 'SUMMARY' ? focused.parentElement.dataset.section : null;
    const scrolls = new Map([...this.shadowRoot.querySelectorAll('[data-scroll-key]')].map((element) => [element.dataset.scrollKey, element.scrollLeft]));
    const open = new Set([...this.shadowRoot.querySelectorAll('details[open]')].map((detail) => detail.dataset.section));
    const busy = this._mappingLoading || this._pendingCalendars.size > 0 || this._pendingTodos.size > 0;
    const cache = this.cache();
    const failed = this._error || Object.values(this._calendarErrors).some(Boolean) || Object.values(this._todoErrors).some(Boolean);
    const status = busy ? 'Načítavam údaje…' : failed ? 'Niektoré údaje sa nenačítali' : cache.mappingAt ? `Načítané ${fmtTime(cache.mappingAt, this._timeZone || 'UTC')}` : '';
    const content = this._students.length ? this._students.map((student) => this.studentCard(student)).join('') : `<div class="board-notice" role="status">${this._error ? esc(this._error) : this._mappingLoading ? '<i class="spinner"></i>Načítavam účty EduPage…' : 'Nie je načítaný žiadny účet EduPage. Skontrolujte integráciu v Nastaveniach → Zariadenia a služby.'}</div>`;
    this.shadowRoot.innerHTML = `<style>${STYLES}</style><header class="topbar"><div class="page-title">${this._narrow ? `<button class="icon-button" data-action="menu" aria-label="Otvoriť navigáciu Home Assistanta">${icon('menu')}</button>` : ''}<h1>Školská nástenka</h1></div><div class="top-actions"><div class="top-meta"><time>${esc(fmtDate(new Date(), this._timeZone || 'UTC', { weekday: 'long', day: 'numeric', month: 'long' }))}</time><span role="status">${esc(status)}</span></div><button class="icon-button menu-button" data-action="canteen" aria-label="Otvoriť jedálny lístok" title="Jedálny lístok">${icon('food')}<span>Jedálny lístok</span></button><button class="icon-button ${busy ? 'busy' : ''}" data-action="refresh" aria-label="Obnoviť údaje" title="Obnoviť údaje" ${busy ? 'disabled' : ''}>${icon('refresh')}</button></div></header><main class="board ${this._students.length === 1 ? 'single' : ''}">${this._error && this._students.length ? `<div class="board-notice error">${esc(this._error)}</div>` : ''}${content}</main>${this.canteenModal()}`;
    this.shadowRoot.querySelectorAll('details').forEach((detail) => {
      detail.open = open.has(detail.dataset.section);
      if (focusedSection === detail.dataset.section) detail.querySelector('summary')?.focus({ preventScroll: true });
    });
    this.shadowRoot.querySelectorAll('[data-scroll-key]').forEach((element) => { element.scrollLeft = scrolls.get(element.dataset.scrollKey) || 0; });
    if (focusedAction) this.shadowRoot.querySelector(`[data-action="${focusedAction}"]`)?.focus({ preventScroll: true });
    this.shadowRoot.querySelector('[data-action="refresh"]')?.addEventListener('click', () => this.load(true));
    this.shadowRoot.querySelector('[data-action="canteen"]')?.addEventListener('click', () => { this._menuOpen = true; this.render(); this.loadCanteen(); });
    this.shadowRoot.querySelectorAll('[data-action="close-menu"]').forEach((element) => element.addEventListener('click', (event) => {
      if (event.target === element || element.tagName === 'BUTTON') { this._menuOpen = false; this.render(); }
    }));
    this.shadowRoot.querySelector('[data-action="menu"]')?.addEventListener('click', () => this.dispatchEvent(new CustomEvent('hass-toggle-menu', { bubbles: true, composed: true })));
  }
}
if (!customElements.get('edupage-school-board-panel')) customElements.define('edupage-school-board-panel', EduPageSchoolBoardPanel);
