/* v7 — real 3D food (geometry + PBR, procedural canvas textures, no photos).
   Box units: the combo box is 3.2 wide. Every builder returns a Group with its origin at the bottom centre,
   userData.w / userData.h (footprint width / height). Low-poly but smooth; instancing for seeds, onions, fries, crumbs. */
import {
  Group, Mesh, LatheGeometry, CylinderGeometry, PlaneGeometry, BoxGeometry, TorusGeometry, SphereGeometry, CircleGeometry,
  IcosahedronGeometry, InstancedMesh, MeshStandardMaterial, MeshPhysicalMaterial, MeshBasicMaterial, CanvasTexture, SRGBColorSpace,
  RepeatWrapping, Vector2, Vector3, Object3D, DoubleSide, Color, Quaternion,
} from 'three';

let seed = 11;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const rr = (a, b) => a + (b - a) * rnd();
function ctex(w, h, paint, srgb = true, rep = false) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h);
  const t = new CanvasTexture(c); if (srgb) t.colorSpace = SRGBColorSpace; t.anisotropy = 4;
  if (rep) { t.wrapS = t.wrapT = RepeatWrapping; } return t;
}
function speckle(g, w, h, n, col, r0, r1, a0 = 0.2, a1 = 0.6) {
  g.fillStyle = col;
  for (let i = 0; i < n; i++) { g.globalAlpha = rr(a0, a1); g.beginPath(); g.ellipse(rnd() * w, rnd() * h, rr(r0, r1), rr(r0, r1) * rr(0.5, 1), rnd() * 3, 0, 7); g.fill(); }
  g.globalAlpha = 1;
}
const lathe = (pts, seg = 48) => new LatheGeometry(pts.map(p => new Vector2(p[0], p[1])), seg);
function puck(r, h, e, n = 5) {
  const p = [[0, 0]];
  for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + (i / n) * Math.PI / 2; p.push([r - e + Math.cos(a) * e, e + Math.sin(a) * e]); }
  for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI / 2; p.push([r - e + Math.cos(a) * e, h - e + Math.sin(a) * e]); }
  p.push([0, h]); return p;
}
function jitter(geo, amt, freq = 7, yMin = -1e9, ph = 0) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const r = Math.hypot(x, z); if (r < 1e-4 || y < yMin) continue;
    const a = Math.atan2(z, x); const k = 1 + amt * (Math.sin(a * freq + 1.3 + ph) * 0.5 + Math.sin(a * freq * 2.3 + 0.4 + ph) * 0.3 + Math.sin(a * 17.1 + ph) * 0.2);
    p.setX(i, x * k); p.setZ(i, z * k);
  }
  geo.computeVertexNormals(); return geo;
}
function lacy(geo, ph) { // smash-burger edge: irregular, crispy lace + slightly domed crust
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const r = Math.hypot(x, z); if (r < 1e-4) { p.setY(i, y + (y > 0 ? 0.008 : 0)); continue; }
    const a = Math.atan2(z, x); const n = Math.sin(a * 5 + ph) * 0.5 + Math.sin(a * 11.3 + ph * 2) * 0.3 + Math.sin(a * 23.7 + 1.7 + Math.sin(a * 3) * 2) * 0.2; const k = 1 + 0.055 * n + (y > 0 ? 0.012 : -0.012);
    p.setXYZ(i, x * k, y * (1 - 0.25 * Math.max(0, n)), z * k); } // thinner, crispier where the edge spreads
  geo.computeVertexNormals(); return geo;
}
const shadowed = (m) => { m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return m; };

