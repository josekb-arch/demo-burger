/* v9 — real 3D food (geometry + PBR, procedural canvas textures, no photos).
   Box units: the combo box is 3.2 wide. Every builder returns a Group with its origin at the bottom centre and userData.w / userData.h.
   Perf (v9): MeshStandard almost everywhere (Physical only for the glossy dip sauce), merged static parts, instancing,
   modest segment counts, and shadows cast only by the key pieces. */
import {
  Group, Mesh, LatheGeometry, CylinderGeometry, PlaneGeometry, BoxGeometry, SphereGeometry, CircleGeometry,
  IcosahedronGeometry, InstancedMesh, MeshStandardMaterial, MeshPhysicalMaterial, MeshBasicMaterial, CanvasTexture, SRGBColorSpace,
  RepeatWrapping, Vector2, Vector3, Object3D, DoubleSide, FrontSide, Color, AdditiveBlending, BufferAttribute,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
export { mergeGeometries };

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
function blotch(g, w, h, n, col, r0, r1, a) { // soft large-scale tone variation (wraps horizontally, so lathe seams stay invisible)
  for (let i = 0; i < n; i++) { const x0 = rnd() * w, y = rnd() * h, r = rr(r0, r1), al = rr(a * 0.5, a);
    for (const x of [x0 - w, x0, x0 + w]) { if (x + r < 0 || x - r > w) continue; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.globalAlpha = al; g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); } }
  g.globalAlpha = 1;
}
const lathe = (pts, seg = 40) => new LatheGeometry(pts.map(p => new Vector2(p[0], p[1])), seg);
function puck(r, h, e, n = 4) {
  const p = [[0, 0]];
  for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + (i / n) * Math.PI / 2; p.push([r - e + Math.cos(a) * e, e + Math.sin(a) * e]); }
  for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI / 2; p.push([r - e + Math.cos(a) * e, h - e + Math.sin(a) * e]); }
  p.push([0, h]); return p;
}
const ang = (x, z) => Math.atan2(z, x);
function radial(geo, f) { // displace radially by f(angle, y) (angle-only functions keep cap/side seams closed)
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); if (Math.hypot(x, z) < 1e-5) continue; const k = f(ang(x, z), y); p.setX(i, x * k); p.setZ(i, z * k); }
  geo.computeVertexNormals(); return geo;
}
function weldSeam(geo, seg) { // lathe: the first and last columns share positions; average their normals so no crease shows
  const n = geo.attributes.normal, cols = seg + 1, rows = n.count / cols;
  for (let j = 0; j < rows; j++) { const a = j, b = seg * rows + j; const x = n.getX(a) + n.getX(b), y = n.getY(a) + n.getY(b), z = n.getZ(a) + n.getZ(b), l = Math.hypot(x, y, z) || 1; n.setXYZ(a, x / l, y / l, z / l); n.setXYZ(b, x / l, y / l, z / l); }
  n.needsUpdate = true; return geo;
}
const cast = (...ms) => ms.forEach(m => { m.castShadow = true; m.receiveShadow = true; });
const recv = (g) => { g.traverse(o => { if (o.isMesh) o.receiveShadow = true; }); return g; };

