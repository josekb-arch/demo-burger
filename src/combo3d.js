/* Procedural 3D food for the GAME DAY COMBO box: burger, loose fries in a tray, two dips and an Oreo shake.
   Real geometry + PBR materials (no flat cut-outs). All sizes are in box units (box is 3.2 wide). */
import {
  Group, Mesh, LatheGeometry, CylinderGeometry, PlaneGeometry, BoxGeometry, TorusGeometry, SphereGeometry, CircleGeometry,
  IcosahedronGeometry, InstancedMesh, MeshStandardMaterial, MeshPhysicalMaterial, CanvasTexture, SRGBColorSpace,
  RepeatWrapping, Vector2, Object3D, DoubleSide, Color, Scene, BackSide, MeshBasicMaterial, PMREMGenerator,
} from 'three';

let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const rr = (a, b) => a + (b - a) * rnd();

function ctex(w, h, paint, srgb = true, rep = false) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h);
  const t = new CanvasTexture(c); if (srgb) t.colorSpace = SRGBColorSpace; t.anisotropy = 4;
  if (rep) { t.wrapS = t.wrapT = RepeatWrapping; }
  return t;
}
function speckle(g, w, h, n, col, r0, r1, a0 = 0.2, a1 = 0.6) {
  for (let i = 0; i < n; i++) { g.globalAlpha = rr(a0, a1); g.fillStyle = col; g.beginPath(); g.ellipse(rnd() * w, rnd() * h, rr(r0, r1), rr(r0, r1) * rr(0.5, 1), rnd() * 3, 0, 7); g.fill(); }
  g.globalAlpha = 1;
}
const lathe = (pts, seg = 48) => new LatheGeometry(pts.map(p => new Vector2(p[0], p[1])), seg);
// rounded "puck" profile: radius r, height h, edge round e
function puck(r, h, e, n = 6) {
  const p = [[0, 0]];
  for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + (i / n) * Math.PI / 2; p.push([r - e + Math.cos(a) * e, e + Math.sin(a) * e]); }
  for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI / 2; p.push([r - e + Math.cos(a) * e, h - e + Math.sin(a) * e]); }
  p.push([0, h]); return p;
}
function jitterRadial(geo, amt, freq = 7, yMin = -1e9) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const r = Math.hypot(x, z); if (r < 1e-4 || y < yMin) continue;
    const a = Math.atan2(z, x); const k = 1 + amt * (Math.sin(a * freq + 1.3) * 0.5 + Math.sin(a * freq * 2.3 + 0.4) * 0.3 + Math.sin(a * 17.1) * 0.2);
    p.setX(i, x * k); p.setZ(i, z * k);
  }
  geo.computeVertexNormals(); return geo;
}