/* ---------------- shared materials ---------------- */
let MM = null;
export function foodMats() {
  if (MM) return MM;
  const crumb = ctex(256, 256, (g, w, h) => { g.fillStyle = '#808080'; g.fillRect(0, 0, w, h); speckle(g, w, h, 1400, '#000', 0.5, 1.8, 0.2, 0.6); speckle(g, w, h, 1400, '#fff', 0.5, 1.8, 0.2, 0.6); }, false, true);
  const bunTop = ctex(512, 256, (g, w, h) => { // v: rim (canvas bottom) → crown (canvas top)
    const gr = g.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, '#E9B56B'); gr.addColorStop(0.1, '#D58A35'); gr.addColorStop(0.35, '#BA6420'); gr.addColorStop(1, '#93460F');
    g.fillStyle = gr; g.fillRect(0, 0, w, h); speckle(g, w, h, 900, '#6e300b', 0.6, 2.4, 0.06, 0.22); speckle(g, w, h, 600, '#f3c27e', 0.6, 2.2, 0.06, 0.25);
  });
  const bunCut = ctex(256, 256, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2); gr.addColorStop(0, '#E7C38A'); gr.addColorStop(0.75, '#D59A52'); gr.addColorStop(1, '#A9601F'); g.fillStyle = gr; g.fillRect(0, 0, w, h); speckle(g, w, h, 700, '#8c4f1a', 0.6, 2, 0.1, 0.35); });
  const bunBot = ctex(256, 128, (g, w, h) => { const gr = g.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, '#B86A2A'); gr.addColorStop(0.5, '#D99A50'); gr.addColorStop(0.9, '#C98034'); gr.addColorStop(1, '#9A5520'); g.fillStyle = gr; g.fillRect(0, 0, w, h); speckle(g, w, h, 300, '#6e320e', 0.6, 2, 0.1, 0.3); });
  const patty = ctex(512, 256, (g, w, h) => { // smash crust: near-black char, lacy brown crust, a few seared highlights
    g.fillStyle = '#24130a'; g.fillRect(0, 0, w, h); speckle(g, w, h, 3200, '#0b0503', 1.2, 5, 0.4, 0.95); speckle(g, w, h, 1600, '#4a2612', 1, 4, 0.35, 0.8);
    speckle(g, w, h, 700, '#7a4220', 0.6, 2.2, 0.4, 0.85); speckle(g, w, h, 160, '#a9652f', 0.5, 1.4, 0.5, 0.9); }, true, true);
  const pattyB = ctex(256, 128, (g, w, h) => { g.fillStyle = '#808080'; g.fillRect(0, 0, w, h); speckle(g, w, h, 2600, '#000', 1, 4.5, 0.4, 1); speckle(g, w, h, 1800, '#fff', 0.8, 3.5, 0.4, 1); }, false, true);
  const fry = ctex(64, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#C9781F'); gr.addColorStop(0.25, '#F1BC52'); gr.addColorStop(0.75, '#EDB24A'); gr.addColorStop(1, '#C26F1C'); g.fillStyle = gr; g.fillRect(0, 0, w, h); speckle(g, w, h, 160, '#a85a14', 0.4, 1.4, 0.15, 0.4); speckle(g, w, h, 90, '#fff6d8', 0.3, 0.9, 0.3, 0.7); });
  const swirl = ctex(256, 256, (g, w, h) => { g.fillStyle = '#808080'; g.fillRect(0, 0, w, h); g.strokeStyle = '#c8c8c8'; g.lineWidth = 7; g.beginPath(); for (let a = 0; a < 26; a += 0.05) { const r = 4 + a * 4.4; g.lineTo(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r); } g.stroke(); }, false);
  MM = {
    crumb,
    bunTop: new MeshPhysicalMaterial({ map: bunTop, bumpMap: crumb, bumpScale: 0.5, roughness: 0.45, clearcoat: 0.5, clearcoatRoughness: 0.3, sheen: 0.4, sheenColor: new Color('#ffcf8a') }),
    bunBot: new MeshStandardMaterial({ map: bunBot, bumpMap: crumb, bumpScale: 0.8, roughness: 0.68 }),
    bunCut: new MeshStandardMaterial({ map: bunCut, bumpMap: crumb, bumpScale: 1.4, roughness: 0.9 }),
    seed: new MeshStandardMaterial({ color: '#F2E3BF', roughness: 0.55 }),
    patty: new MeshPhysicalMaterial({ map: patty, bumpMap: pattyB, bumpScale: 4.5, roughness: 0.62, clearcoat: 0.25, clearcoatRoughness: 0.5 }),
    cheese: new MeshPhysicalMaterial({ color: '#F4A51A', roughness: 0.3, clearcoat: 0.45, clearcoatRoughness: 0.2, sheen: 0.35, sheenColor: new Color('#ffd27a'), side: DoubleSide }),
    onion: new MeshPhysicalMaterial({ color: '#7A3E15', roughness: 0.35, clearcoat: 0.7, clearcoatRoughness: 0.25 }),
    sauce: new MeshPhysicalMaterial({ color: '#E9975A', roughness: 0.22, clearcoat: 0.9, clearcoatRoughness: 0.15 }),
    lettuce: new MeshPhysicalMaterial({ color: '#4E8A26', roughness: 0.45, clearcoat: 0.3, side: DoubleSide, sheen: 0.4, sheenColor: new Color('#d8f5a0') }),
    tomatoSkin: new MeshPhysicalMaterial({ color: '#C8231B', roughness: 0.3, clearcoat: 0.7 }),
    fry: new MeshStandardMaterial({ map: fry, bumpMap: crumb, bumpScale: 0.7, roughness: 0.55, emissive: '#3a1a02', emissiveIntensity: 0.35 }),
    ceramic: new MeshPhysicalMaterial({ color: '#F3F1EC', roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08 }),
    dipO: new MeshPhysicalMaterial({ color: '#E8883A', roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05, bumpMap: swirl, bumpScale: 1.2 }),
    dipD: new MeshPhysicalMaterial({ color: '#5C1B0C', roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05, bumpMap: swirl, bumpScale: 1.2 }),
    cream: new MeshPhysicalMaterial({ color: '#D8CCC2', roughness: 0.62, bumpMap: crumb, bumpScale: 1.6, sheen: 0.4, sheenColor: new Color('#ffffff') }),
    oreo: new MeshStandardMaterial({ color: '#1C1512', roughness: 0.75, bumpMap: crumb, bumpScale: 2 }),
    clear: new MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.05, metalness: 0, clearcoat: 1, transparent: true, opacity: 0.12, depthWrite: false, side: DoubleSide }),
    straw: new MeshPhysicalMaterial({ color: '#F06A10', roughness: 0.28, clearcoat: 0.7 }),
    tray: new MeshStandardMaterial({ color: '#141414', roughness: 0.75 }),
  };
  return MM;
}