/* ---------------- shared materials ---------------- */
let MM = null;
export function foodMats() {
  if (MM) return MM;
  const crumb = ctex(256, 256, (g, w, h) => { g.fillStyle = '#808080'; g.fillRect(0, 0, w, h); speckle(g, w, h, 1400, '#000', 0.5, 1.8, 0.2, 0.6); speckle(g, w, h, 1400, '#fff', 0.5, 1.8, 0.2, 0.6); }, false, true);
  // brioche crown: rim pale → deep golden crown, uneven browning blotches, pores and a few wrinkles
  const bunTop = ctex(512, 256, (g, w, h) => { // canvas bottom = rim, top = crown
    const gr = g.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, '#F0C67E'); gr.addColorStop(0.12, '#E2A048'); gr.addColorStop(0.4, '#CF7E2C'); gr.addColorStop(0.8, '#BC6720'); gr.addColorStop(1, '#B05E1C');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    blotch(g, w, h, 34, '#8a3e12', 20, 70, 0.28); blotch(g, w, h, 30, '#f6c47a', 15, 55, 0.3); blotch(g, w, h * 0.35, 14, '#6e2e0c', 12, 40, 0.22);
    speckle(g, w, h, 1500, '#5a2508', 0.4, 1.4, 0.15, 0.4); speckle(g, w, h, 700, '#ffd99a', 0.4, 1.2, 0.1, 0.3);
  });
  const bunBump = ctex(512, 256, (g, w, h) => { g.fillStyle = '#808080'; g.fillRect(0, 0, w, h); speckle(g, w, h, 2600, '#000', 0.4, 1.5, 0.2, 0.6); speckle(g, w, h, 900, '#fff', 0.5, 1.6, 0.1, 0.4);
    g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 2; for (let i = 0; i < 14; i++) { const y = rr(0.1, 0.85) * h, x = rnd() * w, L = rr(30, 90); g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + L * 0.3, y + rr(-6, 6), x + L * 0.7, y + rr(-6, 6), x + L, y + rr(-4, 4)); g.stroke(); } }, false);
  const bunCut = ctex(256, 256, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2); gr.addColorStop(0, '#D9A35C'); gr.addColorStop(0.7, '#C88238'); gr.addColorStop(1, '#9A5520'); g.fillStyle = gr; g.fillRect(0, 0, w, h); blotch(g, w, h, 20, '#7a3a10', 10, 40, 0.4); speckle(g, w, h, 700, '#6e3a12', 0.6, 2, 0.1, 0.35); });
  const bunBot = ctex(256, 128, (g, w, h) => { const gr = g.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, '#B86A2A'); gr.addColorStop(0.5, '#DCA058'); gr.addColorStop(0.85, '#C98034'); gr.addColorStop(1, '#8F4C1A'); g.fillStyle = gr; g.fillRect(0, 0, w, h); blotch(g, w, h, 14, '#8a4416', 10, 30, 0.35); speckle(g, w, h, 400, '#6e320e', 0.5, 1.6, 0.1, 0.3); });
  const patty = ctex(512, 256, (g, w, h) => { // smash crust: near-black char, lacy brown crust, a few seared highlights
    g.fillStyle = '#24130a'; g.fillRect(0, 0, w, h); blotch(g, w, h, 30, '#000', 20, 60, 0.5); speckle(g, w, h, 3000, '#0b0503', 1.2, 5, 0.4, 0.95); speckle(g, w, h, 1500, '#4a2612', 1, 4, 0.35, 0.8);
    speckle(g, w, h, 650, '#7a4220', 0.6, 2.2, 0.4, 0.85); speckle(g, w, h, 160, '#a9652f', 0.5, 1.4, 0.5, 0.9); }, true, true);
  const pattyB = ctex(256, 128, (g, w, h) => { g.fillStyle = '#808080'; g.fillRect(0, 0, w, h); speckle(g, w, h, 2600, '#000', 1, 4.5, 0.4, 1); speckle(g, w, h, 1800, '#fff', 0.8, 3.5, 0.4, 1); }, false, true);
  // fries: golden body, toasted brown tips and edges, irregular blotches (v runs along the fry)
  const fry = ctex(64, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#8A4A12'); gr.addColorStop(0.07, '#C47A26'); gr.addColorStop(0.2, '#E9AE4C'); gr.addColorStop(0.55, '#F2C35E'); gr.addColorStop(0.85, '#E3A444'); gr.addColorStop(0.95, '#B96B1E'); gr.addColorStop(1, '#7E4210');
    g.fillStyle = gr; g.fillRect(0, 0, w, h); const sg = g.createLinearGradient(0, 0, w, 0); sg.addColorStop(0, 'rgba(150,80,20,.55)'); sg.addColorStop(0.25, 'rgba(0,0,0,0)'); sg.addColorStop(0.75, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(150,80,20,.55)'); g.fillStyle = sg; g.fillRect(0, 0, w, h);
    blotch(g, w, h, 10, '#a35a16', 6, 18, 0.45); speckle(g, w, h, 120, '#9a5214', 0.4, 1.4, 0.2, 0.5); speckle(g, w, h, 60, '#fff2cc', 0.3, 0.9, 0.3, 0.6); });
  const swirl = ctex(256, 256, (g, w, h) => { g.fillStyle = '#808080'; g.fillRect(0, 0, w, h); g.strokeStyle = '#c8c8c8'; g.lineWidth = 7; g.beginPath(); for (let a = 0; a < 26; a += 0.05) { const r = 4 + a * 4.4; g.lineTo(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r); } g.stroke(); }, false);
  // onion strand: translucent golden centre, browned grilled edges along the ribbon
  const onion = ctex(128, 32, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#5a2a0c'); gr.addColorStop(0.3, '#B9793A'); gr.addColorStop(0.5, '#E0B47A'); gr.addColorStop(0.7, '#B9793A'); gr.addColorStop(1, '#5a2a0c'); g.fillStyle = gr; g.fillRect(0, 0, w, h); blotch(g, w, h, 8, '#3a1806', 4, 12, 0.6); });
  MM = {
    crumb,
    bunTop: new MeshStandardMaterial({ map: bunTop, bumpMap: bunBump, bumpScale: 1.2, roughness: 0.42, envMapIntensity: 1.2 }),
    bunBot: new MeshStandardMaterial({ map: bunBot, bumpMap: crumb, bumpScale: 0.8, roughness: 0.62 }),
    bunCut: new MeshStandardMaterial({ map: bunCut, bumpMap: crumb, bumpScale: 1.4, roughness: 0.9 }),
    seed: new MeshStandardMaterial({ color: '#F2E3BF', roughness: 0.55 }),
    patty: new MeshStandardMaterial({ map: patty, bumpMap: pattyB, bumpScale: 4.5, roughness: 0.55 }),
    pattyBurnt: new MeshStandardMaterial({ map: patty, bumpMap: pattyB, bumpScale: 5, roughness: 0.6, color: '#8a8a8a' }),
    cheese: new MeshStandardMaterial({ color: '#F4A51A', roughness: 0.28, emissive: '#5a2a00', emissiveIntensity: 0.25, side: DoubleSide }),
    onion: new MeshStandardMaterial({ map: onion, roughness: 0.3, side: DoubleSide, emissive: '#6a3008', emissiveIntensity: 0.35 }),
    sauce: new MeshStandardMaterial({ color: '#E9975A', roughness: 0.18 }),
    fry: new MeshStandardMaterial({ map: fry, bumpMap: crumb, bumpScale: 0.7, roughness: 0.5, emissive: '#3a1a02', emissiveIntensity: 0.3 }),
    ceramic: new MeshStandardMaterial({ color: '#F3F1EC', roughness: 0.14 }),
    dipO: new MeshPhysicalMaterial({ color: '#E8883A', roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05, bumpMap: swirl, bumpScale: 1.2 }),
    dipD: new MeshPhysicalMaterial({ color: '#5C1B0C', roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05, bumpMap: swirl, bumpScale: 1.2 }),
    cream: new MeshStandardMaterial({ color: '#F1ECE6', roughness: 0.3, bumpMap: crumb, bumpScale: 1.6, envMapIntensity: 1.4 }),
    oreo: new MeshStandardMaterial({ color: '#1C1512', roughness: 0.7, bumpMap: crumb, bumpScale: 2 }),
    straw: new MeshStandardMaterial({ color: '#F06A10', roughness: 0.25 }),
    tray: new MeshStandardMaterial({ color: '#141414', roughness: 0.75 }),
  };
  return MM;
}

