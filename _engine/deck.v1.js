/* ============================================================
   DECK ENGINE — v1
   Navigation, HUD, and generic slide behaviours.

   Deck-agnostic: reads the DOM, assumes nothing about slide
   content. Per-deck behaviour attaches via Deck.onEnter().

   VERSIONED alongside deck.v1.css. Ship v2 rather than changing
   v1 behaviour, so archived decks stay stable.

   Navigator + deep-link were added to v1 rather than forked to v2:
   at the time v1 had exactly one consumer and it was still in active
   development, so no archived deck was pinned to the old behaviour.
   Once a deck ships against v1, that exemption is spent for anything
   that CHANGES existing behaviour -- a rebound key, an altered API, a
   different default. Purely additive bindings on previously-unbound
   keys stay allowed: they cannot alter how an already-published deck
   behaves, which is the only thing the rule protects. P (open PDF) was
   added under that carve-out.
   ============================================================ */

window.Deck = (() => {
  const slides    = Array.from(document.querySelectorAll('.slide'));
  const sectionEl = document.getElementById('hud-section');
  const counterEl = document.getElementById('hud-slide');
  const progress  = document.getElementById('progress');
  const help      = document.getElementById('help');
  const stage     = document.getElementById('stage');

  const pad  = n => String(n).padStart(2, '0');
  const total = slides.length;
  let i = 0;

  /* per-deck hooks: Deck.onEnter('s-ecosystem', el => {...}) */
  const enterHooks = {};
  const leaveHooks = {};

  /* ---------- live countdown ----------
     <div data-countdown="2027-08-23T13:30:00Z">
       <span data-cd="days"></span><span data-cd="hrs"></span>
       <span data-cd="mins"></span><span data-cd="secs"></span> */
  function initCountdowns() {
    const nodes = Array.from(document.querySelectorAll('[data-countdown]'));
    if (!nodes.length) return;
    const tick = () => {
      nodes.forEach(node => {
        const target = Date.parse(node.dataset.countdown);
        if (Number.isNaN(target)) return;
        const diff  = Math.max(0, target - Date.now());
        const total = Math.floor(diff / 1000);
        const parts = {
          days: Math.floor(total / 86400).toLocaleString('en-US'),
          hrs:  pad(Math.floor((total % 86400) / 3600)),
          mins: pad(Math.floor((total % 3600) / 60)),
          secs: pad(total % 60)
        };
        node.querySelectorAll('[data-cd]').forEach(el => {
          const v = parts[el.dataset.cd];
          if (v !== undefined && el.textContent !== v) el.textContent = v;
        });
      });
    };
    tick();
    setInterval(tick, 1000);
  }

  /* ---------- count-up ----------
     <div data-countup>2,000+</div>  — animates 0 → value on arrival.
     Non-numeric values (e.g. "#1") just fade in. */
  function initCountUps(root) {
    return Array.from(root.querySelectorAll('[data-countup]')).map(el => {
      if (!el.dataset.targetHtml) el.dataset.targetHtml = el.innerHTML;
      return el;
    });
  }
  const countTimers = [];
  function clearCountTimers() { while (countTimers.length) clearTimeout(countTimers.pop()); }

  function resetCountUps(root) {
    clearCountTimers();
    initCountUps(root).forEach(el => {
      el.style.opacity = '';
      el.innerHTML = el.dataset.targetHtml;
    });
  }

  function runCountUps(root) {
    resetCountUps(root);
    initCountUps(root).forEach((el, idx) => {
      const targetHtml = el.dataset.targetHtml;
      const m = el.textContent.trim().match(/^([\d,]+)(.*)$/);
      if (m) {
        const num = parseInt(m[1].replace(/,/g, ''), 10);
        const grouped = m[1].includes(',');
        el.innerHTML = targetHtml.replace(/^[\d,]+/, '0');
        countTimers.push(setTimeout(() => {
          const start = performance.now(), dur = 1100;
          (function frame(now) {
            const t = Math.min(1, (now - start) / dur);
            const v = Math.floor((1 - Math.pow(1 - t, 3)) * num);
            el.innerHTML = targetHtml.replace(/^[\d,]+/,
              grouped ? v.toLocaleString('en-US') : String(v));
            if (t < 1) requestAnimationFrame(frame);
            else el.innerHTML = targetHtml;
          })(performance.now());
        }, 320 + idx * 180));
      } else {
        el.style.opacity = '0';
        countTimers.push(setTimeout(() => {
          el.style.opacity = '';
          el.classList.add('snap');
          countTimers.push(setTimeout(() => el.classList.remove('snap'), 700));
        }, 1700));
      }
    });
  }

  /* ---------- deep link ----------
     The slide index lives in the hash, so a refresh, a reopened tab, or a
     pasted URL lands on the slide you were on rather than back at the cover.
     replaceState, not assignment, so stepping through a deck does not fill
     the back button with one entry per slide. */
  function startIndex() {
    const m = /^#(\d+)$/.exec(location.hash);
    if (!m) return 0;
    const n = parseInt(m[1], 10) - 1;
    return (n >= 0 && n < total) ? n : 0;
  }
  function writeHash() {
    const h = '#' + (i + 1);
    if (location.hash !== h) history.replaceState(null, '', h);
  }

  /* ---------- slide navigator ----------
     Presenter chrome: "N" or a click on the HUD counter opens an index of
     every slide. Built lazily from the DOM, so a deck needs no extra markup. */
  let navEl = null, navSel = 0;
  const navOpen = () => !!navEl && navEl.classList.contains('open');

  function buildNav() {
    navEl = document.createElement('div');
    navEl.className = 'nav-overlay';
    const inner = document.createElement('div'); inner.className = 'nav-inner';
    const head  = document.createElement('div'); head.className  = 'nav-head';
    const h1 = document.createElement('span'); h1.textContent = 'Jump to slide';
    const h2 = document.createElement('span');
    h2.textContent = 'Arrows move · Enter selects · N or ESC closes';
    head.append(h1, h2);
    const grid = document.createElement('div'); grid.className = 'nav-grid';
    slides.forEach((s, idx) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'nav-card';
      const n = document.createElement('span'); n.className = 'nc-n'; n.textContent = pad(idx + 1);
      const t = document.createElement('span'); t.className = 'nc-t';
      t.textContent = s.dataset.section || ('Slide ' + (idx + 1));
      b.append(n, t);
      b.addEventListener('click', () => { setActive(idx); closeNav(); });
      b.addEventListener('mouseenter', () => { navSel = idx; markNav(); });
      grid.appendChild(b);
    });
    inner.append(head, grid);
    navEl.appendChild(inner);
    navEl.addEventListener('click', e => { if (e.target === navEl) closeNav(); });
    document.body.appendChild(navEl);
  }
  function markNav() {
    if (!navEl) return;
    navEl.querySelectorAll('.nav-card').forEach((c, idx) => {
      c.classList.toggle('current', idx === i);      /* where the deck is */
      c.classList.toggle('sel', idx === navSel);     /* where Enter would go */
    });
  }
  /* Column count is measured, not assumed: the grid is auto-fill, so how many
     cards sit per row depends on the viewport. Up/Down must step by that. */
  function navCols() {
    const cards = navEl ? navEl.querySelectorAll('.nav-card') : [];
    if (cards.length < 2) return 1;
    const top = cards[0].getBoundingClientRect().top;
    let n = 0;
    for (const c of cards) {
      if (Math.abs(c.getBoundingClientRect().top - top) < 2) n++; else break;
    }
    return Math.max(1, n);
  }
  function moveSel(d) {
    navSel = Math.max(0, Math.min(total - 1, navSel + d));
    markNav();
    const c = navEl.querySelectorAll('.nav-card')[navSel];
    if (c) c.scrollIntoView({ block: 'nearest' });
  }
  function openNav()  { if (!navEl) buildNav(); navSel = i; markNav(); navEl.classList.add('open'); }
  function closeNav() { if (navEl) navEl.classList.remove('open'); }
  function toggleNav(){ navOpen() ? closeNav() : openNav(); }

  /* ---------- navigation ---------- */
  function setActive(next) {
    next = Math.max(0, Math.min(total - 1, next));
    slides.forEach((s, idx) => {
      if (idx === next) {
        s.classList.remove('active');
        void s.offsetWidth;               /* restart arrival animations */
        s.classList.add('active');
        runCountUps(s);
        Object.keys(enterHooks).forEach(cls => {
          if (s.classList.contains(cls)) enterHooks[cls](s);
        });
      } else {
        if (s.classList.contains('active')) {
          Object.keys(leaveHooks).forEach(cls => {
            if (s.classList.contains(cls)) leaveHooks[cls](s);
          });
        }
        s.classList.remove('active');
        resetCountUps(s);
      }
    });
    i = next;
    if (sectionEl) sectionEl.textContent = (slides[i].dataset.section || '—').toUpperCase();
    if (counterEl) counterEl.textContent = `${pad(i + 1)} / ${pad(total)}`;
    if (progress)  progress.style.width = (i / (total - 1) * 100) + '%';
    writeHash();
    markNav();
  }

  window.addEventListener('keydown', e => {
    /* While the navigator is open it owns the keyboard: arrows move the
       selection rather than the deck, so nothing flashes past behind the
       overlay, and Enter commits the slide under the cursor. */
    if (navOpen()) {
      e.preventDefault();
      if (e.key === 'ArrowRight')      moveSel(1);
      else if (e.key === 'ArrowLeft')  moveSel(-1);
      else if (e.key === 'ArrowDown')  moveSel(navCols());
      else if (e.key === 'ArrowUp')    moveSel(-navCols());
      else if (e.key === 'Home')       { navSel = 0; markNav(); }
      else if (e.key === 'End')        { navSel = total - 1; markNav(); }
      else if (e.key === 'Enter' || e.key === ' ') { setActive(navSel); closeNav(); }
      else if (e.key === 'Escape' || e.key === 'n' || e.key === 'N') closeNav();
      return;
    }
    if (['ArrowRight', ' ', 'PageDown', 'Enter'].includes(e.key)) { e.preventDefault(); setActive(i + 1); }
    else if (['ArrowLeft', 'PageUp'].includes(e.key))             { e.preventDefault(); setActive(i - 1); }
    else if (e.key === 'Home')                                    { e.preventDefault(); setActive(0); }
    else if (e.key === 'End')                                     { e.preventDefault(); setActive(total - 1); }
    else if (e.key === 'n' || e.key === 'N')                      { e.preventDefault(); toggleNav(); }
    else if (e.key === 'Escape')                                  { closeNav(); }
    else if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
      else document.exitFullscreen?.();
    }
    else if (e.key === 'p' || e.key === 'P')                      { e.preventDefault(); openPDF(); }
  });

  /* P -> this deck's PDF. Convention: a deck served at /slug/ exports to
     /slug.pdf, so the href is the pathname with its trailing slash traded
     for .pdf. Same tab on purpose -- Back returns you, and the #N deep
     link restores the slide you left rather than dumping you on slide 1.
     Guarded to http(s): opened from file:// there is no sibling to hit. */
  function pdfHref() {
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return null;
    const base = location.pathname.replace(/\/index\.html?$/i, '/').replace(/\/+$/, '');
    return base ? base + '.pdf' : null;
  }
  function openPDF() { const href = pdfHref(); if (href) location.href = href; }

  if (counterEl) counterEl.addEventListener('click', openNav);

  window.addEventListener('hashchange', () => {
    const n = startIndex();
    if (n !== i) setActive(n);
  });

  if (stage) {
    stage.addEventListener('click', e => {
      const r = stage.getBoundingClientRect();
      setActive(e.clientX - r.left > r.width * 0.4 ? i + 1 : i - 1);
    });
    let touchStart = 0;
    stage.addEventListener('touchstart', e => { touchStart = e.changedTouches[0].clientX; }, { passive: true });
    stage.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - touchStart;
      if (Math.abs(dx) >= 40) setActive(dx < 0 ? i + 1 : i - 1);
    }, { passive: true });
  }

  if (help) {
    let t;
    setTimeout(() => help.classList.add('fade'), 6000);
    window.addEventListener('mousemove', () => {
      help.classList.remove('fade');
      clearTimeout(t);
      t = setTimeout(() => help.classList.add('fade'), 3500);
    });
  }

  initCountdowns();
  setActive(startIndex());

  return {
    go: setActive,
    next: () => setActive(i + 1),
    prev: () => setActive(i - 1),
    get index() { return i; },
    get total() { return total; },
    onEnter: (cls, fn) => { enterHooks[cls] = fn; },
    onLeave: (cls, fn) => { leaveHooks[cls] = fn; },
    openNav, closeNav, toggleNav
  };
})();
