/* v10 — photoreal food: real-looking photo cut-outs turned into 3D "photo reliefs".
   The alpha mask gives the silhouette; a distance transform of the mask gives a rounded height field, so the photo is
   displaced into a volume (front) and mirrored into a darker back half. Lit by the scene lights (Lambert: cheap per-pixel shading + cast/contact shadows),
   while an emissive copy of the photo keeps its real colours. Turning the box or the fly-in shows volume, not a flat card. */
import { Group, Mesh, PlaneGeometry, MeshLambertMaterial, Color, FrontSide, BufferAttribute } from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
export { RGBELoader };

export function photoRelief(tex, { w = 1, depth = 0.2, seg = 64, round = 0.4, dome = 0.25, emissive = 0.72, diffuse = 0.42, backTone = 0.72, rough = 0.6, rim = 0.22, base = 0.32, slope = 1.2 } = {}) {
  const img = tex.image; const ar = img.height / img.width;
  const gx = seg, gy = Math.max(8, Math.round(seg * ar)), nx = gx + 1, ny = gy + 1;
  const c = document.createElement('canvas'); c.width = nx; c.height = ny; const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0, nx, ny); const px = g.getImageData(0, 0, nx, ny).data;
  // chamfer distance (grid cells) from each inside cell to the silhouette
  const INF = 1e9, d = new Float32Array(nx * ny);
  for (let i = 0; i < nx * ny; i++) d[i] = px[i * 4 + 3] > 110 ? INF : 0;
  const at = (x, y) => (x < 0 || y < 0 || x >= nx || y >= ny) ? 0 : d[y * nx + x];
  for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) { const i = y * nx + x; if (!d[i]) continue; d[i] = Math.min(d[i], at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + 1.414, at(x + 1, y - 1) + 1.414); }
  for (let y = ny - 1; y >= 0; y--) for (let x = nx - 1; x >= 0; x--) { const i = y * nx + x; if (!d[i]) continue; d[i] = Math.min(d[i], at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + 1.414, at(x - 1, y + 1) + 1.414); }
  let dmax = 1; for (let i = 0; i < d.length; i++) if (d[i] > dmax && d[i] < INF) dmax = d[i];
  const r0 = Math.max(1.5, dmax * round), H = w * ar;
  const geo = new PlaneGeometry(w, H, gx, gy); geo.translate(0, H / 2, 0);
  const p = geo.attributes.position, col = new Float32Array(p.count * 3);
  // lowest inside row per column → base (contact) occlusion measured from the object's own bottom edge
  const lowRow = new Int32Array(nx).fill(-1);
  for (let x = 0; x < nx; x++) for (let y = ny - 1; y >= 0; y--) if (d[y * nx + x]) { lowRow[x] = y; break; }
  for (let i = 0; i < p.count; i++) { // PlaneGeometry rows run top → bottom, like the image
    const t = Math.min(1, d[i] / r0); const edge = 0.6 * Math.sqrt(1 - (1 - t) * (1 - t)) + 0.4 * t * (2 - t); // rounded, no knife-edge wall
    // slope limit: walls never steeper than ~50°, so thin parts (fry tips, onion strands, straws) stay flat instead of smearing when turned
    p.setZ(i, Math.min(depth * w * edge * (1 - dome + dome * Math.min(1, d[i] / dmax)), slope * d[i] * w / gx));
    // baked occlusion: the rim turns away from the light, the base sits in its own contact shadow
    const x = i % nx, y = (i / nx) | 0; const up = lowRow[x] < 0 ? 1 : Math.min(1, Math.max(0, (lowRow[x] - y) / (ny * 0.14)));
    const ao = (1 - rim * (1 - Math.min(1, d[i] / (r0 * 0.8)))) * (1 - base * (1 - up * up * (3 - 2 * up)));
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = ao;
  }
  geo.setAttribute('color', new BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const mat = (tone, em, side, back) => { const m = new MeshLambertMaterial({ map: tex, emissiveMap: tex, emissive: new Color(em, em, em), color: new Color(tone, tone, tone), alphaTest: 0.5, side, toneMapped: false, vertexColors: true,
      polygonOffset: back, polygonOffsetFactor: back ? 2 : 0, polygonOffsetUnits: back ? 4 : 0 }); // back shell always loses the depth tie at the silhouette (no dark specks)
    m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance *= vColor.rgb;'); };
    m.customProgramCacheKey = () => 'relief-ao'; return m; };;
  const front = new Mesh(geo, mat(diffuse, emissive, FrontSide, false));
  const back = new Mesh(geo, mat(diffuse * backTone, emissive * backTone, FrontSide, true)); back.scale.z = -1;
  front.castShadow = back.castShadow = true; front.receiveShadow = true;
  const grp = new Group(); grp.add(front, back); grp.userData = { w, h: H, front, back };
  return grp;
}
