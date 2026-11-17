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
  // {word} = orange accent segment
  const seg = (l, li) => l.split(/(\{[^}]+\})/).filter(Boolean).map(x => { const acc = x[0] === '{'; const t = acc ? x.slice(1, -1) : x; return `<span class="l${acc ? ' acc' : ''}" data-t="${t}">${t}</span>`; }).join('').replace(/^<span class="l/, li ? '<span class="nl l' : '$&');
  h.innerHTML = `<span class="sr">${lines.join(' ').replace(/[{}]/g, '')}</span><span aria-hidden="true">${lines.map(seg).join('<br>')}</span>`;
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
  const plate = $('.bg-plate'), noPaper = $('.bg-nopaper');
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
        // video framing: the burger stays centred (~47% of the width) from the hero to the stack
        hero: { x0: L.vw * 0.31, x1: L.vw * 0.63, y0: top, y1: bot },
        smash: { x0: L.vw * 0.34, x1: L.vw * 0.64, y0: top + (L.vh - top) * 0.02, y1: L.vh * 0.84 }, // video: centred, the title overlaps its right edge
        stack: { x0: L.vw * 0.31, x1: L.vw * 0.65, y0: top - 2, y1: L.vh * 0.97 }, // labels sit right of x1
        combo: { x0: L.vw * 0.07, x1: L.vw * 0.6, y0: top + 30, y1: bot - 24 }, // video: the reassembled set sits left of centre
        boxOpen: { x0: L.vw * 0.05, x1: L.vw * 0.72, y0: top + 6, y1: L.vh - 10 }, // whole box incl. the open lid, kept below the nav
        boxFront: { x0: L.vw * 0.15, x1: L.vw * 0.86, y0: top + (L.vh - top) * 0.24, y1: L.vh * 0.74 }, // z028 framing
      };
    } else {
      const above = (k, extra = 0) => ({ x0: 14, x1: L.vw - 14, y0: top, y1: r[k].y - 16 - extra });
      L.reg = {
        hero: above('hero'),
        smash: above('smash'),
        stack: { x0: 12, x1: L.vw - 148, y0: top, y1: r.stack.y - 16 },
        combo: above('combo'),
        boxOpen: { x0: 8, x1: L.vw - 8, y0: top + 4, y1: r.combo.y - 10 },
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
    const want = { x: (R.x0 + R.x1) / 2, y: L.portrait ? R.y1 - (R.y1 - R.y0) * 0.1 : L.navh + (L.vh - L.navh) * 0.62 };
    let ox = want.x - PAPER.x * k, oy = want.y - PAPER.y * k;
    ox = Math.min(0, Math.max(L.vw - iw, ox)); oy = Math.min(0, Math.max(L.vh - ih, oy));
    for (const el of [plate, noPaper]) { el.style.backgroundSize = `${iw}px ${ih}px`; el.style.backgroundPosition = `${ox}px ${oy}px`; }
    const paper = { x: ox + PAPER.x * k, y: oy + PAPER.y * k };
    plate.style.transformOrigin = noPaper.style.transformOrigin = `${paper.x}px ${paper.y}px`;
    // burger photo size: 800x659 → fit region
    const rw = R.x1 - R.x0, rh = paper.y - R.y0;
    let w = Math.min(rw * (L.portrait ? 0.72 : 0.86), rh * 0.92 * 800 / 659, 620);
    const h = w * 659 / 800;
    L.heroB = { cx: paper.x, base: paper.y + h * 0.04, w, h };
    heroImg.style.width = w + 'px';
    heroImg.style.transform = `translate(${paper.x - w / 2}px, ${L.heroB.base - h}px)`;
    heroImg.style.opacity = 1;
  }

  measure(); placePlate(); noPaper.classList.add('ld');

  /* ---------- timeline ---------- */
  const tl = gsap.timeline({
    defaults: { ease: 'power1.inOut' },
    onUpdate: () => { dirty = true; housekeeping(); },
    scrollTrigger: { trigger: stage, start: 'top top', end: () => '+=' + Math.round(L.vh * 7.6), pin: true, scrub: 0.6, invalidateOnRefresh: true, anticipatePin: 1,
      onToggle: self => { pinned = self.isActive; dirty = true; } },
  });
  let pinned = true;
  // copy blocks scroll through like the video: rise in from below, rest, then leave upwards
  const show = (el, at) => tl.fromTo(el, { y: () => L.vh * 0.42 }, { y: 0, duration: 0.5, ease: 'power2.out' }, at).fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.12, ease: 'none' }, at);
  const leave = (el, at) => tl.to(el, { y: () => -L.vh * (L.portrait && (el === panels.shakes) ? 0.06 : 0.42), duration: 0.42, ease: 'power1.in' }, at).to(el, { autoAlpha: 0, duration: 0.2, ease: 'none' }, at + 0.12);

  tl.to(S, { hz: 1, duration: 0.9, ease: 'none' }, 0)
    .to(S, { spin: 1, duration: 9.9, ease: 'none' }, 0)
    .fromTo([plate, noPaper], { scale: 1 }, { scale: 1.1, duration: 1.8, ease: 'none' }, 0)
    .fromTo('.bg-kitchen', { scale: 1.1 }, { scale: 1, duration: 4.6, ease: 'none' }, 5.2);
  leave(panels.hero, 0.6);
  tl.to('.scrim-b', { opacity: 0, duration: 0.35 }, 0.7)
    .to('.scrim-l', { opacity: 0, duration: 0.35 }, 0.7)
    .to(S, { seg: 1, duration: 1.0 }, 0.85)
    .to(S, { photo: 0, duration: 0.15 }, 0.92)
    .to(S, { explode: 0.42, duration: 0.85, ease: 'power2.out' }, 0.9)
    // v6: like the video the napkin stays; the table + paper slide down-left as the burger splits (z009/z010)
    .to(plate, { xPercent: -22, yPercent: 16, duration: 1.4, ease: 'power1.inOut' }, 0.9)
    .to('.bg-shade', { opacity: 0.62, duration: 0.8 }, 0.95)
    .to('.scrim-r', { opacity: 1, duration: 0.5 }, 1.4);
  show(panels.smash, 1.45);
  leave(panels.smash, 2.55);
  tl.to('.scrim-r', { opacity: 0, duration: 0.3 }, 2.6)
    .to(S, { explode: 0.62, duration: 0.7 }, 2.65)
    .to('.bg-light', { opacity: 1, duration: 0.6 }, 2.7)
    .to(S, { seg: 2, duration: 0.8 }, 2.7)
    .to(labelsEl, { autoAlpha: 1, duration: 0.35 }, 3.2);
  show(panels.stack, 3.15);
  // like the video (z017): the list goes first, the THE STACK title keeps drifting up while the combo set assembles
  { const sp = panels.stack; const rest = [$('.num', sp), $('.stack-list', sp)].filter(Boolean);
    tl.to(rest, { autoAlpha: 0, duration: 0.25, ease: 'none' }, 4.15)
      .to(sp, { y: () => -L.vh * (L.portrait ? 0.08 : 0.5), duration: 1.0, ease: 'none' }, 4.15)
      .to(sp, { autoAlpha: 0, duration: 0.2, ease: 'none' }, 5.08); }
  tl.to(labelsEl, { autoAlpha: 0, duration: 0.25 }, 4.15)
    .to(S, { explode: 0, duration: 0.5 }, 4.3)
    .to(S, { photo: 1, duration: 0.05, ease: 'none' }, 4.8)
    .to(S, { items: 1, duration: 0.85, ease: 'power3.out' }, 4.4)
    .to(S, { seg: 3, duration: 0.8 }, 4.3)
    .to('.bg-kitchen', { autoAlpha: 1, duration: 0.6 }, 5.25)
    .to('.bg-light', { opacity: 0, duration: 0.6 }, 5.25)
    .to('.bg-shade', { opacity: 0, duration: 0.6 }, 5.25)
    .to(S, { boxIn: 1, duration: 1.0, ease: 'power2.inOut' }, 5.2)
    .to('.scrim-r', { opacity: 1, duration: 0.4 }, 5.8);
  show(panels.combo, 5.75);
  leave(panels.combo, 7.0);
  tl.to('.scrim-r', { opacity: 0, duration: 0.3 }, 7.05)
    .to(S, { lid: 1, duration: 1.1, ease: 'power2.inOut' }, 7.15)
    .to(S, { front: 1, duration: 1.3 }, 7.25)
    .to('.scrim-l', { opacity: 1, duration: 0.4 }, 7.9);
  show(panels.shakes, 7.9);
  leave(panels.shakes, 9.15);
  tl.to('.scrim-l', { opacity: 0, duration: 0.4 }, 9.2)
    .to({}, { duration: 0.35 }, 9.55);
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

  /* ---------- Three.js: loaded on the first interaction (or once the page has been idle for a while) ----------
     Until then the hero shows the same burger photo, so nothing changes visually; this keeps the main thread free while the page loads. */
  await new Promise(res => {
    const EV = ['wheel', 'touchstart', 'pointerdown', 'keydown', 'scroll'];
    let done = false; const go = () => { if (done) return; done = true; EV.forEach(e => removeEventListener(e, go)); res(); };
    EV.forEach(e => addEventListener(e, go, { passive: true }));
    if (scrollY > 2) go();
    const later = () => setTimeout(() => (window.requestIdleCallback ? requestIdleCallback(go, { timeout: 2000 }) : go()), 6000);
    if (document.readyState === 'complete') later(); else addEventListener('load', later, { once: true });
  });
  const yieldMain = () => new Promise(r => setTimeout(r, 0));
  const THREE = await import('./vendor/three-app.js?v=6');
  const canvas = $('#gl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = true;
  const scene = new THREE.Scene();
  await yieldMain();
  scene.environment = THREE.studioEnv(renderer); scene.environmentIntensity = 0.85;
  await yieldMain();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 10); camera.updateMatrixWorld(true);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x2a2420, 1.4));
  const sun = new THREE.DirectionalLight(0xfff4e6, 2.4); sun.position.set(-3, 6, 5); scene.add(sun); scene.add(sun.target);
  sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02; sun.shadow.radius = 4;

  const loader = new THREE.TextureLoader();
  const tex = (u) => new Promise((res, rej) => loader.load(u, t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; res(t); }, undefined, rej));

  // layer metadata (source px, exploded reference image 720x1280)
  const LAY = [
    ['l_topbun', 145, 96, 431, 210], ['l_sauce', 144, 336, 428, 105], ['l_onions', 125, 441, 461, 153],
    ['l_patty1', 117, 594, 482, 172], ['l_patty2', 117, 766, 487, 192], ['l_botbun', 161, 958, 399, 202],
  ];
  const CX = 360, CY = 628;
  const [layerTex, photoTex] = await Promise.all([
    Promise.all(LAY.map(l => tex(`assets/img/${l[0]}.webp`))),
    tex('assets/img/burger.webp'),
  ]);

  const burger = new THREE.Group(); scene.add(burger);
  const planeMat = (t) => new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false });
  // thickness for photo cut-outs: darker copies stacked behind the face, so any yaw shows a solid edge (2.5D volume)
  function addSlices(m, n, depth, dark = 0.42, dy = 0) {
    const sl = [];
    for (let j = 1; j <= n; j++) {
      const k = j / n, c = Math.round(255 * (1 - (1 - dark) * Math.min(1, 0.45 + k * 0.55))) * 0x010101;
      const sm = new THREE.Mesh(m.geometry, new THREE.MeshBasicMaterial({ map: m.material.map, transparent: true, depthWrite: false, toneMapped: false, color: c, opacity: 0 }));
      sm.position.set(0, -dy * k, -depth * k); sm.renderOrder = m.renderOrder - 1; m.add(sm); sl.push(sm);
    }
    m.userData.slices = sl; return sl;
  }
  const syncSlices = (m, op) => { const sl = m.userData.slices; if (!sl) return; for (const c of sl) { c.material.opacity = op; c.visible = op > 0.003; } };
  const layers = LAY.map((l, i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(l[3] / 100, l[4] / 100), planeMat(layerTex[i]));
    m.userData.base = { x: (l[1] + l[3] / 2 - CX) / 100, y: -(l[2] + l[4] / 2 - CY) / 100 };
    m.renderOrder = 10 + i; burger.add(m);
    // volume: a darker "edge" copy just below (thickness) + a soft silhouette shadow falling on the layer underneath
    const img = layerTex[i].image, sw = 96, shh = Math.max(8, Math.round(96 * img.height / img.width));
    const sc = document.createElement('canvas'); sc.width = sw + 24; sc.height = shh + 24; const sg = sc.getContext('2d');
    sg.drawImage(img, 12, 12, sw, shh); sg.globalCompositeOperation = 'source-in'; sg.fillStyle = '#1b0d04'; sg.fillRect(0, 0, sc.width, sc.height);
    const bl = document.createElement('canvas'); bl.width = 30; bl.height = Math.max(4, Math.round(30 * sc.height / sc.width)); bl.getContext('2d').drawImage(sc, 0, 0, bl.width, bl.height);
    const st = new THREE.CanvasTexture(bl); st.colorSpace = THREE.SRGBColorSpace;
    const pw = l[3] / 100, ph = l[4] / 100;
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(pw * 1.12, ph * 1.25), new THREE.MeshBasicMaterial({ map: st, transparent: true, depthWrite: false, opacity: 0 }));
    sh.position.set(0.04, -ph * 0.32, -0.06); sh.renderOrder = 9; m.add(sh);
    addSlices(m, 5, 0.16, 0.45, Math.min(0.06, ph * 0.08));
    m.userData.sh = sh;
    return m;
  });
  // shadow under the burger on the paper
  const shCan = document.createElement('canvas'); shCan.width = 256; shCan.height = 64;
  { const g = shCan.getContext('2d'); const gr = g.createRadialGradient(128, 32, 4, 128, 32, 120); gr.addColorStop(0, 'rgba(0,0,0,.75)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.setTransform(1, 0, 0, 0.27, 0, 23); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); }
  const shTex = new THREE.CanvasTexture(shCan);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.3), new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false }));
  shadow.renderOrder = 1; scene.add(shadow);

  // bottom-anchored billboard items (photo burger, fries, sauce, shake). Unit = 1 world unit wide.
  function item(t, w, h) { const g = new THREE.PlaneGeometry(1, h / w); g.translate(0, h / w / 2, 0); const m = new THREE.Mesh(g, planeMat(t)); m.renderOrder = 30; scene.add(m); return m; }
  const photo = item(photoTex, 800, 659); addSlices(photo, 6, 0.06, 0.5);

  /* ---------- the box (procedural, canvas textures) ---------- */
  await document.fonts.load('100px Anton'); await yieldMain();
  const BW = 3.2, BH = 0.95, BD = 2.0, T = 0.04;
  const box = new THREE.Group(); scene.add(box); box.visible = false;
  function canvasTex(w, h, paint) { const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
  const OR = '#E8622A', RED = '#C8341F';
  function starPath(g, cx, cy, r) { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } g.closePath(); }
  function badge(g, cx, cy, r, bg = RED, fg = '#fff') {
    g.fillStyle = bg; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
    g.strokeStyle = fg; g.globalAlpha = 0.75; g.lineWidth = r * 0.035; g.beginPath(); g.arc(cx, cy, r * 0.86, 0, 7); g.stroke(); g.globalAlpha = 1;
    g.fillStyle = fg;
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
  function tagline(g, x, ty, size, tw) { // a second "MADE FRESH. MADE BOLD." rule, as on the video's closed box
    g.fillStyle = OR; g.font = `${size * 0.2}px Anton`; g.letterSpacing = `${size * 0.03}px`; g.textAlign = 'center';
    const txt = 'MADE FRESH. MADE BOLD.'; const w2 = g.measureText(txt).width; g.fillText(txt, x + tw / 2, ty);
    g.fillRect(x - size * 0.6, ty - size * 0.08, tw / 2 - w2 / 2 + size * 0.45, size * 0.035);
    g.fillRect(x + tw / 2 + w2 / 2 + size * 0.15, ty - size * 0.08, tw / 2 - w2 / 2, size * 0.035);
    starPath(g, x + tw + size * 0.35, ty - size * 0.07, size * 0.08); g.fill(); g.letterSpacing = '0px';
  }
  const black = (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#1a1a1a'); gr.addColorStop(1, '#0b0b0b'); g.fillStyle = gr; g.fillRect(0, 0, w, h); };
  const frontTex = canvasTex(2048, 608, (g, w, h) => { black(g, w, h); badge(g, 300, 270, 200); const tw = wordmark(g, 600, 250, 210, true); tagline(g, 600, 250 + 210 * 1.18, 210, tw); g.fillStyle = OR; g.fillRect(0, h - 10, w, 10); });
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
  const panel = (w, h, d, mats, x, y, z, parent = box) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; };
  // faces: +x, -x, +y, -y, +z, -z
  panel(BW, T, BD, [mBlack, mBlack, mFloor, mBlack, mBlack, mBlack], 0, T / 2, 0);
  panel(BW, BH, T, [mBlack, mBlack, mBlack, mBlack, M({ map: frontTex }), mIn], 0, BH / 2, BD / 2 - T / 2);
  panel(BW, BH, T, [mBlack, mBlack, mBlack, mBlack, mIn, mBlack], 0, BH / 2, -BD / 2 + T / 2);
  panel(T, BH, BD, [M({ map: sideTex }), mIn, mBlack, mBlack, mBlack, mBlack], BW / 2 - T / 2, BH / 2, 0);
  panel(T, BH, BD, [mIn, M({ map: sideLTex }), mBlack, mBlack, mBlack, mBlack], -BW / 2 + T / 2, BH / 2, 0);
  panel(T, BH * 0.62, BD - 2 * T, [mIn, mIn, mBlack, mBlack, mBlack, mBlack], -0.18, BH * 0.31, 0);
  // raised insert for the dips (front-right) + ring holder wall for the shake, like the video's compartments
  const INS = { burger: 0.34, dips: 0.6, fries: 0.22, shake: 0.36 };
  panel(1.36, INS.burger, BD - 2 * T, [mIn, mIn, mFloor, mBlack, mIn, mIn], -0.88, INS.burger / 2, 0);
  panel(0.86, INS.dips, 0.84, [mIn, mIn, mFloor, mBlack, mIn, mIn], 0.3, INS.dips / 2, 0.54);
  panel(0.86, INS.fries, 1.0, [mIn, mIn, mFloor, mBlack, mIn, mIn], 0.3, INS.fries / 2, -0.48);
  panel(0.8, INS.shake, BD - 2 * T, [mIn, mIn, mFloor, mBlack, mIn, mIn], 1.17, INS.shake / 2, 0);
  const lidPivot = new THREE.Group(); lidPivot.position.set(0, BH, -BD / 2); box.add(lidPivot);
  const lidMats = [mBlack, mBlack, M({ map: lidTopTex }), M({ map: lidInTex }), mBlack, mBlack];
  panel(BW + 0.02, T, BD + 0.02, lidMats, 0, T / 2, BD / 2, lidPivot);
  // soft contact shadow
  const bsh = new THREE.Mesh(new THREE.PlaneGeometry(BW * 1.5, BD * 1.7), new THREE.MeshBasicMaterial({ map: canvasTex(256, 256, (g) => { const gr = g.createRadialGradient(128, 128, 30, 128, 128, 128); gr.addColorStop(0, 'rgba(0,0,0,.7)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); }), transparent: true, depthWrite: false }));
  bsh.rotation.x = -Math.PI / 2; bsh.position.y = 0.002; bsh.renderOrder = 2; box.add(bsh);
  // slots inside the box (box-local, bottom anchored) + widths in box units
  const SLOT = { photo: [-0.89, INS.burger, 0.06, 1.4], burger: [-0.89, INS.burger, 0.06, 0], fries: [0.3, INS.fries, -0.46, 0], dipO: [0.08, INS.dips, 0.4, 0], dipD: [0.52, INS.dips, 0.7, 0], shake: [1.14, INS.shake, 0.04, 0] };
  const BOX_OPEN = { rx: 0.46, ry: -0.26, lid: -1.74 }, BOX_FRONT = { rx: 0.09, ry: 0.0, lid: 0 }; // open: 3/4 view like the video; closed: straight-on front

  await yieldMain();
  /* ---------- combo food: photographic 2.5D sprites (camera-facing photo layers + contact shadows) ----------
     Each item is a group anchored at its base. Its photo layers always face the camera (so they read like the video's
     photography), get a slight per-layer yaw/roll for depth while they fly in, and sit on a soft contact shadow once in the box. */
  const [pileT, trayT, dipOT, dipDT, shakeT] = await Promise.all(['f_pile', 'f_tray', 'f_dipo', 'f_dipd', 'f_shake'].map(n => tex(`assets/img/${n}.webp?v=6`)));
  const blob = canvasTex(256, 128, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(0,0,0,.85)'); gr.addColorStop(0.55, 'rgba(0,0,0,.4)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.setTransform(1, 0, 0, 0.5, 0, h / 4); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
  function layerMesh(t, w, opts = {}) {
    const ar = t.image.height / t.image.width, h = w * ar;
    const geo = new THREE.PlaneGeometry(w, h); geo.translate(0, h / 2 - (opts.sink || 0) * h, 0);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false, color: opts.tint || 0xffffff }));
    if (opts.flip) m.scale.x = -1; m.renderOrder = 40; m.userData = { h, w, dx: opts.dx || 0, dz: opts.dz || 0, yaw: opts.yaw || 0, op: opts.op ?? 1 }; addSlices(m, 5, w * 0.07, 0.42); return m;
  }
  function sprite(layersDef, shadowW, boxOnly = []) {
    const g = new THREE.Group(); const L2 = layersDef.map(([t, w, o]) => layerMesh(t, w, o));
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(shadowW, shadowW * 0.55), new THREE.MeshBasicMaterial({ map: blob, transparent: true, depthWrite: false, opacity: 0 }));
    sh.rotation.x = -Math.PI / 2; sh.position.y = 0.006; sh.renderOrder = 35; g.add(sh);
    L2.forEach(m => g.add(m)); scene.add(g); g.visible = false;
    const top = L2[0]; g.userData = { w: top.userData.w, h: top.userData.h, layers: L2, sh, boxOnly };
    return g;
  }
  // fries: a tray (light scene, like the video's reassembly) that turns into a loose golden heap in the box compartment
  const fries = sprite([[trayT, 1.0, {}], [pileT, 1.0, { flip: true, dx: -0.06, dz: -0.1, yaw: 0.12, tint: 0xd9c2a0, sink: 0.08 }], [pileT, 0.94, { dx: 0.05, dz: 0.06, yaw: -0.1, sink: 0.06 }]], 0.95);
  fries.userData.boxLayers = [1, 2]; fries.userData.freeLayers = [0];
  const dipO = sprite([[dipOT, 1.0, {}]], 1.0), dipD = sprite([[dipDT, 1.0, {}]], 1.0);
  const shake = sprite([[shakeT, 1.0, {}]], 0.9);
  const burgerSh = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.82), new THREE.MeshBasicMaterial({ map: blob, transparent: true, depthWrite: false, opacity: 0 }));
  burgerSh.rotation.x = -Math.PI / 2; burgerSh.renderOrder = 35; box.add(burgerSh); burgerSh.position.set(SLOT.photo[0], SLOT.photo[1] + 0.006, SLOT.photo[2]);
  const FOOD = { fries, dipO, dipD, shake };
  fries.userData.lift = 1.7; dipO.userData.lift = dipD.userData.lift = 1.1; shake.userData.lift = 0.5; fries.userData.k = 0.95; shake.userData.k = 0.8; dipO.userData.k = dipD.userData.k = 0.54;

  await yieldMain();
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
  // free (light scene) poses around the reassembled burger, burger units: [x, y(centre), width]
  const COMBO_ITEMS = () => L.portrait
    ? { fries: [-1.9, 3.4, 1.7], dipO: [-0.3, 5.4, 0.95], dipD: [0.7, 5.3, 1.0], shake: [2.15, 1.2, 1.65] }
    : { fries: [-4.7, 0.9, 3.0], dipO: [-0.6, 5.3, 1.0], dipD: [0.7, 5.2, 1.1], shake: [3.9, 1.5, 3.1] };
  function computeFits() {
    // hero: photo plane width = 4.9 local units; photo centre y = 0 in local space
    const hb = L.heroB; const s0 = (hb.w * wpp) / 4.9; const c = toWorld(hb.cx, hb.base - hb.h / 2);
    FIT.hero = { x: c.x, y: c.y, s: s0 };
    FIT.smash = fitBurger(L.reg.smash, 0.42, 5.4, L.portrait ? 0.86 : 0.97);
    FIT.stack = fitBurger(L.reg.stack, 0.62, 5.4, L.portrait ? 0.9 : 1.0);
    const it = COMBO_ITEMS(); const xs = [-2.6, 2.6], ys = [-2.4, 2.2];
    for (const k in it) { const [x, y, w] = it[k]; const h = w * FOOD[k].userData.h / FOOD[k].userData.w; xs.push(x - w / 2, x + w / 2); ys.push(y - h / 2, y + h / 2); }
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
    { const a = st.lid; for (const x of [-BW / 2, BW / 2]) for (const zz of [0, BD]) pts.push([x, BH + Math.sin(-a) * zz, -BD / 2 + Math.cos(a) * zz]); }
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
    if (m.userData.slices) { m.rotation.y = k > 0 ? Math.max(-0.16, box.rotation.y * 0.35 + 0.05) * ease(clamp01(k * 1.4)) : 0; syncSlices(m, k > 0 ? opacity * ease(clamp01(k * 3)) : 0); }
  }
  const qInv = new THREE.Quaternion(), qF = new THREE.Quaternion(), eF = new THREE.Euler();
  const qA = new THREE.Quaternion(), qB = new THREE.Quaternion(), eA = new THREE.Euler(), vS = new THREE.Vector3(), qSlot = new THREE.Quaternion();
  function place3(o, local, slot, k, roll, yaw) {
    // local: [x, yCentre, width] in burger units (free pose); slot: box-local [x, y, z]
    const A = anchor(); const sF = Math.max(local[2] * A.s / o.userData.w, 1e-4);
    let x = A.x + local[0] * A.s, y = A.y + local[1] * A.s - o.userData.h * sF * 0.5, z = 0.8, sc = sF;
    eA.set(0.42 + mouse.y * 0.06, yaw + (S.spin - 0.5) * 0.9 + mouse.x * 0.2, roll); qA.setFromEuler(eA);
    if (k > 0) {
      vS.set(slot[0], slot[1], slot[2]); box.localToWorld(vS); const kk = ease(clamp01(k));
      qSlot.setFromAxisAngle(vS.clone().set(0, 1, 0), yaw * 0.4); qB.copy(box.quaternion).multiply(qSlot);
      x = lerp(x, vS.x, kk); y = lerp(y, vS.y, kk) + Math.sin(Math.PI * kk) * (o.userData.lift ?? 0.9) * box.scale.x; z = lerp(z, vS.z, kk) + Math.sin(Math.PI * kk) * 0.6 * box.scale.x; // arc: items drop into their compartments from above sc = lerp(sF, box.scale.x * (o.userData.k || 1), kk); qA.slerp(qB, kk);
    }
    o.position.set(x, y, z); o.scale.setScalar(sc); o.quaternion.copy(qA);
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
      const vol = clamp01((e - 0.15) / 0.3); m.userData.sh.material.opacity = i === 5 ? 0 : 0.42 * layerOp * vol; syncSlices(m, layerOp * vol);
      m.rotation.y = (i - 2.5) * 0.07 * e + 0.22 * e; // tiny per-layer yaw: the layers turn slightly differently as the burger spins → parallax depth
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
      box.rotation.set(lerp(BOX_OPEN.rx, BOX_FRONT.rx, fr) + mouse.y * 0.04 * (1 - fr), lerp(BOX_OPEN.ry - 0.5 * (1 - bIn), BOX_FRONT.ry, fr) + (mouse.x * 0.08 + (S.spin - 0.72) * 0.35) * (1 - fr), 0);
      lidPivot.rotation.x = lerp(BOX_OPEN.lid, BOX_FRONT.lid, ease(clamp01(S.lid)));
      box.updateMatrixWorld(true);
    }
    // burger photo (same plane from the hero) docks in its compartment; fries, dips and shake are 2.5D photo sprites
    const it = COMBO_ITEMS(); const kIt = S.items; const itE = 1 - Math.pow(1 - clamp01(kIt), 3);
    const kBox = clamp01((S.boxIn - 0.12) / 0.88);
    const inBox = S.lid < 0.93 ? 1 : 0, lidHideShake = 1 - clamp01((S.lid - 0.12) / 0.3);
    placeItem(photo, [0, -2.02 + 0.12 * S.hz * (1 - S.items), 4.9 * (1 + 0.05 * S.hz * (1 - S.items))], SLOT.photo, 1, kBox, S.photo * inBox);
    const shK = ease(clamp01((kBox - 0.55) / 0.45));
    burgerSh.material.opacity = 0.75 * ease(clamp01(kBox * 1.6)) * S.photo * inBox; burgerSh.visible = box.visible && burgerSh.material.opacity > 0.01;
    const fly = (p, from) => [lerp(from[0], p[0], itE), lerp(from[1], p[1], itE), p[2]];
    const FROM = { fries: [-16, 9], dipO: [-6, 16], dipD: [8, 15], shake: [17, 4] }, SPIN = { fries: -0.5, dipO: 0.3, dipD: -0.2, shake: 0.4 };
    const swap = ease(clamp01((kBox - 0.22) / 0.2)); // fries tray → loose heap while it drops into the box
    for (const k of ['fries', 'dipO', 'dipD', 'shake']) {
      const o = FOOD[k]; const roll = (1 - itE) * (k === 'shake' ? -0.5 : 0.6);
      place3(o, fly(it[k], FROM[k]), SLOT[k], kBox, roll, SPIN[k]);
      // the reassembled light scene shows one dip (the dark one, like the video); the orange one joins in the box
      let op = (k === 'dipO' ? ease(clamp01((kBox - 0.2) / 0.5)) : clamp01(kIt * 2.5)) * (k === 'shake' ? lidHideShake : inBox);
      o.visible = op > 0.003; if (!o.visible) continue;
      qInv.copy(o.quaternion).invert();
      o.userData.layers.forEach((m, i) => {
        const u = m.userData; let lop = u.op;
        if (o.userData.boxLayers) lop *= o.userData.boxLayers.includes(i) ? swap : 1 - swap;
        // face the camera, with a slight per-layer yaw + roll that settles as the item lands
        const settle = 1 - ease(clamp01(kBox));
        eF.set(0, (u.yaw + SPIN[k] * 0.5) * (0.35 + settle) + Math.max(-0.18, box.rotation.y * 0.35) * ease(clamp01(kBox * 1.4)) + 0.06 + mouse.x * 0.05, roll * 0.9 * settle + roll * 0.1); qF.setFromEuler(eF);
        m.quaternion.copy(qInv).multiply(qF);
        m.position.set(u.dx, 0, u.dz);
        m.material.opacity = op * lop; m.visible = m.material.opacity > 0.003; syncSlices(m, m.material.opacity);
      });
      o.userData.sh.material.opacity = 0.7 * op * ease(clamp01(kBox * 1.6)); o.userData.sh.visible = o.userData.sh.material.opacity > 0.01;
    }
    // key light + shadow frustum follow the box
    if (box.visible || photo.visible) {
      const bs = box.scale.x; sun.target.position.copy(box.position); sun.position.set(box.position.x - 3 * bs, box.position.y + 6 * bs, box.position.z + 5 * bs);
      const sc = sun.shadow.camera, ext = 2.4 * bs;
      if (Math.abs(sc.right - ext) > 1e-3) { sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 0.5 * bs; sc.far = 16 * bs; sc.updateProjectionMatrix(); }
    }

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
  // compile every material up front (in parallel where the GPU driver allows) so nothing hitches mid-scroll
  { const hid = []; scene.traverse(o => { if (!o.visible) { hid.push(o); o.visible = true; } });
    try { await (renderer.compileAsync ? renderer.compileAsync(scene, camera) : renderer.compile(scene, camera)); } catch (e) {}
    hid.forEach(o => { o.visible = false; }); await yieldMain(); }
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
    out.photo = bbox(photo); out.burger3 = null; out.fries = bbox(fries); out.dipO = bbox(dipO); out.dipD = bbox(dipD); out.shake = bbox(shake); bsh.visible = false; out.box = box.visible ? bbox(box) : null; bsh.visible = true;
    return out;
  };
  window.__S = S;
}
