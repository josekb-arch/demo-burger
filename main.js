/* All Star Burgers — demo replica. Three.js + GSAP ScrollTrigger + Lenis (all vendored). */
const { gsap, ScrollTrigger } = window;
const root = document.documentElement;
const ANIM = root.classList.contains('anim');
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

/* ---------- shared: toast + scramble headings ---------- */
const toast = $('#toast'); let toastT;
function say(msg) { toast.textContent = msg; toast.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => toast.classList.remove('show'), 2600); }
$$('.order').forEach(b => b.addEventListener('click', () => say('Demo — online ordering is not connected.')));

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#%&*+/<>=';
$$('.scr').forEach(h => {
  const lines = h.dataset.text.split('|');
  h.innerHTML = `<span class="sr">${lines.join(' ')}</span><span aria-hidden="true">${lines.map(l => `<span class="l" data-t="${l}">${l}</span>`).join('<br>')}</span>`;
});
function scramble(h) {
  if (!ANIM) return;
  const spans = $$('.l', h); const t0 = performance.now(); const dur = 650;
  cancelAnimationFrame(h._raf);
  const step = (now) => {
    const k = Math.min(1, (now - t0) / dur);
    spans.forEach(s => {
      const t = s.dataset.t; let out = '';
      for (let i = 0; i < t.length; i++) {
        const c = t[i];
        out += (c === ' ' || c === '.' || c === '-' || k >= 1 || k > (i / t.length) * 0.85 + 0.12) ? c : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      s.textContent = out;
    });
    if (k < 1) h._raf = requestAnimationFrame(step);
  };
  h._raf = requestAnimationFrame(step);
}

if (!ANIM) {
  // Reduced motion / no WebGL: static readable page, native scrolling.
  $$('.glitch').forEach(e => e.classList.add('in'));
} else {
  initAnim().catch(err => { console.warn('3D disabled:', err && err.message); fallbackStatic(); });
}

function fallbackStatic() {
  root.classList.remove('anim'); root.classList.add('rm');
  ScrollTrigger.getAll().forEach(t => t.kill());
  $$('.txt').forEach(p => { p.removeAttribute('inert'); p.removeAttribute('aria-hidden'); gsap.set(p, { clearProps: 'all' }); });
}

async function initAnim() {
  gsap.registerPlugin(ScrollTrigger);
  const lenis = new window.Lenis({ lerp: 0.11, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(t => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  window.__lenis = lenis;

  // anchors through Lenis (skip link keeps native focus behaviour)
  $$('a[href^="#"]:not(.skip)').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href'); const el = id === '#main' ? $('#stage') : $(id);
    if (!el) return; e.preventDefault();
    lenis.scrollTo(id === '#main' ? 0 : el, { duration: 1.4, offset: id === '#main' ? 0 : -40 });
    const f = id === '#main' ? $('#main') : el; if (!f.hasAttribute('tabindex')) f.setAttribute('tabindex', '-1');
    setTimeout(() => f.focus({ preventScroll: true }), 1450);
  }));

  const stage = $('#stage');
  const plate = $('.bg-plate');
  const heroImg = $('.hero-burger');
  const panels = { hero: $('#s-hero'), smash: $('#s-smash'), stack: $('#s-stack'), combo: $('#s-combo'), shakes: $('#s-shakes') };
  const labelsEl = $('.labels'); const labelLis = $$('li', labelsEl);

  /* ---------- state driven by the scroll timeline ---------- */
  const S = { hz: 0, spin: 0, seg: 0, explode: 0, photo: 1, items: 0, boxIn: 0, lid: 0, front: 0, labels: 0 };
  let dirty = true;

  /* ---------- layout (screen-space regions) ---------- */
  const L = { vw: 0, vh: 0, portrait: false, navh: 64 };
  function rectOf(p) { // copy block rect inside the stage, ignoring transforms
    const c = $('.copy', p);
    return { x: p.offsetLeft + c.offsetLeft, y: p.offsetTop + c.offsetTop, w: c.offsetWidth, h: c.offsetHeight };
  }
  function measure() {
    L.vw = stage.clientWidth; L.vh = stage.clientHeight; L.portrait = L.vw / L.vh <= 1;
    L.navh = $('.nav').offsetHeight;
    const r = {}; for (const k in panels) r[k] = rectOf(panels[k]);
    L.r = r;
    const pad = 20, top = L.navh + 12, bot = L.vh - 14;
    if (!L.portrait) {
      L.reg = {
        hero: { x0: r.hero.x + r.hero.w + 40, x1: L.vw - 28, y0: top, y1: bot },
        smash: { x0: 28, x1: r.smash.x - 40, y0: top, y1: bot },
        stack: { x0: Math.max(r.stack.x + r.stack.w * 0.55, L.vw * 0.3), x1: L.vw * 0.74, y0: top, y1: bot }, // labels sit right of x1
        combo: { x0: L.vw * 0.12, x1: L.vw * 0.88, y0: top + 20, y1: bot - 20 },
        boxOpen: { x0: 24, x1: r.combo.x - 40, y0: top + 10, y1: bot - 10 },
        boxFront: { x0: r.shakes.x + r.shakes.w + 40, x1: L.vw - 28, y0: top + 30, y1: bot - 30 },
      };
    } else {
      const above = (k, extra = 0) => ({ x0: 14, x1: L.vw - 14, y0: top, y1: r[k].y - 16 - extra });
      L.reg = {
        hero: above('hero'),
        smash: above('smash'),
        stack: { x0: 12, x1: L.vw - 148, y0: top, y1: r.stack.y - 16 },
        combo: above('combo'),
        boxOpen: above('combo'),
        boxFront: { x0: 14, x1: L.vw - 14, y0: r.shakes.y + r.shakes.h + 18, y1: bot - 10 },
      };
    }
  }

  /* hero plate + paper anchor (paper centre in the 1280x720 plate) */
  const PAPER = { x: 640, y: 444 };
  function placePlate() {
    const R = L.reg.hero; const cover = Math.max(L.vw / 1280, L.vh / 720);
    const k = cover * (L.portrait ? 1.6 : 1.25);
    const iw = 1280 * k, ih = 720 * k;
    const want = { x: (R.x0 + R.x1) / 2, y: L.portrait ? R.y1 - (R.y1 - R.y0) * 0.1 : L.navh + (L.vh - L.navh) * 0.7 };
    let ox = want.x - PAPER.x * k, oy = want.y - PAPER.y * k;
    ox = Math.min(0, Math.max(L.vw - iw, ox)); oy = Math.min(0, Math.max(L.vh - ih, oy));
    plate.style.backgroundSize = `${iw}px ${ih}px`;
    plate.style.backgroundPosition = `${ox}px ${oy}px`;
    const paper = { x: ox + PAPER.x * k, y: oy + PAPER.y * k };
    plate.style.transformOrigin = `${paper.x}px ${paper.y}px`;
    // burger photo size: 800x659 → fit region
    const rw = R.x1 - R.x0, rh = paper.y - R.y0;
    let w = Math.min(rw * (L.portrait ? 0.72 : 0.72), rh * 0.92 * 800 / 659, 560);
    const h = w * 659 / 800;
    L.heroB = { cx: paper.x, base: paper.y + h * 0.04, w, h };
    heroImg.style.width = w + 'px';
    heroImg.style.transform = `translate(${paper.x - w / 2}px, ${L.heroB.base - h}px)`;
    heroImg.style.opacity = 1;
  }

  measure(); placePlate();

  /* ---------- timeline ---------- */
  const tl = gsap.timeline({
    defaults: { ease: 'power1.inOut' },
    onUpdate: () => { dirty = true; housekeeping(); },
    scrollTrigger: { trigger: stage, start: 'top top', end: () => '+=' + Math.round(L.vh * 7.2), pin: true, scrub: 0.6, invalidateOnRefresh: true, anticipatePin: 1,
      onToggle: self => { pinned = self.isActive; dirty = true; } },
  });
  let pinned = true;
  const hide = { autoAlpha: 0, y: -24, duration: 0.25 };
  const show = (el, at) => tl.fromTo(el, { autoAlpha: 0, y: 28 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: 'power2.out' }, at);

  tl.to(S, { hz: 1, duration: 0.7, ease: 'none' }, 0)
    .to(S, { spin: 1, duration: 9.4, ease: 'none' }, 0)
    .fromTo(plate, { scale: 1 }, { scale: 1.1, duration: 2.8, ease: 'none' }, 0)
    .fromTo('.bg-kitchen', { scale: 1.1 }, { scale: 1, duration: 4.2, ease: 'none' }, 5.2)
    .to(panels.hero, hide, 0.55)
    .to('.scrim-b', { opacity: 0, duration: 0.35 }, 0.6)
    .to('.scrim-l', { opacity: 0, duration: 0.35 }, 0.6)
    .to(S, { seg: 1, duration: 1.3 }, 0.6)
    .to(S, { photo: 0, duration: 0.18 }, 0.7)
    .to(S, { explode: 1, duration: 1.25, ease: 'power2.in' }, 0.68)
    .to('.bg-shade', { opacity: 0.55, duration: 1 }, 0.7)
    .to('.scrim-r', { opacity: 1, duration: 0.5 }, 1.4);
  show(panels.smash, 1.55);
  tl.to({}, { duration: 0.6 }, 2.0)
    .to(panels.smash, hide, 2.6)
    .to('.scrim-r', { opacity: 0, duration: 0.3 }, 2.6)
    .to('.bg-light', { opacity: 1, duration: 0.7 }, 2.7)
    .to(S, { seg: 2, duration: 0.8 }, 2.7)
    .to(labelsEl, { autoAlpha: 1, duration: 0.35 }, 3.25);
  show(panels.stack, 3.25);
  tl.to({}, { duration: 0.6 }, 3.6)
    .to([panels.stack, labelsEl], hide, 4.2)
    .to(S, { explode: 0, duration: 0.7 }, 4.3)
    .to(S, { photo: 1, duration: 0.15 }, 4.85)
    .to(S, { items: 1, duration: 0.85, ease: 'power3.out' }, 4.4)
    .to(S, { seg: 3, duration: 0.8 }, 4.3)
    .to('.bg-kitchen', { autoAlpha: 1, duration: 0.6 }, 5.25)
    .to('.bg-light', { opacity: 0, duration: 0.6 }, 5.25)
    .to('.bg-shade', { opacity: 0, duration: 0.6 }, 5.25)
    .to(S, { boxIn: 1, duration: 1.0, ease: 'power2.inOut' }, 5.2)
    .to('.scrim-r', { opacity: 1, duration: 0.4 }, 6.0);
  show(panels.combo, 6.1);
  tl.to({}, { duration: 0.6 }, 6.45)
    .to(panels.combo, hide, 7.05)
    .to('.scrim-r', { opacity: 0, duration: 0.3 }, 7.05)
    .to(S, { lid: 1, duration: 1.1, ease: 'power2.inOut' }, 7.15)
    .to(S, { front: 1, duration: 1.3 }, 7.25)
    .to('.scrim-l', { opacity: 1, duration: 0.4 }, 8.2);
  show(panels.shakes, 8.3);
  tl.to({}, { duration: 0.75 }, 8.65);
  window.__tl = tl;

  /* panels: inert/aria in sync with what is painted (runs inside the scrubbed timeline) */
  const active = {};
  function housekeeping() {
    for (const k in panels) {
      const p = panels[k]; const on = gsap.getProperty(p, 'opacity') > 0.5 && gsap.getProperty(p, 'visibility') !== 'hidden';
      if (on !== active[k]) {
        active[k] = on;
        if (on) { p.removeAttribute('inert'); p.removeAttribute('aria-hidden'); if (k !== 'hero' || inited) scramble($('.scr', p)); }
        else { p.setAttribute('inert', ''); p.setAttribute('aria-hidden', 'true'); }
      }
    }
    const kOn = S.boxIn > 0.01 || S.items > 0.6;
    if (kOn && !kitchenLoaded) loadKitchen();
  }
  let inited = false;
  let kitchenLoaded = false;
  function loadKitchen() { kitchenLoaded = true; $('.bg-kitchen').classList.add('ld'); }
  housekeeping(); inited = true;
  document.fonts.ready.then(() => scramble($('#h-hero')));

  /* ---------- menu / concept scroll animations ---------- */
  $$('.card').forEach(c => {
    gsap.fromTo(c, { y: 70, opacity: 0.001 }, { y: 0, opacity: 1, ease: 'power2.out', scrollTrigger: { trigger: c, start: 'top 98%', end: 'top 62%', scrub: 0.5 } });
    const im = $('.ph img', c);
    gsap.fromTo(im, { scale: 1.16, yPercent: -5 }, { scale: 1.0, yPercent: 5, ease: 'none', scrollTrigger: { trigger: c, start: 'top bottom', end: 'bottom top', scrub: true } });
  });
  ScrollTrigger.batch('.glitch', { start: 'top 88%', once: true, onEnter: els => els.forEach((e, i) => setTimeout(() => e.classList.add('in'), i * 90)) });
  gsap.fromTo('.lineup-title', { scale: 0.86, letterSpacing: '0.08em' }, { scale: 1, letterSpacing: '0.005em', ease: 'none', scrollTrigger: { trigger: '.lineup-title', start: 'top bottom', end: 'top 30%', scrub: true } });
  gsap.fromTo('.mq-track', { xPercent: 0 }, { xPercent: -32, ease: 'none', scrollTrigger: { trigger: '.concept', start: 'top bottom', end: 'bottom top', scrub: true } });
  $$('.concept-title .ln').forEach((ln, i) => gsap.fromTo(ln, { yPercent: 60, opacity: 0.001 }, { yPercent: 0, opacity: 1, ease: 'power2.out', scrollTrigger: { trigger: '.concept-in', start: `top ${92 - i * 6}%`, end: `top ${58 - i * 6}%`, scrub: 0.5 } }));
  gsap.fromTo('.concept-body', { y: 50, opacity: 0.001 }, { y: 0, opacity: 1, ease: 'power2.out', scrollTrigger: { trigger: '.concept-in', start: 'top 85%', end: 'top 50%', scrub: 0.5 } });

  /* ---------- Three.js (lazy module) ---------- */
  const THREE = await import('./vendor/three.module.min.js');
  const canvas = $('#gl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 10); camera.updateMatrixWorld(true);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x2a2420, 1.4));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(-3, 6, 5); scene.add(sun);

  const loader = new THREE.TextureLoader();
  const tex = (u) => new Promise((res, rej) => loader.load(u, t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; res(t); }, undefined, rej));

  // layer metadata (source px, exploded reference image 720x1280)
  const LAY = [
    ['l_topbun', 145, 96, 431, 210], ['l_sauce', 144, 336, 428, 105], ['l_onions', 125, 441, 461, 153],
    ['l_patty1', 117, 594, 482, 172], ['l_patty2', 117, 766, 487, 192], ['l_botbun', 161, 958, 399, 202],
  ];
  const CX = 360, CY = 628;
  const [layerTex, photoTex, friesTex, sauceTex, shakeTex] = await Promise.all([
    Promise.all(LAY.map(l => tex(`assets/img/${l[0]}.webp`))),
    tex('assets/img/burger.webp'), tex('assets/img/i_fries.webp'), tex('assets/img/i_sauce.webp'), tex('assets/img/i_shake.webp'),
  ]);

  const burger = new THREE.Group(); scene.add(burger);
  const planeMat = (t) => new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false });
  const layers = LAY.map((l, i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(l[3] / 100, l[4] / 100), planeMat(layerTex[i]));
    m.userData.base = { x: (l[1] + l[3] / 2 - CX) / 100, y: -(l[2] + l[4] / 2 - CY) / 100 };
    m.renderOrder = 10 + i; burger.add(m); return m;
  });
  // shadow under the burger on the paper
  const shCan = document.createElement('canvas'); shCan.width = 256; shCan.height = 64;
  { const g = shCan.getContext('2d'); const gr = g.createRadialGradient(128, 32, 4, 128, 32, 120); gr.addColorStop(0, 'rgba(0,0,0,.75)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.setTransform(1, 0, 0, 0.27, 0, 23); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); }
  const shTex = new THREE.CanvasTexture(shCan);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.3), new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false }));
  shadow.renderOrder = 1; scene.add(shadow);

  // bottom-anchored billboard items (photo burger, fries, sauce, shake). Unit = 1 world unit wide.
  function item(t, w, h) { const g = new THREE.PlaneGeometry(1, h / w); g.translate(0, h / w / 2, 0); const m = new THREE.Mesh(g, planeMat(t)); m.renderOrder = 30; scene.add(m); return m; }
  const photo = item(photoTex, 800, 659);
  const fries = item(friesTex, 362, 394), sauce = item(sauceTex, 252, 222), shake = item(shakeTex, 302, 515);

  /* ---------- the box (procedural, canvas textures) ---------- */
  await document.fonts.load('100px Anton');
  const BW = 3.2, BH = 0.95, BD = 2.0, T = 0.04;
  const box = new THREE.Group(); scene.add(box); box.visible = false;
  function canvasTex(w, h, paint) { const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
  const OR = '#E8622A', RED = '#C8341F';
  function starPath(g, cx, cy, r) { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } g.closePath(); }
  function badge(g, cx, cy, r) {
    g.fillStyle = RED; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = r * 0.035; g.beginPath(); g.arc(cx, cy, r * 0.86, 0, 7); g.stroke();
    g.fillStyle = '#fff';
    g.beginPath(); g.ellipse(cx, cy - r * 0.18, r * 0.42, r * 0.26, 0, Math.PI, 0); g.fill();
    g.fillRect(cx - r * 0.46, cy - r * 0.13, r * 0.92, r * 0.09);
    g.beginPath(); g.roundRect(cx - r * 0.42, cy - r * 0.0, r * 0.84, r * 0.12, r * 0.05); g.fill();
    for (let i = -1; i <= 1; i++) { starPath(g, cx + i * r * 0.22, cy - r * 0.62, r * 0.07); g.fill(); }
    g.textAlign = 'center'; g.font = `${r * 0.3}px Anton`; g.fillText('ALL★STAR', cx, cy + r * 0.45);
    g.font = `${r * 0.13}px Anton`; g.fillText('BURGERS', cx, cy + r * 0.64);
  }
  function wordmark(g, x, y, size, stripes) {
    g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillStyle = '#F4F3EF'; g.font = `${size}px Anton`;
    const a = g.measureText('ALL').width, sw = size * 0.62, s2 = g.measureText('STAR').width;
    g.fillText('ALL', x, y); starPath(g, x + a + sw / 2, y - size * 0.36, size * 0.28); g.fill(); g.fillText('STAR', x + a + sw, y);
    const tw = a + sw + s2;
    g.fillStyle = OR; g.font = `${size * 0.42}px Anton`; g.textAlign = 'center';
    g.fillText('BURGERS', x + tw / 2, y + size * 0.55);
    const bw = g.measureText('BURGERS').width;
    g.fillRect(x, y + size * 0.36, tw / 2 - bw / 2 - size * 0.12, size * 0.035);
    g.fillRect(x + tw / 2 + bw / 2 + size * 0.12, y + size * 0.36, tw / 2 - bw / 2 - size * 0.12, size * 0.035);
    if (stripes) {
      g.font = `${size * 0.2}px Anton`; g.letterSpacing = `${size * 0.03}px`;
      const ty = y + size * 0.92; const txt = 'MADE FRESH. MADE BOLD.'; const w2 = g.measureText(txt).width;
      g.fillText(txt, x + tw / 2, ty);
      g.fillRect(x - size * 0.6, ty - size * 0.08, tw / 2 - w2 / 2 + size * 0.45, size * 0.035);
      g.fillRect(x + tw / 2 + w2 / 2 + size * 0.15, ty - size * 0.08, tw / 2 - w2 / 2, size * 0.035);
      starPath(g, x + tw + size * 0.35, ty - size * 0.07, size * 0.08); g.fill();
      g.letterSpacing = '0px';
    }
    return tw;
  }
  const black = (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#1a1a1a'); gr.addColorStop(1, '#0b0b0b'); g.fillStyle = gr; g.fillRect(0, 0, w, h); };
  const frontTex = canvasTex(2048, 608, (g, w, h) => { black(g, w, h); badge(g, 300, 290, 205); wordmark(g, 600, 300, 220, true); g.fillStyle = OR; g.fillRect(0, h - 10, w, 10); });
  const lidInTex = canvasTex(2048, 1280, (g, w, h) => { black(g, w, h); badge(g, 380, 330, 220); wordmark(g, 720, 380, 240, true); g.fillStyle = OR; g.fillRect(120, 1000, 1500, 8); starPath(g, 1700, 1004, 26); g.fill(); g.fillRect(1760, 1000, 200, 8); });
  const lidTopTex = canvasTex(2048, 1280, (g, w, h) => { black(g, w, h); badge(g, 1024, 520, 330); g.fillStyle = OR; g.fillRect(200, 1000, 1648, 10); g.fillRect(200, 1040, 1648, 10); });
  const floorTex = canvasTex(1024, 640, (g, w, h) => {
    g.fillStyle = '#151515'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(232,98,42,.35)'; g.lineWidth = 3;
    for (let i = -h; i < w; i += 46) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.stroke(); }
    g.fillStyle = OR; for (let y = 40; y < h; y += 120) for (let x = 40 + (y % 240 ? 60 : 0); x < w; x += 120) { starPath(g, x, y, 10); g.fill(); }
  });
  const wallInTex = canvasTex(1024, 256, (g, w, h) => { g.fillStyle = '#141414'; g.fillRect(0, 0, w, h); g.fillStyle = OR; g.fillRect(0, 28, w, 6); });
  const sideTex = canvasTex(512, 256, (g, w, h) => { g.fillStyle = '#A8231B'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; starPath(g, w / 2, h / 2, 80); g.fill(); });
  const sideLTex = canvasTex(512, 256, (g, w, h) => { black(g, w, h); g.fillStyle = OR; g.fillRect(0, h * 0.62, w, 8); });
  const M = (o) => new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0.05, ...o });
  const mBlack = M({ color: 0x121212 }), mIn = M({ map: wallInTex }), mFloor = M({ map: floorTex });
  const panel = (w, h, d, mats, x, y, z, parent = box) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats); m.position.set(x, y, z); parent.add(m); return m; };
  // faces: +x, -x, +y, -y, +z, -z
  panel(BW, T, BD, [mBlack, mBlack, mFloor, mBlack, mBlack, mBlack], 0, T / 2, 0);
  panel(BW, BH, T, [mBlack, mBlack, mBlack, mBlack, M({ map: frontTex }), mIn], 0, BH / 2, BD / 2 - T / 2);
  panel(BW, BH, T, [mBlack, mBlack, mBlack, mBlack, mIn, mBlack], 0, BH / 2, -BD / 2 + T / 2);
  panel(T, BH, BD, [M({ map: sideTex }), mIn, mBlack, mBlack, mBlack, mBlack], BW / 2 - T / 2, BH / 2, 0);
  panel(T, BH, BD, [mIn, M({ map: sideLTex }), mBlack, mBlack, mBlack, mBlack], -BW / 2 + T / 2, BH / 2, 0);
  panel(T, BH * 0.55, BD - 2 * T, [mIn, mIn, mBlack, mBlack, mBlack, mBlack], -0.25, BH * 0.275, 0);
  const lidPivot = new THREE.Group(); lidPivot.position.set(0, BH, -BD / 2); box.add(lidPivot);
  const lidMats = [mBlack, mBlack, M({ map: lidTopTex }), M({ map: lidInTex }), mBlack, mBlack];
  panel(BW + 0.02, T, BD + 0.02, lidMats, 0, T / 2, BD / 2, lidPivot);
  // soft contact shadow
  const bsh = new THREE.Mesh(new THREE.PlaneGeometry(BW * 1.5, BD * 1.7), new THREE.MeshBasicMaterial({ map: canvasTex(256, 256, (g) => { const gr = g.createRadialGradient(128, 128, 30, 128, 128, 128); gr.addColorStop(0, 'rgba(0,0,0,.7)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); }), transparent: true, depthWrite: false }));
  bsh.rotation.x = -Math.PI / 2; bsh.position.y = 0.002; bsh.renderOrder = 2; box.add(bsh);
  // slots inside the box (box-local, bottom anchored) + widths in box units
  const SLOT = { photo: [-0.95, T, 0.05, 1.25], fries: [0.25, T, -0.45, 0.62], sauce: [0.3, T, 0.5, 0.44], shake: [1.02, T, -0.05, 0.62] };
  const BOX_OPEN = { rx: 0.62, ry: -0.3, lid: -1.95 }, BOX_FRONT = { rx: 0.14, ry: 0.0, lid: 0 };

  /* ---------- fitting helpers ---------- */
  const v3 = new THREE.Vector3();
  let wpp = 1; // world units per px at z=0
  function resize() {
    measure(); placePlate();
    renderer.setSize(L.vw, L.vh, false);
    camera.aspect = L.vw / L.vh; camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    wpp = 2 * 10 * Math.tan(THREE.MathUtils.degToRad(17.5)) / L.vh;
    computeFits(); dirty = true;
  }
  const toWorld = (px, py) => ({ x: (px - L.vw / 2) * wpp, y: (L.vh / 2 - py) * wpp });
  const toScreen = (v) => { v3.copy(v).project(camera); return { x: (v3.x + 1) / 2 * L.vw, y: (1 - v3.y) / 2 * L.vh }; };
  // burger content extents in local units
  const spreadOf = (e) => 0.3 + 0.85 * e;
  function burgerExtent(e) { const sp = spreadOf(e); const t = LAY[0], b = LAY[5]; return { top: -(t[2] - CY) / 100 * sp + (sp < 0.5 ? 0.6 : 0), bot: -(b[2] + b[4] - CY) / 100 * sp - (sp < 0.5 ? 0.6 : 0) }; }
  const FIT = {};
  function fitBurger(R, e, wUnits = 5.2, fill = 0.9) {
    const ex = burgerExtent(e); const hU = (ex.top - (ex.bot)) + (e > 0.5 ? 2.1 : 0);
    const rw = R.x1 - R.x0, rh = R.y1 - R.y0;
    const pxPerUnit = Math.min(rw * fill / wUnits, rh * fill / hU);
    const cx = (R.x0 + R.x1) / 2, cy = (R.y0 + R.y1) / 2;
    const w = toWorld(cx, cy); const s = pxPerUnit * wpp;
    return { x: w.x, y: w.y - ((ex.top + ex.bot) / 2) * s, s };
  }
  const COMBO_ITEMS = () => L.portrait
    ? { fries: [-3.4, -2.2, 2.6], sauce: [2.6, -2.4, 1.7], shake: [3.0, -0.6, 2.0] }
    : { fries: [-5.4, -2.0, 3.0], sauce: [3.4, -2.3, 2.0], shake: [4.6, -1.0, 2.4] };
  function computeFits() {
    // hero: photo plane width = 4.9 local units; photo centre y = 0 in local space
    const hb = L.heroB; const s0 = (hb.w * wpp) / 4.9; const c = toWorld(hb.cx, hb.base - hb.h / 2);
    FIT.hero = { x: c.x, y: c.y, s: s0 };
    FIT.smash = fitBurger(L.reg.smash, 1, 5.4, 0.92);
    FIT.stack = fitBurger(L.reg.stack, 1, 5.4, 0.92);
    const it = COMBO_ITEMS(); const xs = [-2.6, 2.6], ys = [-2.4, 2.2];
    for (const k in it) { const [x, y, w] = it[k]; xs.push(x - w / 2, x + w / 2); ys.push(y, y + w * 1.6); }
    const wU = Math.max(...xs) - Math.min(...xs), hU = Math.max(...ys) - Math.min(...ys);
    const R = L.reg.combo; const ppu = Math.min((R.x1 - R.x0) * 0.9 / wU, (R.y1 - R.y0) * 0.85 / hU, L.vh * 0.42 / 4.1);
    const cc = toWorld((R.x0 + R.x1) / 2, (R.y0 + R.y1) / 2); const sC = ppu * wpp;
    FIT.combo = { x: cc.x - ((Math.max(...xs) + Math.min(...xs)) / 2) * sC, y: cc.y - ((Math.max(...ys) + Math.min(...ys)) / 2) * sC, s: sC };
    FIT.boxOpen = fitBox(L.reg.boxOpen, BOX_OPEN, true);
    FIT.boxFront = fitBox(L.reg.boxFront, BOX_FRONT, false);
  }
  const tmpObj = new THREE.Object3D();
  function boxPoints(st, open) {
    const pts = []; for (const x of [-BW / 2, BW / 2]) for (const y of [0, BH]) for (const z of [-BD / 2, BD / 2]) pts.push([x, y, z]);
    const a = st.lid; for (const x of [-BW / 2, BW / 2]) for (const zz of [0, BD]) pts.push([x, BH + Math.sin(-a) * zz, -BD / 2 + Math.cos(a) * zz]);
    if (open) pts.push([SLOT.shake[0], 1.6, SLOT.shake[2]], [SLOT.photo[0], 1.1, SLOT.photo[2]]);
    return pts;
  }
  function boxBBox(st, pos, s, open) {
    tmpObj.position.set(pos.x, pos.y, 0); tmpObj.rotation.set(st.rx, st.ry, 0); tmpObj.scale.setScalar(s); tmpObj.updateMatrixWorld(true);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const p of boxPoints(st, open)) { v3.set(p[0], p[1], p[2]).applyMatrix4(tmpObj.matrixWorld); const q = toScreen(v3); x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
    return { x0, y0, x1, y1 };
  }
  function fitBox(R, st, open) {
    let pos = { x: 0, y: 0 }, s = 1;
    for (let k = 0; k < 4; k++) {
      const b = boxBBox(st, pos, s, open);
      if (k < 2) s *= Math.min((R.x1 - R.x0) * 0.94 / (b.x1 - b.x0), (R.y1 - R.y0) * 0.94 / (b.y1 - b.y0), k === 0 ? 9 : 1.3);
      const b2 = boxBBox(st, pos, s, open);
      pos = { x: pos.x + (((R.x0 + R.x1) / 2) - (b2.x0 + b2.x1) / 2) * wpp, y: pos.y - (((R.y0 + R.y1) / 2) - (b2.y0 + b2.y1) / 2) * wpp };
    }
    return { x: pos.x, y: pos.y, s };
  }

  /* ---------- per-frame scene update ---------- */
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp01 = (t) => Math.max(0, Math.min(1, t));
  const ease = (t) => t * t * (3 - 2 * t);
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener('pointermove', (e) => { mouse.tx = (e.clientX / innerWidth - 0.5); mouse.ty = (e.clientY / innerHeight - 0.5); }, { passive: true });
  const ORDER = ['hero', 'smash', 'stack', 'combo'];
  function anchor() {
    const i = Math.min(2, Math.floor(S.seg)); const t = S.seg - i;
    const a = FIT[ORDER[i]], b = FIT[ORDER[i + 1]];
    return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), s: lerp(a.s, b.s, t) };
  }
  const W = { a: new THREE.Vector3(), b: new THREE.Vector3(), q: new THREE.Quaternion() };
  function placeItem(m, local, slot, kIn, k, opacity, scaleMul = 1) {
    // local: [x,y,w] in burger units (light scene). slot: box-local [x,y,z,w].
    const A = anchor();
    const ax = A.x + local[0] * A.s, ay = A.y + local[1] * A.s, aw = local[2] * A.s * scaleMul;
    let x = ax, y = ay, z = 0.3, w = aw;
    if (k > 0) {
      W.b.set(slot[0], slot[1], slot[2]); box.localToWorld(W.b);
      const bw = slot[3] * box.scale.x; const kk = ease(clamp01(k));
      x = lerp(ax, W.b.x, kk); y = lerp(ay, W.b.y, kk); z = lerp(0.3, W.b.z, kk); w = lerp(aw, bw, kk);
    }
    m.position.set(x, y, z); m.scale.setScalar(Math.max(w, 1e-4));
    m.material.opacity = opacity; m.visible = opacity > 0.003;
  }
  let tNow = 0;
  function update() {
    const A = anchor(); const e = S.explode; const sp = spreadOf(e);
    mouse.x += (mouse.tx - mouse.x) * 0.08; mouse.y += (mouse.ty - mouse.y) * 0.08;
    burger.position.set(A.x, A.y, 0); burger.scale.setScalar(A.s);
    burger.rotation.set(mouse.y * 0.06 * e, mouse.x * 0.18 * e + (S.spin - 0.25) * 0.5 * e, 0);
    const layerOp = (1 - S.photo) * (1 - clamp01(S.boxIn * 3));
    layers.forEach((m, i) => {
      const b = m.userData.base; const fl = Math.sin(tNow * 1.3 + i * 1.1) * 0.05 * e;
      m.position.set(b.x + Math.sin(i * 2.1) * 0.12 * e, b.y * sp + fl, (2.5 - i) * 0.22 * e);
      m.rotation.z = (i % 2 ? 1 : -1) * 0.05 * e;
      m.material.opacity = layerOp; m.visible = layerOp > 0.003;
    });
    // shadow on the hero paper
    const shOp = clamp01(1 - S.seg * 2.2);
    shadow.position.set(A.x, A.y - 2.02 * A.s - 0.02, -0.01); shadow.scale.setScalar(A.s * (1 + S.seg * 0.6));
    shadow.material.opacity = shOp; shadow.visible = shOp > 0.01;

    // box
    const bIn = ease(clamp01(S.boxIn)); const fr = ease(clamp01(S.front));
    box.visible = bIn > 0.001;
    if (box.visible) {
      const o = FIT.boxOpen, f = FIT.boxFront;
      const bx = lerp(o.x, f.x, fr), by = lerp(o.y, f.y, fr), bs = lerp(o.s, f.s, fr);
      box.position.set(bx, lerp(by - L.vh * wpp * 0.9, by, bIn), 0);
      box.scale.setScalar(bs);
      box.rotation.set(lerp(BOX_OPEN.rx, BOX_FRONT.rx, fr) + mouse.y * 0.04, lerp(BOX_OPEN.ry - 0.5 * (1 - bIn), BOX_FRONT.ry, fr) + mouse.x * 0.08 + (S.spin - 0.72) * 0.35, 0);
      lidPivot.rotation.x = lerp(BOX_OPEN.lid, BOX_FRONT.lid, ease(clamp01(S.lid)));
      box.updateMatrixWorld(true);
    }
    // photo burger + side items
    const it = COMBO_ITEMS(); const kIt = S.items; const itE = 1 - Math.pow(1 - clamp01(kIt), 3);
    const kBox = clamp01((S.boxIn - 0.12) / 0.88);
    const lidHide = 1 - clamp01((S.lid - 0.3) / 0.35), lidHideShake = 1 - clamp01((S.lid - 0.12) / 0.3);
    // photo: centred burger (local y offset so its bottom matches bottom bun)
    placeItem(photo, [0, -2.02 + 0.12 * S.hz * (1 - S.items), 4.9 * (1 + 0.05 * S.hz * (1 - S.items))], SLOT.photo, 1, kBox, S.photo * lidHide);
    const fly = (p, from) => [lerp(from[0], p[0], itE), lerp(from[1], p[1], itE), p[2]];
    placeItem(fries, fly(it.fries, [-16, -9]), SLOT.fries, 1, kBox, clamp01(kIt * 3) * lidHide);
    placeItem(sauce, fly(it.sauce, [14, -10]), SLOT.sauce, 1, kBox, clamp01(kIt * 3) * lidHide);
    placeItem(shake, fly(it.shake, [16, 8]), SLOT.shake, 1, kBox, clamp01(kIt * 3) * lidHideShake);
    fries.rotation.z = (1 - itE) * 0.8 * (1 - kBox); shake.rotation.z = -(1 - itE) * 0.6 * (1 - kBox); sauce.rotation.z = (1 - itE) * -0.9 * (1 - kBox);

    // stack labels follow the layers' right edges
    const lOp = gsap.getProperty(labelsEl, 'opacity');
    if (lOp > 0.01) {
      layers.forEach((m, i) => {
        const g = LAY[i]; v3.set(m.position.x + g[3] / 200 * 0.92, m.position.y + (i === 3 || i === 4 ? 0.25 : 0), m.position.z); burger.localToWorld(v3);
        const q = toScreen(v3); const li = labelLis[i];
        li.style.transform = `translate(${Math.round(q.x + 8)}px, ${Math.round(q.y - li.offsetHeight / 2)}px)`;
      });
    }
  }
  function render() {
    tNow = performance.now() / 1000;
    const floating = pinned && (S.explode > 0.05 || S.boxIn > 0) || Math.abs(mouse.tx - mouse.x) + Math.abs(mouse.ty - mouse.y) > 0.002;
    if (!dirty && !floating) return;
    if (!pinned && tl.scrollTrigger.progress >= 1 && stage.getBoundingClientRect().bottom < 0) return;
    update(); renderer.render(scene, camera); dirty = false;
  }
  resize();
  update(); renderer.render(scene, camera);
  canvas.classList.add('on'); heroImg.classList.add('off');
  gsap.ticker.add(render);
  let rT; window.addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(() => { resize(); ScrollTrigger.refresh(); }, 120); });
  // idle prefetch of the kitchen plate
  (window.requestIdleCallback || setTimeout)(() => { if (!kitchenLoaded) { const i = new Image(); i.src = 'assets/img/kitchen.webp'; } }, { timeout: 3000 });

  // test hooks
  window.__bb = () => {
    const out = {}; const bbox = (m) => { if (!m.visible) return null; const b = new THREE.Box3(); m.updateMatrixWorld(true); m.traverseVisible(o => { if (o.isMesh) { o.geometry.computeBoundingBox(); b.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld)); } }); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) { const q = toScreen(new THREE.Vector3(x, y, z)); x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); } return { x0, y0, x1, y1 }; };
    out.layers = layers.some(l => l.visible) ? layers.map(bbox).filter(Boolean) : [];
    out.photo = bbox(photo); out.fries = bbox(fries); out.sauce = bbox(sauce); out.shake = bbox(shake); bsh.visible = false; out.box = box.visible ? bbox(box) : null; bsh.visible = true;
    return out;
  };
  window.__S = S;
}