/* ---------------- burger layers (each: Group, origin bottom centre, userData.h thickness) ---------------- */
function cheeseSlice(M, size, droop, R, rot) { // smooth melt: hugs the patty top, rolls over the rim and hangs in soft drips
  const g = new PlaneGeometry(size, size, 30, 30); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), z = p.getZ(i); const r = Math.hypot(x, z), a = ang(x, z); let yy = 0.008 - r * r * 0.012;
    if (r > R) {
      const over = r - R; const drip = droop * (0.62 + 0.22 * Math.sin(a * 4 + rot * 5) + 0.12 * Math.sin(a * 9 + rot));
      const t = 1 - Math.exp(-over * 11);
      yy -= drip * t; const nr = R + over * (0.32 - 0.22 * t) + 0.012 * t; x *= nr / r; z *= nr / r;
    }
    p.setXYZ(i, x, yy, z);
  }
  g.computeVertexNormals(); const m = new Mesh(g, M.cheese); m.rotation.y = rot; return m;
}
// smash-patty edge: irregular lace (angle-only, so caps and sides stay welded)
const lace = (ph, amt) => (a) => 1 + amt * (Math.sin(a * 5 + ph) * 0.45 + Math.sin(a * 11.3 + ph * 2) * 0.25 + Math.sin(a * 23.7 + 1.7 + Math.sin(a * 3 + ph) * 2) * 0.18 + Math.sin(a * 41 + ph * 3) * 0.12);
function L(h, ...meshes) { const g = new Group(); meshes.forEach(m => g.add(m)); g.userData.h = h; return recv(g); }
export function burgerLayers() {
  const M = foodMats(); seed = 11;
  const at = (m, y) => { m.position.y = y; return m; };
  // top bun: toasted brioche dome, slightly lopsided, with sesame seeds
  const R = 0.56, H = 0.33;
  const prof = [[0, 0], [R - 0.06, 0], [R - 0.01, 0.025]];
  for (let i = 0; i <= 12; i++) { const a = (i / 12) * Math.PI / 2; prof.push([R * Math.cos(a) * (1 - 0.03 * Math.sin(a * 2)), 0.045 + (H - 0.045) * Math.pow(Math.sin(a), 0.78)]); }
  prof[prof.length - 1][0] = 0;
  const dg = lathe(prof, 44);
  { const p = dg.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const a = ang(x, z), t = y / H;
      const k = 1 + 0.018 * Math.sin(a * 3 + 0.7) + 0.01 * Math.sin(a * 7 + 2) ; p.setXYZ(i, x * k, y * (1 + 0.05 * t * Math.sin(a * 2 + 1.1) + 0.02 * t * Math.sin(a * 5)), z * k); } dg.computeVertexNormals(); weldSeam(dg, 44); }
  const dome = new Mesh(dg, M.bunTop);
  const cut = at(new Mesh(new CircleGeometry(R - 0.05, 32).rotateX(Math.PI / 2), M.bunCut), 0.002);
  const seeds = new InstancedMesh(new SphereGeometry(0.016, 6, 4), M.seed, 64); const o = new Object3D(), up = new Vector3(0, 1, 0);
  for (let i = 0; i < 64; i++) {
    const a = rnd() * 6.28, t = Math.acos(1 - rnd() * 0.75);
    const s = Math.sin(t), y = 0.045 + (H - 0.045) * Math.pow(Math.cos(t), 0.78), r = R * s * 0.99;
    const n = new Vector3(Math.cos(a) * s, Math.cos(t) * 1.3, Math.sin(a) * s).normalize();
    o.position.set(Math.cos(a) * r, y * (1 + 0.05 * (y / H) * Math.sin(a * 2 + 1.1)) + 0.004, Math.sin(a) * r); o.quaternion.setFromUnitVectors(up, n); o.rotateY(rnd() * 3);
    o.scale.set(1, 0.38, 0.55); o.updateMatrix(); seeds.setMatrixAt(i, o.matrix);
  }
  cast(dome);
  const top = L(H, dome, cut, seeds);
  const sauce = L(0.025, at(new Mesh(radial(new CylinderGeometry(0.53, 0.5, 0.025, 40, 1), (a) => 1 + 0.06 * Math.sin(a * 9) + 0.03 * Math.sin(a * 17)), M.sauce), 0.012));
  // grilled onions: flat, translucent ribbon strands (one InstancedMesh)
  const rib = new PlaneGeometry(1, 1, 10, 1); { const p = rib.attributes.position; for (let i = 0; i < p.count; i++) { const u = p.getX(i), v = p.getY(i); const th = u * 2.4, r = 0.075 + v * 0.026; p.setXYZ(i, Math.cos(th) * r, Math.sin(th * 2.5) * 0.007 + v * 0.004, Math.sin(th) * r); } rib.computeVertexNormals(); }
  const on = new InstancedMesh(rib, M.onion, 72);
  for (let i = 0; i < 72; i++) {
    const a = rnd() * 6.28, r = Math.pow(rnd(), 0.5) * 0.5; o.position.set(Math.cos(a) * r, 0.012 + rnd() * 0.05, Math.sin(a) * r);
    o.quaternion.identity(); o.rotation.set(rr(-0.35, 0.35), rnd() * 6.28, rr(-0.35, 0.35)); o.scale.set(rr(0.7, 1.4), 1, rr(0.7, 1.4)); o.updateMatrix(); on.setMatrixAt(i, o.matrix);
    on.setColorAt(i, new Color().setHSL(0.075 + rnd() * 0.03, 0.55, 0.55 + rnd() * 0.3));
  }
  const onions = L(0.07, on);
  // smash patties: lacy crust edge; the bottom one is wider than the bun and more charred (z016)
  const pattyL = (rot, r0, mat, dr) => { const pm = at(new Mesh(radial(new CylinderGeometry(r0, r0 - 0.03, 0.14, 56, 2), lace(rot * 3, 0.06)), mat), 0.07); const ch = at(cheeseSlice(M, 1.02 * r0 / 0.58, 0.15 * dr, r0 - 0.05, rot), 0.142); cast(pm, ch); return L(0.15, pm, ch); };
  const p1 = pattyL(0.35, 0.58, M.patty, 1), p2 = pattyL(-0.45, 0.65, M.pattyBurnt, 1.15);
  const bm = new Mesh(lathe(puck(0.53, 0.19, 0.07)), M.bunBot); cast(bm);
  const bot = L(0.19, bm, at(new Mesh(new CircleGeometry(0.5, 32).rotateX(-Math.PI / 2), M.bunCut), 0.191));
  return { top, sauce, onions, p1, p2, bot };
}

