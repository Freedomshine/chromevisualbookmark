// 线性图标（24 网格，currentColor 描边）与文件夹色块
import { hueOf, splitEmoji } from './util.js';

const P = {
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  folder: '<path d="M3.5 7.5a2 2 0 0 1 2-2h3.6l2 2.2h7.4a2 2 0 0 1 2 2v7.8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
  folderPlus: '<path d="M3.5 7.5a2 2 0 0 1 2-2h3.6l2 2.2h7.4a2 2 0 0 1 2 2v7.8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/><path d="M12 11v5M9.5 13.5h5"/>',
  chevronRight: '<path d="m9.5 6 6 6-6 6"/>',
  chevronLeft: '<path d="m14.5 6-6 6 6 6"/>',
  arrowUp: '<path d="M12 19V5M6.5 10.5 12 5l5.5 5.5"/>',
  close: '<path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5"/>',
  grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6"/>',
  list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><path d="M4.6 6.5h.1M4.6 12h.1M4.6 17.5h.1" stroke-width="2.6"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  undo: '<path d="M9.5 6.5 5 11l4.5 4.5"/><path d="M5.5 11H15a4.5 4.5 0 0 1 0 9h-3"/>',
  external: '<path d="M14 4.5h5.5V10"/><path d="M19.5 4.5 11 13"/><path d="M18 14v4a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 5 18V8a1.5 1.5 0 0 1 1.5-1.5H10"/>',
  trash: '<path d="M4.5 7h15"/><path d="M9.5 7V5.2a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V7"/><path d="M6.5 7l.8 11.3a1.6 1.6 0 0 0 1.6 1.5h6.2a1.6 1.6 0 0 0 1.6-1.5L17.5 7"/>',
  edit: '<path d="M14.5 5.5l4 4"/><path d="M4.5 19.5l1-4.2L15.8 5a1.4 1.4 0 0 1 2 0l1.2 1.2a1.4 1.4 0 0 1 0 2L8.7 18.5z"/>',
  move: '<path d="M3.5 7.5a2 2 0 0 1 2-2h3.6l2 2.2h7.4a2 2 0 0 1 2 2v7.8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/><path d="M9 13.5h6.5M13 11l2.5 2.5L13 16"/>',
  check: '<path d="m5.5 12.5 4 4 9-9"/>',
  overview: '<rect x="4" y="4" width="7" height="9" rx="1.8"/><rect x="13" y="4" width="7" height="5" rx="1.8"/><rect x="13" y="11" width="7" height="9" rx="1.8"/><rect x="4" y="15" width="7" height="5" rx="1.8"/>',
  columns: '<rect x="3.5" y="5" width="5" height="14" rx="1.6"/><rect x="9.5" y="5" width="5" height="14" rx="1.6"/><rect x="15.5" y="5" width="5" height="14" rx="1.6"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/>',
  clock: '<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>',
  sparkles: '<path d="M11 3.5l1.7 4.6 4.6 1.7-4.6 1.7L11 16.1l-1.7-4.6-4.6-1.7 4.6-1.7z"/><path d="M18 14.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
  lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="2.2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  wand: '<path d="m4.5 19.5 10-10"/><path d="m13 8 3 3"/><path d="M17.5 3.5v3M16 5h3M20 10v2.4M18.8 11.2h2.4M9 3.8v2M8 4.8h2"/>',
  target: '<circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="1.8"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21"/>',
  inbox: '<path d="M4 13.5 6.2 6.3A1.6 1.6 0 0 1 7.7 5.2h8.6a1.6 1.6 0 0 1 1.5 1.1L20 13.5V18a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18z"/><path d="M4 13.5h4.5l1 2h5l1-2H20"/>',
  type: '<path d="M5.5 7.5V5h13v2.5M12 5v14M9.5 19h5"/>',
  globe: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c2.4 2.3 3.5 5 3.5 8s-1.1 5.7-3.5 8c-2.4-2.3-3.5-5-3.5-8s1.1-5.7 3.5-8z"/>',
  menu: '<path d="M4.5 7h15M4.5 12h15M4.5 17h15"/>',
  bookmark: '<path d="M7 4.5h10a1 1 0 0 1 1 1v14l-6-3.8-6 3.8v-14a1 1 0 0 1 1-1z"/>',
  phone: '<rect x="7" y="3.5" width="10" height="17" rx="2.2"/><path d="M11 17.5h2"/>',
  split: '<rect x="3.5" y="5" width="17" height="14" rx="2.2"/><path d="M12 5v14"/><path d="M14.8 12h3M16.3 10.5v3"/>',
  image: '<rect x="4" y="5" width="16" height="14" rx="2.2"/><circle cx="9" cy="10" r="1.6"/><path d="m5 17 4.5-4.5 3.5 3.5 2.5-2.5L19.5 17"/>',
  collapse: '<path d="m7 15 5-5 5 5"/><path d="M7 19h10" opacity=".5"/>',
};

