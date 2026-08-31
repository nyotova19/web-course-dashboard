  'use strict';

  /* ══════════════════════════════════════════
     CONFIG
  ══════════════════════════════════════════ */
  const appRoot = window.location.pathname.replace(/\/(index\.html)?$/, '').replace(/\/+$/, '');
  const Config = {
    apiBase: (appRoot === '' ? '' : appRoot) + '/api',
    tokenKey: 'wc_token',
  };

  /* ══════════════════════════════════════════
     STATE
  ══════════════════════════════════════════ */
  const State = {
    user: null,
    token: null,
    activeTab: 0,
    activeTag: { 0: [], 1: null, 2: null, 3: null, 4: null, 5: [] },
  };

  /* ══════════════════════════════════════════
     API
  ══════════════════════════════════════════ */
  const Api = {
    async _req(method, path, body) {
      const opts = {
        method,
        headers: { 'Content-Type': 'application/json' },
      };
      if (State.token) opts.headers['Authorization'] = `Bearer ${State.token}`;
      if (body !== undefined) opts.body = JSON.stringify(body);
      try {
        const res = await fetch(Config.apiBase + path, opts);
        let json = {};
        try { json = await res.json(); } catch (e) { json = {}; }
        if (!res.ok) {
          return json && json.error ? json : { error: json.message || `Request failed (${res.status})`, status: res.status };
        }
        return json;
      } catch (e) {
        return { error: e.message || 'Network error' };
      }
    },
    login:        (email, pw) => Api._req('POST', '/auth/login', { email, password: pw }),
    register:     (data)      => Api._req('POST', '/auth/register', data),
    me:           ()          => Api._req('GET',  '/auth/me'),
    myReports:    (p = {})    => Api._req('GET',  '/reports?' + new URLSearchParams(p)),
    allReports:   (p = {})    => Api._req('GET',  '/reports?' + new URLSearchParams({ scope: 'all', ...p })),
    reportTags:   ()          => Api._req('GET',  '/reports/tags'),
    createReport: (d)         => Api._req('POST', '/reports', d),
    updateReport: (id, d)     => Api._req('PUT',  `/reports/${id}`, d),
    deleteReport: (id)        => Api._req('DELETE', `/reports/${id}`),
    homework:     (p = {})    => Api._req('GET',  '/homework?' + new URLSearchParams(p)),
    submitHw:     (id, d)     => Api._req('POST', `/homework/${id}/submit`, d),
    gradeHw:      (id, userId, d) => Api._req('PUT', `/homework/${id}/grade/${userId}`, d),
    homeworkSubmissions: (id)   => Api._req('GET', `/homework/${id}/submissions`),
    sessions:     (params = {}) => Api._req('GET',  '/presentations/sessions?' + new URLSearchParams(params)),
    createSession:(d)         => Api._req('POST', '/presentations/sessions', d),
    createSlot:    (id, d)    => Api._req('POST', `/presentations/sessions/${id}/slots`, d),
    deleteSlot:    (id)       => Api._req('DELETE', `/presentations/slots/${id}`),
    deleteSession: (id)       => Api._req('DELETE', `/presentations/sessions/${id}`),
    students:     ()          => Api._req('GET',  '/users?role=student'),
    mine:         ()          => Api._req('GET',  '/presentations/mine'),
    bookSlot:     (id, d)     => Api._req('POST', `/presentations/slots/${id}/book`, d),
    cancelSlot:   (id)        => Api._req('DELETE', `/presentations/slots/${id}/cancel`),
  };

  /* ══════════════════════════════════════════
     TOAST
  ══════════════════════════════════════════ */
  const Toast = {
    show(msg, type = 'success') {
      const el = document.createElement('div');
      el.className = `toast toast-${type}`;
      el.textContent = msg;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 3500);
    },
  };

  /* ══════════════════════════════════════════
     MODAL
  ══════════════════════════════════════════ */
  const Modal = {
    _cb: null,
    open(title, html, onSubmit) {
      document.getElementById('modal-title').textContent = title;
      document.getElementById('modal-body').innerHTML = html;
      document.getElementById('modal-overlay').classList.remove('hidden');
      Modal._cb = onSubmit;
      const form = document.querySelector('#modal-body form');
      if (form) {
        form.addEventListener('submit', async e => {
          e.preventDefault();
          const submitBtn = form.querySelector('button[type="submit"]');
          if (submitBtn) submitBtn.disabled = true;
          try {
            await Modal._cb(form);
          } finally {
            if (submitBtn) submitBtn.disabled = false;
          }
        });
      }
    },
    close() {
      document.getElementById('modal-overlay').classList.add('hidden');
      document.getElementById('modal-body').innerHTML = '';
      Modal._cb = null;
    },
    init() {
      document.getElementById('modal-close').addEventListener('click', Modal.close);
      document.getElementById('modal-overlay').addEventListener('click', e => {
        if (e.target === e.currentTarget) Modal.close();
      });
    },
  };

  /* ══════════════════════════════════════════
     KEYWORD INPUT WIDGET
  ══════════════════════════════════════════ */
  function buildTagInput(wrapId, initial = []) {
    const wrap = document.getElementById(wrapId);
    let tags = [...initial];

    function render() {
      wrap.innerHTML = '';
      tags.forEach((t, i) => {
        const chip = document.createElement('span');
        chip.className = 'kw-chip';
        chip.innerHTML = `${t}<button type="button" class="kw-chip-rm" data-i="${i}">&times;</button>`;
        wrap.appendChild(chip);
      });
      const inp = document.createElement('input');
      inp.className = 'kw-input-raw';
      inp.type = 'text';
      inp.placeholder = tags.length ? '' : '#тема, Enter';
      wrap.appendChild(inp);
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ',') {
          e.preventDefault();
          addTag(inp.value);
          inp.value = '';
        } else if (e.key === 'Backspace' && !inp.value && tags.length) {
          tags.pop();
          render();
        }
      });
      inp.addEventListener('blur', () => {
        if (inp.value.trim()) { addTag(inp.value); inp.value = ''; }
      });
      wrap.addEventListener('click', e => {
        const rm = e.target.closest('.kw-chip-rm');
        if (rm) { tags.splice(+rm.dataset.i, 1); render(); }
        else wrap.querySelector('.kw-input-raw')?.focus();
      });
    }

    function addTag(raw) {
      let t = raw.trim().toLowerCase();
      if (!t) return;
      if (!t.startsWith('#')) t = '#' + t;
      if (!tags.includes(t)) { tags.push(t); render(); }
    }

    render();
    return { getValue: () => [...tags] };
  }

  /* ══════════════════════════════════════════
     HELPERS
  ══════════════════════════════════════════ */
  function statusBadge(s) {
    const map = {
      pending:     ['badge-warn',    'Чака'],
      in_progress: ['badge-info',    'В процес'],
      submitted:   ['badge-info',    'Предадено'],
      graded:      ['badge-ok',      'Оценено'],
      suggested:   ['badge-suggest', 'Предложено'],
      booked:      ['badge-warn',    'Резервирано'],
      free:        ['badge-muted',   'Свободно'],
      done:        ['badge-ok',      'Завършено'],
      upcoming:    ['badge-info',    'Предстоящо'],
      active:      ['badge-info',    'Активно'],
    };
    const [cls, label] = map[s] || ['badge-muted', s];
    return `<span class="badge ${cls}">${label}</span>`;
  }

  function fmtDate(d) {
    if (!d) return '—';
    const dt = new Date(d);
    if (isNaN(dt)) return d;
    return dt.toLocaleDateString('bg-BG', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function kwChips(kws, clickable = false) {
    if (!kws || !kws.length) return '';
    return kws.map(k =>
      clickable
        ? `<span class="kw-pill kw-pill-link" data-tag="${k}">${k}</span>`
        : `<span class="kw-pill">${k}</span>`
    ).join('');
  }

  function resList(resources) {
    if (!resources || !resources.length) return '';
    return `<ul class="res-list">${resources.map(r =>
      `<li><a href="${r}" target="_blank" rel="noopener">${r}</a></li>`
    ).join('')}</ul>`;
  }

  function renderTagFilterBar(containerId, tags, activeTag, onSelect) {
    const c = document.getElementById(containerId);
    if (!c) return;
    c.innerHTML = '';
    const allBtn = document.createElement('button');
    allBtn.className = 'tag-btn' + (activeTag === null ? ' active' : '');
    allBtn.textContent = 'Всички';
    allBtn.addEventListener('click', () => onSelect(null));
    c.appendChild(allBtn);
    tags.forEach(t => {
      const btn = document.createElement('button');
      btn.className = 'tag-btn' + (activeTag === t ? ' active' : '');
      btn.textContent = t;
      btn.addEventListener('click', () => onSelect(t));
      c.appendChild(btn);
    });
  }

  /* ══════════════════════════════════════════
     ROUTER
  ══════════════════════════════════════════ */
  const Router = {
    modules: null, // set in App.init

    switchTo(tabIndex, tagFilter = null) {
      if (State.user?.role === 'teacher' && tabIndex === 4) {
        tabIndex = 5;
      }
      document.querySelectorAll('.tab').forEach((t, i) => t.classList.toggle('active', i === tabIndex));
      document.querySelectorAll('.tab-panel').forEach((p, i) => p.classList.toggle('active', i === tabIndex));
      State.activeTab = tabIndex;
      if (tagFilter !== null) State.activeTag[tabIndex] = tagFilter;
      Router.modules[tabIndex].load();
      const hash = tagFilter ? `tab=${tabIndex}&tag=${encodeURIComponent(tagFilter)}` : `tab=${tabIndex}`;
      history.replaceState(null, '', '#' + hash);
    },

    init() {
      document.querySelectorAll('.tab').forEach((el, i) =>
        el.addEventListener('click', () => Router.switchTo(i))
      );
    },
  };

  /* ══════════════════════════════════════════
     TAB 0 — MY REPORTS
  ══════════════════════════════════════════ */
  const Tab0 = {
    async load() {
      document.getElementById('t0-content').innerHTML = '<div class="loading">Зареждане...</div>';
      const activeTags = State.activeTag[0]; // array

      const res = await Api.myReports();
      const allReports = res.data || [];

      // Filter client-side by selected tags (report must have AT LEAST ONE selected tag)
      const reports = activeTags.length
        ? allReports.filter(r => activeTags.some(t => (r.keywords || []).includes(t)))
        : allReports;

      // Build tag bar from all reports — multi-select toggle
      const allTags = [...new Set(allReports.flatMap(r => r.keywords || []))].sort();
      const c = document.getElementById('t0-tags');
      c.innerHTML = '';

      const allBtn = document.createElement('button');
      allBtn.className = 'tag-btn' + (activeTags.length === 0 ? ' active' : '');
      allBtn.textContent = 'Всички';
      allBtn.addEventListener('click', () => { State.activeTag[0] = []; Tab0.load(); });
      c.appendChild(allBtn);

      allTags.forEach(t => {
        const btn = document.createElement('button');
        const isActive = activeTags.includes(t);
        btn.className = 'tag-btn' + (isActive ? ' active' : '');
        btn.textContent = t;
        btn.addEventListener('click', () => {
          const current = State.activeTag[0];
          State.activeTag[0] = isActive
            ? current.filter(x => x !== t)   // deselect
            : [...current, t];                // select
          Tab0.load();
        });
        c.appendChild(btn);
      });

      Tab0.render(reports);
    },

    render(reports) {
      const c = document.getElementById('t0-content');
      if (!reports.length) {
        c.innerHTML = `<div class="empty-state"><div class="es-icon">📄</div><p>Нямате реферати. Добавете нов или предложете тема.</p></div>`;
        return;
      }
      c.innerHTML = `<table>
        <thead><tr>
          <th>Заглавие</th>
          <th>Ключови думи</th>
          <th>Срок</th>
          <th>Статус</th>
          <th>Действия</th>
        </tr></thead>
        <tbody id="t0-tbody"></tbody>
      </table>`;
      const tbody = document.getElementById('t0-tbody');
      reports.forEach(r => {
        const tr = document.createElement('tr');
        tr.className = 'report-row';
        tr.innerHTML = `
          <td><strong>${r.title}</strong>${r.notes ? `<div style="font-size:11px;color:var(--muted);margin-top:2px">${r.notes}</div>` : ''}</td>
          <td>${kwChips(r.keywords, true)}</td>
          <td style="white-space:nowrap">${fmtDate(r.deadline)}</td>
          <td>${statusBadge(r.status)}</td>
          <td>
            <div class="report-actions">
              <button class="btn-icon" title="Редактирай" data-action="edit" data-id="${r._id}">✏️</button>
              <button class="btn-icon" title="Изтрий" data-action="delete" data-id="${r._id}" data-title="${r.title}">🗑️</button>
            </div>
          </td>`;
        tbody.appendChild(tr);
      });

      // Event delegation for keyword chips and actions
      tbody.addEventListener('click', e => {
        const chip = e.target.closest('.kw-pill-link');
        if (chip) {
          const t = chip.dataset.tag;
          const current = State.activeTag[0];
          State.activeTag[0] = current.includes(t)
            ? current.filter(x => x !== t)
            : [...current, t];
          Tab0.load();
          return;
        }
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        if (btn.dataset.action === 'edit') Tab0.openEdit(btn.dataset.id, reports);
        if (btn.dataset.action === 'delete') Tab0.confirmDelete(btn.dataset.id, btn.dataset.title);
      });
    },

    openAdd(suggested = false) {
      let kwWidget;
      const html = `<form id="report-form">
        <div class="form-group">
          <label>Заглавие *</label>
          <input type="text" name="title" required placeholder="Тема на реферата">
        </div>
        <div class="form-group">
          <label>Ключови думи / хеш-тагове</label>
          <div class="kw-input-wrap" id="kw-wrap"></div>
          <div class="form-hint">Въведете тема и натиснете Enter</div>
        </div>
        <div class="form-group">
          <label>Ресурси (URL-и, всеки на нов ред)</label>
          <textarea name="resources" placeholder="https://..."></textarea>
        </div>
        ${!suggested ? `<div class="form-group">
          <label>Срок за предаване *</label>
          <input type="date" name="deadline" required>
        </div>` : ''}
        <div class="form-group">
          <label>Бележки</label>
          <textarea name="notes" placeholder="Допълнителна информация..."></textarea>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-sec" onclick="Modal.close()">Отказ</button>
          <button type="submit" class="btn btn-primary">${suggested ? 'Предложи тема' : 'Добави реферат'}</button>
        </div>
      </form>`;
      Modal.open(suggested ? 'Предложи тема' : 'Нов реферат', html, async form => {
        const data = {
          title: form.title.value.trim(),
          keywords: kwWidget.getValue(),
          resources: (form.resources?.value || '').split('\n').map(s => s.trim()).filter(Boolean),
          notes: form.notes?.value?.trim() || '',
          status: suggested ? 'suggested' : 'pending',
        };
        if (!suggested) data.deadline = form.deadline.value;
        const res = await Api.createReport(data);
        if (res.error) { Toast.show(res.error, 'error'); return; }
        Toast.show(suggested ? 'Темата е предложена!' : 'Рефератът е добавен!');
        Modal.close();
        Tab0.load();
      });
      kwWidget = buildTagInput('kw-wrap', []);
    },

    openEdit(id, reports) {
      const r = reports.find(x => x._id === id);
      if (!r) return;
      let kwWidget;
      const html = `<form id="report-form">
        <div class="form-group">
          <label>Заглавие *</label>
          <input type="text" name="title" value="${r.title.replace(/"/g, '&quot;')}" required>
        </div>
        <div class="form-group">
          <label>Ключови думи / хеш-тагове</label>
          <div class="kw-input-wrap" id="kw-wrap"></div>
        </div>
        <div class="form-group">
          <label>Ресурси (URL-и, всеки на нов ред)</label>
          <textarea name="resources">${(r.resources || []).join('\n')}</textarea>
        </div>
        <div class="form-group">
          <label>Срок за предаване</label>
          <input type="date" name="deadline" value="${r.deadline ? r.deadline.slice(0,10) : ''}">
        </div>
        <div class="form-group">
          <label>Бележки</label>
          <textarea name="notes">${r.notes || ''}</textarea>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-sec" onclick="Modal.close()">Отказ</button>
          <button type="submit" class="btn btn-primary">Запази</button>
        </div>
      </form>`;
      Modal.open('Редактирай реферат', html, async form => {
        const data = {
          title: form.title.value.trim(),
          keywords: kwWidget.getValue(),
          resources: (form.resources?.value || '').split('\n').map(s => s.trim()).filter(Boolean),
          notes: form.notes?.value?.trim() || '',
        };
        if (form.deadline?.value) data.deadline = form.deadline.value;
        const res = await Api.updateReport(id, data);
        if (res.error) { Toast.show(res.error, 'error'); return; }
        Toast.show('Рефератът е обновен!');
        Modal.close();
        Tab0.load();
      });
      kwWidget = buildTagInput('kw-wrap', r.keywords || []);
    },

    async confirmDelete(id, title) {
      if (!confirm(`Сигурни ли сте, че искате да изтриете "${title}"?`)) return;
      const res = await Api.deleteReport(id);
      if (res.error) { Toast.show(res.error, 'error'); return; }
      Toast.show('Рефератът е изтрит.');
      Tab0.load();
    },
  };

  /* ══════════════════════════════════════════
     TAB 1 — ALL REPORTS
  ══════════════════════════════════════════ */
  const Tab1 = {
    async load() {
      document.getElementById('t1-content').innerHTML = '<div class="loading">Зареждане...</div>';
      const tag = State.activeTag[1];
      const params = {};
      if (tag) params.tag = tag;

      const [res, tagsRes] = await Promise.all([Api.allReports(params), Api.reportTags()]);
      const reports = res.data || [];
      const allTags = Array.isArray(tagsRes) ? tagsRes.sort() : [];

      renderTagFilterBar('t1-tags', allTags, tag, t => {
        State.activeTag[1] = t;
        Tab1.load();
      });

      Tab1.render(reports, tag);
    },

    render(reports, activeTag) {
      const c = document.getElementById('t1-content');
      if (!reports.length) {
        c.innerHTML = `<div class="empty-state"><div class="es-icon">📚</div><p>${activeTag ? `Няма реферати с таг ${activeTag}.` : 'Все още няма реферати.'}</p></div>`;
        return;
      }

      if (!activeTag) {
        // Group by tag client-side
        const grouped = {};
        reports.forEach(r => {
          (r.keywords && r.keywords.length ? r.keywords : ['#без-таг']).forEach(k => {
            if (!grouped[k]) grouped[k] = [];
            grouped[k].push(r);
          });
        });
        let html = '';
        Object.keys(grouped).sort().forEach(tag => {
          html += `<div class="section-header">${tag} <span style="font-weight:400;color:var(--muted);font-size:12px">(${grouped[tag].length})</span></div>`;
          html += Tab1.reportCards(grouped[tag]);
        });
        c.innerHTML = html;
      } else {
        c.innerHTML = Tab1.reportCards(reports);
      }
    },

    reportCards(reports) {
      return reports.map(r => `
        <div class="card" style="margin-bottom:10px">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
            <div style="flex:1;min-width:0">
              <div style="font-weight:600;font-size:14px;margin-bottom:4px">${r.title}</div>
              <div style="font-size:12px;color:var(--muted);margin-bottom:6px">
                ${r.user_name} · Срок: ${fmtDate(r.deadline)}
              </div>
              <div>${kwChips(r.keywords)}</div>
              ${r.resources && r.resources.length ? `<div style="margin-top:8px">${resList(r.resources)}</div>` : ''}
            </div>
            <div style="flex-shrink:0">${statusBadge(r.status)}</div>
          </div>
        </div>`
      ).join('');
    },

    openSuggest() {
      Tab0.openAdd(true); // reuse the same form, just navigates back to Tab0 on success
      // Override the success handler to reload Tab1 instead
    },
  };

  /* ══════════════════════════════════════════
     TAB 2 — ПРЕДСТАВЯНЕ (book slots)
  ══════════════════════════════════════════ */
  const Tab2 = {
    _sessions: [],
    _mine: [],

    async load() {
      document.getElementById('t2-sessions').innerHTML = '<div class="loading">Зареждане...</div>';
      const [sessions, mine] = await Promise.all([Api.sessions({ type: 'referat' }), Api.mine()]);
      Tab2._sessions = Array.isArray(sessions) ? sessions : [];
      Tab2._mine = Array.isArray(mine) ? mine : [];
      Tab2.renderSessions();
    },
    async deleteSlot(slotId) {
      Modal.open('Потвърждение', `<form><p>Сигурни ли сте, че искате да премахнете този слот?</p><div class="form-actions"><button type="button" class="btn btn-sec" onclick="Modal.close()">Не</button><button type="submit" class="btn btn-danger">Да, премахни</button></div></form>`, async () => {
        const res = await Api.deleteSlot(slotId);
        if (res.error) { Toast.show(res.error, 'error'); return; }
        Toast.show('Слотът е премахнат.');
        Modal.close();
        Tab2.load();
      });
    },
    async deleteSession(sessionId) {
      Modal.open('Потвърждение', `<form><p>Сигурни ли сте, че искате да премахнете цялата дата и всички свободни слотове?</p><div class="form-actions"><button type="button" class="btn btn-sec" onclick="Modal.close()">Не</button><button type="submit" class="btn btn-danger">Да, премахни дата</button></div></form>`, async () => {
        const res = await Api.deleteSession(sessionId);
        if (res.error) { Toast.show(res.error, 'error'); return; }
        Toast.show('Дата за защита премахната.');
        Modal.close();
        Tab2.load();
      });
    },

    renderSessions() {
      const c = document.getElementById('t2-sessions');
      const actions = document.querySelector('#tab-2 .toolbar-actions');
      const isTeacher = State.user?.role === 'teacher';
      const mySlotIds = new Set(Tab2._mine.map(s => s._id));
      const mySessionIds = new Set(Tab2._mine.map(s => s.session_id));

      if (actions) {
        actions.innerHTML = isTeacher ? `
          <button class="btn btn-accent btn-sm" id="add-date-btn-2">Добави дата за защита</button>
          <button class="btn btn-accent btn-sm" id="add-hour-btn-2" ${Tab2._sessions.length ? '' : 'disabled'}>Добави час за защита</button>
        ` : '';
      }

      if (!Tab2._sessions.length) {
        c.innerHTML = `<div class="empty-state"><div class="es-icon">🗓️</div><p>Няма планирани сесии.</p></div>`;
        if (isTeacher) {
          c.innerHTML += '<div style="margin-top:12px;color:var(--muted)">Използвайте "Добави дата за защита", за да създадете нова дата.</div>';
        }
      } else {
        c.innerHTML = Tab2._sessions.map(session => {
          const slots = (session.slots || []).length
              ? session.slots.map(slot => {
                  const isMySlot = mySlotIds.has(slot._id);
                  const isTaken = slot.status === 'booked' || slot.status === 'done';
                  const canBook = slot.status === 'free' && !mySessionIds.has(session._id);
                  const teacherDeleteSlot = isTeacher && slot.status === 'free';
                  return `<div class="slot-row">
                    <div class="slot-time">${slot.time || ''}</div>
                    <div class="slot-owner">
                      ${isTaken ? `<strong>${slot.user_name || '—'}</strong><span class="slot-topic"> — ${slot.topic || ''}</span>` : '<span style="color:var(--muted)">Свободно</span>'}
                    </div>
                    <div>
                      ${isMySlot
                        ? `<span class="badge badge-info">Моя</span>`
                        : isTaken
                          ? `<span class="badge badge-muted">${slot.status === 'done' ? 'Завършено' : 'Заето'}</span>`
                          : canBook
                            ? `<button class="btn btn-accent btn-sm" data-action="book" data-slot-id="${slot._id}">Резервирай</button>`
                            : `<span class="badge badge-muted">Свободно</span>`
                      }
                      ${teacherDeleteSlot ? `<button class="btn btn-danger btn-sm" data-action="delete-slot" data-slot-id="${slot._id}">Премахни слот</button>` : ''}
                    </div>
                  </div>`;
                }).join('')
              : '<div class="slot-row"><div class="slot-time"></div><div class="slot-owner" style="color:var(--muted)"><em>Предстои добавяне на часови слотове</em></div><div></div></div>';

          // determine if session has any booked slots
          const hasBookings = (session.slots || []).some(s => s.status === 'booked' || s.status === 'done');
          const canDeleteSession = isTeacher && !hasBookings;
          return `<div class="session-card">
              <div class="session-header">
                <div>
                  <div class="session-date">${fmtDate(session.date)}</div>
                  <div class="session-label">${session.label || ''} · ${session.slot_duration_min || 15} мин./слот</div>
                </div>
                <div>
                  ${canDeleteSession ? `<button class="btn btn-danger btn-sm" data-action="delete-session" data-session-id="${session._id}">Премахни дата</button>` : ''}
                </div>
              </div>
              ${slots}
            </div>`;
        }).join('');
      }

      c.onclick = e => {
        const bookBtn = e.target.closest('[data-action="book"]');
        if (bookBtn) { Tab2.openBook(bookBtn.dataset.slotId); return; }

        const delBtn = e.target.closest('[data-action="delete-slot"]');
        if (delBtn) { Tab2.deleteSlot(delBtn.dataset.slotId); return; }

        const delSess = e.target.closest('[data-action="delete-session"]');
        if (delSess) { Tab2.deleteSession(delSess.dataset.sessionId); return; }
      };

      const addDateBtn = document.getElementById('add-date-btn-2');
      const addHourBtn = document.getElementById('add-hour-btn-2');
      if (addDateBtn) addDateBtn.addEventListener('click', Tab2.openAddDate);
      if (addHourBtn) addHourBtn.addEventListener('click', Tab2.openAddHour);
    },

    openAddDate() {
      const html = `<form id="add-date-form">
        <div class="form-group">
          <label>Име на защита</label>
          <input type="text" name="label" placeholder="Име на датата (например: Семестриална защита)" required>
        </div>
        <div class="form-group">
          <label>Дата на защита</label>
          <input type="date" name="date" required>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-sec" onclick="Modal.close()">Отказ</button>
          <button type="submit" class="btn btn-accent">Добави</button>
        </div>
      </form>`;
      Modal.open('Добави дата за защита', html, async form => {
        const date = form.date.value;
        const label = form.label.value.trim();
        if (!date) { Toast.show('Моля изберете дата.', 'error'); return; }
        const res = await Api.createSession({
          date,
          type: 'referat',
          label: label || 'Представяне на реферат',
          slot_duration_min: 15,
          slot_count: 0,
          start_time: '09:00',
        });
        if (res.error) { Toast.show(res.error, 'error'); return; }
        Toast.show('Дата за защита добавена.');
        Modal.close();
        Tab2.load();
      });
    },

    openAddHour() {
      const options = Tab2._sessions.map(session => `
        <option value="${session._id}">${fmtDate(session.date)} — ${session.label || ''}</option>
      `).join('');
      const html = `<form id="add-hour-form">
        <div class="form-group">
          <label>Дата на защита</label>
          <select name="session_id" required>${options}</select>
        </div>
        <div class="form-group">
          <label>Час</label>
          <input type="time" name="time" required>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-sec" onclick="Modal.close()">Отказ</button>
          <button type="submit" class="btn btn-accent">Добави</button>
        </div>
      </form>`;
      Modal.open('Добави час за защита', html, async form => {
        const sessionId = form.session_id.value;
        const time = form.time.value;
        if (!sessionId || !time) { Toast.show('Моля попълнете всички полета.', 'error'); return; }
        const res = await Api.createSlot(sessionId, { time });
        if (res.error) { Toast.show(res.error, 'error'); return; }
        Toast.show('Часът е добавен.');
        Modal.close();
        Tab2.load();
      });
    },

    async openBook(slotId) {
      if (State.user?.role === 'teacher') { Toast.show('Нямате нужните права да резервирате слотове', 'error'); return; }
      // Check for existing referat booking
      const existingBookings = await Api.mine();
      const hasExistingReferat = existingBookings.some(booking => {
        const session = Tab2._sessions.find(s => s._id === booking.session_id);
        return session && (session.type === 'referat' || !session.type);
      });

      if (hasExistingReferat) {
        Toast.show('Вече имате запазен час за представяне на реферат', 'error');
        return;
      }

      const html = `<form id="book-form">
        <div class="form-group">
          <label>Тема на представянето *</label>
          <input type="text" name="topic" required placeholder="Тема на реферата, проекта...">
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-sec" onclick="Modal.close()">Отказ</button>
          <button type="submit" class="btn btn-accent">Резервирай слот</button>
        </div>
      </form>`;
      Modal.open('Резервирай слот', html, async form => {
        const res = await Api.bookSlot(slotId, { topic: form.topic.value.trim() });
        if (res.error) { Toast.show(res.error, 'error'); return; }
        Toast.show('Слотът е резервиран!');
        Modal.close();
        Tab2.load();
      });
    },
  };

  /* ══════════════════════════════════════════
     TAB 3 — Представяне на проект (project sessions)
  ══════════════════════════════════════════ */
  const Tab3 = {
    _sessions: [],

    async load() {
      document.getElementById('t3-sessions').innerHTML = '<div class="loading">Зареждане...</div>';
      const sessions = await Api.sessions({ type: 'project' });
      Tab3._sessions = Array.isArray(sessions) ? sessions : [];
      Tab3.renderSessions();
    },

    renderSessions() {
      const c = document.getElementById('t3-sessions');
      const actions = document.querySelector('#tab-3 .toolbar-actions');
      const isTeacher = State.user?.role === 'teacher';
      if (actions) {
        actions.innerHTML = isTeacher ? `
          <button class="btn btn-accent btn-sm" id="add-date-btn-3">Добави дата за защита</button>
          <button class="btn btn-accent btn-sm" id="add-hour-btn-3" ${Tab3._sessions.length ? '' : 'disabled'}>Добави час за защита</button>
        ` : '';
      }

      if (!Tab3._sessions.length) {
        c.innerHTML = `<div class="empty-state"><div class="es-icon">🗓️</div><p>Няма налични дати за представяне на проект.</p></div>`;
        if (isTeacher) {
          c.innerHTML += '<div style="margin-top:12px;color:var(--muted)">Използвайте "Добави дата за защита", за да създадете нова дата.</div>';
        }
      } else {
        c.innerHTML = Tab3._sessions.map(session => {
          const slots = (session.slots || []).length
            ? session.slots.map(slot => {
                const isMySlot = slot.user_id === State.user._id || (Array.isArray(slot.team_member_ids) && slot.team_member_ids.includes(State.user._id));
                const isTaken = slot.status === 'booked' || slot.status === 'done';
                const canBook = slot.status === 'free';
                const teacherDeleteSlot = isTeacher && slot.status === 'free';
                return `<div class="slot-row">
                  <div class="slot-time">${slot.time || ''}</div>
                  <div class="slot-owner">
                    ${isTaken
                      ? `<strong>${slot.user_name || '—'}</strong><span class="slot-topic">${slot.team_member_names?.length ? ` — ${slot.team_member_names.join(', ')}` : ` — ${slot.topic || ''}`}</span>`
                      : '<span style="color:var(--muted)">Свободно</span>'}
                  </div>
                  <div>
                    ${isMySlot
                      ? `<span class="badge badge-info">Моя</span>`
                      : isTaken
                        ? `<span class="badge badge-muted">${slot.status === 'done' ? 'Завършено' : 'Заето'}</span>`
                        : canBook
                          ? `<button class="btn btn-accent btn-sm" data-action="book" data-slot-id="${slot._id}">Резервирай</button>`
                          : `<span class="badge badge-muted">Свободно</span>`
                    }
                    ${teacherDeleteSlot ? `<button class="btn btn-danger btn-sm" data-action="delete-slot" data-slot-id="${slot._id}">Премахни слот</button>` : ''}
                  </div>
                </div>`;
              }).join('')
            : '<div class="slot-row"><div class="slot-time"></div><div class="slot-owner" style="color:var(--muted)"><em>Предстои добавяне на часови слотове</em></div><div></div></div>';

          const hasBookings = (session.slots || []).some(s => s.status === 'booked' || s.status === 'done');
          const canDeleteSession = isTeacher && !hasBookings;
          return `<div class="session-card">
            <div class="session-header">
              <div>
                <div class="session-date">${fmtDate(session.date)}</div>
                <div class="session-label">${session.label || ''} · ${session.slot_duration_min || 15} мин./слот</div>
              </div>
              <div>
                ${canDeleteSession ? `<button class="btn btn-danger btn-sm" data-action="delete-session" data-session-id="${session._id}">Премахни дата</button>` : ''}
              </div>
            </div>
            ${slots}
          </div>`;
        }).join('');
      }

      c.onclick = async e => {
        const bookBtn = e.target.closest('[data-action="book"]');
        if (bookBtn) { await Tab3.openBook(bookBtn.dataset.slotId); return; }

        const delBtn = e.target.closest('[data-action="delete-slot"]');
        if (delBtn) { Tab3.deleteSlot(delBtn.dataset.slotId); return; }

        const delSess = e.target.closest('[data-action="delete-session"]');
        if (delSess) { Tab3.deleteSession(delSess.dataset.sessionId); return; }
      };

      const addDateBtn = document.getElementById('add-date-btn-3');
      const addHourBtn = document.getElementById('add-hour-btn-3');
      if (addDateBtn) addDateBtn.addEventListener('click', Tab3.openAddDate);
      if (addHourBtn) addHourBtn.addEventListener('click', Tab3.openAddHour);
    },

    openAddDate() {
      const html = `<form id="add-date-form">
        <div class="form-group">
          <label>Име на защита</label>
          <input type="text" name="label" placeholder="Име на датата (например: Краен срок)" required>
        </div>
        <div class="form-group">
          <label>Дата на защита</label>
          <input type="date" name="date" required>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-sec" onclick="Modal.close()">Отказ</button>
          <button type="submit" class="btn btn-accent">Добави</button>
        </div>
      </form>`;
      Modal.open('Добави дата за защита', html, async form => {
        const date = form.date.value;
        const label = form.label.value.trim();
        if (!date) { Toast.show('Моля изберете дата.', 'error'); return; }
        const res = await Api.createSession({
          date,
          type: 'project',
          label: label || 'Представяне на проект',
          slot_duration_min: 15,
          slot_count: 0,
          start_time: '09:00',
        });
        if (res.error) { Toast.show(res.error, 'error'); return; }
        Toast.show('Дата за защита добавена.');
        Modal.close();
        Tab3.load();
      });
    },

    openAddHour() {
      const options = Tab3._sessions.map(session => `
        <option value="${session._id}">${fmtDate(session.date)} — ${session.label || ''}</option>
      `).join('');
      const html = `<form id="add-hour-form">
        <div class="form-group">
          <label>Дата на защита</label>
          <select name="session_id" required>${options}</select>
        </div>
        <div class="form-group">
          <label>Час</label>
          <input type="time" name="time" required>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-sec" onclick="Modal.close()">Отказ</button>
          <button type="submit" class="btn btn-accent">Добави</button>
        </div>
      </form>`;
      Modal.open('Добави час за защита', html, async form => {
        const sessionId = form.session_id.value;
        const time = form.time.value;
        if (!sessionId || !time) { Toast.show('Моля попълнете всички полета.', 'error'); return; }
        const res = await Api.createSlot(sessionId, { time });
        if (res.error) { Toast.show(res.error, 'error'); return; }
        Toast.show('Часът е добавен.');
        Modal.close();
        Tab3.load();
      });
    },

    async openBook(slotId) {
      if (State.user?.role === 'teacher') { Toast.show('Нямате нужните права да резервирате слотове', 'error'); return; }
      // Check for existing project booking
      const existingBookings = await Api.mine();
      const hasExistingProject = existingBookings.some(booking => {
        const session = Tab3._sessions.find(s => s._id === booking.session_id);
        return session && session.type === 'project';
      });

      if (hasExistingProject) {
        Toast.show('Вече имате запазен час за представяне на проект', 'error');
        return;
      }

      const students = await Api.students();
      const studentList = Array.isArray(students) ? students : [];
      let selectedMembers = [State.user]; // Auto-select current user

      const html = `<form id="book-form">
        <div class="form-group">
          <label>Добавяне на членове на екипа (до 3)</label>
          <input type="text" id="team-search" placeholder="Търсене на студент по име...">
          <div id="team-suggestions" class="autocomplete-suggestions"></div>
          <div id="team-selected" class="selected-chips"></div>
          <div class="form-hint">Вие сте автоматично избрани. Добавете до 2 допълнителни студента.</div>
        </div>
        <div class="form-group">
          <label>Тема на представянето *</label>
          <input type="text" name="topic" required placeholder="Тема на реферата, проекта...">
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-sec" onclick="Modal.close()">Отказ</button>
          <button type="submit" class="btn btn-accent">Резервирай слот</button>
        </div>
      </form>`;

      Modal.open('Резервирай слот', html, async form => {
        const topic = form.topic.value.trim();
        if (!topic) {
          Toast.show('Тема на представянето е задължителна.', 'error');
          return;
        }

        const res = await Api.bookSlot(slotId, {
          topic,
          team_member_ids: selectedMembers.map(m => m._id),
        });

        if (res.error) {
          Toast.show(res.error, 'error');
          return;
        }

        Toast.show('Слотът е резервиран!');
        Modal.close();
        Tab3.load();
      });

      const teamSearch = document.getElementById('team-search');
      const suggestions = document.getElementById('team-suggestions');
      const selectedContainer = document.getElementById('team-selected');

      const renderSelected = () => {
        selectedContainer.innerHTML = selectedMembers.map(member => {
          const isCurrentUser = member._id === State.user._id;
          return `
            <span class="autocomplete-chip" data-id="${member._id}">
              ${member.name}${isCurrentUser ? ' (ти)' : ''}
              ${!isCurrentUser ? `<button type="button" class="chip-remove" data-id="${member._id}">&times;</button>` : '<span style="opacity:0;width:14px;"></span>'}
            </span>
          `;
        }).join('');
      };

      const renderSuggestions = () => {
        const query = teamSearch.value.trim().toLowerCase();
        const filtered = studentList
          .filter(s => !selectedMembers.some(m => m._id === s._id))
          .filter(s => !query || s.name.toLowerCase().includes(query));

        if (!filtered.length) {
          suggestions.innerHTML = query
            ? '<div class="autocomplete-empty">Няма съвпадения</div>'
            : '<div class="autocomplete-empty">Няма налични други студенти за добавяне.</div>';
          return;
        }

        suggestions.innerHTML = filtered.slice(0, 5).map(s => `
          <div class="autocomplete-item" data-id="${s._id}">${s.name}</div>
        `).join('');
      };

      const addMember = (id) => {
        if (selectedMembers.length >= 3) {
          Toast.show('Можете да добавите максимум 2 допълнителни студента.', 'error');
          return;
        }
        const student = studentList.find(s => s._id === id);
        if (!student || selectedMembers.some(m => m._id === id)) return;
        selectedMembers.push(student);
        renderSelected();
        teamSearch.value = '';
        renderSuggestions();
      };

      teamSearch.addEventListener('input', renderSuggestions);
      teamSearch.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const first = suggestions.querySelector('.autocomplete-item');
          if (first) addMember(first.dataset.id);
        }
      });

      suggestions.addEventListener('click', (e) => {
        const item = e.target.closest('.autocomplete-item');
        if (!item) return;
        addMember(item.dataset.id);
      });

      selectedContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.chip-remove');
        if (!btn) return;
        const id = btn.dataset.id;
        if (id === State.user._id) return; // Prevent removing current user
        selectedMembers = selectedMembers.filter(m => m._id !== id);
        renderSelected();
        renderSuggestions();
      });

      renderSelected();
      renderSuggestions();
    },
    async deleteSlot(slotId) {
      const html = `<form id="del-slot-form"><div style="background: var(--danger); color: #fff; border-radius: 16px; padding: 22px;"><p style="font-size:15px;font-weight:700;margin-bottom:20px;">Сигурни ли сте, че искате да премахнете този слот?</p><div class="form-actions"><button type="button" class="btn btn-sec" id="del-no">Не, откажи</button><button type="submit" class="btn btn-danger">Да, премахни</button></div></div></form>`;
      Modal.open('Потвърждение', html, async () => {
        const res = await Api.deleteSlot(slotId);
        if (res.error) { Toast.show(res.error, 'error'); return; }
        Toast.show('Слотът е премахнат.');
        Modal.close();
        Tab3.load();
      });
      setTimeout(() => { const btn = document.getElementById('del-no'); if (btn) btn.addEventListener('click', () => Modal.close()); }, 50);
    },
    async deleteSession(sessionId) {
      const html = `<form id="del-session-form"><div style="background: var(--danger); color: #fff; border-radius: 16px; padding: 22px;"><p style="font-size:15px;font-weight:700;margin-bottom:20px;">Сигурни ли сте, че искате да премахнете цялата дата и всички свободни слотове?</p><div class="form-actions"><button type="button" class="btn btn-sec" id="del-no2">Не, откажи</button><button type="submit" class="btn btn-danger">Да, премахни дата</button></div></div></form>`;
      Modal.open('Потвърждение', html, async () => {
        const res = await Api.deleteSession(sessionId);
        if (res.error) { Toast.show(res.error, 'error'); return; }
        Toast.show('Дата за защита премахната.');
        Modal.close();
        Tab3.load();
      });
      setTimeout(() => { const btn = document.getElementById('del-no2'); if (btn) btn.addEventListener('click', () => Modal.close()); }, 50);
    },
  };

  /* ══════════════════════════════════════════
     TAB 4 — Запазени дати (my bookings & results)
  ══════════════════════════════════════════ */
  const Tab4 = {
    _sessions: [],
    _mine: [],

    async load() {
      document.getElementById('t4-mine').innerHTML = '<div class="loading">Зареждане...</div>';
      const [sessions, mine] = await Promise.all([Api.sessions(), Api.mine()]);
      Tab4._sessions = Array.isArray(sessions) ? sessions : [];
      Tab4._mine = Array.isArray(mine) ? mine : [];
      Tab4.render();
    },

    render() {
      const c = document.getElementById('t4-mine');
      if (!Tab4._mine.length) {
        c.innerHTML = `<div class="empty-state"><div class="es-icon">🎓</div><p>Нямате резервирани слотове за защита. 
        Резервирайте от таб "Представяне на реферат" или "Представяне на проект".</p></div>`;
        return;
      }
      
      const sessionMap = Object.fromEntries(Tab4._sessions.map(s => [s._id, s]));
      
      // Group bookings by session type
      const referatBookings = Tab4._mine.filter(slot => {
        const sess = sessionMap[slot.session_id] || {};
        return sess.type === 'referat' || !sess.type;
      });
      
      const projectBookings = Tab4._mine.filter(slot => {
        const sess = sessionMap[slot.session_id] || {};
        return sess.type === 'project';
      });
      
      const renderBookings = (bookings, title) => {
        if (!bookings.length) return '';
        
        return `<div style="margin-bottom:32px">
          <h2 style="color:var(--primary);font-size:18px;margin-bottom:16px">${title}</h2>
          ${bookings.map(slot => {
            const sess = sessionMap[slot.session_id] || {};
            return `<div class="booking-card" style="margin-bottom:14px">
              <h3>Резервация за защита</h3>
              <div class="booking-detail">Дата: <strong>${fmtDate(sess.date)}</strong></div>
              <div class="booking-detail">Час: <strong>${slot.time || '—'}</strong></div>
              <div class="booking-detail">Тема: <strong>${slot.topic || '—'}</strong></div>
              ${slot.team_member_names?.length ? `<div class="booking-detail">Екип: <strong>${slot.team_member_names.join(', ')}</strong></div>` : ''}
              <div class="booking-detail">Сесия: <strong>${sess.label || '—'}</strong></div>
              <div class="booking-detail">Статус: ${statusBadge(slot.status)}</div>
              ${slot.notes ? `<div class="booking-detail">Бележка от преподавател: <em>${slot.notes}</em></div>` : ''}
              ${slot.status === 'booked' ? `<button class="btn btn-danger btn-sm" style="margin-top:12px" data-action="cancel" data-slot-id="${slot._id}">Откажи резервацията</button>` : ''}
            </div>`;
          }).join('')}
        </div>`;
      };
      
      c.innerHTML = renderBookings(referatBookings, 'Резервации за защита на реферат') +
                    renderBookings(projectBookings, 'Резервации за защита на проект');

      c.addEventListener('click', async e => {
        const btn = e.target.closest('[data-action="cancel"]');
        if (!btn) return;
        const slotId = btn.dataset.slotId;
        const html = `<form id="cancel-form">
          <div style="background: var(--danger); color: #fff; border-radius: 16px; padding: 22px;">
            <p style="font-size: 15px; font-weight: 700; margin-bottom: 20px;">Сигурни ли сте, че искате да откажете резервацията?</p>
            <div class="form-actions">
              <button type="button" class="btn btn-sec" id="cancel-no">Не, прекрати</button>
              <button type="submit" class="btn btn-danger">Да, продължи</button>
            </div>
          </div>
        </form>`;

        Modal.open('Отказ на резервация', html, async form => {
          const res = await Api.cancelSlot(slotId);
          if (res.error) { Toast.show(res.error, 'error'); return; }
          Toast.show('Резервацията е отказана.');
          Modal.close();
          Tab4.load();
        });

        const noBtn = document.getElementById('cancel-no');
        if (noBtn) {
          noBtn.addEventListener('click', () => Modal.close());
        }
      });
    },
  };

  /* ══════════════════════════════════════════
     TAB 5 — HOMEWORK
  ══════════════════════════════════════════ */
  const Tab5 = {
    async load() {
      document.getElementById('t5-content').innerHTML = '<div class="loading">Зареждане...</div>';

      // Always fetch all homework for the tag bar, filter client-side
      const allRes = await Api.homework();
      const allItems = Array.isArray(allRes) ? allRes : (allRes.data || []);
      const isTeacher = State.user?.role === 'teacher';
      const activeTags = State.activeTag[5];
      const items = activeTags.length
        ? allItems.filter(h => activeTags.some(t => (h.tags || []).includes(t)))
        : allItems;

      if (isTeacher && allItems.length) {
        const submissionsByHw = await Promise.all(allItems.map(async h => {
          const res = await Api.homeworkSubmissions(h._id);
          return [h._id, Array.isArray(res) ? res : []];
        }));
        Tab5._submissions = Object.fromEntries(submissionsByHw);
      } else {
        Tab5._submissions = {};
      }

      // Build multi-select tag bar from ALL homework
      const allTags = [...new Set(allItems.flatMap(h => h.tags || []))].sort();
      const tc = document.getElementById('t5-tags');
      tc.innerHTML = '';

      const allBtn = document.createElement('button');
      allBtn.className = 'tag-btn' + (activeTags.length === 0 ? ' active' : '');
      allBtn.textContent = 'Всички';
      allBtn.addEventListener('click', () => { State.activeTag[5] = []; Tab5.load(); });
      tc.appendChild(allBtn);

      allTags.forEach(t => {
        const btn = document.createElement('button');
        const isActive = activeTags.includes(t);
        btn.className = 'tag-btn' + (isActive ? ' active' : '');
        btn.textContent = t;
        btn.addEventListener('click', () => {
          const current = State.activeTag[5];
          State.activeTag[5] = isActive ? current.filter(x => x !== t) : [...current, t];
          Tab5.load();
        });
        tc.appendChild(btn);
      });

      Tab5.render(items);
    },

    render(items) {
      const c = document.getElementById('t5-content');
      if (!items.length) {
        c.innerHTML = `<div class="empty-state"><div class="es-icon">📝</div><p>Няма домашни задачи.</p></div>`;
        return;
      }

      const isTeacher = State.user?.role === 'teacher';
      const now = new Date();
      const week = new Date(now.getTime() + 7 * 86400000);

      const groups = {
        overdue:   { label: 'Просрочени',    items: [], cls: 'danger'  },
        thisweek:  { label: 'Тази седмица',  items: [], cls: 'warn'    },
        upcoming:  { label: 'Предстоящи',    items: [], cls: 'info'    },
        submitted: { label: 'Предадени',     items: [], cls: 'ok'      },
      };

      items.forEach(h => {
        if (!isTeacher) {
          const sub = h.my_submission;
          if (sub && (sub.status === 'submitted' || sub.status === 'graded')) {
            groups.submitted.items.push(h);
            return;
          }
        }

        const dl = h.deadline ? new Date(h.deadline) : null;
        if (!dl) { groups.upcoming.items.push(h); return; }
        if (dl < now)   groups.overdue.items.push(h);
        else if (dl < week) groups.thisweek.items.push(h);
        else                groups.upcoming.items.push(h);
      });

      let html = '';
      Object.entries(groups).forEach(([key, g]) => {
        if (!g.items.length) return;
        html += `<div class="section-header">${g.label} <span style="font-weight:400;color:var(--muted);font-size:12px">(${g.items.length})</span></div>`;
        g.items.forEach(h => {
          const sub = h.my_submission;
          const tags = (h.tags || []).map(t =>
            `<span class="kw-pill kw-pill-link" data-tag="${t}" data-goto-tab1="1">${t}</span>`
          ).join('');

          const submissions = isTeacher ? (Tab5._submissions[h._id] || []) : [];
          let rightHtml = '';
          if (isTeacher) {
            rightHtml = `<span class="badge badge-info">${submissions.length} предадени</span>`;
          } else if (sub && sub.status === 'graded') {
            rightHtml = `<span class="badge badge-ok">${sub.points ?? '?'} / ${h.max_points} т.</span>`;
          } else if (sub) {
            rightHtml = `<span class="badge badge-info">Предадено</span>`;
          } else {
            rightHtml = `<button class="btn btn-primary btn-sm" data-action="submit" data-hw-id="${h._id}">Предай</button>`;
          }
          const submissionHtml = isTeacher
            ? `<div class="teacher-submissions">
                <div class="teacher-submissions-title">Предадени от студенти (${submissions.length})</div>
                ${submissions.length ? submissions.map(s => `
                  <div class="teacher-submission-row">
                    <div><strong>${s.user_name || 'Студент'}</strong> ${s.points !== null && s.points !== undefined ? `<span class="badge badge-ok">${s.points} / 10</span>` : ''}</div>
                    <div>Предадено: <strong>${fmtDate(s.submitted_at)}</strong></div>
                    <div>Линк: ${s.link ? `<a href="${s.link}" target="_blank" rel="noopener">${s.link}</a>` : '<span style="color:var(--muted)">Няма</span>'}</div>
                    <div class="teacher-grade-row">
                      <label>Оценка: <input type="number" min="0" max="10" step="1" value="${s.points !== null && s.points !== undefined ? s.points : ''}" data-input-hw-id="${h._id}" data-input-user-id="${s.user_id}" class="grade-input"></label>
                      <button type="button" class="btn btn-accent btn-sm" data-action="grade" data-hw-id="${h._id}" data-user-id="${s.user_id}">Оцени</button>
                    </div>
                  </div>`).join('') : '<div class="teacher-no-submissions">Все още няма предадени домашни.</div>'}
              </div>`
            : '';

          const indicatorCls = {
            overdue: 'hw-indicator-danger',
            thisweek: 'hw-indicator-warn',
            upcoming: 'hw-indicator-muted',
            submitted: 'hw-indicator-ok',
          }[key];

          html += `<div class="hw-item">
            <div class="hw-indicator ${indicatorCls}"></div>
            <div class="hw-body">
              <div class="hw-title">ДЗ #${h.number || '?'} — ${h.title}</div>
              <div class="hw-meta">Срок: <strong>${fmtDate(h.deadline)}</strong> · max <strong>${h.max_points}</strong> т.</div>
              ${h.description ? `<div style="font-size:12px;color:#555;margin-bottom:4px">${h.description}</div>` : ''}
              <div class="hw-tags">${tags}</div>
              ${submissionHtml}
            </div>
            <div class="hw-right">${rightHtml}</div>
          </div>`;
        });
      });

      c.innerHTML = html;

      // Event delegation
      c.onclick = e => {
        const chip = e.target.closest('[data-goto-tab1]');
        if (chip) {
          Router.switchTo(1, chip.dataset.tag);
          return;
        }
        const submitBtn = e.target.closest('[data-action="submit"]');
        if (submitBtn) { Tab5.openSubmit(submitBtn.dataset.hwId, items); return; }
        const gradeBtn = e.target.closest('[data-action="grade"]');
        if (gradeBtn) {
          const hwId = gradeBtn.dataset.hwId;
          const userId = gradeBtn.dataset.userId;
          const input = c.querySelector(`input.grade-input[data-input-hw-id="${hwId}"][data-input-user-id="${userId}"]`);
          const points = input ? parseInt(input.value, 10) : NaN;
          if (isNaN(points) || points < 0 || points > 10) {
            Toast.show('Въведете стойност между 0 и 10.', 'error');
            return;
          }
          Tab5.gradeSubmission(hwId, userId, points);
        }
      };
    },

    async gradeSubmission(hwId, userId, points) {
      const res = await Api.gradeHw(hwId, userId, { points });
      if (res.error) { Toast.show(res.error, 'error'); return; }
      Toast.show('Оценката е запазена.');
      Tab5.load();
    },

    openSubmit(hwId, items) {
      const hw = items.find(h => h._id === hwId);
      const html = `<form id="submit-form">
        <div class="form-group">
          <label>ДЗ #${hw?.number} — ${hw?.title || ''}</label>
        </div>
        <div class="form-group">
          <label>Съдържание *</label>
          <textarea name="content" required placeholder="Описание на решението..."></textarea>
        </div>
        <div class="form-group">
          <label>Линк към решение</label>
          <input type="url" name="link" placeholder="https://github.com/...">
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-sec" onclick="Modal.close()">Отказ</button>
          <button type="submit" class="btn btn-primary">Предай домашното</button>
        </div>
      </form>`;
      Modal.open('Предай домашно', html, async form => {
        const res = await Api.submitHw(hwId, {
          content: form.content.value.trim(),
          link: form.link?.value?.trim() || '',
        });
        if (res.error) { Toast.show(res.error, 'error'); return; }
        Toast.show('Домашното е предадено!');
        Modal.close();
        Tab5.load();
      });
    },
  };

  /* ══════════════════════════════════════════
     AUTH
  ══════════════════════════════════════════ */
  const Auth = {
    init() {
      State.token = localStorage.getItem(Config.tokenKey);
      if (State.token) {
        Api.me().then(user => {
          if (user.error || !user._id) { Auth.showLogin(); return; }
          Auth.setUser(user);
          Auth.showDashboard();
        }).catch(() => Auth.showLogin());
      } else {
        Auth.showLogin();
      }
    },

    setUser(user) {
      State.user = user;
      const initials = (user.name || '?').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
      document.getElementById('user-avatar').textContent = initials;
      document.getElementById('user-name').textContent = user.name || user.email;
      document.getElementById('user-group').textContent = user.group ? `Група: ${user.group}` : '';
      const hideTab4 = State.user?.role === 'teacher';
      const tab4 = document.querySelector('.tab[data-tab="4"]');
      if (tab4) tab4.classList.toggle('hidden', hideTab4);
    },

    showLogin() {
      document.getElementById('login-screen').classList.remove('hidden');
      document.getElementById('dashboard').classList.add('hidden');
    },

    showDashboard() {
      document.getElementById('login-screen').classList.add('hidden');
      document.getElementById('dashboard').classList.remove('hidden');
      const hideTab4 = State.user?.role === 'teacher';
      const tab4 = document.querySelector('.tab[data-tab="4"]');
      if (tab4) tab4.classList.toggle('hidden', hideTab4);
      // Restore from URL hash
      const hash = new URLSearchParams(window.location.hash.slice(1));
      let t = Math.min(5, Math.max(0, parseInt(hash.get('tab') ?? '0')));
      const tag = hash.get('tag') ? decodeURIComponent(hash.get('tag')) : null;
      if (hideTab4 && t === 4) t = 5;
      Router.switchTo(t, tag);
    },

    openRegister() {
      const html = `<form id="register-form">
        <div class="form-group">
          <label>Име *</label>
          <input type="text" name="name" required placeholder="Име и фамилия">
        </div>
        <div class="form-group">
          <label>Имейл *</label>
          <input type="email" name="email" required placeholder="you@uni.bg">
        </div>
        <div class="form-group">
          <label>Парола *</label>
          <div class="pw-wrap">
            <input type="password" name="password" required placeholder="••••••••">
            <button type="button" class="pw-toggle" aria-label="Покажи паролата">👁️</button>
          </div>
        </div>
        <div class="form-group">
          <label>Роля *</label>
          <select name="role" id="register-role">
            <option value="student">Студент</option>
            <option value="teacher">Преподавател</option>
          </select>
        </div>
        <div class="form-group" id="register-group-wrap">
          <label>Група *</label>
          <input type="text" name="group" placeholder="Група 3">
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-sec" onclick="Modal.close()">Отказ</button>
          <button type="submit" class="btn btn-primary">Регистрирай се</button>
        </div>
      </form>`;

      Modal.open('Регистрация', html, async form => {
        const email = form.email.value.trim();
        const password = form.password.value;
        const name = form.name.value.trim();
        const role = form.role.value;
        const group = role === 'teacher'
          ? 'all'
          : form.group.value.trim();

        if (!name || !email || !password || !group) {
          Toast.show('Попълнете всички задължителни полета.', 'error');
          return;
        }

        const res = await Api.register({ name, email, password, role, group });
        if (res.error || !res.token) {
          Toast.show(res.error || 'Регистрацията не можа да бъде извършена.', 'error');
          return;
        }

        State.token = res.token;
        localStorage.setItem(Config.tokenKey, res.token);
        Auth.setUser(res.user || { name, email, role, group });
        Modal.close();
        Auth.showDashboard();
        Toast.show('Успешна регистрация!', 'success');
      });

      const roleSelect = document.getElementById('register-role');
      const groupInput = document.querySelector('#register-group-wrap input[name="group"]');
      const groupLabel = document.querySelector('#register-group-wrap label');
      const updateGroup = () => {
        if (roleSelect.value === 'teacher') {
          groupInput.value = 'all';
          groupInput.placeholder = 'all';
          groupInput.readOnly = true;
          groupLabel.textContent = 'Група (за преподавател = all)';
        } else {
          groupInput.value = '';
          groupInput.placeholder = 'Група 3';
          groupInput.readOnly = false;
          groupLabel.textContent = 'Група *';
        }
      };
      roleSelect.addEventListener('change', updateGroup);
      updateGroup();
    },

    logout() {
      localStorage.removeItem(Config.tokenKey);
      State.token = null;
      State.user = null;
      State.activeTag = { 0: [], 1: null, 2: null, 3: null, 4: null, 5: [] };
      Auth.showLogin();
    },
  };

  /* ══════════════════════════════════════════
     APP INIT
  ══════════════════════════════════════════ */
  const App = {
    init() {
      Modal.init();
      Router.modules = [Tab0, Tab1, Tab2, Tab3, Tab4, Tab5];
      Router.init();

      // Password toggle (delegated) — toggles nearest input in .pw-wrap
      document.addEventListener('click', (e) => {
        const btn = e.target.closest('.pw-toggle');
        if (!btn) return;
        const wrap = btn.closest('.pw-wrap');
        if (!wrap) return;
        const input = wrap.querySelector('input');
        if (!input) return;
        if (input.type === 'password') {
          input.type = 'text';
          btn.textContent = '🙈';
        } else {
          input.type = 'password';
          btn.textContent = '👁️';
        }
      });

      // Login form
      document.getElementById('login-form').addEventListener('submit', async e => {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        const pw    = document.getElementById('login-password').value;
        const errEl = document.getElementById('login-error');
        errEl.classList.add('hidden');
        try {
          const res = await Api.login(email, pw);
          if (res.error || !res.token) {
            errEl.textContent = res.error || 'Невалиден имейл или парола.';
            errEl.classList.remove('hidden');
            return;
          }
          State.token = res.token;
          localStorage.setItem(Config.tokenKey, res.token);
          Auth.setUser(res.user || { name: email });
          Auth.showDashboard();
        } catch (err) {
          Toast.show(err.message || 'Network error', 'error');
        }
      });

      document.getElementById('register-btn').addEventListener('click', Auth.openRegister);

      // Logout
      document.getElementById('logout-btn').addEventListener('click', Auth.logout);

      // Tab 0 buttons
      document.getElementById('t0-add-btn').addEventListener('click', () => Tab0.openAdd(false));
      document.getElementById('t0-suggest-btn').addEventListener('click', () => Tab0.openAdd(true));

      // Tab 1 suggest button
      document.getElementById('t1-suggest-btn').addEventListener('click', () => {
        // Open suggest modal, but after success reload Tab0 and switch to it
        let kwWidget;
        const html = `<form id="report-form">
          <div class="form-group">
            <label>Заглавие на предложената тема *</label>
            <input type="text" name="title" required placeholder="Тема...">
          </div>
          <div class="form-group">
            <label>Ключови думи / хеш-тагове</label>
            <div class="kw-input-wrap" id="kw-wrap"></div>
          </div>
          <div class="form-group">
            <label>Бележки</label>
            <textarea name="notes" placeholder="Защо предлагате тази тема?"></textarea>
          </div>
          <div class="form-actions">
            <button type="button" class="btn btn-sec" onclick="Modal.close()">Отказ</button>
            <button type="submit" class="btn btn-primary">Предложи тема</button>
          </div>
        </form>`;
        Modal.open('Предложи тема', html, async form => {
          const data = {
            title: form.title.value.trim(),
            keywords: kwWidget.getValue(),
            notes: form.notes?.value?.trim() || '',
            status: 'suggested',
          };
          const res = await Api.createReport(data);
          if (res.error) { Toast.show(res.error, 'error'); return; }
          Toast.show('Темата е предложена!');
          Modal.close();
          Tab1.load();
        });
        kwWidget = buildTagInput('kw-wrap', []);
      });

      Auth.init();
    },
  };

  document.addEventListener('DOMContentLoaded', () => App.init());