/* ---------------- fries: twisted, curved golden sticks with toasted tips (one InstancedMesh) in a low black tray ---------------- */
export function buildFries3D() {
  const M = foodMats(); seed = 5; const g = new Group();
  const W = 0.62, D = 0.46, H = 0.3, t = 0.015;
  const parts = []; const wall = (w, h, d, x, y, z) => { const b = new BoxGeometry(w, h, d); b.translate(x, y, z); parts.push(b); };
  wall(W, t, D, 0, t / 2, 0); wall(W, H, t, 0, H / 2, D / 2); wall(W, H * 0.8, t, 0, H * 0.4, -D / 2); wall(t, H, D, W / 2, H / 2, 0); wall(t, H, D, -W / 2, H / 2, 0);
  const tray = new Mesh(mergeGeometries(parts), M.tray); tray.receiveShadow = true; g.add(tray);
  const geo = new BoxGeometry(0.105, 1, 0.095, 1, 8, 1); geo.translate(0, 0.5, 0);
  { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); let x = p.getX(i), z = p.getZ(i); const tw = y * 0.7, c = Math.cos(tw), s = Math.sin(tw);
      const w = 0.9 + 0.1 * Math.sin(y * 5 + 1); [x, z] = [(x * c - z * s) * w, (x * s + z * c) * w];
      p.setXYZ(i, x + Math.sin(y * Math.PI) * 0.05, y, z + Math.sin(y * 2.2) * 0.015); } geo.computeVertexNormals(); }
  const N = 17; const fr = new InstancedMesh(geo, M.fry, N);
  for (let i = 0; i < N; i++) {
    const Lh = rr(0.6, 0.92); const x = rr(-W / 2 + 0.06, W / 2 - 0.06), z = rr(-D / 2 + 0.06, D / 2 - 0.06);
    o.position.set(x, 0.02, z);
    const lean = rr(0.35, 0.8), dir = (i % 2 ? 0.6 : -2.4) + rr(-0.7, 0.7); // piled at a steep slant, crossing like z024
    o.rotation.set(Math.sin(dir) * lean, rnd() * 6.28, -Math.cos(dir) * lean); o.scale.set(rr(0.8, 1.2), Lh, rr(0.8, 1.2)); o.updateMatrix(); fr.setMatrixAt(i, o.matrix);
    fr.setColorAt(i, new Color().setHSL(0.11 + rr(-0.02, 0.02), rr(0.3, 0.7), rr(0.82, 0.97)));
  }
  cast(fr); g.add(fr);
  g.userData = { w: W + 0.25, h: 0.85, tray };
  return g;
}
const o = new Object3D();