export function icon(name, cls = '') {
  return `<svg class="ic${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${P[name] || ''}</svg>`;
}

// 文件夹色相只取和背景协调的几种：薰衣草、天青、薄荷、蜜桃、蔷薇、灯黄、湖蓝、丁香
const HUES = [258, 205, 152, 22, 334, 44, 184, 288];

const FOLDER_GLYPH =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="f-back" d="M3 7.2A2.2 2.2 0 0 1 5.2 5h3.9l2.1 2.2h7.6A2.2 2.2 0 0 1 21 9.4v8.4A2.2 2.2 0 0 1 18.8 20H5.2A2.2 2.2 0 0 1 3 17.8z"/><path class="f-front" d="M3 10.6a1.8 1.8 0 0 1 1.8-1.8h14.4a1.8 1.8 0 0 1 1.8 1.8v7.2A2.2 2.2 0 0 1 18.8 20H5.2A2.2 2.2 0 0 1 3 17.8z"/></svg>';

const ROOT_ICONS = { 1: 'bookmark', 2: 'inbox', 3: 'phone' };

export function folderTile(node, cls = '') {
  const isRoot = node.parentId === '0';
  const h = isRoot ? 205 : HUES[hueOf(node.id) % HUES.length];
  const { emoji } = splitEmoji(node.title);
  let inner = FOLDER_GLYPH;
  if (isRoot) inner = icon(ROOT_ICONS[node.id] || 'folder');
  else if (emoji) inner = `<span class="ftile-emoji">${emoji}</span>`;
  return `<span class="ftile${isRoot ? ' is-root' : ''}${cls ? ' ' + cls : ''}" style="--h:${h}" aria-hidden="true">${inner}</span>`;
}

export function specialTile(name, h = 44) {
  return `<span class="ftile is-root" style="--h:${h}" aria-hidden="true">${icon(name)}</span>`;
}

// 小浮岛标志：侧栏品牌、弹窗、扩展图标都用这一个
let markSeq = 0;
export function brandMark() {
  const id = `bm${++markSeq}`;
  return `<svg class="brand-svg" viewBox="0 0 64 64" aria-hidden="true">
  <defs>
    <linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#262c68"/><stop offset=".55" stop-color="#6f5aa3"/><stop offset="1" stop-color="#eaa7b4"/></linearGradient>
    <radialGradient id="${id}g" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffd98a" stop-opacity=".9"/><stop offset="1" stop-color="#ffd98a" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="64" height="64" rx="18" fill="url(#${id}s)"/>
  <circle cx="48" cy="13" r="3.6" fill="#fff4d6"/>
  <circle cx="14" cy="12" r="1" fill="#fff" opacity=".8"/><circle cx="24" cy="7" r=".8" fill="#fff" opacity=".6"/><circle cx="56" cy="27" r=".8" fill="#fff" opacity=".6"/>
  <path d="M13 40c6 3 32 3 38 0l-5 6-4 7-6 6-3 2-3-3-6-6-4-6z" fill="#4a3a72"/>
  <path d="M13 40l6 7 4 6 6 6 3 2-6-11-6-6z" fill="#6c579a"/>
  <path d="M11 39.5c2-4 40-4 42 0-1 2.4-40 2.4-42 0z" fill="#6fa36f"/>
  <path d="M14 38.4c4-2.2 32-2.4 36 0-8-.8-28-.8-36 0z" fill="#a6d08a" opacity=".8"/>
  <circle cx="32" cy="31" r="10" fill="url(#${id}g)"/>
  <path d="M25 38V29.5l7-6 7 6V38z" fill="#9c8ad6"/>
  <path d="M22.5 30.5 32 22l9.5 8.5" fill="none" stroke="#3a315f" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
  <rect x="29.5" y="30" width="5" height="5" rx="1" fill="#ffd56b"/>
  <circle cx="45" cy="33" r="4.6" fill="#2f5b5e"/><circle cx="44" cy="31.6" r="2.6" fill="#4d8a78"/>
</svg>`;
}
