/* Kim ko'proq...? — guruh so'rovi */
(function () {
  const $app = document.getElementById('app');
  const LS_ME = 'kk_me';
  const LS_ANS = 'kk_answers';

  let META = { members: [], questions: [] };
  let me = localStorage.getItem(LS_ME) || null;
  let answers = JSON.parse(localStorage.getItem(LS_ANS) || '{}');
  let qIndex = 0;
  let pendingTarget = null;

  const byId = (id) => META.members.find((m) => m.id === id);
  const img = (id) => `/static/members/${id}.jpg`;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 1800);
  }

  function saveLocal() {
    localStorage.setItem(LS_ANS, JSON.stringify(answers));
  }

  // ---------- Views ----------
  function viewPickMe() {
    document.getElementById('nav-reset').classList.add('hidden');
    $app.innerHTML = `
      <section id="pick-me" class="fade-in">
        <div class="text-center mb-6">
          <h1 class="brand text-5xl sm:text-6xl leading-none">SEN KIMSAN?</h1>
          <p class="text-white/60 mt-2">Boshlash uchun o'zingni tanla. Keyin ${META.questions.length} ta savolga javob berasan 😈</p>
        </div>
        <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3" id="me-grid">
          ${META.members.map((m) => `
            <article class="member-card" data-id="${m.id}">
              <img src="${img(m.id)}" alt="${esc(m.name)}" loading="lazy">
              <div class="check"><i class="fas fa-check"></i></div>
              <div class="name">${esc(m.name)}</div>
            </article>`).join('')}
        </div>
        <div class="sticky bottom-4 mt-6 flex justify-center">
          <button id="btn-start" class="btn btn-primary text-lg shadow-2xl" disabled><i class="fas fa-play mr-2"></i>Boshlash</button>
        </div>
      </section>`;

    let picked = null;
    $app.querySelectorAll('.member-card').forEach((el) => {
      el.addEventListener('click', () => {
        $app.querySelectorAll('.member-card').forEach((e) => e.classList.remove('selected'));
        el.classList.add('selected');
        picked = el.dataset.id;
        document.getElementById('btn-start').disabled = false;
      });
    });
    document.getElementById('btn-start').addEventListener('click', async () => {
      if (!picked) return;
      me = picked;
      localStorage.setItem(LS_ME, me);
      // Load progress from server
      try {
        const { data } = await axios.get(`/api/progress/${me}`);
        answers = { ...answers, ...data.answers };
        saveLocal();
      } catch (e) {}
      const firstUnanswered = META.questions.findIndex((q) => !answers[q.id]);
      qIndex = firstUnanswered === -1 ? 0 : firstUnanswered;
      if (firstUnanswered === -1) viewDone();
      else viewQuestion();
    });
  }

  function viewQuestion() {
    document.getElementById('nav-reset').classList.remove('hidden');
    const q = META.questions[qIndex];
    const total = META.questions.length;
    const answered = Object.keys(answers).length;
    pendingTarget = answers[q.id] || null;
    const meM = byId(me);

    $app.innerHTML = `
      <section id="question-view" class="fade-in">
        <div class="flex items-center justify-between text-sm text-white/60 mb-2">
          <span class="flex items-center gap-2"><img src="${img(me)}" class="runner" alt=""> ${esc(meM.short)}</span>
          <span>${qIndex + 1} / ${total}</span>
        </div>
        <div class="progress-bar mb-5"><div style="width:${((qIndex) / total) * 100}%"></div></div>

        <article class="q-card p-6 sm:p-8 text-center mb-6">
          <div class="q-emoji mb-3">${q.emoji}</div>
          <span class="pill cat-${q.category} uppercase tracking-wider">${esc(q.category)}</span>
          <h2 class="q-text mt-3">${esc(q.text)}</h2>
        </article>

        <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3" id="target-grid">
          ${META.members.map((m) => `
            <article class="member-card ${m.id === me ? 'is-me' : ''} ${pendingTarget === m.id ? 'selected' : ''}" data-id="${m.id}">
              <img src="${img(m.id)}" alt="${esc(m.name)}" loading="lazy">
              <div class="check"><i class="fas fa-check"></i></div>
              <div class="name">${esc(m.name)}</div>
            </article>`).join('')}
        </div>

        <div class="sticky bottom-4 mt-6 flex items-center justify-center gap-3">
          <button id="btn-prev" class="btn btn-ghost" ${qIndex === 0 ? 'disabled style="opacity:.3"' : ''}><i class="fas fa-arrow-left"></i></button>
          <button id="btn-next" class="btn btn-primary text-lg shadow-2xl" ${pendingTarget ? '' : 'disabled'}>
            ${qIndex === total - 1 ? '<i class="fas fa-flag-checkered mr-2"></i>Tugatish' : 'Keyingi <i class="fas fa-arrow-right ml-2"></i>'}
          </button>
        </div>
      </section>`;

    window.scrollTo({ top: 0, behavior: 'smooth' });

    $app.querySelectorAll('#target-grid .member-card').forEach((el) => {
      el.addEventListener('click', () => {
        $app.querySelectorAll('#target-grid .member-card').forEach((e) => e.classList.remove('selected'));
        el.classList.add('selected');
        pendingTarget = el.dataset.id;
        document.getElementById('btn-next').disabled = false;
        // auto-scroll to button on mobile
        document.getElementById('btn-next').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
    });

    document.getElementById('btn-prev').addEventListener('click', () => {
      if (qIndex > 0) { qIndex--; viewQuestion(); }
    });

    document.getElementById('btn-next').addEventListener('click', async () => {
      if (!pendingTarget) return;
      answers[q.id] = pendingTarget;
      saveLocal();
      const btn = document.getElementById('btn-next');
      btn.disabled = true;
      try {
        await axios.post('/api/vote', { voter: me, question: q.id, target: pendingTarget });
      } catch (e) {
        toast('Saqlashda xatolik, qayta urinib ko\'ring');
        btn.disabled = false;
        return;
      }
      if (qIndex < total - 1) { qIndex++; viewQuestion(); }
      else { viewDone(); }
    });
  }

  async function viewDone() {
    // sync everything in bulk just to be safe
    try { await axios.post('/api/votes', { voter: me, answers }); } catch (e) {}
    const meM = byId(me);
    $app.innerHTML = `
      <section id="done-view" class="text-center py-10 fade-in">
        <img src="${img(me)}" class="w-32 h-40 object-cover rounded-2xl mx-auto mb-4 border-4 border-yellow-400 shadow-2xl" alt="">
        <h1 class="brand text-5xl">RAHMAT, ${esc(meM.short.toUpperCase())}! 🎉</h1>
        <p class="text-white/60 mt-2 mb-6">Barcha ${META.questions.length} savolga javob berdingiz. Endi natijalarni ko'ring — kim nima bo'ldi? 👀</p>
        <div class="flex flex-wrap gap-3 justify-center">
          <button id="btn-results" class="btn btn-primary text-lg"><i class="fas fa-chart-simple mr-2"></i>Natijalarni ko'rish</button>
          <button id="btn-edit" class="btn btn-ghost">Javoblarni o'zgartirish</button>
        </div>
      </section>`;
    if (window.confetti) confetti({ particleCount: 160, spread: 90, origin: { y: 0.6 } });
    document.getElementById('btn-results').addEventListener('click', viewResults);
    document.getElementById('btn-edit').addEventListener('click', () => { qIndex = 0; viewQuestion(); });
  }

  async function viewResults() {
    $app.innerHTML = `<div class="text-center py-20 text-white/50"><i class="fas fa-spinner fa-spin text-3xl"></i></div>`;
    let data;
    try { ({ data } = await axios.get('/api/results')); } catch (e) {
      $app.innerHTML = `<p class="text-center text-red-400 py-20">Natijalarni yuklab bo'lmadi.</p>`; return;
    }
    const cats = [...new Set(META.questions.map((q) => q.category))];
    const totalVotes = Object.values(data.results).reduce((a, arr) => a + arr.reduce((s, x) => s + x.n, 0), 0);

    $app.innerHTML = `
      <section id="results-view" class="fade-in">
        <div class="text-center mb-6">
          <h1 class="brand text-5xl sm:text-6xl leading-none">NATIJALAR 🏆</h1>
          <p class="text-white/60 mt-2">
            <i class="fas fa-users mr-1"></i>${data.voters}/${data.totalMembers} kishi ovoz berdi ·
            <i class="fas fa-check-double mx-1"></i>${data.completed} kishi to'liq tugatdi ·
            ${totalVotes} ovoz
          </p>
        </div>

        <div class="flex flex-wrap gap-2 justify-center mb-6" id="cat-chips">
          <span class="chip active" data-cat="all">Barchasi</span>
          ${cats.map((c) => `<span class="chip" data-cat="${c}">${c}</span>`).join('')}
          <span class="chip" data-cat="__people">👤 Odamlar bo'yicha</span>
        </div>

        <div id="results-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"></div>
        ${!me ? '' : `<div class="text-center mt-8"><button id="btn-back-q" class="btn btn-ghost"><i class="fas fa-pen mr-2"></i>Javoblarimni o'zgartirish</button></div>`}
      </section>`;

    const grid = document.getElementById('results-grid');

    function renderQuestions(cat) {
      const qs = META.questions.filter((q) => cat === 'all' || q.category === cat);
      grid.innerHTML = qs.map((q, i) => {
        const votes = data.results[q.id] || [];
        const top = votes[0];
        const total = votes.reduce((s, v) => s + v.n, 0);
        const tie = votes.length > 1 && votes[1].n === top?.n;
        const runners = votes.slice(1, 5);
        return `
          <article class="result-card" style="animation-delay:${Math.min(i * 40, 400)}ms">
            <div class="p-4 pb-2">
              <span class="pill cat-${q.category} uppercase tracking-wider">${q.emoji} ${esc(q.category)}</span>
              <h3 class="font-extrabold text-lg leading-snug mt-2">${esc(q.text)}</h3>
            </div>
            ${top ? `
              <div class="px-4 pt-3 pb-4">
                <div class="relative flex items-center gap-4 bg-black/30 rounded-2xl p-3">
                  <div class="relative w-24 shrink-0">
                    <span class="crown">${tie ? '🤝' : '👑'}</span>
                    <img src="${img(top.target)}" class="winner-img rounded-xl border-2 border-yellow-400" alt="">
                  </div>
                  <div class="min-w-0">
                    <div class="text-yellow-400 text-xs font-bold uppercase tracking-widest">${tie ? 'Durrang' : 'G\'olib'}</div>
                    <div class="brand text-2xl leading-tight">${esc(byId(top.target).name)}</div>
                    <div class="text-white/60 text-sm mt-1">${top.n} ovoz · ${Math.round((top.n / total) * 100)}%</div>
                    ${runners.length ? `<div class="flex items-center gap-1 mt-2">
                      ${runners.map((r) => `<img src="${img(r.target)}" class="runner" title="${esc(byId(r.target).name)} — ${r.n}" alt="">`).join('')}
                      <span class="text-xs text-white/40 ml-1">+${runners.map((r) => r.n).reduce((a, b) => a + b, 0)}</span>
                    </div>` : ''}
                  </div>
                </div>
              </div>` : `<div class="px-4 pb-5 text-white/40 text-sm"><i class="fas fa-hourglass-half mr-1"></i>Hali ovoz yo'q</div>`}
          </article>`;
      }).join('');
    }

    function renderPeople() {
      // For each member: which questions did they "win"?
      const wins = {};
      const mentions = {};
      for (const q of META.questions) {
        const votes = data.results[q.id] || [];
        if (votes[0]) (wins[votes[0].target] ||= []).push({ q, n: votes[0].n });
        for (const v of votes) mentions[v.target] = (mentions[v.target] || 0) + v.n;
      }
      const sorted = [...META.members].sort((a, b) => (wins[b.id]?.length || 0) - (wins[a.id]?.length || 0) || (mentions[b.id] || 0) - (mentions[a.id] || 0));
      grid.innerHTML = sorted.map((m, i) => `
        <article class="result-card p-4" style="animation-delay:${Math.min(i * 30, 400)}ms">
          <div class="flex items-center gap-3">
            <img src="${img(m.id)}" class="w-16 h-20 object-cover rounded-xl" alt="">
            <div>
              <div class="font-extrabold">${esc(m.name)}</div>
              <div class="text-white/50 text-xs">${(wins[m.id] || []).length} ta g'alaba · ${mentions[m.id] || 0} ovoz</div>
            </div>
          </div>
          ${(wins[m.id] || []).length ? `<ul class="mt-3 space-y-1 text-sm">${wins[m.id].map((w) => `<li class="flex gap-2"><span>${w.q.emoji}</span><span class="text-white/80">${esc(w.q.text)}</span></li>`).join('')}</ul>` : `<div class="mt-3 text-xs text-white/30">Hali hech qaysi savolda birinchi emas 🙂</div>`}
        </article>`).join('');
    }

    renderQuestions('all');
    document.querySelectorAll('#cat-chips .chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('#cat-chips .chip').forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        const cat = chip.dataset.cat;
        if (cat === '__people') renderPeople(); else renderQuestions(cat);
      });
    });
    const back = document.getElementById('btn-back-q');
    if (back) back.addEventListener('click', () => { qIndex = 0; viewQuestion(); });
    window.scrollTo({ top: 0 });
  }

  // ---------- Nav ----------
  document.getElementById('nav-results').addEventListener('click', viewResults);
  document.getElementById('nav-reset').addEventListener('click', () => {
    if (confirm('Boshqa odam sifatida kirmoqchimisiz? Hozirgi javoblar serverda saqlanib qoladi.')) {
      localStorage.removeItem(LS_ME); localStorage.removeItem(LS_ANS);
      me = null; answers = {}; viewPickMe();
    }
  });
  document.getElementById('brand').addEventListener('click', (e) => { e.preventDefault(); me ? viewQuestion() : viewPickMe(); });

  // ---------- Init ----------
  (async function init() {
    try {
      const { data } = await axios.get('/api/meta');
      META = data;
    } catch (e) {
      $app.innerHTML = '<p class="text-center text-red-400 py-20">Yuklashda xatolik.</p>';
      return;
    }
    if (me && byId(me)) {
      try {
        const { data } = await axios.get(`/api/progress/${me}`);
        answers = { ...answers, ...data.answers };
        saveLocal();
      } catch (e) {}
      const firstUnanswered = META.questions.findIndex((q) => !answers[q.id]);
      if (firstUnanswered === -1) viewDone();
      else { qIndex = firstUnanswered; viewQuestion(); }
    } else {
      viewPickMe();
    }
  })();
})();