/* ---------------- dips: low ceramic ramekin, glossy clearcoat sauce ---------------- */
export function buildDip3D(dark) {
  const M = foodMats(); const g = new Group();
  const R = 0.2, H = 0.1, T = 0.016;
  const prof = [[0, 0], [R - 0.02, 0], [R, 0.012], [R + 0.006, H - 0.012], [R, H], [R - T, H - 0.004], [R - T - 0.002, 0.02], [0, 0.018]];
  const cer = new Mesh(lathe(prof, 36), M.ceramic); cast(cer); g.add(cer);
  const sp = [[R - T - 0.002, H - 0.014], [R * 0.75, H - 0.006], [R * 0.4, H - 0.001], [0, H + 0.002]];
  const dol = new SphereGeometry(R * 0.34, 16, 8); dol.scale(1, 0.32, 1); dol.translate(R * 0.12, H - 0.004, -R * 0.08);
  const sg = lathe(sp, 32);
  const sauce = new Mesh(mergeGeometries([sg.toNonIndexed(), dol.toNonIndexed()]), dark ? M.dipD : M.dipO); sauce.receiveShadow = true; g.add(sauce);
  g.userData = { w: (R + 0.01) * 2, h: H + 0.02 }; return g;
}

/* ---------------- shake: ONE clear cup (cookies-and-cream body, chocolate drizzle, ink stamp), cream dome, Oreo, clear dome lid, straw ----------------
   All pieces share the cup's axis and base. The clear parts are additive highlight shells (no depth write, drawn last), so they never
   hide or split the opaque body behind them. */
