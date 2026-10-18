import { $, $$, esc, domainOf, faviconUrl, highlight, openUrl, prefs } from './util.js';
import { icon, brandMark } from './icons.js';
import { store } from './store.js';
import { Scene } from './scene.js';

const settings = { scene: 'dusk', glass: 0.12, blur: 22, motion: true, ...prefs.get('settings', {}) };
document.documentElement.style.setProperty('--ga', settings.glass);
document.documentElement.style.setProperty('--gb', `${settings.blur}px`);
Scene.mount($('#scene'), { ...settings, mini: true });

$('#mark').innerHTML = brandMark();
$('#searchIc').innerHTML = icon('search');
$('#openApp').innerHTML = `${icon('columns')}打开整理台`;
$('#openMgr').innerHTML = icon('external');

const q = $('#q');
let cursor = -1;

const title = (b) => b.title || domainOf(b.url) || b.url;

function render() {
  const query = q.value.trim();
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const items = terms.length
    ? store.bookmarks.filter((b) => terms.every((t) => `${b.title} ${b.url}`.toLowerCase().includes(t))).slice(0, 40)
    : store.stats.recent.slice(0, 12);
  $('#listLabel').textContent = terms.length ? `找到 ${items.length >= 40 ? '40+' : items.length} 个` : '最近添加';
  $('#list').innerHTML = items.length
    ? items
        .map(
          (b) => `<button class="pp-item" data-url="${esc(b.url)}" title="${esc(b.url)}">
        <img class="fav" src="${faviconUrl(b.url)}" alt="">
        <span><b>${highlight(title(b), query)}</b><small>${esc(store.pathText(b.id))}</small></span></button>`,
        )
        .join('')
    : `<p class="pp-empty">${terms.length ? '没有找到，换个关键词试试' : '还没有书签'}</p>`;
  cursor = -1;
}

function open(url, background = false) {
  if (openUrl(url, background ? 'background' : 'tab') && !background) window.close();
}

$('#list').addEventListener('click', (e) => {
  const item = e.target.closest('.pp-item');
  if (item) open(item.dataset.url, e.metaKey || e.ctrlKey);
});

q.addEventListener('input', render);
q.addEventListener('keydown', (e) => {
  const items = $$('.pp-item');
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (!items.length) return;
    items[cursor]?.classList.remove('is-active');
    cursor = (cursor + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items[cursor].classList.add('is-active');
    items[cursor].scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter') {
    const item = items[cursor] || items[0];
    if (item) open(item.dataset.url, e.metaKey || e.ctrlKey);
  }
});

$('#openApp').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('bookmarks.html') });
  window.close();
});
$('#openMgr').addEventListener('click', () => {
  chrome.tabs.create({ url: 'chrome://bookmarks/' });
  window.close();
});

store.load().then(() => {
  $('#stats').textContent = `${store.bookmarks.length} 个书签，${store.folders.length} 个文件夹`;
  render();
});