/* ---------------- burger layers (each: Group, origin bottom centre, userData.h thickness) ---------------- */
function cheeseSlice(M, size, droop, R, rot) { // smooth melt: hugs the patty top, rolls over the rim and hangs in soft drips
  const g = new PlaneGeometry(size, size, 64, 64); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), z = p.getZ(i); const r = Math.hypot(x, z), a = Math.atan2(z, x); let yy = 0.008 - r * r * 0.012;
    if (r > R) {
      const over = r - R; const drip = droop * (0.62 + 0.22 * Math.sin(a * 4 + rot * 5) + 0.12 * Math.sin(a * 9 + rot));
      const t = 1 - Math.exp(-over * 11); // eased fold: no crease at the rim
      yy -= drip * t; const nr = R + over * (0.32 - 0.22 * t) + 0.012 * t; x *= nr / r; z *= nr / r;
    }
    p.setXYZ(i, x, yy, z);
  }
  g.computeVertexNormals(); const m = new Mesh(g, M.cheese); m.rotation.y = rot; return m;
}
function L(h, ...meshes) { const g = new Group(); meshes.forEach(m => g.add(m)); g.userData.h = h; return shadowed(g); }
export function burgerLayers() {
  const M = foodMats(); seed = 11;
  const at = (m, y) => { m.position.y = y; return m; };
  // top bun: brioche dome with sesame seeds
  const R = 0.56, H = 0.33;
  const prof = [[0, 0], [R - 0.06, 0], [R - 0.01, 0.025]];
  for (let i = 0; i <= 16; i++) { const a = (i / 16) * Math.PI / 2; prof.push([R * Math.cos(a) * (1 - 0.03 * Math.sin(a * 2)), 0.045 + (H - 0.045) * Math.pow(Math.sin(a), 0.78)]); }
  prof[prof.length - 1][0] = 0;
  const dome = new Mesh(jitter(lathe(prof, 56), 0.014, 5), M.bunTop);
  const cut = at(new Mesh(new CircleGeometry(R - 0.05, 40).rotateX(Math.PI / 2), M.bunCut), 0.002);
  const seeds = new InstancedMesh(new SphereGeometry(0.016, 7, 5), M.seed, 70); const o = new Object3D(), up = new Vector3(0, 1, 0);
  for (let i = 0; i < 70; i++) {
    const a = rnd() * 6.28, t = Math.acos(1 - rnd() * 0.75); // spread over the crown
    const s = Math.sin(t), y = 0.045 + (H - 0.045) * Math.pow(Math.cos(t), 0.78), r = R * s * 0.99;
    const n = new Vector3(Math.cos(a) * s, Math.cos(t) * 1.3, Math.sin(a) * s).normalize();
    o.position.set(Math.cos(a) * r, y + 0.004, Math.sin(a) * r); o.quaternion.setFromUnitVectors(up, n); o.rotateY(rnd() * 3);
    o.scale.set(1, 0.38, 0.55); o.updateMatrix(); seeds.setMatrixAt(i, o.matrix);
  }
  const top = L(H, dome, cut, seeds);
  // signature sauce: thin glossy layer with a wavy dripping edge
  const sauce = L(0.03, at(new Mesh(jitter(new CylinderGeometry(0.53, 0.5, 0.03, 48, 1), 0.07, 9), M.sauce), 0.015));
  // caramelised onions: instanced torus strands
  const on = new InstancedMesh(new TorusGeometry(0.085, 0.012, 5, 14, 2.6), M.onion, 64);
  for (let i = 0; i < 64; i++) {
    const a = rnd() * 6.28, r = Math.pow(rnd(), 0.4) * 0.54; o.position.set(Math.cos(a) * r, 0.02 + rnd() * 0.05, Math.sin(a) * r);
    o.quaternion.identity(); o.rotation.set(Math.PI / 2 + rr(-0.5, 0.5), rr(-0.4, 0.4), rnd() * 6.28); o.scale.setScalar(rr(0.7, 1.5)); o.updateMatrix(); on.setMatrixAt(i, o.matrix);
    on.setColorAt(i, new Color().setHSL(0.07 + rnd() * 0.03, 0.75, 0.2 + rnd() * 0.14));
  }
  const onions = L(0.08, on);
  // patties with melted American cheese draping over
  const pattyL = (rot) => L(0.165, at(new Mesh(lacy(new CylinderGeometry(0.59, 0.56, 0.15, 96, 3), rot * 3), M.patty), 0.075), at(cheeseSlice(M, 1.04, 0.16, 0.54, rot), 0.152));
  const p1 = pattyL(0.35), p2 = pattyL(-0.45);
  // bottom bun, toasted cut side up
  const bot = L(0.19, new Mesh(lathe(puck(0.53, 0.19, 0.07)), M.bunBot), at(new Mesh(new CircleGeometry(0.5, 40).rotateX(-Math.PI / 2), M.bunCut), 0.191));
  // lettuce: wavy leaf that overhangs the patty
  const lg = new PlaneGeometry(1.4, 1.4, 34, 34); lg.rotateX(-Math.PI / 2);
  { const p = lg.attributes.position; for (let i = 0; i < p.count; i++) { let x = p.getX(i), z = p.getZ(i); const r = Math.hypot(x, z), a = Math.atan2(z, x); const rim = 0.6 + 0.03 * Math.sin(a * 5 + 1) + 0.02 * Math.sin(a * 11); const f = Math.max(0, r - 0.42);
      let y = 0.015 + Math.sin(a * 13 + r * 9) * 0.04 * Math.min(1, f * 6) - f * f * 0.9; if (r > rim) { const k = rim / r; x *= k; z *= k; y -= (r - rim) * 0.2; } p.setXYZ(i, x, y, z); } lg.computeVertexNormals(); }
  const lettuce = L(0.05, new Mesh(lg, M.lettuce));
  // tomato: two slices with a procedural cut face
  const tomFace = ctex(256, 256, (g, w, h) => { g.fillStyle = '#B81E16'; g.fillRect(0, 0, w, h); g.fillStyle = '#E2453A'; g.beginPath(); g.arc(w / 2, h / 2, w * 0.46, 0, 7); g.fill(); g.fillStyle = '#C42A1F';
    for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28; g.beginPath(); g.ellipse(w / 2 + Math.cos(a) * w * 0.24, h / 2 + Math.sin(a) * h * 0.24, w * 0.14, w * 0.09, a, 0, 7); g.fill(); }
    g.fillStyle = '#F2D27A'; for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28; for (let j = 0; j < 5; j++) { g.beginPath(); g.ellipse(w / 2 + Math.cos(a) * w * (0.2 + j * 0.02), h / 2 + Math.sin(a) * h * (0.2 + j * 0.02), 4, 2.4, a, 0, 7); g.fill(); } }
    g.strokeStyle = '#E86A58'; g.lineWidth = 6; g.beginPath(); g.arc(w / 2, h / 2, w * 0.08, 0, 7); g.stroke(); });
  const tomFaceM = new MeshPhysicalMaterial({ map: tomFace, roughness: 0.25, clearcoat: 0.8 });
  const slice = (x, z) => { const m = new Mesh(new CylinderGeometry(0.27, 0.27, 0.045, 32), [M.tomatoSkin, tomFaceM, tomFaceM]); m.position.set(x, 0.022, z); return m; };
  const tomato = L(0.045, slice(-0.24, 0.05), slice(0.26, -0.04));
  return { top, sauce, onions, p1, p2, bot, lettuce, tomato };
}