/* ---------------- materials ---------------- */
function mats() {
  const bunTex = ctex(512, 256, (g, w, h) => {
    // u: around, v: bottom(0)->top(1) of the lathe (canvas y inverted)
    const gr = g.createLinearGradient(0, h, 0, 0);
    gr.addColorStop(0, '#EDC27C'); gr.addColorStop(0.12, '#D69040'); gr.addColorStop(0.45, '#B4621E'); gr.addColorStop(1, '#8E4612');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 900, '#7a3a10', 0.6, 2.2, 0.08, 0.25);
    speckle(g, w, h, 500, '#f6c98a', 0.6, 2, 0.08, 0.3);
  });
  const bunBot = ctex(256, 128, (g, w, h) => { const gr = g.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, '#B8692A'); gr.addColorStop(0.6, '#D99248'); gr.addColorStop(1, '#C97A34'); g.fillStyle = gr; g.fillRect(0, 0, w, h); speckle(g, w, h, 300, '#6e320e', 0.6, 2, 0.1, 0.3); });
  const pattyTex = ctex(512, 256, (g, w, h) => { g.fillStyle = '#3a2215'; g.fillRect(0, 0, w, h); speckle(g, w, h, 2200, '#1a0e08', 1, 4, 0.3, 0.8); speckle(g, w, h, 1300, '#6b3f22', 0.8, 3, 0.3, 0.7); speckle(g, w, h, 300, '#8c5a32', 0.6, 1.6, 0.4, 0.8); }, true, true);
  const pattyBump = ctex(256, 128, (g, w, h) => { g.fillStyle = '#808080'; g.fillRect(0, 0, w, h); speckle(g, w, h, 1800, '#000', 1, 3.5, 0.3, 0.9); speckle(g, w, h, 1200, '#fff', 0.8, 3, 0.3, 0.9); }, false, true);
  const crumb = ctex(256, 256, (g, w, h) => { g.fillStyle = '#808080'; g.fillRect(0, 0, w, h); speckle(g, w, h, 900, '#000', 0.6, 2, 0.2, 0.6); speckle(g, w, h, 900, '#fff', 0.6, 2, 0.2, 0.6); }, false, true);
  const fryTex = ctex(64, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#B0601C'); gr.addColorStop(0.06, '#EBA23E'); gr.addColorStop(0.5, '#F8BE5C'); gr.addColorStop(0.94, '#E99A36'); gr.addColorStop(1, '#A85818'); g.fillStyle = gr; g.fillRect(0, 0, w, h); speckle(g, w, h, 60, '#9a5214', 0.5, 1.6, 0.2, 0.5); });
  return {
    bun: new MeshPhysicalMaterial({ map: bunTex, bumpMap: crumb, bumpScale: 0.6, roughness: 0.42, clearcoat: 0.55, clearcoatRoughness: 0.32, sheen: 0.3, sheenColor: new Color('#ffcf8a') }),
    bunBot: new MeshStandardMaterial({ map: bunBot, bumpMap: crumb, bumpScale: 0.8, roughness: 0.7 }),
    crumbIn: new MeshStandardMaterial({ color: '#E8C48A', bumpMap: crumb, bumpScale: 1.2, roughness: 0.95 }),
    patty: new MeshStandardMaterial({ map: pattyTex, bumpMap: pattyBump, bumpScale: 2.2, roughness: 0.78 }),
    cheese: new MeshPhysicalMaterial({ color: '#F4A91C', roughness: 0.32, clearcoat: 0.35, clearcoatRoughness: 0.25, sheen: 0.4, sheenColor: new Color('#ffd27a'), side: DoubleSide }),
    onion: new MeshPhysicalMaterial({ color: '#6B3714', roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.3 }),
    sauce: new MeshPhysicalMaterial({ color: '#E7A05C', roughness: 0.25, clearcoat: 0.8 }),
    fry: new MeshStandardMaterial({ map: fryTex, roughness: 0.58, bumpMap: crumb, bumpScale: 0.6, emissive: '#3d1c02', emissiveIntensity: 0.6 }),
  };
}

