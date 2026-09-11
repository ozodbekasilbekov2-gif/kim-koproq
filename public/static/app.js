/* Kim ko'proq...? — 2AF1 guruh so'rovi (v2) */
(function () {
  const $app = document.getElementById('app');
  const LS_ME = 'kk_me';

  let META = { members: [], questions: [], categories: [] };
  let me = localStorage.getItem(LS_ME) || null;
  let answers = {}; // { [qid]: { A?: id, B?: id } }
  let qIndex = 0;

  const byId = (id) => META.members.find((m) => m.id === id);
  const img = (id) => { const m = byId(id); return m && m.photo ? `/static/members/${id}.jpg` : '/static/members/_mafia.jpg'; };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const myGroup = () => (byId(me) || {}).group;
  const otherGroup = () => (myGroup() === 'A' ? 'B' : 'A');
  const catClass = (c) => 'cat-' + String(c).split(' ')[0];

  function toast(msg) {
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
    document.body.appendChild(t); setTimeout(() => t.remove(), 2000);
  }
  function setNav() {
    document.getElementById('nav-reset').classList.toggle('hidden', !me);
    document.getElementById('nav-questions').classList.toggle('hidden', !me);
  }
  async function loadMeta() { const { data } = await axios.get('/api/meta'); META = data; }
  async function loadProgress() {
    if (!me) return;
    try { const { data } = await axios.get(`/api/progress/${me}`); answers = data.answers || {}; } catch (e) { answers = {}; }
  }
  const isAnswered = (q) => !!(answers[q.id] && answers[q.id][myGroup()]);

  function memberCard(m, opts = {}) {
    return `
      <article class="member-card ${opts.disabled ? 'is-me' : ''} ${opts.selected ? 'selected' : ''}" data-id="${m.id}">
        <img src="${img(m.id)}" alt="${esc(m.name)}" loading="lazy">
        ${m.photo ? '' : '<span class="mafia-badge">🕵️ MAFIA</span>'}
        <div class="check"><i class="fas fa-check"></i></div>
        <div class="name">${esc(m.name)}</div>
      </article>`;
  }

  // ================= PICK ME =================
  function viewPickMe() {
    setNav();
    const groups = ['A', 'B'];
    $app.innerHTML = `
      <section id="pick-me" class="fade-in">
        <div class="text-center mb-6">
          <h1 class="brand text-5xl sm:text-6xl leading-none">SEN KIMSAN?</h1>
          <p class="text-white/60 mt-2">O'zingni tanla. ${META.questions.length} ta savol — o'z guruhingdan tanlaysan, boshqa guruhdan ixtiyoriy 😈</p>
        </div>
        ${groups.map((g) => `
          <div class="group-block g-${g} mb-4">
            <div class="flex items-center gap-2 mb-3"><span class="gtag gtag-${g}">${g} GURUH</span><span class="text-white/40 text-xs">${META.members.filter((m) => m.group === g).length} kishi</span></div>
            <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-3 me-grid">
              ${META.members.filter((m) => m.group === g).map((m) => memberCard(m)).join('')}
            </div>
          </div>`).join('')}
        <div class="sticky bottom-4 mt-6 flex justify-center">
          <button id="btn-start" class="btn btn-primary text-lg shadow-2xl" disabled><i class="fas fa-play mr-2"></i>Boshlash</button>
        </div>
      </section>`;
    let picked = null;
    $app.querySelectorAll('.member-card').forEach((el) => el.addEventListener('click', () => {
      $app.querySelectorAll('.member-card').forEach((e) => e.classList.remove('selected'));
      el.classList.add('selected'); picked = el.dataset.id;
      document.getElementById('btn-start').disabled = false;
    }));
    document.getElementById('btn-start').addEventListener('click', async () => {
      if (!picked) return;
      me = picked; localStorage.setItem(LS_ME, me);
      await loadProgress();
      goFirstUnanswered();
    });
  }

  function goFirstUnanswered() {
    const i = META.questions.findIndex((q) => !isAnswered(q));
    if (i === -1) viewDone(); else { qIndex = i; viewQuestion(); }
  }

  // ================= QUESTION =================
  function viewQuestion() {
    setNav();
    if (!META.questions.length) { viewQuestions(); return; }
    if (qIndex >= META.questions.length) qIndex = META.questions.length - 1;
    const q = META.questions[qIndex];
    const total = META.questions.length;
    const mg = myGroup(), og = otherGroup();
    const cur = { ...(answers[q.id] || {}) };
    const meM = byId(me);

    const grid = (g, required) => `
      <div class="group-block g-${g} mb-4" data-group="${g}">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2"><span class="gtag gtag-${g}">${g} GURUH</span>
            <span class="text-white/50 text-xs">${required ? 'majburiy' : 'ixtiyoriy — bilmasang tashlab ket'}</span></div>
          ${!required ? `<button class="btn btn-ghost btn-sm skip-g" data-group="${g}" ${cur[g] ? '' : 'style="display:none"'}><i class="fas fa-xmark mr-1"></i>Bekor</button>` : ''}
        </div>
        <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-3 target-grid" data-group="${g}">
          ${META.members.filter((m) => m.group === g).map((m) => memberCard(m, { disabled: m.id === me, selected: cur[g] === m.id })).join('')}
        </div>
      </div>`;

    $app.innerHTML = `
      <section id="question-view" class="fade-in">
        <div class="flex items-center justify-between text-sm text-white/60 mb-2">
          <span class="flex items-center gap-2"><img src="${img(me)}" class="w-7 h-7 rounded-full object-cover" alt=""> ${esc(meM.short)} <span class="gtag gtag-${mg}">${mg}</span></span>
          <span>${qIndex + 1} / ${total}</span>
        </div>
        <div class="progress-bar mb-5"><div style="width:${(qIndex / total) * 100}%"></div></div>

        <article class="q-card p-6 sm:p-8 text-center mb-5 relative">
          <button id="btn-edit-q" class="absolute top-3 right-3 text-white/40 hover:text-white text-sm" title="Savolni tahrirlash"><i class="fas fa-pen"></i></button>
          <div class="q-emoji mb-3">${esc(q.emoji)}</div>
          <span class="pill ${catClass(q.category)} uppercase tracking-wider">${esc(q.category)}</span>
          <h2 class="q-text mt-3">${esc(q.text)}</h2>
        </article>

        ${grid(mg, true)}
        ${grid(og, false)}

        <div class="sticky bottom-4 mt-6 flex items-center justify-center gap-3">
          <button id="btn-prev" class="btn btn-ghost" ${qIndex === 0 ? 'disabled style="opacity:.3"' : ''}><i class="fas fa-arrow-left"></i></button>
          <button id="btn-next" class="btn btn-primary text-lg shadow-2xl" ${cur[mg] ? '' : 'disabled'}>
            ${qIndex === total - 1 ? '<i class="fas fa-flag-checkered mr-2"></i>Tugatish' : 'Keyingi <i class="fas fa-arrow-right ml-2"></i>'}
          </button>
        </div>
      </section>`;
    window.scrollTo({ top: 0, behavior: 'smooth' });

    $app.querySelectorAll('.target-grid').forEach((gridEl) => {
      const g = gridEl.dataset.group;
      gridEl.querySelectorAll('.member-card').forEach((el) => el.addEventListener('click', () => {
        gridEl.querySelectorAll('.member-card').forEach((e) => e.classList.remove('selected'));
        el.classList.add('selected'); cur[g] = el.dataset.id;
        if (g === mg) document.getElementById('btn-next').disabled = false;
        const skip = $app.querySelector(`.skip-g[data-group="${g}"]`); if (skip) skip.style.display = '';
      }));
    });
    $app.querySelectorAll('.skip-g').forEach((b) => b.addEventListener('click', () => {
      const g = b.dataset.group; cur[g] = null; b.style.display = 'none';
      $app.querySelectorAll(`.target-grid[data-group="${g}"] .member-card`).forEach((e) => e.classList.remove('selected'));
    }));
    document.getElementById('btn-prev').addEventListener('click', () => { if (qIndex > 0) { qIndex--; viewQuestion(); } });
    document.getElementById('btn-edit-q').addEventListener('click', () => editQuestionModal(q, () => viewQuestion()));
    document.getElementById('btn-next').addEventListener('click', async () => {
      if (!cur[mg]) return;
      const btn = document.getElementById('btn-next'); btn.disabled = true;
      try {
        await axios.post('/api/vote', { voter: me, question: q.id, targets: { [mg]: cur[mg], [og]: cur[og] ?? null } });
        answers[q.id] = { [mg]: cur[mg] }; if (cur[og]) answers[q.id][og] = cur[og];
      } catch (e) { toast('Saqlashda xatolik'); btn.disabled = false; return; }
      if (qIndex < total - 1) { qIndex++; viewQuestion(); } else viewDone();
    });
  }

  // ================= DONE =================
  function viewDone() {
    setNav();
    const meM = byId(me);
    $app.innerHTML = `
      <section id="done-view" class="text-center py-10 fade-in">
        <img src="${img(me)}" class="w-32 h-40 object-cover rounded-2xl mx-auto mb-4 border-4 border-yellow-400 shadow-2xl" alt="">
        <h1 class="brand text-5xl">RAHMAT, ${esc(meM.short.toUpperCase())}! 🎉</h1>
        <p class="text-white/60 mt-2 mb-6">Hammasiga javob berding. Endi natijalar — kim nima bo'ldi? 👀</p>
        <div class="flex flex-wrap gap-3 justify-center">
          <button id="btn-results" class="btn btn-primary text-lg"><i class="fas fa-chart-simple mr-2"></i>Natijalar</button>
          <button id="btn-edit" class="btn btn-ghost">Javoblarni o'zgartirish</button>
          <button id="btn-qs" class="btn btn-ghost"><i class="fas fa-plus mr-1"></i>Savol qo'shish</button>
        </div>
      </section>`;
    if (window.confetti) confetti({ particleCount: 160, spread: 90, origin: { y: 0.6 } });
    document.getElementById('btn-results').addEventListener('click', viewResults);
    document.getElementById('btn-edit').addEventListener('click', () => { qIndex = 0; viewQuestion(); });
    document.getElementById('btn-qs').addEventListener('click', viewQuestions);
  }

  // ================= RESULTS (Telegram style) =================
  async function viewResults() {
    setNav();
    $app.innerHTML = `<div class="text-center py-20 text-white/50"><i class="fas fa-spinner fa-spin text-3xl"></i></div>`;
    let data;
    try { await loadMeta(); ({ data } = await axios.get('/api/results')); } catch (e) {
      $app.innerHTML = `<p class="text-center text-red-400 py-20">Natijalarni yuklab bo'lmadi.</p>`; return;
    }
    const cats = [...new Set(META.questions.map((q) => q.category))];
    $app.innerHTML = `
      <section id="results-view" class="fade-in">
        <div class="text-center mb-5">
          <h1 class="brand text-5xl sm:text-6xl leading-none">NATIJALAR 🏆</h1>
          <p class="text-white/60 mt-2 text-sm"><i class="fas fa-users mr-1"></i>${data.voters}/${data.totalMembers} ovoz berdi · <i class="fas fa-check-double mx-1"></i>${data.completed} to'liq tugatdi</p>
        </div>
        <div class="flex flex-wrap gap-2 justify-center mb-5" id="cat-chips">
          <span class="chip active" data-cat="all">Barchasi</span>
          ${cats.map((c) => `<span class="chip" data-cat="${esc(c)}">${esc(c)}</span>`).join('')}
          <span class="chip" data-cat="__people">👤 Odamlar</span>
        </div>
        <div id="results-grid" class="grid grid-cols-1 lg:grid-cols-2 gap-4"></div>
      </section>`;
    const grid = document.getElementById('results-grid');

    function pollGroup(q, g) {
      const votes = (data.results[q.id] || {})[g] || {};
      const members = META.members.filter((m) => m.group === g);
      const total = Object.values(votes).reduce((s, v) => s + v.length, 0);
      const max = Math.max(0, ...Object.values(votes).map((v) => v.length));
      const sorted = [...members].sort((a, b) => (votes[b.id]?.length || 0) - (votes[a.id]?.length || 0));
      const withVotes = sorted.filter((m) => votes[m.id]?.length);
      const zero = sorted.filter((m) => !votes[m.id]?.length);
      const opt = (m) => {
        const vs = votes[m.id] || []; const pct = total ? Math.round((vs.length / total) * 100) : 0;
        return `<div class="opt ${vs.length && vs.length === max ? 'top' : ''}" data-opt>
          <div class="pct">${pct}%</div>
          <div class="oname"><img class="thumb" src="${img(m.id)}" alt="">${esc(m.short)}${m.photo ? '' : ' 🕵️'}</div>
          <div class="voters">${vs.length ? `<span>${vs.length}</span><div class="stack">${vs.slice(0, 3).map((v) => `<img src="${img(v)}" title="${esc(byId(v)?.name)}" alt="">`).join('')}${vs.length > 3 ? `<span class="text-xs ml-1 text-white/50">+${vs.length - 3}</span>` : ''}</div>` : ''}</div>
          <div class="bar"><div style="width:${pct}%"></div></div>
          ${vs.length ? `<div class="voter-list">${vs.map((v) => `<span class="voter-chip"><img src="${img(v)}" alt="">${esc(byId(v)?.short)}</span>`).join('')}</div>` : ''}
        </div>`;
      };
      return `<div class="poll-group" data-q="${q.id}" data-g="${g}">
        <div class="flex items-center justify-between py-2"><span class="gtag gtag-${g}">${g} GURUH</span><span class="text-xs text-white/40">${total} ovoz</span></div>
        ${withVotes.map(opt).join('')}
        ${zero.length ? `<div class="zero-wrap" style="display:none">${zero.map(opt).join('')}</div>
          <div class="poll-foot toggle-zero">Qolganlarni ko'rsatish (${zero.length})</div>` : ''}
        ${total === 0 ? '<div class="text-xs text-white/30 py-2">Hali ovoz yo\'q</div>' : ''}
      </div>`;
    }

    function renderQuestions(cat) {
      const qs = META.questions.filter((q) => cat === 'all' || q.category === cat);
      grid.innerHTML = qs.map((q, i) => `
        <article class="poll" style="animation-delay:${Math.min(i * 40, 400)}ms">
          <div class="poll-head">
            <span class="pill ${catClass(q.category)} uppercase tracking-wider">${esc(q.emoji)} ${esc(q.category)}</span>
            <h3 class="poll-title mt-2">${esc(q.text)}</h3>
          </div>
          ${pollGroup(q, 'A')}${pollGroup(q, 'B')}
        </article>`).join('');
      grid.querySelectorAll('[data-opt]').forEach((o) => o.addEventListener('click', () => o.classList.toggle('open')));
      grid.querySelectorAll('.toggle-zero').forEach((t) => t.addEventListener('click', () => {
        const w = t.previousElementSibling; const show = w.style.display === 'none';
        w.style.display = show ? '' : 'none'; t.textContent = show ? 'Yashirish' : t.textContent.replace('Yashirish', "Qolganlarni ko'rsatish");
        if (!show) t.textContent = `Qolganlarni ko'rsatish (${w.children.length})`;
        w.querySelectorAll('[data-opt]').forEach((o) => o.addEventListener('click', () => o.classList.toggle('open')));
      }));
    }

    function renderPeople() {
      const wins = {}, mentions = {};
      for (const q of META.questions) for (const g of ['A', 'B']) {
        const votes = (data.results[q.id] || {})[g] || {};
        let best = null, bn = 0;
        for (const [t, vs] of Object.entries(votes)) { mentions[t] = (mentions[t] || 0) + vs.length; if (vs.length > bn) { bn = vs.length; best = t; } }
        if (best) (wins[best] ||= []).push({ q, n: bn });
      }
      const sorted = [...META.members].sort((a, b) => (wins[b.id]?.length || 0) - (wins[a.id]?.length || 0) || (mentions[b.id] || 0) - (mentions[a.id] || 0));
      grid.innerHTML = sorted.map((m, i) => `
        <article class="poll p-4" style="animation-delay:${Math.min(i * 30, 400)}ms">
          <div class="flex items-center gap-3">
            <img src="${img(m.id)}" class="w-16 h-20 object-cover rounded-xl" alt="">
            <div><div class="font-extrabold">${esc(m.name)} <span class="gtag gtag-${m.group}">${m.group}</span></div>
            <div class="text-white/50 text-xs">${(wins[m.id] || []).length} ta g'alaba · ${mentions[m.id] || 0} ovoz</div></div>
          </div>
          ${(wins[m.id] || []).length ? `<ul class="mt-3 space-y-1 text-sm">${wins[m.id].map((w) => `<li class="flex gap-2"><span>${esc(w.q.emoji)}</span><span class="text-white/80">${esc(w.q.text)}</span><span class="text-white/40 ml-auto">${w.n}</span></li>`).join('')}</ul>` : `<div class="mt-3 text-xs text-white/30">Hali hech qaysi savolda birinchi emas 🙂</div>`}
        </article>`).join('');
    }

    renderQuestions('all');
    document.querySelectorAll('#cat-chips .chip').forEach((chip) => chip.addEventListener('click', () => {
      document.querySelectorAll('#cat-chips .chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      chip.dataset.cat === '__people' ? renderPeople() : renderQuestions(chip.dataset.cat);
    }));
    window.scrollTo({ top: 0 });
  }

  // ================= QUESTION EDITOR =================
  function editQuestionModal(q, onDone) {
    const isNew = !q;
    const bg = document.createElement('div'); bg.className = 'modal-bg';
    bg.innerHTML = `
      <div class="modal">
        <h3 class="brand text-3xl mb-3">${isNew ? "YANGI SAVOL" : "SAVOLNI TAHRIRLASH"}</h3>
        <div class="grid grid-cols-[70px_1fr] gap-2 mb-2">
          <input id="m-emoji" class="input text-center text-2xl" value="${esc(q?.emoji || '❓')}" maxlength="8">
          <select id="m-cat" class="input">${META.categories.map((c) => `<option ${q?.category === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
        </div>
        <textarea id="m-text" class="input" rows="3" placeholder="Kim ko'proq ...?" maxlength="200">${esc(q?.text || '')}</textarea>
        <div class="text-xs text-white/40 mt-1">${isNew ? '' : `Qo'shgan: ${esc(byId(q.created_by)?.short || q.created_by)}${q.updated_by ? ` · o'zgartirgan: ${esc(byId(q.updated_by)?.short || q.updated_by)}` : ''}`}</div>
        <div class="flex items-center justify-between gap-2 mt-4">
          ${isNew ? '<span></span>' : `<button id="m-del" class="btn btn-danger btn-sm"><i class="fas fa-trash mr-1"></i>O'chirish</button>`}
          <div class="flex gap-2">
            <button id="m-cancel" class="btn btn-ghost btn-sm">Bekor</button>
            <button id="m-save" class="btn btn-primary btn-sm">Saqlash</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(bg);
    const close = () => bg.remove();
    bg.addEventListener('click', (e) => { if (e.target === bg) close(); });
    bg.querySelector('#m-cancel').addEventListener('click', close);
    bg.querySelector('#m-save').addEventListener('click', async () => {
      const payload = { actor: me, text: bg.querySelector('#m-text').value, emoji: bg.querySelector('#m-emoji').value, category: bg.querySelector('#m-cat').value };
      try {
        if (isNew) await axios.post('/api/questions', payload); else await axios.put(`/api/questions/${q.id}`, payload);
        await loadMeta(); toast(isNew ? 'Savol qo\'shildi ✅' : 'Saqlandi ✅'); close(); onDone && onDone();
      } catch (e) { toast(e.response?.data?.error || 'Xatolik'); }
    });
    const del = bg.querySelector('#m-del');
    if (del) del.addEventListener('click', async () => {
      if (!confirm(`"${q.text}" savolini o'chirasizmi? Bunga berilgan ovozlar ham yo'qoladi.`)) return;
      try { await axios.delete(`/api/questions/${q.id}?actor=${me}`); await loadMeta(); toast('O\'chirildi'); close(); onDone && onDone(); }
      catch (e) { toast('Xatolik'); }
    });
    setTimeout(() => bg.querySelector('#m-text').focus(), 50);
  }

  async function viewQuestions() {
    setNav();
    await loadMeta();
    $app.innerHTML = `
      <section id="questions-view" class="fade-in">
        <div class="text-center mb-5">
          <h1 class="brand text-5xl leading-none">SAVOLLAR ✍️</h1>
          <p class="text-white/60 mt-2 text-sm">Hamma qo'shishi, o'zgartirishi va o'chirishi mumkin. Kim nima qilgani ko'rinadi.</p>
        </div>
        <div class="flex justify-center gap-2 mb-5">
          <button id="q-add" class="btn btn-primary"><i class="fas fa-plus mr-2"></i>Savol qo'shish</button>
          <button id="q-back" class="btn btn-ghost"><i class="fas fa-arrow-left mr-2"></i>So'rovga qaytish</button>
        </div>
        <div class="space-y-2" id="q-list">
          ${META.questions.map((q, i) => `
            <div class="qrow">
              <div class="text-2xl w-9 text-center">${esc(q.emoji)}</div>
              <div class="flex-1 min-w-0">
                <div class="font-semibold leading-snug">${i + 1}. ${esc(q.text)}</div>
                <div class="meta"><span class="${catClass(q.category)}">${esc(q.category)}</span> · ${esc(byId(q.created_by)?.short || q.created_by)}${q.updated_by ? ` · ✏️ ${esc(byId(q.updated_by)?.short || q.updated_by)}` : ''}</div>
              </div>
              <button class="btn btn-ghost btn-sm q-edit" data-id="${q.id}"><i class="fas fa-pen"></i></button>
            </div>`).join('')}
        </div>
      </section>`;
    document.getElementById('q-add').addEventListener('click', () => editQuestionModal(null, viewQuestions));
    document.getElementById('q-back').addEventListener('click', () => goFirstUnanswered());
    $app.querySelectorAll('.q-edit').forEach((b) => b.addEventListener('click', () => editQuestionModal(META.questions.find((q) => q.id == b.dataset.id), viewQuestions)));
  }

  // ================= NAV =================
  document.getElementById('nav-results').addEventListener('click', viewResults);
  document.getElementById('nav-questions').addEventListener('click', viewQuestions);
  document.getElementById('nav-reset').addEventListener('click', () => {
    if (confirm('Boshqa odam sifatida kirmoqchimisiz? Javoblar serverda saqlanib qoladi.')) {
      localStorage.removeItem(LS_ME); me = null; answers = {}; viewPickMe();
    }
  });
  document.getElementById('brand').addEventListener('click', (e) => { e.preventDefault(); me ? goFirstUnanswered() : viewPickMe(); });

  // ================= INIT =================
  (async function init() {
    try { await loadMeta(); } catch (e) { $app.innerHTML = '<p class="text-center text-red-400 py-20">Yuklashda xatolik.</p>'; return; }
    if (me && byId(me)) { await loadProgress(); goFirstUnanswered(); } else { me = null; viewPickMe(); }
  })();
})();