/* ---------------- fries: golden irregular sticks (one InstancedMesh) in a low black tray ---------------- */
export function buildFries3D() {
  const M = foodMats(); seed = 5; const g = new Group();
  const W = 0.62, D = 0.46, H = 0.3, t = 0.015;
  const tray = new Group(); g.add(tray);
  const wall = (w, h, d, x, y, z) => { const m = new Mesh(new BoxGeometry(w, h, d), M.tray); m.position.set(x, y, z); tray.add(m); };
  wall(W, t, D, 0, t / 2, 0); wall(W, H, t, 0, H / 2, D / 2); wall(W, H * 0.8, t, 0, H * 0.4, -D / 2); wall(t, H, D, W / 2, H / 2, 0); wall(t, H, D, -W / 2, H / 2, 0);
  // slightly curved, square-section stick with chamfered corners
  const geo = new BoxGeometry(0.11, 1, 0.1, 2, 6, 2); geo.translate(0, 0.5, 0);
  { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) * (0.92 + 0.08 * Math.sin(y * 3)) + Math.sin(y * Math.PI) * 0.035); p.setZ(i, p.getZ(i) * (0.95 + 0.05 * Math.cos(y * 4))); } geo.computeVertexNormals(); }
  const N = 17; const fr = new InstancedMesh(geo, M.fry, N); const o = new Object3D();
  for (let i = 0; i < N; i++) {
    const Lh = rr(0.6, 0.92); const x = rr(-W / 2 + 0.06, W / 2 - 0.06), z = rr(-D / 2 + 0.06, D / 2 - 0.06);
    o.position.set(x, 0.02, z);
    const lean = rr(0.35, 0.8), dir = (i % 2 ? 0.6 : -2.4) + rr(-0.7, 0.7); // piled at a steep slant, crossing like z024 // leaning outwards, a loose golden bunch
    o.rotation.set(Math.sin(dir) * lean, rnd() * 6.28, -Math.cos(dir) * lean); o.scale.set(rr(0.8, 1.25), Lh, rr(0.8, 1.25)); o.updateMatrix(); fr.setMatrixAt(i, o.matrix);
    fr.setColorAt(i, new Color().setHSL(0.088 + rr(-0.012, 0.01), rr(0.85, 1), rr(0.56, 0.7)));
  }
  g.add(fr); shadowed(g);
  g.userData = { w: W + 0.25, h: 0.85, tray };
  return g;
}