/* ---------------- burger ---------------- */
function cheeseSlice(M, y, size, droop, R) {
  const g = new PlaneGeometry(size, size, 36, 36); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), z = p.getZ(i); const r = Math.hypot(x, z);
    let yy = 0;
    if (r > R) { // fold down over the patty edge, corners drip further
      const over = r - R; const k = R / r; const corner = Math.pow(Math.max(Math.abs(x), Math.abs(z)) / (size / 2), 6);
      yy = -Math.min(over * 1.15, droop * (0.55 + corner * 1.1)); const pull = 1 - Math.min(1, over * 1.4) * 0.55;
      x = x * (k + (1 - k) * pull * 0.6); z = z * (k + (1 - k) * pull * 0.6);
    }
    yy += Math.sin(x * 9) * Math.cos(z * 8) * 0.008;
    p.setXYZ(i, x, y + yy, z);
  }
  g.computeVertexNormals();
  const m = new Mesh(g, M.cheese); m.rotation.y = 0.35; return m;
}
export function buildBurger(M) {
  const g = new Group();
  const add = (geo, mat, y = 0) => { const m = new Mesh(geo, mat); m.position.y = y; m.castShadow = m.receiveShadow = true; g.add(m); return m; };
  // bottom bun (toasted top surface)
  add(lathe(puck(0.5, 0.17, 0.06)), M.bunBot);
  add(new CylinderGeometry(0.47, 0.47, 0.012, 40), M.crumbIn, 0.172);
  // patty 1
  let y = 0.17;
  add(jitterRadial(new CylinderGeometry(0.57, 0.55, 0.15, 64, 4), 0.05, 9), M.patty, y + 0.075);
  y += 0.15; g.add(cheeseSlice(M, y + 0.004, 1.08, 0.2, 0.52));
  add(jitterRadial(new CylinderGeometry(0.56, 0.54, 0.15, 64, 4), 0.055, 7), M.patty, y + 0.085);
  y += 0.165; g.add(cheeseSlice(M, y + 0.004, 1.06, 0.2, 0.51)).rotation.y = -0.5;
  // grilled onions
  const on = new Group(); g.add(on);
  for (let i = 0; i < 70; i++) {
    const t = new Mesh(new TorusGeometry(rr(0.05, 0.12), rr(0.008, 0.014), 4, 14, rr(1.6, 3.6)), M.onion);
    const a = rnd() * 6.28, r = Math.pow(rnd(), 0.35) * 0.54;
    t.position.set(Math.cos(a) * r, y + 0.02 + rnd() * 0.08 - (r > 0.5 ? 0.04 : 0), Math.sin(a) * r);
    t.rotation.set(Math.PI / 2 + rr(-0.6, 0.6), rr(-0.5, 0.5), rnd() * 6.28); t.castShadow = true; on.add(t);
  }
  y += 0.1;
  // sauce
  add(jitterRadial(new CylinderGeometry(0.5, 0.48, 0.025, 48), 0.06, 11), M.sauce, y + 0.012);
  y += 0.02;
  // top bun dome
  const dome = []; const R = 0.55, H = 0.31;
  dome.push([0.0, 0]); dome.push([R - 0.05, 0]); dome.push([R - 0.005, 0.03]);
  for (let i = 0; i <= 16; i++) { const a = (i / 16) * Math.PI / 2; dome.push([R * Math.cos(a) * (1 - 0.04 * Math.sin(a * 2)), 0.05 + (H - 0.05) * Math.pow(Math.sin(a), 0.82)]); }
  dome[dome.length - 1][0] = 0;
  add(jitterRadial(lathe(dome, 64), 0.018, 5), M.bun, y);
  g.userData.h = y + H; g.userData.w = 1.1;
  return g;
}

/* ---------------- fries (loose sticks in a low black tray) ---------------- */
export function buildFries(M, trayMat, lineMat) {
  const g = new Group();
  const W = 0.8, D = 0.72, H = 0.42, t = 0.02;
  const wall = (w, h, d, x, y, z) => { const m = new Mesh(new BoxGeometry(w, h, d), trayMat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m); };
  wall(W, t, D, 0, t / 2, 0); wall(W, H, t, 0, H / 2, D / 2); wall(W, H, t, 0, H / 2, -D / 2); wall(t, H, D, W / 2, H / 2, 0); wall(t, H, D, -W / 2, H / 2, 0);
  const ln = new Mesh(new BoxGeometry(W + 0.004, 0.018, 0.004), lineMat); ln.position.set(0, H * 0.72, D / 2 + 0.012); g.add(ln);
  const o = new Object3D(); const N = 34;
  const geo = new CylinderGeometry(0.062, 0.058, 1, 8, 5); geo.translate(0, 0.5, 0);
  { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z); if (r > 1e-4) { const k = Math.min(1.25, 1 / Math.max(Math.abs(x), Math.abs(z)) * r * 0.82); p.setX(i, x * k); p.setZ(i, z * k * 0.85); } } geo.computeVertexNormals(); }
  const fr = new InstancedMesh(geo, M.fry, N); fr.castShadow = true; fr.receiveShadow = true;
  for (let i = 0; i < N; i++) {
    const L = rr(0.55, 0.95); const a = rnd() * 6.28, r = Math.sqrt(rnd()) * 0.26;
    o.position.set(Math.cos(a) * r, 0.03, Math.sin(a) * r * 0.85);
    const lean = 0.3 + r * 1.8 + rr(0, 0.45); // a loose bunch fanning out of the tray
    o.rotation.set(Math.sin(a) * lean, rnd() * 3, -Math.cos(a) * lean);
    o.scale.set(rr(0.85, 1.2), L, rr(0.85, 1.2)); o.updateMatrix(); fr.setMatrixAt(i, o.matrix);
  }
  g.add(fr);
  g.userData.w = W; g.userData.h = 1.0;
  return g;
}

