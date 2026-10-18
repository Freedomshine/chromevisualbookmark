// 背景场景：黄昏/星夜的浮岛插画，或用户自己的壁纸
import { $ } from './util.js';

// 固定种子的随机数，保证每次打开星星和云的位置一致
function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ISLAND = `
<svg class="island-svg" viewBox="0 0 600 700" aria-hidden="true">
  <defs>
    <radialGradient id="isl-halo" cx=".5" cy=".46" r=".5">
      <stop offset="0" style="stop-color:var(--halo)" stop-opacity=".5"/>
      <stop offset=".55" style="stop-color:var(--halo)" stop-opacity=".12"/>
      <stop offset="1" style="stop-color:var(--halo)" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="isl-rock" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" style="stop-color:var(--rock-1)"/>
      <stop offset=".55" style="stop-color:var(--rock-2)"/>
      <stop offset="1" style="stop-color:var(--rock-3)"/>
    </linearGradient>
    <linearGradient id="isl-grass" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" style="stop-color:var(--grass-1)"/>
      <stop offset="1" style="stop-color:var(--grass-2)"/>
    </linearGradient>
    <radialGradient id="isl-win" cx=".5" cy=".42" r=".7">
      <stop offset="0" stop-color="#fff6cf"/>
      <stop offset=".5" stop-color="#ffd567"/>
      <stop offset="1" stop-color="#f2a443"/>
    </radialGradient>
    <radialGradient id="isl-glow" cx=".5" cy=".5" r=".5">
      <stop offset="0" stop-color="#ffd27a" stop-opacity=".75"/>
      <stop offset="1" stop-color="#ffd27a" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="isl-cglow" cx=".5" cy=".5" r=".5">
      <stop offset="0" style="stop-color:var(--crystal)" stop-opacity=".8"/>
      <stop offset="1" style="stop-color:var(--crystal)" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="isl-fall" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" style="stop-color:var(--water)" stop-opacity=".95"/>
      <stop offset=".7" style="stop-color:var(--water)" stop-opacity=".35"/>
      <stop offset="1" style="stop-color:var(--water)" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <ellipse cx="300" cy="300" rx="300" ry="290" fill="url(#isl-halo)"/>

  <!-- 漂浮的小石块 -->
  <g class="isl-chip c1"><path d="M84 520l26-9 14 17-15 21-19-8z" style="fill:var(--rock-2)"/><path d="M84 520l26-9 14 17z" style="fill:var(--rock-lit)"/></g>
  <g class="isl-chip c2"><path d="M500 506l24-7 11 18-16 14-15-6z" style="fill:var(--rock-2)"/><path d="M500 506l24-7 11 18z" style="fill:var(--rock-lit)"/></g>
  <g class="isl-chip c3"><path d="M424 626l16-6 9 14-12 12z" style="fill:var(--rock-3)"/><path d="M424 626l16-6 9 14z" style="fill:var(--rock-1)"/></g>

  <!-- 岩石主体 -->
  <path d="M68 364c28 16 102 26 232 27 130-1 205-11 238-29l-10 30-20 26 4 28-30 24-12 42-32 28-18 48-40 22-28 40-34 14-18 26-16-26-32-18-20-40-36-22-12-44-34-28-10-42-32-24-4-34z" fill="url(#isl-rock)"/>
  <path d="M68 364l14 28 22 20 4 34 32 24 10 42 34 28 12 44 36 22 20 40 32 18 16 26-38-90-34-52-32-48-36-50-32-44-24-22z" style="fill:var(--rock-lit)" opacity=".9"/>
  <path d="M164 394l66 76 38 90 32 130V560l-20-90-30-74z" style="fill:var(--rock-1)" opacity=".55"/>
  <path d="M538 362l-10 30-20 26 4 28-30 24-12 42-32 28-18 48-40 22-28 40-34 14-18 26 40-90 40-60 40-60 40-50 40-34z" style="fill:var(--rock-dark)" opacity=".85"/>
  <g fill="none" style="stroke:var(--rock-line)" stroke-width="2.5" stroke-linecap="round" opacity=".45">
    <path d="M118 420c80 16 280 18 374-2"/><path d="M160 490c80 16 210 16 300-2"/><path d="M214 568c46 12 136 12 196-2"/>
  </g>

  <!-- 发光晶石 -->
  <g class="isl-crystals">
    <circle cx="212" cy="470" r="30" fill="url(#isl-cglow)"/><path d="M212 452l10 18-10 18-10-18z" style="fill:var(--crystal)"/>
    <circle cx="396" cy="520" r="26" fill="url(#isl-cglow)"/><path d="M396 505l9 15-9 16-9-16z" style="fill:var(--crystal)"/>
    <circle cx="300" cy="604" r="20" fill="url(#isl-cglow)"/><path d="M300 594l6 10-6 11-6-11z" style="fill:var(--crystal)"/>
  </g>

  <!-- 垂下来的根须 -->
  <g fill="none" style="stroke:var(--vine)" stroke-width="3" stroke-linecap="round">
    <path d="M150 392c-4 28 8 48 0 78"/><path d="M236 396c-4 34 10 64 0 104-6 20 4 30 0 48"/>
    <path d="M372 398c6 32-6 58 2 90"/><path d="M470 388c6 22-4 40 2 64"/>
  </g>
  <g style="fill:var(--leaf-2)"><circle cx="150" cy="472" r="4"/><circle cx="236" cy="550" r="4"/><circle cx="374" cy="490" r="4"/><circle cx="472" cy="454" r="3.5"/></g>

  <!-- 小溪和瀑布 -->
  <path d="M452 338c20 4 44 10 66 22" fill="none" style="stroke:var(--water)" stroke-width="5" stroke-linecap="round" opacity=".7"/>
  <path d="M506 358c3 20 5 44 5 84v170h14V442c0-40 2-64 5-84z" fill="url(#isl-fall)"/>
  <path class="isl-flow" d="M512 372v230M520 372v236M526 372v200" fill="none" stroke="#fff" stroke-width="1.6" stroke-dasharray="9 17" stroke-linecap="round" opacity=".6"/>

  <!-- 岛面草地 -->
  <path d="M62 352c8-22 50-36 106-40 62-6 132-8 204-6 68 2 128 8 160 22 20 9 20 24 6 32-38 20-118 28-238 28-110 0-196-8-226-20-12-5-14-10-12-16z" fill="url(#isl-grass)"/>
  <path d="M96 338c44-16 124-22 204-23 80-1 170 5 220 19-50-2-140-6-220-5-80 1-150 5-204 9z" style="fill:var(--grass-hi)" opacity=".75"/>
  <g style="fill:var(--grass-dark)">
    <ellipse cx="96" cy="372" rx="14" ry="7"/><ellipse cx="160" cy="382" rx="16" ry="7"/><ellipse cx="236" cy="389" rx="18" ry="6"/>
    <ellipse cx="330" cy="390" rx="18" ry="6"/><ellipse cx="410" cy="384" rx="16" ry="7"/><ellipse cx="486" cy="374" rx="14" ry="7"/>
  </g>

  <!-- 后面的松树 -->
  <g style="fill:var(--leaf-3)">
    <path d="M150 222l-30 54h18l-26 44h76l-26-44h18z"/>
    <rect x="145" y="318" width="10" height="20" style="fill:var(--trunk)"/>
  </g>

  <!-- 右侧大树 -->
  <path d="M440 342c-4-40 4-70-2-110h14c-2 40 6 70 4 110z" style="fill:var(--trunk)"/>
  <g style="fill:var(--leaf-1)">
    <circle cx="446" cy="196" r="54"/><circle cx="404" cy="222" r="40"/><circle cx="490" cy="224" r="40"/>
    <circle cx="440" cy="146" r="42"/><circle cx="410" cy="172" r="34"/><circle cx="482" cy="166" r="38"/>
  </g>
  <g style="fill:var(--leaf-2)" opacity=".85">
    <circle cx="432" cy="180" r="34"/><circle cx="398" cy="212" r="22"/><circle cx="476" cy="208" r="22"/>
    <circle cx="430" cy="136" r="25"/><circle cx="470" cy="152" r="20"/>
  </g>

  <!-- 屋檐到树的串灯 -->
  <path d="M368 172c22 30 48 36 74 30" fill="none" stroke="#2a2040" stroke-width="1.4" opacity=".8"/>
  <g class="isl-bulbs" fill="#ffe08a">
    <circle cx="377" cy="184" r="3"/><circle cx="389" cy="194" r="3"/><circle cx="402" cy="201" r="3"/><circle cx="416" cy="205" r="3"/><circle cx="430" cy="204" r="3"/>
  </g>

  <!-- 小屋 -->
  <path d="M346 250l38-14v97l-38 12z" style="fill:var(--wall-side)"/>
  <rect x="196" y="250" width="150" height="95" style="fill:var(--wall)"/>
  <path d="M356 168l38-16v82l-38 14z" style="fill:var(--wall-side-2)"/>
  <rect x="186" y="168" width="170" height="80" style="fill:var(--wall-2)"/>
  <rect x="182" y="244" width="178" height="9" rx="2" style="fill:var(--beam)"/>
  <path d="M360 244l32-12v8l-32 13z" style="fill:var(--beam)"/>
  <path d="M271 84l97 88 38-16-97-88z" style="fill:var(--roof-side)"/>
  <path d="M174 172l97-88 97 88z" style="fill:var(--roof)"/>
  <path d="M194 168l77-70 77 70z" style="fill:var(--wall-2)"/>
  <path d="M174 172l97-88 97 88" fill="none" style="stroke:var(--rim)" stroke-width="3" stroke-linejoin="round" opacity=".55"/>
  <path d="M271 84l38-16" fill="none" style="stroke:var(--rim)" stroke-width="2.5" opacity=".45"/>
  <rect x="330" y="72" width="18" height="40" style="fill:var(--chimney)"/>
  <rect x="327" y="67" width="24" height="8" rx="2" style="fill:var(--beam)"/>
  <g class="isl-smoke" fill="#e9ddff"><circle cx="340" cy="56" r="7"/><circle cx="346" cy="40" r="9"/><circle cx="338" cy="22" r="11"/></g>

  <!-- 窗户 -->
  <g class="isl-glows">
    <circle class="g1" cx="222" cy="212" r="44" fill="url(#isl-glow)"/>
    <circle class="g2" cx="320" cy="212" r="44" fill="url(#isl-glow)"/>
    <circle class="g3" cx="233" cy="295" r="52" fill="url(#isl-glow)"/>
    <circle class="g1" cx="271" cy="134" r="32" fill="url(#isl-glow)"/>
    <circle class="g2" cx="190" cy="282" r="30" fill="url(#isl-glow)"/>
  </g>
  <g style="stroke:var(--frame)" stroke-width="3">
    <circle cx="271" cy="134" r="14" fill="url(#isl-win)"/>
    <rect x="204" y="190" width="36" height="44" rx="2" fill="url(#isl-win)"/>
    <rect x="302" y="190" width="36" height="44" rx="2" fill="url(#isl-win)"/>
    <rect x="208" y="272" width="50" height="44" rx="2" fill="url(#isl-win)"/>
    <rect x="318" y="276" width="20" height="34" rx="2" fill="url(#isl-win)"/>
  </g>
  <g style="stroke:var(--frame)" stroke-width="2.2">
    <path d="M271 120v28M257 134h28"/><path d="M222 190v44M204 212h36"/><path d="M320 190v44M302 212h36"/><path d="M233 272v44M208 294h50"/>
  </g>
  <path d="M366 184l18-7v37l-18 7z" fill="#e8b25a" opacity=".85"/>
  <path d="M356 270l18-7v37l-18 7z" fill="#e8b25a" opacity=".75"/>
  <rect x="200" y="316" width="62" height="8" rx="2" style="fill:var(--beam)"/>
  <g><circle cx="210" cy="314" r="3.5" fill="#f7a8c8"/><circle cx="222" cy="312" r="3.5" fill="#ffe08a"/><circle cx="234" cy="314" r="3.5" fill="#f7a8c8"/><circle cx="246" cy="312" r="3.5" fill="#fff"/></g>
  <path d="M274 345v-49a18 18 0 0 1 36 0v49z" style="fill:var(--door)"/>
  <circle cx="292" cy="300" r="6" fill="#ffd567"/>
  <circle cx="302" cy="322" r="2" fill="#ffd567"/>
  <rect x="266" y="343" width="52" height="6" rx="1.5" style="fill:var(--step)"/>
  <rect x="260" y="349" width="64" height="6" rx="1.5" style="fill:var(--step)" opacity=".8"/>
  <!-- 挂灯 -->
  <path d="M190 253v18" stroke="#2a2040" stroke-width="1.6"/>
  <rect x="183" y="271" width="14" height="18" rx="3" fill="url(#isl-win)" style="stroke:var(--frame)" stroke-width="2"/>

  <!-- 篱笆与灌木 -->
  <g style="fill:var(--step)" opacity=".85">
    <rect x="96" y="332" width="5" height="22" rx="1.5"/><rect x="114" y="330" width="5" height="24" rx="1.5"/><rect x="132" y="330" width="5" height="24" rx="1.5"/><rect x="150" y="332" width="5" height="22" rx="1.5"/>
    <rect x="92" y="338" width="66" height="4" rx="2"/><rect x="92" y="347" width="66" height="3" rx="1.5"/>
  </g>
  <g style="fill:var(--leaf-1)"><circle cx="170" cy="342" r="18"/><circle cx="150" cy="352" r="14"/><circle cx="414" cy="344" r="16"/><circle cx="434" cy="350" r="12"/></g>
  <g style="fill:var(--leaf-2)"><circle cx="164" cy="335" r="9"/><circle cx="408" cy="338" r="8"/></g>
  <g>
    <circle cx="118" cy="364" r="3" fill="#f7a8c8"/><circle cx="196" cy="372" r="3" fill="#ffe08a"/><circle cx="372" cy="370" r="3" fill="#f7a8c8"/>
    <circle cx="452" cy="364" r="3" fill="#fff"/><circle cx="344" cy="378" r="2.6" fill="#ffe08a"/><circle cx="140" cy="374" r="2.6" fill="#fff"/>
  </g>
</svg>`;