export function buildShake3D(badgeTex) {
  const M = foodMats(); seed = 3; const g = new Group();
  const R0 = 0.23, R1 = 0.29, H = 0.74, rAt = (y) => R0 + (R1 - R0) * (y / H);
  const body = ctex(512, 256, (gg, w, h) => { // cookies & cream: light grey cream, dark cookie bits, drizzle running down the inside of the cup
    gg.fillStyle = '#E4DDD6'; gg.fillRect(0, 0, w, h); blotch(gg, w, h, 30, '#b9aca3', 10, 30, 0.35); speckle(gg, w, h, 1700, '#2a211d', 0.7, 3.4, 0.35, 0.9); speckle(gg, w, h, 500, '#6a5a52', 0.6, 2.2, 0.2, 0.5);
    gg.fillStyle = '#3B1A0E'; for (let i = 0; i < 20; i++) { const x = rnd() * w, len = rr(0.3, 0.9) * h, wd = rr(7, 18); gg.globalAlpha = rr(0.75, 1); gg.beginPath(); gg.moveTo(x - wd / 2, 0); gg.bezierCurveTo(x - wd, len * 0.4, x + wd * 0.3, len * 0.7, x, len); gg.bezierCurveTo(x + wd * 0.6, len * 0.7, x + wd, len * 0.3, x + wd / 2, 0); gg.fill(); }
    gg.globalAlpha = 1; gg.fillRect(0, 0, w, 10); });
  const bodyM = new MeshStandardMaterial({ map: body, roughness: 0.4 });
  const bm = new Mesh(new CylinderGeometry(R1 - 0.01, R0 - 0.01, H - 0.01, 32, 1, true), bodyM); bm.position.y = (H - 0.01) / 2; cast(bm); g.add(bm);
  if (badgeTex) { const b = new Mesh(new CylinderGeometry(rAt(H * 0.53) + 0.004, rAt(H * 0.19) + 0.004, H * 0.34, 20, 1, true, -0.62, 1.24), new MeshStandardMaterial({ map: badgeTex, transparent: true, roughness: 0.3, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })); b.position.y = H * 0.36; b.renderOrder = 44; g.add(b); }
  // whipped cream dome, sitting exactly on the cup rim
  const cp = []; for (let i = 0; i <= 9; i++) { const a = (i / 9) * Math.PI / 2; cp.push([(R1 - 0.008) * Math.cos(a), 0.2 * Math.sin(a)]); } cp[cp.length - 1][0] = 0;
  const cg = lathe(cp, 32); { const p = cg.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const a = ang(x, z); const k = 1 + 0.05 * Math.sin(a * 7 + y * 30) * Math.min(1, y * 8); p.setXYZ(i, x * k, y * (1 + 0.08 * Math.sin(a * 5)), z * k); } cg.computeVertexNormals(); weldSeam(cg, 32); }
  const cream = new Mesh(cg, M.cream); cream.position.y = H - 0.012; cream.receiveShadow = true; g.add(cream);
  const crumbs = new InstancedMesh(new IcosahedronGeometry(0.045, 0), M.oreo, 100);
  for (let i = 0; i < 100; i++) { const a = rnd() * 6.28, t = Math.sqrt(rnd()) * 0.9; const r = (R1 - 0.03) * t; o.position.set(Math.cos(a) * r, H - 0.012 + 0.2 * Math.sqrt(Math.max(0, 1 - t * t)) + 0.004, Math.sin(a) * r); o.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); o.scale.set(rr(0.7, 1.7), rr(0.45, 0.9), rr(0.7, 1.7)); o.updateMatrix(); crumbs.setMatrixAt(i, o.matrix); }
  g.add(crumbs);
  const cookies = new InstancedMesh(new CylinderGeometry(0.075, 0.075, 0.022, 16), M.oreo, 3);
  for (let i = 0; i < 3; i++) { const a = i * 2.1 + 0.4; o.position.set(Math.cos(a) * 0.11, H + 0.15 - i * 0.02, Math.sin(a) * 0.11); o.rotation.set(rr(-0.9, 0.9), 0, rr(-0.9, 0.9)); o.scale.set(1, 1, 1); o.updateMatrix(); cookies.setMatrixAt(i, o.matrix); }
  g.add(cookies);
  const st = new Mesh(new CylinderGeometry(0.02, 0.02, 0.62, 10), M.straw); st.position.set(0.05, H + 0.24, -0.03); st.rotation.z = -0.16; g.add(st);
  // clear PET cup + dome lid: soft specular streaks (additive, so they only brighten, like the video's reflections)
  const streak = ctex(256, 64, (gg, w, h) => { gg.fillStyle = '#000'; gg.fillRect(0, 0, w, h);
    const band = (c, wd, a) => { const gr = gg.createLinearGradient(c - wd, 0, c + wd, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, `rgba(255,255,255,${a})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); gg.fillStyle = gr; gg.fillRect(c - wd, 0, 2 * wd, h); };
    band(w * 0.40, 9, 0.75); band(w * 0.46, 4, 0.5); band(w * 0.58, 16, 0.22); band(w * 0.9, 10, 0.3); band(w * 0.15, 20, 0.12); });
  const glass = new MeshBasicMaterial({ map: streak, transparent: true, blending: AdditiveBlending, depthWrite: false, side: FrontSide, toneMapped: false });
  const cup = new Mesh(new CylinderGeometry(R1 + 0.006, R0 + 0.006, H, 32, 1, true), glass); cup.position.y = H / 2; cup.renderOrder = 46; g.add(cup);
  const lidT = streak.clone(); lidT.rotation = Math.PI / 2; lidT.center.set(0.5, 0.5);
  const lid = new Mesh(new SphereGeometry(R1 + 0.014, 32, 10, 0, Math.PI * 2, 0, Math.PI / 2), new MeshBasicMaterial({ map: lidT, transparent: true, blending: AdditiveBlending, depthWrite: false, side: FrontSide, toneMapped: false, opacity: 0.9 }));
  lid.scale.y = 0.95; lid.position.y = H; lid.renderOrder = 47; g.add(lid);
  const rim = new Mesh(new CylinderGeometry(R1 + 0.016, R1 + 0.016, 0.02, 32, 1, true), new MeshBasicMaterial({ color: '#5a5a5a', transparent: true, blending: AdditiveBlending, depthWrite: false, toneMapped: false })); rim.position.y = H; rim.renderOrder = 47; g.add(rim);
  g.userData = { w: (R1 + 0.02) * 2, h: H + 0.55 }; return g;
}