/* ---------------- dip cup ---------------- */
export function buildDip(color, dark) {
  const g = new Group();
  const cupM = new MeshPhysicalMaterial({ color: '#F2EEE6', roughness: 0.35, clearcoat: 0.4, side: DoubleSide });
  const prof = [[0, 0], [0.14, 0], [0.15, 0.01], [0.185, 0.16], [0.2, 0.165], [0.2, 0.175], [0.183, 0.172]];
  const cup = new Mesh(lathe(prof, 40), cupM); cup.castShadow = cup.receiveShadow = true; g.add(cup);
  const sm = new MeshPhysicalMaterial({ color, roughness: dark ? 0.12 : 0.28, clearcoat: 1, clearcoatRoughness: dark ? 0.05 : 0.2, sheen: dark ? 0 : 0.4, sheenColor: new Color('#ffd0a0') });
  sm.side = DoubleSide; const s = new Mesh(new CircleGeometry(0.176, 40).rotateX(-Math.PI / 2).translate(0, 0.15, 0), sm); s.receiveShadow = true; g.add(s);
  g.userData.w = 0.4; g.userData.h = 0.18;
  return g;
}

/* ---------------- Oreo shake ---------------- */
export function buildShake(badgePaint) {
  const g = new Group();
  const H = 0.82, R0 = 0.22, R1 = 0.3;
  const fill = ctex(512, 512, (c, w, h) => {
    c.fillStyle = '#ECE4D6'; c.fillRect(0, 0, w, h);
    speckle(c, w, h, 700, '#2b1d16', 1, 4, 0.3, 0.8); // cookie crumbs
    // chocolate drizzle running down from the top (canvas y=0 is the cup top)
    c.fillStyle = '#3A1E12';
    for (let i = 0; i < 26; i++) { const x = rnd() * w, len = rr(0.25, 0.85) * h, wd = rr(5, 14); c.beginPath(); c.moveTo(x - wd / 2, 0); c.bezierCurveTo(x - wd / 2 + rr(-8, 8), len * 0.5, x - wd * 0.3, len, x, len + wd * 0.4); c.bezierCurveTo(x + wd * 0.3, len, x + wd / 2 + rr(-8, 8), len * 0.5, x + wd / 2, 0); c.fill(); }
    c.fillRect(0, 0, w, 26);
  }, true);
  fill.wrapS = RepeatWrapping;
  // content (slightly inside the cup)
  const inner = []; for (let i = 0; i <= 10; i++) { const t = i / 10; inner.push([(R0 + (R1 - R0) * t) - 0.012, 0.012 + t * (H - 0.03)]); }
  inner.unshift([0, 0.012]); inner.push([0, H - 0.018]);
  const cont = new Mesh(lathe(inner, 48), new MeshStandardMaterial({ map: fill, roughness: 0.6 })); cont.receiveShadow = true; g.add(cont);
  // label sticker on the front
  const lab = new Mesh(new CylinderGeometry(R0 + (R1 - R0) * 0.45 + 0.004, R0 + (R1 - R0) * 0.25 + 0.004, 0.3, 32, 1, true, -0.6, 1.2), new MeshStandardMaterial({ map: ctex(256, 256, badgePaint), transparent: true, roughness: 0.5 }));
  lab.position.y = 0.32; g.add(lab);
  // clear plastic cup
  const cupP = [[0, 0], [R0, 0], [R0 + 0.004, 0.01]]; for (let i = 1; i <= 8; i++) { const t = i / 8; cupP.push([R0 + (R1 - R0) * t + 0.004, t * H]); } cupP.push([R1 + 0.02, H + 0.005], [R1 + 0.02, H + 0.02], [R1 + 0.004, H + 0.02]);
  const clear = new MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.06, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, transparent: true, opacity: 0.22, depthWrite: false, side: DoubleSide });
  const cup = new Mesh(lathe(cupP, 48), clear); cup.renderOrder = 40; g.add(cup);
  // whipped cream mound + oreo crumbs under a clear dome
  const cream = []; for (let i = 0; i <= 14; i++) { const t = i / 14; const r = (R1 - 0.02) * Math.cos(t * Math.PI / 2); cream.push([Math.max(0, r), H + 0.01 + 0.2 * Math.sin(t * Math.PI / 2) + 0.015 * Math.sin(t * 20)]); }
  const creamG = jitterRadial(lathe(cream, 48), 0.06, 6);
  const cr = new Mesh(creamG, new MeshPhysicalMaterial({ color: '#F4EFE6', roughness: 0.55, sheen: 0.5, sheenColor: new Color('#ffffff'), bumpMap: null })); cr.castShadow = true; g.add(cr);
  const cg = new IcosahedronGeometry(0.035, 0); const crumbs = new InstancedMesh(cg, new MeshStandardMaterial({ color: '#1c1512', roughness: 0.85 }), 60); const o = new Object3D();
  for (let i = 0; i < 60; i++) { const a = rnd() * 6.28, t = Math.sqrt(rnd()) * 0.95; const r = (R1 - 0.03) * t; const yy = H + 0.01 + 0.2 * Math.sin((1 - t) * Math.PI / 2 + 0.0) * 1; o.position.set(Math.cos(a) * r, Math.min(yy, H + 0.21) + 0.005, Math.sin(a) * r); o.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); o.scale.set(rr(0.7, 1.6), rr(0.4, 0.8), rr(0.7, 1.6)); o.updateMatrix(); crumbs.setMatrixAt(i, o.matrix); }
  g.add(crumbs);
  const dome = new Mesh(new SphereGeometry(R1 + 0.02, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2), clear); dome.scale.y = 0.85; dome.position.y = H + 0.02; dome.renderOrder = 41; g.add(dome);
  // straw
  const st = new Mesh(new CylinderGeometry(0.022, 0.022, 0.62, 16), new MeshPhysicalMaterial({ color: '#E85D04', roughness: 0.3, clearcoat: 0.6 }));
  st.position.set(0.09, H + 0.12, -0.04); st.rotation.z = -0.22; st.castShadow = true; g.add(st);
  g.userData.w = 0.64; g.userData.h = H + 0.3;
  return g;
}

