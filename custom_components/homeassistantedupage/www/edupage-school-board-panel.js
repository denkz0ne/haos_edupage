/* EduPage's native Home Assistant sidebar panel. */
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char]));

const fmtDate = (value, options = { weekday: "short", day: "numeric", month: "short" }) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("sk-SK", options).format(date);
};
const fmtTime = (value, timeZone = undefined) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("sk-SK", { hour: "2-digit", minute: "2-digit", timeZone }).format(date);
};
const textState = (hass, id, fallback = "—") => {
  const value = id && hass.states[id]?.state;
  return value && !["unknown", "unavailable", "none"].includes(value) ? value : fallback;
};
const attributes = (hass, id) => (id && hass.states[id]?.attributes) || {};
const zonedParts = (value, timeZone) => Object.fromEntries(new Intl.DateTimeFormat("en-US", {
  timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
}).formatToParts(value).filter((part) => part.type !== "literal").map(({ type, value: partValue }) => [type, Number(partValue)]));
const dateKey = (parts) => `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
const localMidnightISO = (year, month, day, timeZone) => {
  const wall = Date.UTC(year, month - 1, day);
  const sample = new Date(wall + 12 * 60 * 60 * 1000);
  const p = zonedParts(sample, timeZone);
  const offset = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - sample.getTime();
  return new Date(wall - offset).toISOString();
};

class EduPageSchoolBoardPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._students = [];
    this._view = "board";
    this._events = {};
    this._todos = {};
    this._eventsKey = "";
    this._refreshing = false;
    this._timer = window.setInterval(() => {
      this.render();
      if (this._loaded) this.refresh().then(() => this.render());
    }, 15 * 60 * 1000);
  }

  set hass(value) {
    this._hass = value;
    if (value && !this._loaded) {
      this._loaded = true;
      this.load();
    } else if (value) this.render();
  }

  disconnectedCallback() {
    window.clearInterval(this._timer);
  }

  async load() {
    try {
      const result = await this._hass.callWS({ type: "homeassistantedupage/panel" });
      this._students = result.students || [];
      await Promise.all([this.loadCalendars(), this.loadTodos()]);
    } catch (error) {
      this._error = error?.message || "Nepodarilo sa načítať údaje EduPage.";
    }
    this.render();
  }

  async refresh() {
    try {
      const result = await this._hass.callWS({ type: "homeassistantedupage/panel" });
      this._students = result.students || [];
      await Promise.all([this.loadCalendars(), this.loadTodos()]);
    } catch (error) {
      this._error = error?.message || "Nepodarilo sa obnoviť údaje EduPage.";
    }
  }

  async loadCalendars() {
    const ids = this._students.flatMap((student) => [student.entities?.timetable, student.entities?.assignments]).filter(Boolean);
    if (!ids.length || !this._hass) return;
    const timeZone = this._hass.config.time_zone || "UTC";
    const localToday = zonedParts(new Date(), timeZone);
    const monday = new Date(Date.UTC(localToday.year, localToday.month - 1, localToday.day - ((new Date(Date.UTC(localToday.year, localToday.month - 1, localToday.day)).getUTCDay() + 6) % 7)));
    const end = new Date(monday);
    end.setUTCDate(end.getUTCDate() + 5);
    const key = `${ids.join(",")}:${dateKey({ year: monday.getUTCFullYear(), month: monday.getUTCMonth() + 1, day: monday.getUTCDate() })}`;
    if (this._eventsKey === key || this._refreshing) return;
    this._refreshing = true;
    try {
      const result = await this._hass.callWS({
        type: "call_service", domain: "calendar", service: "get_events",
        target: { entity_id: ids }, return_response: true,
        service_data: {
          start_date_time: localMidnightISO(monday.getUTCFullYear(), monday.getUTCMonth() + 1, monday.getUTCDate(), timeZone),
          end_date_time: localMidnightISO(end.getUTCFullYear(), end.getUTCMonth() + 1, end.getUTCDate(), timeZone),
        },
      });
      this._events = result?.response || result || {};
      this._eventsKey = key;
    } catch (error) {
      this._calendarError = error?.message || "Rozvrh sa nepodarilo načítať.";
    } finally {
      this._refreshing = false;
    }
  }

  async loadTodos() {
    const ids = this._students.map((student) => student.entities?.todo).filter(Boolean);
    if (!ids.length) return;
    try {
      const result = await this._hass.callWS({
        type: "call_service", domain: "todo", service: "get_items",
        target: { entity_id: ids }, return_response: true,
        service_data: { status: ["needs_action", "completed"] },
      });
      this._todos = result?.response || result || {};
    } catch (error) {
      this._todoError = error?.message || "Zoznam úloh sa nepodarilo načítať.";
    }
  }

  eventList(id) {
    const value = this._events?.[id];
    return Array.isArray(value) ? value : (value?.events || []);
  }

  schedule(student) {
    const events = this.eventList(student.entities?.timetable);
    const assignments = this.eventList(student.entities?.assignments);
    const timeZone = this._hass.config.time_zone || "UTC";
    const localToday = zonedParts(new Date(), timeZone);
    const todayUTC = new Date(Date.UTC(localToday.year, localToday.month - 1, localToday.day));
    const mondayUTC = new Date(todayUTC);
    mondayUTC.setUTCDate(mondayUTC.getUTCDate() - ((mondayUTC.getUTCDay() + 6) % 7));
    const days = Array.from({ length: 5 }, (_, i) => {
      const date = new Date(mondayUTC);
      date.setUTCDate(date.getUTCDate() + i);
      return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(), key: dateKey({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() }) };
    });
    const parsed = events.map((event) => ({ ...event, _start: new Date(event.start), _end: new Date(event.end) }))
      .filter((event) => !Number.isNaN(event._start.getTime()));
    const periods = [...new Set(this._students.flatMap((child) => this.eventList(child.entities?.timetable).map((item) => {
      const start = new Date(item.start);
      if (Number.isNaN(start.getTime())) return null;
      const parts = zonedParts(start, timeZone);
      return `${parts.hour}:${parts.minute}`;
    }).filter(Boolean)))].sort((a, b) => { const [ah, am] = a.split(":").map(Number); const [bh, bm] = b.split(":").map(Number); return ah * 60 + am - bh * 60 - bm; });
    const now = new Date();
    return `<div class="timetable"><div class="time-head">Hodina</div>${periods.map((_, i) => `<div class="period-head">${i + 1}.</div>`).join("")}
      ${days.map((day, dayIndex) => {
        return `<div class="day-label"><b>${["Po", "Ut", "St", "Št", "Pi"][dayIndex]}</b><small>${day.day}.${day.month}.</small></div>${periods.map((period) => {
          const [hour, minute] = period.split(":").map(Number);
          const event = parsed.find((item) => {
            const parts = zonedParts(item._start, timeZone);
            return dateKey(parts) === day.key && parts.hour === hour && parts.minute === minute;
          });
          if (!event) return `<div class="lesson empty"></div>`;
          const title = event.summary || event.message || "Hodina";
          const canceled = /^\[Odpadlo\]/i.test(title);
          const active = !canceled && now >= event._start && now < event._end;
          const next = !canceled && !active && event._start > now && parsed.filter((other) => other._start > now).sort((a, b) => a._start - b._start)[0] === event;
          const hasTask = assignments.some((task) => dateKey(zonedParts(new Date(task.start), timeZone)) === dateKey(zonedParts(event._start, timeZone)) && (task.summary || "").toLocaleLowerCase("sk").includes(title.replace(/^\[Odpadlo\]\s*/i, "").toLocaleLowerCase("sk")));
          const color = canceled ? "cancelled" : `subject-${(title.toLocaleLowerCase("sk").split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) % 6) + 1}`;
          return `<div class="lesson ${color} ${active ? "active" : ""}"><strong>${esc(title.replace(/^\[Odpadlo\]\s*/i, ""))}</strong><small>${fmtTime(event.start, timeZone)}${event.location ? ` · ${esc(event.location)}` : ""}</small>${canceled ? `<span class="tag red">Odpadá</span>` : next ? `<span class="tag">Najbližšia</span>` : hasTask ? `<span class="tag amber">Úloha</span>` : ""}</div>`;
        }).join("")}`;
      }).join("")}</div>`;
  }

  subjectRows(student) {
    return (student.entities?.subjects || []).map(({ entity_id: id, name }) => {
      const attrs = attributes(this._hass, id);
      const grade = attrs.latest_grade ?? attrs.last_grade ?? attrs.grade;
      if (grade === undefined || grade === null || grade === "") return "";
      return { name, grade: String(grade), date: attrs.latest_grade_date || attrs.last_grade_date || "", title: attrs.latest_grade_title || attrs.last_grade_title || "" };
    }).filter(Boolean).sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, this._view === "grades" ? 40 : 4);
  }

  messages(student) {
    const attrs = attributes(this._hass, student.entities?.notifications);
    const events = attrs.events || [];
    return events.filter((item) => {
      const kind = String(item.type || item.event_type || "").toLocaleLowerCase("sk");
      const text = item.text || item.title || item.name || item.description;
      return text && !["homework", "grade", "mark", "test", "exam"].some((word) => kind.includes(word));
    }).slice(0, 3).map((item) => `<div class="message"><span class="dot"></span><div><strong>${esc(item.title || item.text || item.name || item.description)}</strong><small>${esc(item.author || item.from || fmtDate(item.date || item.timestamp, { day: "numeric", month: "short" }))}</small></div></div>`).join("");
  }

  todos(student) {
    const id = student.entities?.todo;
    const state = this._hass.states[id];
    const response = this._todos?.[id];
    const items = Array.isArray(response) ? response : (response?.items || []);
    if (!items.length) return `<div class="empty-state">${state ? "Žiadne úlohy na zobrazenie" : "Zoznam úloh nie je dostupný"}</div>`;
    return items.filter((item) => item.status !== "completed").slice(0, this._view === "tasks" ? 100 : 3).map((item) => `<div class="task"><span class="checkbox"></span><div><strong>${esc(item.summary || item.title || "Domáca úloha")}</strong><small>${esc(item.due ? `Termín ${fmtDate(item.due, { day: "numeric", month: "short" })}` : item.description || "Bez termínu")}</small></div></div>`).join("") || `<div class="empty-state">Všetky úlohy sú hotové</div>`;
  }

  metric(student, key, title, icon, fallback = "—") {
    const value = textState(this._hass, student.entities?.[key], fallback);
    const attrs = attributes(this._hass, student.entities?.[key]);
    const detail = attrs.next_lesson || attrs.room || attrs.time || attrs.description || "";
    return `<div class="metric"><span class="metric-icon">${icon}</span><div><small>${esc(title)}</small><strong>${esc(value)}</strong>${detail ? `<small>${esc(detail)}</small>` : ""}</div></div>`;
  }

  studentCard(student) {
    const subjects = this.subjectRows(student);
    const grades = subjects.length ? subjects.map((item) => `<div class="grade-row"><span><b>${esc(item.name)}</b><small>${esc(item.title || (item.date ? fmtDate(item.date, { day: "numeric", month: "short" }) : "Posledná známka"))}</small></span><strong class="grade">${esc(item.grade)}</strong></div>`).join("") : `<div class="empty-state">Známky zatiaľ nie sú dostupné</div>`;
    const className = (student.class_names || []).join(", ") || "Trieda nezistená";
    const chips = [["open_homework", "DÚ"], ["upcoming_exams", "písomky"], ["timetable_changes", "zmeny"]].map(([key, label]) => {
      const value = Number(textState(this._hass, student.entities?.[key], "0"));
      return value > 0 ? `<span class="summary-chip">${value} ${label}</span>` : "";
    }).join("");
    return `<article class="student-card"><header class="student-head"><div class="student-id"><h2>${esc(student.name)}</h2><p>${esc(className)} <span>·</span> ${esc(student.school_domain || "EduPage")}</p><div class="summary-chips">${chips}</div></div></header>
      <section class="section timetable-section"><div class="section-title"><div><span class="eyebrow">TENTO TÝŽDEŇ</span><h3>Rozvrh hodín</h3></div><button class="text-button" data-view="school">Celý rozvrh <span>→</span></button></div>${this.schedule(student)}</section>
      <section class="section messages-section"><div class="section-title"><div><span class="eyebrow">SPRÁVY ZO ŠKOLY</span><h3>Najnovšie správy</h3></div><span class="round-icon" aria-hidden="true">↗</span></div><div class="messages">${this.messages(student) || `<div class="empty-state">Nové správy sa zobrazia tu</div>`}</div></section>
      <div class="two-panels"><section class="section"><div class="section-title"><div><span class="eyebrow">NEZABUDNÚŤ</span><h3>Domáce úlohy</h3></div><button class="text-button" data-view="tasks">Všetky <span>→</span></button></div><div class="tasks">${this.todos(student)}</div></section>
      <section class="section"><div class="section-title"><div><span class="eyebrow">HODNOTENIE</span><h3>Posledné známky</h3></div><button class="text-button" data-view="grades">Prehľad <span>→</span></button></div><div class="grades">${grades}</div></section></div>
      <div class="two-panels lower"><section class="section"><div class="section-title"><div><span class="eyebrow">ŠKOLSKÝ DEŇ</span><h3>Dôležité informácie</h3></div></div><div class="metrics">${this.metric(student, "timetable_changes", "Zmeny v rozvrhu", "↻", "Bez zmien")}${this.metric(student, "next_ringing", "Najbližšie zvonenie", "◷")}${this.metric(student, "missing_teachers", "Chýbajúci učitelia", "♧", "—")}</div></section><section class="section average-placeholder"><div class="section-title"><div><span class="eyebrow">PRIEMERY</span><h3>Hodnotenie za polrok</h3></div></div><div class="metrics">${this.metric(student, "term_first", "1. polrok")}${this.metric(student, "term_second", "2. polrok")}</div></section></div></article>`;
  }

  render() {
    if (!this._hass) return;
    const now = new Date();
    const title = { board: "Nástenka", school: "Škola", tasks: "Úlohy", grades: "Známky" }[this._view] || "Nástenka";
    const content = this._error ? `<div class="empty-state error">${esc(this._error)}</div>` : this._students.length ? this._students.map((student) => this.studentCard(student)).join("") : `<div class="empty-state">Načítavam účty EduPage…</div>`;
    this.shadowRoot.innerHTML = `<style>
      :host{display:block;min-height:100%;color:var(--primary-text-color,#253344);background:var(--primary-background-color,#f4f6fa);font-family:var(--paper-font-body1_-_font-family,Roboto,"Arial",sans-serif);--ink:#26364b;--muted:#7c8999;--line:#e9edf2;--accent:#3188d5;--panel:var(--card-background-color,#fff)}*{box-sizing:border-box}button{font:inherit;color:inherit;cursor:pointer}.shell{min-height:100vh;display:grid;grid-template-columns:218px minmax(0,1fr)}.rail{background:#263449;color:#e9f0f8;padding:25px 15px;display:flex;flex-direction:column;gap:34px}.brand{display:flex;align-items:center;gap:11px;padding:0 10px}.brand-mark{width:37px;height:37px;border-radius:12px;background:#448bd1;display:grid;place-items:center;font-size:20px}.brand strong{font-size:15px;letter-spacing:.1px}.brand small{display:block;color:#9eacbc;font-size:11px;margin-top:3px}.nav-label{font-size:10px;color:#8695a7;letter-spacing:1.3px;padding:0 12px;margin-bottom:-22px}.nav{display:grid;gap:6px}.nav button{border:0;background:transparent;text-align:left;color:#bcc8d5;border-radius:9px;padding:12px;display:flex;gap:12px;align-items:center;font-size:13px}.nav button.active{color:white;background:#344961;font-weight:600}.nav i{width:19px;text-align:center;font-style:normal;font-size:17px}.rail-foot{margin-top:auto;border-top:1px solid #405066;padding:16px 10px;color:#aebaca;font-size:11px;line-height:1.6}.main{min-width:0}.topbar{height:82px;border-bottom:1px solid var(--line);background:var(--panel);display:flex;align-items:center;justify-content:space-between;padding:0 clamp(20px,3vw,46px)}.page-title{display:flex;align-items:center;gap:12px}.page-title h1{font-size:20px;margin:0;color:var(--ink)}.page-title p{margin:4px 0 0;color:var(--muted);font-size:12px}.top-right{display:flex;align-items:center;gap:20px;color:#657386;font-size:12px}.bell{height:37px;width:37px;border:1px solid var(--line);background:transparent;border-radius:12px;font-size:17px}.content{max-width:1540px;margin:auto;padding:25px clamp(17px,3vw,46px) 50px}.welcome{display:flex;justify-content:space-between;align-items:end;margin:0 0 18px}.welcome h2{font-size:17px;color:var(--ink);margin:0 0 5px}.welcome p{font-size:12px;color:var(--muted);margin:0}.live-chip{font-size:11px;color:#33875d;background:#e7f5ed;border-radius:30px;padding:7px 11px}.cards{display:grid;grid-template-columns:repeat(${Math.min(Math.max(this._students.length, 1), 2)},minmax(0,1fr));gap:17px;align-items:start}.student-card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:19px;box-shadow:0 4px 16px rgba(33,53,77,.035);min-width:0}.student-head{display:flex;align-items:center;gap:12px;padding:0 0 18px;border-bottom:1px solid var(--line)}.avatar{width:43px;height:43px;flex:0 0 auto;background:#eaf3ff;color:#327ab8;border-radius:14px;display:grid;place-items:center;font-weight:700}.student-id{min-width:0;flex:1}.student-id h2{margin:0;color:var(--ink);font-size:16px}.student-id p{margin:5px 0 0;font-size:11px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.student-id p span{padding:0 3px}.summary-chips{display:flex;gap:5px;margin-top:7px;flex-wrap:wrap}.summary-chip{font-size:8px;color:#57728c;background:#f0f5fa;padding:4px 7px;border-radius:10px}.more{border:0;background:transparent;color:#728198;font-size:21px}.section{min-width:0}.timetable-section{padding:19px 0}.section-title{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:13px}.section-title h3{margin:4px 0 0;color:var(--ink);font-size:14px}.eyebrow{font-size:9px;letter-spacing:1.05px;color:#94a0ae;font-weight:700}.text-button{border:0;background:transparent;color:#3985c4;font-size:11px;white-space:nowrap;padding:4px}.text-button span{font-size:15px;margin-left:3px}.timetable{display:grid;grid-template-columns:42px repeat(${Math.max(this._maxPeriods() || 6, 1)},minmax(0,1fr));gap:4px;overflow:auto}.time-head,.period-head{color:#95a0ae;font-size:10px;text-align:center;padding:5px 1px}.day-label{align-self:stretch;display:flex;justify-content:center;flex-direction:column;gap:3px;color:#637286;font-size:10px;padding:4px 1px}.day-label small{font-size:9px;color:#9ba6b2}.lesson{position:relative;min-height:51px;border-radius:7px;padding:6px 5px;display:flex;flex-direction:column;gap:4px;overflow:hidden}.lesson strong{font-size:10px;line-height:1.25;white-space:normal}.lesson small{font-size:8px;color:#65778b;white-space:nowrap}.subject-1{background:#e9f2ff;color:#386ba7}.subject-2{background:#f4ecff;color:#7b59a5}.subject-3{background:#e7f6f0;color:#398169}.subject-4{background:#fff2e3;color:#a56f32}.subject-5{background:#e8f5f8;color:#3b7f8d}.subject-6{background:#fcecf0;color:#a4566d}.lesson.cancelled{background:#f3f4f6;color:#8b9299;text-decoration:line-through}.lesson.active{outline:2px solid #348cd5;outline-offset:-2px}.tag{position:absolute;right:3px;top:3px;background:#fff;color:#3c80b5;border-radius:8px;padding:2px 4px;font-size:7px;text-decoration:none}.tag.red{color:#bc6262}.tag.amber{color:#ac792b}.two-panels{display:grid;grid-template-columns:1fr 1fr;gap:16px;border-top:1px solid var(--line);padding-top:16px}.round-icon{width:27px;height:27px;border:1px solid var(--line);border-radius:50%;background:transparent;color:#75859a}.messages,.tasks,.grades{display:grid;gap:9px}.message,.task{display:flex;align-items:flex-start;gap:9px;min-width:0}.message>div,.task>div{display:grid;gap:4px;min-width:0}.message strong,.task strong{font-size:10px;line-height:1.35;font-weight:600;color:#43536a}.message small,.task small,.grade-row small{font-size:9px;color:#98a2af}.dot{width:7px;height:7px;flex:0 0 auto;border-radius:50%;background:#69a9dd;margin-top:3px}.checkbox{width:13px;height:13px;flex:0 0 auto;border:1.5px solid #c7d1dc;border-radius:4px;margin-top:1px}.lower{margin-top:16px}.grade-row{display:flex;justify-content:space-between;align-items:center;gap:8px}.grade-row span{min-width:0;display:grid;gap:3px}.grade-row b{font-size:10px;color:#526176}.grade{font-size:12px;color:#3e83be;background:#eaf3fc;padding:5px 8px;border-radius:7px}.metrics{display:grid;gap:8px}.metric{display:flex;gap:10px;align-items:center}.metric-icon{width:30px;height:30px;display:grid;place-items:center;color:#538fc2;background:#eff6fc;border-radius:9px;font-size:16px}.metric div{display:grid;gap:2px;min-width:0}.metric small{font-size:9px;color:#8c98a7}.metric strong{font-size:11px;color:#526176}.empty-state{font-size:10px;color:#98a2af;padding:8px 0}.error{color:#b44}.mobile-menu{display:none}
      @media(max-width:1120px){.shell{grid-template-columns:70px minmax(0,1fr)}.rail{padding:20px 9px}.brand{justify-content:center;padding:0}.brand-copy,.nav-label,.nav button span,.rail-foot{display:none}.nav{margin-top:0}.nav button{justify-content:center;padding:12px 5px}.nav i{font-size:19px}.cards{grid-template-columns:1fr}.student-card{max-width:none}}
      @media(max-width:650px){.shell{display:block}.rail{position:fixed;z-index:5;bottom:0;left:0;right:0;height:60px;padding:5px 10px;display:block}.brand,.nav-label{display:none}.nav{height:100%;display:flex;justify-content:space-around;align-items:center}.nav button{height:48px;min-width:52px;flex-direction:column;gap:1px;padding:4px 6px;font-size:8px}.nav button span{display:block}.nav i{font-size:16px}.topbar{height:66px;padding:0 15px}.top-right{gap:8px}.top-date{display:none}.content{padding:17px 12px 80px}.student-card{padding:14px;border-radius:13px}.two-panels{gap:10px}.section-title h3{font-size:13px}.timetable{grid-template-columns:34px repeat(${Math.max(this._maxPeriods() || 6, 1)},minmax(49px,1fr))}.lesson{min-height:48px}.lesson strong{font-size:9px}}
    </style><div class="shell"><aside class="rail"><div class="brand"><div class="brand-mark">⌂</div><div class="brand-copy"><strong>EduPage</strong><small>Školská nástenka</small></div></div><div class="nav-label">PREHĽAD</div><nav class="nav">${[["board", "⌂", "Nástenka"], ["school", "▦", "Škola"], ["tasks", "✓", "Úlohy"], ["grades", "★", "Známky"]].map(([key, icon, label]) => `<button class="${this._view === key ? "active" : ""}" data-view="${key}"><i>${icon}</i><span>${label}</span></button>`).join("")}</nav><div class="rail-foot">Údaje sa obnovujú spolu s integráciou EduPage.<br>Prehľad rodiny</div></aside><main class="main"><header class="topbar"><div class="page-title"><div><h1>${title}</h1><p>Prehľad oboch detí</p></div></div><div class="top-right"><span class="top-date">${esc(new Intl.DateTimeFormat("sk-SK", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: this._hass.config.time_zone || "UTC" }).format(now))}</span><span class="bell" role="img" aria-label="Oznámenia">♧</span></div></header><div class="content"><div class="welcome"><div><h2>Dobrý deň</h2><p>Tu je prehľad toho, čo čaká deti v škole.</p></div><span class="live-chip">● Aktuálny prehľad</span></div><div class="cards">${content}</div></div></main></div>`;
    this.shadowRoot.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => { this._view = button.dataset.view; this.render(); }));
    if (this._view !== "board") {
      const visible = this._view === "school" ? [".timetable-section", ".metrics"] : this._view === "tasks" ? [".tasks"] : [".grades"];
      this.shadowRoot.querySelectorAll(".student-card").forEach((card) => {
        card.querySelectorAll(".section").forEach((section) => {
          section.hidden = !visible.some((selector) => section.matches(selector) || section.querySelector(selector));
        });
        card.querySelectorAll(".two-panels").forEach((row) => {
          row.hidden = ![...row.querySelectorAll(".section")].some((section) => !section.hidden);
        });
      });
    }
    if (!this._eventsKey && !this._refreshing) this.loadCalendars().then(() => this.render());
  }

  _maxPeriods() {
    return Math.max(6, ...this._students.map((student) => new Set(this.eventList(student.entities?.timetable).map((event) => new Date(event.start).toTimeString().slice(0, 5))).size));
  }
}

if (!customElements.get("edupage-school-board-panel")) customElements.define("edupage-school-board-panel", EduPageSchoolBoardPanel);