// 连绵的云海：一排排“云团”沿一条起伏的周期曲线排开，宽度正好一个周期，所以横向滚动首尾无缝
function cloudBand(seed, cls, { lobes, rMin, rMax, base, swell, freq }) {
  const r = rng(seed);
  const W = 1600;
  const phase = r() * Math.PI * 2;
  const phase2 = r() * Math.PI * 2;
  const crest = (x) => base - swell * (0.55 + 0.3 * Math.sin((2 * Math.PI * freq * x) / W + phase) + 0.15 * Math.sin((2 * Math.PI * (freq * 2 + 1) * x) / W + phase2));

  const step = W / lobes;
  const rows = [];
  // 后排高而暗、前排低而亮，叠出层次
  for (const [row, lift, scale] of [[0, 0.55, 1.15], [1, 0, 1]]) {
    for (let i = 0; i < lobes; i++) {
      const x = i * step + (row ? step / 2 : 0) + (r() - 0.5) * step * 0.4;
      const rad = (rMin + r() * (rMax - rMin)) * scale;
      const y = crest(x) + rad * (row ? 0.35 : 0.1) - lift * rad;
      rows.push({ row, x, y, rad });
    }
  }
  const lobe = ({ row, x, y, rad }) => {
    const out = [];
    for (const dx of [0, W, -W]) {
      const cx = x + dx;
      if (cx + rad < -10 || cx - rad > W + 10) continue;
      out.push(
        `<circle cx="${cx.toFixed(1)}" cy="${y.toFixed(1)}" r="${rad.toFixed(1)}" fill="url(#${cls}-base)"${row ? '' : ' opacity=".92"'}/>` +
          `<circle cx="${(cx - rad * 0.1).toFixed(1)}" cy="${(y - rad * 0.13).toFixed(1)}" r="${(rad * 0.87).toFixed(1)}" fill="url(#${cls}-lit)"/>`,
      );
    }
    return out.join('');
  };
  // 云团下方的底色沿同一条曲线走，避免露出天空的缝
  let belly = `M0 500`;
  for (let x = 0; x <= W; x += 20) belly += ` L${x} ${(crest(x) + rMin * 0.6).toFixed(1)}`;
  belly = `<path d="${belly} L${W} 500Z" fill="url(#${cls}-base)"/>`;
  const defs = `<defs>
    <linearGradient id="${cls}-lit" gradientUnits="userSpaceOnUse" x1="0" y1="${base - swell - rMax * 1.6}" x2="0" y2="${base + rMax * 0.6}"><stop offset="0" style="stop-color:var(--${cls}-1)"/><stop offset="1" style="stop-color:var(--${cls}-2)"/></linearGradient>
    <linearGradient id="${cls}-base" gradientUnits="userSpaceOnUse" x1="0" y1="${base - swell - rMax}" x2="0" y2="500"><stop offset="0" style="stop-color:var(--${cls}-2)"/><stop offset="1" style="stop-color:var(--${cls}-3)"/></linearGradient>
  </defs>`;
  const svg = `<svg viewBox="0 0 ${W} 500" preserveAspectRatio="none" aria-hidden="true">${defs}${belly}${rows.map(lobe).join('')}</svg>`;
  return svg + svg;
}