/* ---------------- studio environment for PBR reflections ---------------- */
export function studioEnv(renderer) {
  const s = new Scene();
  const room = new Mesh(new BoxGeometry(20, 12, 20), new MeshBasicMaterial({ color: '#2b2622', side: BackSide })); s.add(room);
  const panel = (w, h, col, x, y, z, rx = 0, ry = 0) => { const m = new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ color: col, side: DoubleSide })); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); s.add(m); };
  panel(9, 9, '#ffffff', -2, 5.8, 1, Math.PI / 2);      // softbox overhead (key, top-left)
  panel(4, 7, '#ffe3c2', -9.8, 1, 2, 0, Math.PI / 2);  // warm left fill
  panel(5, 3, '#9fb0c8', 9.8, 1, -2, 0, -Math.PI / 2); // cool rim right
  panel(20, 3, '#151312', 0, -5.9, 0, -Math.PI / 2);
  const pm = new PMREMGenerator(renderer); const rt = pm.fromScene(s, 0.04); pm.dispose();
  return rt.texture;
}
export { mats };
export function setOpacity(root, o) {
  root.visible = o > 0.003;
  root.traverse(m => {
    if (!m.material) return; const mt = m.material;
    if (mt.userData.op0 === undefined) { mt.userData.op0 = mt.opacity; mt.userData.tr0 = mt.transparent; mt.userData.dw0 = mt.depthWrite; }
    mt.opacity = mt.userData.op0 * o; const tr = mt.userData.tr0 || o < 0.999; mt.transparent = tr; mt.depthWrite = mt.userData.dw0 && o >= 0.999;
  });
}