/* ---------------- dips: low ceramic ramekin, glossy clearcoat sauce ---------------- */
export function buildDip3D(dark) {
  const M = foodMats(); const g = new Group();
  const R = 0.2, H = 0.1, T = 0.016;
  const prof = [[0, 0], [R - 0.02, 0], [R, 0.012], [R + 0.006, H - 0.012], [R, H], [R - T, H - 0.004], [R - T - 0.002, 0.02], [0, 0.018]];
  g.add(new Mesh(lathe(prof, 48), M.ceramic));
  const sp = [[R - T - 0.002, H - 0.014], [R * 0.75, H - 0.006], [R * 0.4, H - 0.001], [0, H + 0.002]]; // outer → centre so the surface faces up
  const sauce = new Mesh(lathe(sp, 40), dark ? M.dipD : M.dipO); g.add(sauce);
  const dollop = new Mesh(new SphereGeometry(R * 0.34, 20, 10), dark ? M.dipD : M.dipO); dollop.scale.y = 0.32; dollop.position.set(R * 0.12, H - 0.004, -R * 0.08); g.add(dollop);
  shadowed(g); g.userData = { w: (R + 0.01) * 2, h: H + 0.02 }; return g;
}

/* ---------------- shake: clear cup, chocolate drizzle, whipped cream dome, Oreo chunks, clear dome lid + straw ---------------- */
export function buildShake3D(badgeTex) {
  const M = foodMats(); seed = 3; const g = new Group();
  const R0 = 0.23, R1 = 0.29, H = 0.74;
  const body = ctex(512, 256, (gg, w, h) => { gg.fillStyle = '#C9AE9F'; gg.fillRect(0, 0, w, h); speckle(gg, w, h, 1400, '#3a2219', 0.8, 3.2, 0.3, 0.8); speckle(gg, w, h, 500, '#d8c4b6', 0.8, 2.4, 0.2, 0.5);
    gg.fillStyle = '#3B170B'; for (let i = 0; i < 22; i++) { const x = rnd() * w, len = rr(0.3, 0.9) * h, wd = rr(8, 20); gg.globalAlpha = rr(0.75, 1); gg.beginPath(); gg.moveTo(x - wd / 2, 0); gg.bezierCurveTo(x - wd, len * 0.4, x + wd * 0.3, len * 0.7, x, len); gg.bezierCurveTo(x + wd * 0.6, len * 0.7, x + wd, len * 0.3, x + wd / 2, 0); gg.fill(); }
    gg.globalAlpha = 1; gg.fillRect(0, 0, w, 12); });
  const shakeM = new MeshPhysicalMaterial({ map: body, roughness: 0.55, sheen: 0.2 });
  g.add(new Mesh(new CylinderGeometry(R1 - 0.012, R0 - 0.012, H - 0.02, 40, 1, false), shakeM)).position.y = H / 2;
  const cup = new Mesh(new CylinderGeometry(R1, R0, H, 40, 1, true), M.clear); cup.position.y = H / 2; cup.renderOrder = 45; g.add(cup);
  const rim = new Mesh(new TorusGeometry(R1 + 0.004, 0.012, 6, 40), M.clear); rim.rotation.x = Math.PI / 2; rim.position.y = H; rim.renderOrder = 45; g.add(rim);
  if (badgeTex) { const b = new Mesh(new CylinderGeometry(R1 * 0.94 + 0.003, R1 * 0.86 + 0.003, 0.34, 32, 1, true, -0.7, 1.4), new MeshStandardMaterial({ map: badgeTex, transparent: true, roughness: 0.45 })); b.position.y = H * 0.36; b.renderOrder = 44; g.add(b); }
  // whipped cream dome
  const cp = []; for (let i = 0; i <= 10; i++) { const a = (i / 10) * Math.PI / 2; cp.push([(R1 - 0.01) * Math.cos(a), 0.2 * Math.sin(a)]); } cp[cp.length - 1][0] = 0;
  const cg = lathe(cp, 40); { const p = cg.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const a = Math.atan2(z, x); const k = 1 + 0.06 * Math.sin(a * 7 + y * 30) * Math.min(1, y * 8); p.setXYZ(i, x * k, y * (1 + 0.08 * Math.sin(a * 5)), z * k); } cg.computeVertexNormals(); }
  const cream = new Mesh(cg, M.cream); cream.position.y = H - 0.01; g.add(cream);
  const crumbs = new InstancedMesh(new IcosahedronGeometry(0.045, 0), M.oreo, 120); const o = new Object3D();
  for (let i = 0; i < 120; i++) { const a = rnd() * 6.28, t = Math.sqrt(rnd()) * 0.92; const r = (R1 - 0.02) * t; o.position.set(Math.cos(a) * r, H - 0.01 + 0.2 * Math.sqrt(Math.max(0, 1 - t * t)) + 0.006, Math.sin(a) * r); o.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); o.scale.set(rr(0.7, 1.7), rr(0.45, 0.9), rr(0.7, 1.7)); o.updateMatrix(); crumbs.setMatrixAt(i, o.matrix); }
  g.add(crumbs);
  for (let i = 0; i < 3; i++) { const c = new Mesh(new CylinderGeometry(0.075, 0.075, 0.022, 20), M.oreo); const a = i * 2.1 + 0.4; c.position.set(Math.cos(a) * 0.12, H + 0.16 - i * 0.02, Math.sin(a) * 0.12); c.rotation.set(rr(-0.9, 0.9), 0, rr(-0.9, 0.9)); g.add(c); }
  const lid = new Mesh(new SphereGeometry(R1 + 0.012, 40, 14, 0, Math.PI * 2, 0, Math.PI / 2), M.clear); lid.scale.y = 0.95; lid.position.y = H; lid.renderOrder = 46; g.add(lid);
  const st = new Mesh(new CylinderGeometry(0.02, 0.02, 0.6, 14), M.straw); st.position.set(0.06, H + 0.2, -0.03); st.rotation.z = -0.2; g.add(st);
  shadowed(g); cup.castShadow = false; lid.castShadow = false;
  g.userData = { w: (R1 + 0.02) * 2, h: H + 0.52 }; return g;
}
