// 通用小工具：DOM 查询、转义、网址处理、本地偏好

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export function domainOf(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '') || u.protocol.replace(':', '');
  } catch {
    return '';
  }
}

// 用于判断重复书签：忽略协议、www 和末尾斜杠
export function normalizeUrl(url) {
  try {
    const u = new URL(url);
    const host = u.host.toLowerCase().replace(/^www\./, '');
    return host + u.pathname.replace(/\/+$/, '') + u.search + u.hash;
  } catch {
    return String(url || '').trim();
  }
}

// MV3 自带的本地图标服务（需要 favicon 权限），不向任何第三方发请求
export function faviconUrl(pageUrl, size = 32) {
  const base = globalThis.chrome?.runtime?.getURL?.('/_favicon/');
  if (!base) return '';
  return `${base}?pageUrl=${encodeURIComponent(pageUrl)}&size=${size}`;
}

export function hueOf(str) {
  let h = 0;
  for (const ch of String(str)) h = Math.imul(h ^ ch.codePointAt(0), 0x5bd1e995) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

const EMOJI_RE = /^(\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}])*)\s*/u;
export function splitEmoji(title) {
  const t = title || '';
  const m = EMOJI_RE.exec(t);
  if (!m) return { emoji: '', text: t };
  return { emoji: m[1], text: t.slice(m[0].length) || t };
}

export function timeAgo(ms) {
  if (!ms) return '';
  const s = (Date.now() - ms) / 1000;
  if (s < 60) return '刚刚';
  const m = s / 60;
  if (m < 60) return `${Math.floor(m)} 分钟前`;
  const h = m / 60;
  if (h < 24) return `${Math.floor(h)} 小时前`;
  const d = h / 24;
  if (d < 30) return `${Math.floor(d)} 天前`;
  if (d < 365) return `${Math.floor(d / 30)} 个月前`;
  return `${Math.floor(d / 365)} 年前`;
}

export const prefs = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem('vb:' + key);
      return v == null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem('vb:' + key, JSON.stringify(value));
    } catch {
      /* 隐私模式等情况下写不进去，忽略即可 */
    }
  },
};

export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// 把关键词高亮成 <mark>，输入已转义
export function highlight(text, query) {
  let html = esc(text);
  const terms = String(query || '').trim().split(/\s+/).filter(Boolean).map(esc);
  if (!terms.length) return html;
  const re = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  return html.replace(re, '<mark>$1</mark>');
}

export function openUrl(url, mode = 'tab') {
  if (/^javascript:/i.test(url)) return false;
  if (mode === 'current') chrome.tabs.update({ url });
  else chrome.tabs.create({ url, active: mode !== 'background' });
  return true;
}