/* ---------- photo-projected lathe: the cut-out photo's silhouette is spun into a solid of revolution and the photo
   is projected onto it from the front, so the object keeps the photo's detail but has real volume, light and shadow ---------- */
function alphaProfile(img, step) {
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data; const W = c.width, H = c.height;
  const rows = [];
  for (let y = 0; y < H; y += step) {
    let x0 = -1, x1 = -1;
    for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 140) { if (x0 < 0) x0 = x; x1 = x; }
    if (x0 >= 0) rows.push({ y, x0, x1 });
  }
  return { rows, W, H, canvas: c, ctx: g };
}
export function photoLathe(img, tex, { step = 6, shrink = 0.985, win = 2, unit = 1, seg = 64, mat = {}, cx, open = 0 } = {}) {
  const P = alphaProfile(img, step); const rows = P.rows;
  const cxx = cx ?? rows.reduce((a, r) => a + (r.x0 + r.x1) / 2, 0) / rows.length;
  // robust radius: min half-width over a small window (keeps the surface inside the silhouette, ignores drips)
  const rad = rows.map((r, i) => { let m = 1e9; for (let j = Math.max(0, i - win); j <= Math.min(rows.length - 1, i + win); j++) m = Math.min(m, Math.min(cxx - rows[j].x0, rows[j].x1 - cxx)); return Math.max(0, m * shrink); });
  const yTop = rows[0].y, yBot = rows[rows.length - 1].y;
  const S = unit / (2 * Math.max(...rad)); // world units per px (object width = unit)
  const pts = [new Vector2(0, 0)];
  for (let i = rows.length - 1; i >= 0; i--) pts.push(new Vector2(rad[i] * S, (yBot - rows[i].y) * S));
  if (open) pts.splice(pts.length - Math.round(open * rows.length), Math.round(open * rows.length)); // drop the top rows (open cup)
  else pts.push(new Vector2(0, (yBot - yTop) * S + 1e-4));
  const geo = new LatheGeometry(pts, seg);
  const p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) { const px = cxx + p.getX(i) / S, py = yBot - p.getY(i) / S; uv.setXY(i, px / P.W, 1 - py / P.H); }
  geo.computeVertexNormals();
  const m = new Mesh(geo, new MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0, ...mat }));
  m.castShadow = m.receiveShadow = true;
  m.userData.w = unit; m.userData.h = (yBot - yTop) * S;
  m.userData.radiusAt = (h) => { for (let i = 1; i < pts.length; i++) if (pts[i].y >= h) return pts[i].x; return 0; };
  return m;
}
export function recolor(img, fn) {
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
  const id = g.getImageData(0, 0, c.width, c.height); const d = id.data;
  for (let i = 0; i < d.length; i += 4) { const o = fn(d[i], d[i + 1], d[i + 2]); if (o) { d[i] = o[0]; d[i + 1] = o[1]; d[i + 2] = o[2]; } }
  g.putImageData(id, 0, 0); const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.anisotropy = 4; return { tex: t, img: c };
}
export function wrapGroup(mesh, extra = []) { const g = new Group(); g.add(mesh); extra.forEach(e => g.add(e)); g.userData.w = mesh.userData.w; g.userData.h = mesh.userData.h; return g; }
export function straw(color = '#E85D04') { const st = new Mesh(new CylinderGeometry(0.022, 0.022, 0.6, 16), new MeshPhysicalMaterial({ color, roughness: 0.3, clearcoat: 0.6 })); st.castShadow = true; return st; }