function stars(n) {
  const r = rng(7);
  let html = '';
  for (let i = 0; i < n; i++) {
    const size = (r() * 1.8 + 0.8).toFixed(1);
    html += `<i style="left:${(r() * 100).toFixed(2)}%;top:${(r() * 58).toFixed(2)}%;width:${size}px;height:${size}px;animation-delay:${(-r() * 6).toFixed(2)}s;animation-duration:${(3 + r() * 4).toFixed(2)}s"></i>`;
  }
  return html;
}

function motes(n) {
  const r = rng(21);
  const tones = ['lamp', 'mint', 'rose'];
  let html = '';
  for (let i = 0; i < n; i++) {
    html += `<i class="${tones[i % 3]}" style="left:${(r() * 100).toFixed(2)}%;--s:${(2 + r() * 3.5).toFixed(1)}px;--x:${((r() - 0.5) * 120).toFixed(0)}px;animation-delay:${(-r() * 26).toFixed(1)}s;animation-duration:${(16 + r() * 14).toFixed(1)}s"></i>`;
  }
  return html;
}

const BIRD = '<svg viewBox="0 0 40 16" aria-hidden="true"><path d="M2 9q9-8 18 0q9-8 18 0" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';

// ---------- 自定义壁纸存在 IndexedDB 里（只在本机） ----------
function db() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('visual-bookmark', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function kv(mode, key, value) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction('kv', mode === 'get' ? 'readonly' : 'readwrite');
    const st = tx.objectStore('kv');
    const req = mode === 'get' ? st.get(key) : mode === 'del' ? st.delete(key) : st.put(value, key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const Scene = {
  root: null,
  photoUrl: null,
  current: { scene: 'dusk', motion: true },

  mount(root, opts = {}) {
    this.root = root;
    const mini = !!opts.mini;
    root.innerHTML = `
      <div class="sky"></div>
      <div class="stars">${stars(mini ? 40 : 120)}</div>
      <div class="moon"></div>
      ${mini ? '' : '<div class="shooting"></div>'}
      <div class="clouds far"><div class="drift">${cloudBand(11, 'cl-far', { lobes: 22, rMin: 46, rMax: 92, base: 330, swell: 120, freq: 2 })}</div></div>
      <div class="island"><div class="bob">${ISLAND}</div></div>
      <div class="clouds near"><div class="drift">${cloudBand(29, 'cl-near', { lobes: 16, rMin: 70, rMax: 130, base: 360, swell: 110, freq: 1 })}</div></div>
      ${mini ? '' : `<div class="birds"><span class="bird b1">${BIRD}</span><span class="bird b2">${BIRD}</span><span class="bird b3">${BIRD}</span></div>`}
      <div class="motes">${motes(mini ? 8 : 26)}</div>
      <div class="photo"></div>
      <div class="veil"></div>`;
    if (!mini) this.bindParallax();
    this.apply(opts);
    this.loadPhoto();
  },

  apply(opts = {}) {
    Object.assign(this.current, opts);
    if (!this.root) return;
    const { scene, motion } = this.current;
    this.root.dataset.variant = scene === 'night' ? 'night' : 'dusk';
    this.root.dataset.mode = scene === 'image' && this.photoUrl ? 'photo' : 'art';
    this.root.dataset.motion = motion ? 'on' : 'off';
  },

  bindParallax() {
    let frame = 0;
    window.addEventListener('pointermove', (e) => {
      if (!this.current.motion || frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        this.root.style.setProperty('--px', ((e.clientX / innerWidth) * 2 - 1).toFixed(3));
        this.root.style.setProperty('--py', ((e.clientY / innerHeight) * 2 - 1).toFixed(3));
      });
    });
  },

  async loadPhoto() {
    try {
      const blob = await kv('get', 'wallpaper');
      if (blob) this.usePhoto(blob);
    } catch {
      /* 读不到就用插画 */
    }
  },

  usePhoto(blob) {
    if (this.photoUrl) URL.revokeObjectURL(this.photoUrl);
    this.photoUrl = blob ? URL.createObjectURL(blob) : null;
    const el = this.root && $('.photo', this.root);
    if (el) el.style.backgroundImage = this.photoUrl ? `url("${this.photoUrl}")` : '';
    this.apply();
  },

  async savePhoto(file) {
    await kv('put', 'wallpaper', file);
    this.usePhoto(file);
  },

  async clearPhoto() {
    await kv('del', 'wallpaper');
    this.usePhoto(null);
  },
};
