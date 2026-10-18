import { $, $$, esc, domainOf, faviconUrl, splitEmoji, timeAgo, prefs, debounce, highlight, openUrl } from './util.js';
import { icon, folderTile, specialTile, brandMark } from './icons.js';
import { store } from './store.js';
import { Scene } from './scene.js';

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const settings = { scene: 'dusk', glass: 0.12, blur: 22, motion: !reduceMotion, openMode: 'tab', ...prefs.get('settings', {}) };

const uid = () => Math.random().toString(36).slice(2, 9);

const S = {
  view: prefs.get('view', 'overview'),
  panels: (prefs.get('panels', []) || []).map((p) => ({ ...p, uid: uid() })),
  organize: false,
  selection: new Set(),
  rangeAnchor: null,
  expanded: new Set(prefs.get('expanded', ['1'])),
  panelWidth: prefs.get('panelWidth', 'm'),
  lastFolder: null,
  newPanels: new Set(),
  flash: new Set(),
};

// 整理建议的四类
const TIPS = [
  { kind: 'dupes', icon: 'copy', label: '重复书签', unit: '组', n: (st) => st.dupes.length, hint: (st) => `同一网址出现多次，共多出 ${st.dupeExtra} 个` },
  { kind: 'empty', icon: 'folder', label: '空文件夹', unit: '个', n: (st) => st.empty.length, hint: () => '里面什么都没有，可删掉或留作新分类' },
  { kind: 'loose', icon: 'inbox', label: '未放进文件夹', unit: '个', n: (st) => st.loose.length, hint: () => '直接躺在书签栏或其他书签根目录' },
  { kind: 'untitled', icon: 'type', label: '没有标题', unit: '个', n: (st) => st.untitled.length, hint: () => '只剩网址，补个名字更好找' },
];
const SPECIAL = {
  dupes: { title: '重复书签', icon: 'copy', h: 334 },
  empty: { title: '空文件夹', icon: 'folder', h: 205 },
  loose: { title: '未放进文件夹', icon: 'inbox', h: 44 },
  untitled: { title: '没有标题的书签', icon: 'type', h: 258 },
  recent: { title: '最近添加', icon: 'clock', h: 152 },
  search: { title: '搜索结果', icon: 'search', h: 184 },
};

const nameOf = (n) => {
  if (!n) return '';
  if (n.url) return n.title || domainOf(n.url) || n.url;
  return splitEmoji(n.title).text || '未命名文件夹';
};

boot();

async function boot() {
  applySettings();
  Scene.mount($('#scene'), settings);
  fillStaticIcons();
  bindEvents();
  try {
    await store.load();
  } catch (err) {
    $('#overview').innerHTML = `<div class="ws-empty glass"><h2>读不到书签</h2><p>${esc(err.message)}</p></div>`;
    return;
  }
  store.listen(onStoreChange);
  renderAll();
  setTimeout(() => document.body.classList.remove('booting'), 2400);
}

function onStoreChange() {
  for (const id of [...S.selection]) if (!store.get(id)) S.selection.delete(id);
  renderAll();
}

function fillStaticIcons() {
  $('#brandMark').innerHTML = brandMark();
  $('.search-ic').innerHTML = icon('search');
  $('#insightsBtn').innerHTML = icon('sparkles') + '<span class="dot"></span>';
  $('#ctaIcon').innerHTML = icon('plus');
  $('#undoBtn').innerHTML = icon('undo');
  $('#mgrBtn').innerHTML = icon('external');
  $('[data-act="collapse-all"]').innerHTML = icon('collapse');
  $('.menu-btn').innerHTML = icon('menu');
}

function applySettings() {
  const root = document.documentElement;
  root.style.setProperty('--ga', settings.glass);
  root.style.setProperty('--gb', `${settings.blur}px`);
  root.dataset.motion = settings.motion ? 'on' : 'off';
  Scene.apply(settings);
}

function saveSettings() {
  prefs.set('settings', settings);
  applySettings();
}

function savePanels() {
  prefs.set('panels', S.panels.map(({ uid: _, ...p }) => p));
}

// ================= 渲染 =================

function renderAll() {
  document.body.classList.toggle('is-organizing', S.organize);
  $('#overview').hidden = S.view !== 'overview';
  $('#workspace').hidden = S.view !== 'workspace';
  renderSidebar();
  renderHeader();
  if (S.view === 'overview') renderOverview();
  else renderWorkspace();
  renderSelectionBar();
  $('#insightsBtn').classList.toggle('has-dot', store.stats.dupes.length + store.stats.empty.length > 0);
  if (!$('#insightsPop').hidden) $('#insightsPop').innerHTML = insightsHtml();
  if (!$('#searchPop').hidden) renderSearchPop();
}

function renderHeader() {
  const ws = S.view === 'workspace';
  $('#pageTitle').textContent = ws ? '整理台' : '书签总览';
  $('#pageSub').textContent = ws
    ? S.organize
      ? '单击选中多项，一起拖走或批量移动'
      : '拖动书签或文件夹到别处，即可移动'
    : '书签都搁浅在这座岛上，慢慢归位就好';
}

function renderSidebar() {
  $$('.nav [data-view]').forEach((b) => b.classList.toggle('is-active', b.dataset.view === S.view));
  $('#navTotal').textContent = store.bookmarks.length;
  $('#navPanels').textContent = S.panels.length;

  const btn = $('#organizeBtn');
  btn.innerHTML = S.organize ? `${icon('check')}<span>完成整理</span>` : `${icon('wand')}<span>整理模式</span>`;
  btn.classList.toggle('is-on', S.organize);
  btn.setAttribute('aria-pressed', S.organize);
  $('#statusOrb').innerHTML = icon(S.organize ? 'wand' : 'move');
  $('#statusOrb').classList.toggle('is-on', S.organize);
  $('#statusTitle').textContent = S.organize ? '批量整理中' : '拖动即可移动';
  $('#statusSub').textContent = S.organize ? '单击多选，可删改' : '每一步都能撤销';
  $('#undoBtn').disabled = !store.undoStack.length;
  const last = store.undoStack.at(-1);
  $('#undoBtn').title = last ? `撤销：${last.label}（⌘Z / Ctrl+Z）` : '没有可以撤销的操作';

  renderTree();
}

function renderTree() {
  const tree = $('#tree');
  const scroll = tree.scrollTop;
  const open = new Set(S.panels.filter((p) => p.kind === 'folder').map((p) => p.folderId));
  const out = [];
  const walk = (node, depth) => {
    for (const f of node.children || []) {
      if (f.url) continue;
      out.push(treeItem(f, depth, open));
      if (S.expanded.has(f.id)) walk(f, depth + 1);
    }
  };
  for (const r of store.roots()) {
    if (!(r.children || []).length && r.id !== '1') continue;
    out.push(treeItem(r, 0, open));
    if (S.expanded.has(r.id)) walk(r, 1);
  }
  tree.innerHTML = out.join('');
  tree.scrollTop = scroll;
}

function treeItem(f, depth, open) {
  const exp = S.expanded.has(f.id);
  const hasSub = f.subfolders > 0;
  const drag = store.isLocked(f.id) ? '' : `draggable="true" data-drag="${f.id}"`;
  return `<div class="t-item${open.has(f.id) ? ' is-open' : ''}" role="treeitem" ${hasSub ? `aria-expanded="${exp}"` : ''} data-drop="${f.id}" ${drag} style="--depth:${depth}">
    <button class="t-chev${hasSub ? '' : ' is-leaf'}${exp ? ' is-exp' : ''}" data-act="toggle" data-id="${f.id}" tabindex="-1" aria-label="${exp ? '收起' : '展开'}">${icon('chevronRight')}</button>
    <button class="t-main" data-act="open-folder" data-id="${f.id}" title="${esc(store.pathText(f.id) ? store.pathText(f.id) + ' / ' : '')}${esc(f.title)}">
      ${folderTile(f)}<span class="t-name">${esc(nameOf(f))}</span><span class="badge">${f.count}</span>
    </button>
  </div>`;
}

// ---------- 总览 ----------

function renderOverview() {
  const st = store.stats;
  const total = store.bookmarks.length;
  const rank = st.rank.slice(0, 14);
  const max = rank[0]?.direct || 1;
  const domMax = st.topDomains[0]?.[1] || 1;

  const rankHtml = rank.length
    ? rank
        .map((f, i) => {
          const parent = store.get(f.parentId);
          return `<li><button class="rank-item enter" style="--i:${i + 2};--p:${(f.direct / max).toFixed(3)}" data-act="open-folder" data-id="${f.id}" title="${esc(store.pathText(f.id))} / ${esc(f.title)}">
          ${folderTile(f)}<span class="rank-name"><b>${esc(nameOf(f))}</b><small>${esc(parent && parent.id !== '0' ? nameOf(parent) : '')}</small></span><span class="rank-count">${f.direct}</span>
        </button></li>`;
        })
        .join('')
    : '<li class="muted-note">还没有放进文件夹的书签</li>';

  const tipsHtml = TIPS.map((t) => {
    const n = t.n(st);
    return `<button class="tip${n ? '' : ' is-clear'}" data-act="special" data-kind="${t.kind}" ${n ? '' : 'disabled'}>
      <span class="tip-top">${icon(t.icon)}<b>${n}</b><em>${t.unit}</em></span>
      <span class="tip-label">${t.label}</span>
      <small>${n ? esc(t.hint(st)) : '很干净，没有发现'}</small>
    </button>`;
  }).join('');

  const domainsHtml = st.topDomains
    .map(
      ([d, c]) => `<li><button class="dom" data-act="domain" data-domain="${esc(d)}" style="--p:${(c / domMax).toFixed(3)}">
      <img class="fav sm" src="${faviconUrl('https://' + d)}" alt="" loading="lazy"><span class="dom-name">${esc(d)}</span><span class="dom-count">${c}</span></button></li>`,
    )
    .join('');

  const recentHtml = st.recent.length
    ? st.recent
        .slice(0, 40)
        .map(
          (b) => `<div class="recent-item row-lite" data-id="${b.id}" draggable="true" data-drag="${b.id}">
      <img class="fav" src="${faviconUrl(b.url)}" alt="" loading="lazy" draggable="false">
      <a class="recent-main" href="${esc(b.url)}" data-act="open-url" data-url="${esc(b.url)}" draggable="false" title="${esc(b.url)}">
        <b>${esc(nameOf(b))}</b><small>${esc(store.pathText(b.id))}</small>
      </a>
      <span class="recent-time">${timeAgo(b.dateAdded)}</span>
      <button class="icon-btn" data-act="reveal" data-id="${b.id}" title="在整理台中定位" aria-label="在整理台中定位">${icon('target')}</button>
    </div>`,
        )
        .join('')
    : '<p class="muted-note">还没有书签。在网页上按 ⌘D / Ctrl+D 收藏后会出现在这里。</p>';

  $('#overview').innerHTML = `<div class="ov">
    <div class="ov-left">
      <button class="stat-card enter" style="--i:0" data-act="go" data-view="workspace">
        <span class="stat-num">${total}</span>
        <span class="stat-label">全部书签</span>
        <span class="stat-hint">分布在 ${store.folders.length} 个文件夹里，点击进入整理台</span>
      </button>
      <h2 class="section-label">书签最多的文件夹</h2>
      <ol class="rank">${rankHtml}</ol>
    </div>

    <section class="ov-mid glass glass-thin enter" style="--i:1">
      <div class="hero">
        <div class="hero-title"><span class="hero-mark">${brandMark()}</span><h2>浮岛书签</h2></div>
        <p>这里收着你的 ${total} 个书签。点左侧任意文件夹，它会在整理台里摊开；多点几个，就能并排对照。把书签或文件夹拖到另一个文件夹上就能移过去，拖错了随时撤销。</p>
        <span class="facts">${icon('folder')}${store.folders.length} 个文件夹，最深 ${Math.max(0, st.maxDepth - 1)} 层</span>
      </div>
      <h3 class="section-label">整理建议</h3>
      <div class="tips">${tipsHtml}</div>
      ${domainsHtml ? `<h3 class="section-label">收藏最多的网站</h3><ol class="domains">${domainsHtml}</ol>` : ''}
    </section>

    <section class="ov-right glass enter" style="--i:2">
      <header class="card-head"><h2>最近添加</h2><button class="card-more" data-act="special" data-kind="recent">在整理台打开</button></header>
      <div class="recent">${recentHtml}</div>
    </section>
  </div>`;
}

// ---------- 整理台 ----------

function panelModel(p) {
  if (p.kind === 'folder') {
    const f = store.get(p.folderId);
    return {
      title: nameOf(f),
      tile: folderTile(f, 'lg'),
      crumbs: store.ancestors(f.id),
      items: f.children || [],
      folder: f,
      droppable: true,
    };
  }
  const meta = SPECIAL[p.kind];
  const st = store.stats;
  let items = [];
  let groups = null;
  if (p.kind === 'search') items = searchBookmarks(p.query);
  else if (p.kind === 'dupes') groups = st.dupes;
  else items = st[p.kind] || [];
  return {
    title: p.kind === 'search' ? `搜索“${p.query}”` : meta.title,
    tile: specialTile(meta.icon, meta.h).replace('class="ftile', 'class="ftile lg'),
    sub: p.kind === 'dupes' ? `${groups.length} 组，共多出 ${st.dupeExtra} 个` : `${items.length} 项`,
    items,
    groups,
    showPath: true,
  };
}

function renderWorkspace() {
  const host = $('#workspace');
  const oldPanels = $('.panels', host);
  const left = oldPanels?.scrollLeft || 0;
  const tops = new Map($$('.panel', host).map((el) => [el.dataset.uid, $('.panel-body', el)?.scrollTop || 0]));

  const before = S.panels.length;
  S.panels = S.panels.filter((p) => p.kind !== 'folder' || (store.get(p.folderId) && !store.get(p.folderId).url));
  if (S.panels.length !== before) savePanels();

  const chips = S.panels
    .map((p) => {
      const m = p.kind === 'folder' ? nameOf(store.get(p.folderId)) : p.kind === 'search' ? `“${p.query}”` : SPECIAL[p.kind].title;
      return `<button class="chip" data-act="chip" data-uid="${p.uid}">${esc(m)}</button>`;
    })
    .join('');

  host.innerHTML = `
    <div class="ws-bar">
      <div class="chips">${chips}</div>
      <div class="ws-tools">
        <div class="seg" role="group" aria-label="面板宽度">
          ${[['s', '窄'], ['m', '中'], ['l', '宽']].map(([k, l]) => `<button class="${S.panelWidth === k ? 'is-on' : ''}" data-act="pw" data-pw="${k}">${l}</button>`).join('')}
        </div>
        ${S.panels.length ? `<button class="btn btn-ghost" data-act="close-all">${icon('close')}全部关闭</button>` : ''}
      </div>
    </div>
    ${
      S.panels.length
        ? `<div class="panels" data-pw="${S.panelWidth}">${S.panels.map(panelHtml).join('')}
            <button class="panel-add" data-act="pick-panel">${icon('plus')}<span>打开文件夹</span></button></div>`
        : emptyWorkspace()
    }`;

  const panels = $('.panels', host);
  if (panels) panels.scrollLeft = left;
  $$('.panel', host).forEach((el) => {
    const t = tops.get(el.dataset.uid);
    if (t) $('.panel-body', el).scrollTop = t;
  });
  S.newPanels.clear();
}

function emptyWorkspace() {
  return `<div class="ws-empty glass glass-thin">
    <span class="ws-empty-ic">${icon('columns')}</span>
    <h2>整理台还空着</h2>
    <p>在左侧点一个文件夹，它就会在这里摊开。可以同时打开好几个，并排对照着整理。</p>
    <div class="ws-empty-actions">
      <button class="btn btn-mint" data-act="open-folder" data-id="1">打开书签栏</button>
      <button class="btn" data-act="pick-panel">选择文件夹…</button>
    </div>
  </div>`;
}

function panelHtml(p) {
  const m = panelModel(p);
  const isFolder = p.kind === 'folder';
  const layout = p.layout === 'grid' ? 'grid' : 'list';
  const canUp = isFolder && m.folder.parentId && m.folder.parentId !== '0';
  const crumbs = isFolder
    ? m.crumbs.length
      ? m.crumbs.map((c) => `<button data-act="panel-nav" data-id="${c.id}">${esc(nameOf(c))}</button>`).join('<span>/</span>')
      : '<span>根目录</span>'
    : `<span>${esc(m.sub)}</span>`;

  let body = '';
  if (m.groups) {
    body = m.groups.length
      ? m.groups
          .map(
            (g) => `<div class="group">
        <div class="group-head"><span title="${esc(g[0].url)}">${esc(domainOf(g[0].url) || g[0].url)}</span><em>${g.length} 处</em>
          ${S.organize ? `<button class="mini-btn" data-act="dupe-keep" data-ids="${g.map((n) => n.id).join(',')}">只留第一个</button>` : ''}</div>
        ${g.map((n) => rowHtml(n, true)).join('')}
      </div>`,
          )
          .join('')
      : emptyPanel('没有重复的书签');
  } else {
    body = m.items.length ? m.items.map((n) => rowHtml(n, m.showPath)).join('') : emptyPanel(isFolder ? '这个文件夹是空的' : '这里什么都没有');
  }

  const count = m.groups ? m.groups.length : m.items.length;
  return `<article class="panel glass${S.newPanels.has(p.uid) ? ' is-new' : ''}" data-uid="${p.uid}" ${isFolder ? `data-folder="${p.folderId}"` : ''}>
    <header class="panel-head" ${isFolder ? `data-drop-into="${p.folderId}"` : ''} ${isFolder && !store.isLocked(p.folderId) ? `draggable="true" data-drag="${p.folderId}" title="拖动标题可以把整个文件夹移走"` : ''}>
      ${m.tile}
      <div class="panel-titles">
        <h3 title="${esc(m.title)}">${esc(m.title)}</h3>
        <nav class="crumbs" aria-label="位置">${crumbs}</nav>
      </div>
      <span class="badge">${count}</span>
    </header>
    <div class="panel-tools">
      ${canUp ? `<button class="icon-btn" data-act="panel-up" title="返回上一级" aria-label="返回上一级">${icon('arrowUp')}</button>` : ''}
      <button class="icon-btn" data-act="panel-layout" title="${layout === 'grid' ? '切换为列表' : '切换为图标'}" aria-label="切换布局">${icon(layout === 'grid' ? 'list' : 'grid')}</button>
      ${isFolder && S.organize ? `<button class="icon-btn" data-act="panel-newfolder" title="在这里新建文件夹" aria-label="新建文件夹">${icon('folderPlus')}</button>` : ''}
      <span class="spacer"></span>
      <button class="icon-btn" data-act="panel-close" title="关闭面板" aria-label="关闭面板">${icon('close')}</button>
    </div>
    <div class="panel-body${layout === 'grid' ? ' is-grid' : ''}" ${isFolder ? `data-drop-body="${p.folderId}"` : ''}>${body}</div>
  </article>`;
}

function emptyPanel(text) {
  return `<div class="panel-empty">${icon('inbox')}<p>${text}</p><small>把书签拖到这里就能放进来，也可以从网页直接拖链接进来</small></div>`;
}

function rowHtml(n, showPath) {
  const locked = store.isLocked(n.id);
  const selected = S.selection.has(n.id) ? ' is-selected' : '';
  const flash = S.flash.has(n.id) ? ' is-flash' : '';
  const drag = locked ? '' : `draggable="true" data-drag="${n.id}"`;
  const check = `<button class="check" data-act="select" aria-label="选择" ${locked ? 'disabled' : ''}>${icon('check')}</button>`;
  const editTools =
    S.organize && !locked
      ? `<button class="icon-btn" data-act="edit" data-id="${n.id}" title="${n.url ? '编辑' : '重命名'}" aria-label="编辑">${icon('edit')}</button>
         <button class="icon-btn danger" data-act="delete" data-id="${n.id}" title="删除" aria-label="删除">${icon('trash')}</button>`
      : '';

  if (n.url) {
    const sub = showPath ? store.pathText(n.id) : domainOf(n.url) || n.url;
    return `<div class="row${selected}${flash}" data-id="${n.id}" ${drag}>
      ${check}
      <img class="fav" src="${faviconUrl(n.url)}" alt="" loading="lazy" draggable="false">
      <a class="row-main" href="${esc(n.url)}" data-act="open-url" data-url="${esc(n.url)}" draggable="false" title="${esc(nameOf(n))}&#10;${esc(n.url)}">
        <span class="row-title">${esc(nameOf(n))}</span><span class="row-sub">${esc(sub)}</span>
      </a>
      <span class="row-actions">
        ${showPath ? `<button class="icon-btn" data-act="reveal" data-id="${n.id}" title="在所在文件夹中定位" aria-label="定位">${icon('target')}</button>` : ''}
        ${editTools}
      </span>
    </div>`;
  }

  const summary = showPath
    ? store.pathText(n.id) || '根目录'
    : n.count || n.subfolders
      ? `${n.count} 个书签${n.subfolders ? `，${n.subfolders} 个子文件夹` : ''}`
      : '空文件夹';
  return `<div class="row is-folder${selected}${flash}" data-id="${n.id}" ${drag}>
    ${check}
    ${folderTile(n)}
    <button class="row-main" data-act="enter-folder" data-id="${n.id}" title="${esc(nameOf(n))}">
      <span class="row-title">${esc(nameOf(n))}</span><span class="row-sub">${esc(summary)}</span>
    </button>
    <span class="row-actions">
      <button class="icon-btn" data-act="split" data-id="${n.id}" title="在新面板打开" aria-label="在新面板打开">${icon('split')}</button>
      ${editTools}
    </span>
    <span class="row-chev">${icon('chevronRight')}</span>
  </div>`;
}

function renderSelectionBar() {
  const bar = $('#selbar');
  const n = S.selection.size;
  bar.hidden = !(S.organize && n);
  if (bar.hidden) return;
  const urls = [...S.selection].map((id) => store.get(id)?.url).filter(Boolean);
  bar.innerHTML = `<span class="selbar-count"><b>${n}</b> 项已选择</span>
    <button class="btn btn-ghost" data-act="sel-move">${icon('move')}移动到…</button>
    ${urls.length ? `<button class="btn btn-ghost" data-act="sel-open">${icon('external')}全部打开</button>` : ''}
    <button class="btn btn-ghost btn-danger" data-act="sel-delete">${icon('trash')}删除</button>
    <button class="icon-btn" data-act="sel-clear" title="取消选择（Esc）" aria-label="取消选择">${icon('close')}</button>`;
}

// ================= 面板操作 =================

function setView(view) {
  S.view = view;
  prefs.set('view', view);
  document.body.classList.remove('drawer-open');
  renderAll();
}

function openFolderPanel(id) {
  const f = store.get(id);
  if (!f || f.url) return;
  let p = S.panels.find((x) => x.kind === 'folder' && x.folderId === id);
  if (!p) {
    p = { uid: uid(), kind: 'folder', folderId: id, layout: 'list' };
    S.panels.push(p);
    S.newPanels.add(p.uid);
    savePanels();
  }
  S.lastFolder = id;
  for (const a of store.ancestors(id)) S.expanded.add(a.id);
  prefs.set('expanded', [...S.expanded]);
  S.view = 'workspace';
  prefs.set('view', 'workspace');
  document.body.classList.remove('drawer-open');
  renderAll();
  focusPanel(p.uid);
  return p;
}

function openSpecial(kind, extra = {}) {
  let p = S.panels.find((x) => x.kind === kind && (kind !== 'search' || x.query === extra.query));
  if (!p) {
    p = { uid: uid(), kind, layout: 'list', ...extra };
    S.panels.push(p);
    S.newPanels.add(p.uid);
    savePanels();
  }
  hidePops();
  S.view = 'workspace';
  prefs.set('view', 'workspace');
  renderAll();
  focusPanel(p.uid);
}

function focusPanel(panelUid) {
  const el = $(`.panel[data-uid="${panelUid}"]`);
  if (!el) return;
  el.scrollIntoView({ behavior: settings.motion ? 'smooth' : 'auto', inline: 'nearest', block: 'nearest' });
  el.classList.remove('is-ping');
  void el.offsetWidth;
  el.classList.add('is-ping');
}

const panelOf = (el) => S.panels.find((p) => p.uid === el.closest('.panel')?.dataset.uid);

function navigatePanel(p, folderId) {
  if (!p || !store.get(folderId)) return;
  if (p.kind !== 'folder') return openFolderPanel(folderId);
  p.folderId = folderId;
  S.lastFolder = folderId;
  savePanels();
  renderAll();
  const body = $(`.panel[data-uid="${p.uid}"] .panel-body`);
  if (body) body.scrollTop = 0;
}

function closePanel(p) {
  S.panels = S.panels.filter((x) => x !== p);
  savePanels();
  renderAll();
}

function flashIds(ids) {
  S.flash = new Set(ids);
  setTimeout(() => S.flash.clear(), 1800);
}

function reveal(id) {
  const n = store.get(id);
  if (!n) return;
  hidePops();
  flashIds([id]);
  openFolderPanel(n.parentId);
  requestAnimationFrame(() => {
    $(`.panel[data-folder="${n.parentId}"] .row[data-id="${id}"]`)?.scrollIntoView({ block: 'center', behavior: settings.motion ? 'smooth' : 'auto' });
  });
}

function currentFolderContext() {
  if (S.lastFolder && store.get(S.lastFolder)) return S.lastFolder;
  return S.panels.find((p) => p.kind === 'folder')?.folderId || '1';
}

// ================= 选择 =================

function syncSelection() {
  $$('.row[data-id]').forEach((r) => r.classList.toggle('is-selected', S.selection.has(r.dataset.id)));
  renderSelectionBar();
}

function toggleSelect(id) {
  if (store.isLocked(id)) return;
  if (S.selection.has(id)) S.selection.delete(id);
  else S.selection.add(id);
  S.rangeAnchor = id;
  syncSelection();
}

function selectRange(row) {
  const rows = $$('.row[data-id]', row.closest('.panel-body'));
  const a = rows.findIndex((r) => r.dataset.id === S.rangeAnchor);
  const b = rows.indexOf(row);
  if (a < 0) return toggleSelect(row.dataset.id);
  const [lo, hi] = a < b ? [a, b] : [b, a];
  rows.slice(lo, hi + 1).forEach((r) => {
    if (!store.isLocked(r.dataset.id)) S.selection.add(r.dataset.id);
  });
  syncSelection();
}

function toggleOrganize() {
  S.organize = !S.organize;
  if (!S.organize) S.selection.clear();
  renderAll();
  toast(S.organize ? '整理模式：单击多选，双击打开，可编辑和删除' : '已退出整理模式，仍可直接拖动书签');
}

// ================= 写操作 =================

async function runMove(ids, parentId, index = null) {
  const target = store.get(parentId);
  if (ids.length === 1) {
    const n = store.get(ids[0]);
    const last = (target?.children || []).length - 1;
    if (n && n.parentId === parentId && (index === n.index || index === n.index + 1 || (index == null && n.index === last))) return;
  }
  flashIds(ids);
  try {
    const r = await store.move(ids, parentId, index);
    if (!r.moved) return toast('这些项目不能放到那里', { tone: 'error' });
    S.selection.clear();
    renderAll();
    toast(`已移动 ${r.moved} 项到「${nameOf(target)}」${r.skipped ? `，另有 ${r.skipped} 项无法移动` : ''}`, { undo: true });
  } catch (err) {
    toast(`移动失败：${err.message}`, { tone: 'error' });
  }
}

async function deleteNodes(ids) {
  ids = ids.filter((id) => !store.isLocked(id));
  if (!ids.length) return;
  const nodes = ids.map((id) => store.get(id));
  const inner = nodes.filter((n) => !n.url).reduce((s, f) => s + f.count, 0);
  const what = nodes.length === 1 ? `「${nameOf(nodes[0])}」` : `这 ${nodes.length} 项`;
  const ok = await confirmDialog({
    title: `删除${what}？`,
    body: inner ? `所选文件夹里还有 ${inner} 个书签，会一起删除。删除后可以用“撤销”找回。` : '删除后可以用“撤销”找回。',
    confirm: '删除',
    danger: true,
  });
  if (!ok) return;
  try {
    const n = await store.remove(ids);
    ids.forEach((id) => S.selection.delete(id));
    renderAll();
    toast(`已删除 ${n} 项`, { undo: true });
  } catch (err) {
    toast(`删除失败：${err.message}`, { tone: 'error' });
  }
}

async function editNode(id) {
  const n = store.get(id);
  if (!n || store.isLocked(id)) return;
  const fields = [{ name: 'title', label: '名称', value: n.title }];
  if (n.url) fields.push({ name: 'url', label: '网址', value: n.url });
  const res = await formDialog({ title: n.url ? '编辑书签' : '重命名文件夹', fields, confirm: '保存' });
  if (!res) return;
  const changes = {};
  if (res.title !== n.title) changes.title = res.title;
  if (n.url && res.url.trim() !== n.url) changes.url = res.url.trim();
  if (!Object.keys(changes).length) return;
  try {
    await store.update(id, changes);
    flashIds([id]);
    renderAll();
    toast('已保存', { undo: true });
  } catch (err) {
    toast(`保存失败：${err.message}`, { tone: 'error' });
  }
}

async function undo() {
  try {
    const label = await store.undo();
    renderAll();
    toast(label ? `已撤销：${label}` : '没有可以撤销的操作');
  } catch (err) {
    toast(`无法撤销：${err.message}`, { tone: 'error' });
  }
}

function openBookmark(url, e = {}) {
  const mode = e.metaKey || e.ctrlKey ? 'background' : settings.openMode;
  if (!openUrl(url, mode)) toast('这是一个书签小工具（javascript:），只能在网页上从书签栏点击运行');
}

// ================= 拖拽 =================

let drag = null;
let dropEl = null;
let expandTimer = null;

function clearDrop() {
  if (dropEl) dropEl.classList.remove('drop-into', 'drop-before', 'drop-after', 'drop-end');
  dropEl = null;
}

// 从网页或地址栏拖进来的链接
const isExternalLink = (e) => !drag && [...(e.dataTransfer?.types || [])].includes('text/uri-list');

function resolveDrop(e) {
  const el = e.target instanceof Element ? e.target : null;
  if (!el) return null;
  const ids = drag ? drag.ids : [];
  const valid = (t) => {
    const target = store.get(t.parentId);
    if (!target || target.url || t.parentId === '0') return null;
    for (const id of ids) {
      const n = store.get(id);
      if (n && !n.url && store.isInside(t.parentId, id)) return null;
    }
    return t;
  };

  const ti = el.closest('.t-item[data-drop]');
  if (ti) return valid({ parentId: ti.dataset.drop, index: null, el: ti, cls: 'drop-into' });

  const head = el.closest('.panel-head[data-drop-into]');
  if (head) return valid({ parentId: head.dataset.dropInto, index: null, el: head, cls: 'drop-into' });

  const body = el.closest('.panel-body[data-drop-body]');
  if (!body) return null;
  const parentId = body.dataset.dropBody;
  const row = el.closest('.row[data-id]');
  if (row && body.contains(row)) {
    const n = store.get(row.dataset.id);
    if (!n || n.parentId !== parentId) return null;
    // 拖到自己身上等于没动
    if (ids.includes(n.id)) return null;
    const r = row.getBoundingClientRect();
    const grid = body.classList.contains('is-grid');
    const rel = grid ? (e.clientX - r.left) / r.width : (e.clientY - r.top) / r.height;
    if (!n.url && rel > 0.28 && rel < 0.72) {
      return valid({ parentId: n.id, index: null, el: row, cls: 'drop-into' });
    }
    const after = rel >= 0.5;
    return valid({ parentId, index: n.index + (after ? 1 : 0), el: row, cls: after ? 'drop-after' : 'drop-before' });
  }
  return valid({ parentId, index: null, el: body, cls: 'drop-end' });
}

function bindDrag() {
  // 任何带 data-drag 的元素都能拖：面板里的书签和文件夹、侧栏文件夹、面板标题、最近添加、搜索结果
  document.addEventListener('dragstart', (e) => {
    const src = e.target instanceof Element && e.target.closest('[data-drag]');
    if (!src) return;
    const id = src.dataset.drag;
    if (store.isLocked(id)) return e.preventDefault();
    const ids = src.matches('.row') && S.selection.has(id) ? store.sortByTree([...S.selection]) : [id];
    drag = { ids };
    // 被拖的元素可能在拖拽途中被重新渲染掉，直接在它身上也挂一个收尾
    src.addEventListener('dragend', endDrag, { once: true });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/x-visual-bookmark', ids.join(','));
    const urls = ids.map((x) => store.get(x)?.url).filter(Boolean);
    if (urls.length) e.dataTransfer.setData('text/uri-list', urls.join('\n'));
    const ghost = $('#dragGhost');
    ghost.textContent = ids.length > 1 ? `移动 ${ids.length} 项` : nameOf(store.get(id));
    e.dataTransfer.setDragImage(ghost, 18, 18);
    requestAnimationFrame(() => {
      if (!drag) return;
      document.body.classList.add('is-dragging');
      ids.forEach((x) => $$(`[data-drag="${x}"]`).forEach((r) => r.classList.add('is-lifted')));
    });
  });

  document.addEventListener('dragover', (e) => {
    if (!drag && !isExternalLink(e)) return;
    const t = resolveDrop(e);
    if (!t) {
      clearDrop();
      return;
    }
    e.preventDefault();
    e.dataTransfer.dropEffect = drag ? 'move' : 'copy';
    if (dropEl !== t.el || !t.el.classList.contains(t.cls)) {
      clearDrop();
      dropEl = t.el;
      dropEl.classList.add(t.cls);
      // 悬停在折叠的侧栏文件夹上一会儿，自动展开
      clearTimeout(expandTimer);
      if (t.el.classList.contains('t-item') && !S.expanded.has(t.parentId) && store.get(t.parentId)?.subfolders) {
        expandTimer = setTimeout(() => {
          S.expanded.add(t.parentId);
          renderTree();
        }, 700);
      }
    }
  });

  document.addEventListener('drop', (e) => {
    const external = isExternalLink(e);
    if (!drag && !external) return;
    const t = resolveDrop(e);
    const ids = drag?.ids;
    // 移动后被拖的那一行会重新渲染，dragend 可能到不了 document，所以这里先收尾
    endDrag();
    if (!t) return;
    e.preventDefault();
    if (external) addDroppedLinks(e.dataTransfer, t.parentId, t.index);
    else runMove(ids, t.parentId, t.index);
  });

  document.addEventListener('dragend', endDrag);
}

async function addDroppedLinks(dt, parentId, index) {
  const urls = dt
    .getData('text/uri-list')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith('#') && !/^javascript:/i.test(s));
  if (!urls.length) return;
  // 单个链接时尽量取到它的标题：网页里的 <a> 文本，或地址栏拖出来时附带的文字
  let title = '';
  if (urls.length === 1) {
    const html = dt.getData('text/html');
    if (html) title = new DOMParser().parseFromString(html, 'text/html').querySelector('a')?.textContent.trim() || '';
    const text = dt.getData('text/plain').trim();
    if (!title && text && text !== urls[0] && !/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) title = text;
  }
  try {
    const links = urls.map((url) => ({ url, title: (urls.length === 1 && title) || domainOf(url) || url }));
    const created = await store.addLinks(parentId, index, links);
    flashIds(created);
    renderAll();
    toast(`已收藏 ${created.length} 个链接到「${nameOf(store.get(parentId))}」`, { undo: true });
  } catch (err) {
    toast(`收藏失败：${err.message}`, { tone: 'error' });
  }
}

function endDrag() {
  drag = null;
  clearDrop();
  clearTimeout(expandTimer);
  document.body.classList.remove('is-dragging');
  $$('.is-lifted').forEach((r) => r.classList.remove('is-lifted'));
}

// ================= 搜索与弹出层 =================

function searchBookmarks(q, limit = Infinity) {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const out = [];
  if (!terms.length) return out;
  for (const b of store.bookmarks) {
    const hay = `${b.title} ${b.url}`.toLowerCase();
    if (terms.every((t) => hay.includes(t))) {
      out.push(b);
      if (out.length >= limit) break;
    }
  }
  return out;
}

function searchFolders(q, limit) {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  return store.folders.filter((f) => terms.every((t) => (f.title || '').toLowerCase().includes(t))).slice(0, limit);
}

function renderSearchPop() {
  const q = $('#search').value.trim();
  const pop = $('#searchPop');
  if (!q) {
    pop.hidden = true;
    return;
  }
  const folders = searchFolders(q, 5);
  const all = searchBookmarks(q);
  const folderHtml = folders
    .map(
      (f) => `<div class="pop-item"><button class="pop-main" data-act="open-folder" data-id="${f.id}">${folderTile(f)}
      <span><b>${highlight(nameOf(f), q)}</b><small>${esc(store.pathText(f.id) || '根目录')}</small></span></button></div>`,
    )
    .join('');
  const bmHtml = all
    .slice(0, 30)
    .map(
      (b) => `<div class="pop-item" draggable="true" data-drag="${b.id}"><a class="pop-main" href="${esc(b.url)}" data-act="open-url" data-url="${esc(b.url)}" draggable="false">
      <img class="fav" src="${faviconUrl(b.url)}" alt="" loading="lazy" draggable="false">
      <span><b>${highlight(nameOf(b), q)}</b><small>${esc(store.pathText(b.id))} · ${highlight(domainOf(b.url), q)}</small></span></a>
      <button class="icon-btn" data-act="reveal" data-id="${b.id}" title="在所在文件夹中定位" aria-label="定位">${icon('target')}</button></div>`,
    )
    .join('');
  pop.innerHTML = `
    ${folders.length ? `<div class="pop-label">文件夹</div>${folderHtml}` : ''}
    <div class="pop-label">书签<span>${all.length}</span></div>
    ${bmHtml || '<p class="pop-empty">没有找到匹配的书签，换个关键词试试</p>'}
    ${all.length ? `<button class="pop-more" data-act="search-panel">在整理台中查看全部 ${all.length} 条结果</button>` : ''}`;
  pop.hidden = false;
  $('#insightsPop').hidden = true;
}

function moveSearchCursor(dir) {
  const items = $$('#searchPop .pop-main');
  if (!items.length) return;
  let i = items.findIndex((x) => x.classList.contains('is-active'));
  items[i]?.classList.remove('is-active');
  i = (i + dir + items.length) % items.length;
  items[i].classList.add('is-active');
  items[i].scrollIntoView({ block: 'nearest' });
}

function insightsHtml() {
  const st = store.stats;
  return `<div class="pop-label">整理建议</div>${TIPS.map((t) => {
    const n = t.n(st);
    return `<div class="pop-item"><button class="pop-main" data-act="special" data-kind="${t.kind}" ${n ? '' : 'disabled'}>
      ${specialTile(t.icon, SPECIAL[t.kind].h)}<span><b>${t.label}<em>${n} ${t.unit}</em></b><small>${n ? esc(t.hint(st)) : '很干净，没有发现'}</small></span></button></div>`;
  }).join('')}`;
}

function hidePops() {
  $('#searchPop').hidden = true;
  $('#insightsPop').hidden = true;
}

// ================= 弹窗 =================

function openModal({ title, body, actions = [], wide = false, onClose }) {
  const layer = document.createElement('div');
  layer.className = 'modal-layer';
  layer.innerHTML = `<div class="modal glass${wide ? ' is-wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <header class="modal-head"><h2>${esc(title)}</h2><button class="icon-btn" data-close aria-label="关闭">${icon('close')}</button></header>
    <div class="modal-body"></div><footer class="modal-foot"></footer></div>`;
  const bodyEl = $('.modal-body', layer);
  if (typeof body === 'string') bodyEl.innerHTML = body;
  else bodyEl.append(body);
  const prevFocus = document.activeElement;
  let closed = false;
  const close = (value) => {
    if (closed) return;
    closed = true;
    layer.classList.add('is-leaving');
    setTimeout(() => layer.remove(), 180);
    document.removeEventListener('keydown', onKey, true);
    prevFocus?.focus?.();
    onClose?.(value);
  };
  const onKey = (e) => {
    if (e.key === 'Escape' && layer === $('#modals').lastElementChild) {
      e.stopPropagation();
      close();
    }
  };
  const foot = $('.modal-foot', layer);
  const buttons = actions.map((a) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `btn ${a.kind || ''}`;
    b.textContent = a.label;
    b.addEventListener('click', () => (a.onClick ? a.onClick(close) : close()));
    foot.append(b);
    return b;
  });
  if (!actions.length) foot.remove();
  layer.addEventListener('mousedown', (e) => {
    if (e.target === layer) close();
  });
  $('[data-close]', layer).addEventListener('click', () => close());
  document.addEventListener('keydown', onKey, true);
  $('#modals').append(layer);
  setTimeout(() => ($('[autofocus]', layer) || $('input:not([type=file]), select', layer) || buttons.at(-1))?.focus(), 40);
  return { close, layer, body: bodyEl, buttons };
}

function confirmDialog({ title, body, confirm = '确定', danger = false }) {
  return new Promise((resolve) => {
    let ok = false;
    openModal({
      title,
      body: `<p class="modal-text">${esc(body)}</p>`,
      actions: [
        { label: '取消', kind: 'btn-ghost' },
        { label: confirm, kind: danger ? 'btn-danger-solid' : 'btn-mint', onClick: (close) => ((ok = true), close()) },
      ],
      onClose: () => resolve(ok),
    });
  });
}

function formDialog({ title, fields, confirm }) {
  return new Promise((resolve) => {
    let result = null;
    const form = document.createElement('form');
    form.className = 'form';
    form.innerHTML = fields
      .map((f) => `<label class="field"><span>${esc(f.label)}</span><input class="input" name="${f.name}" value="${esc(f.value || '')}" ${f.placeholder ? `placeholder="${esc(f.placeholder)}"` : ''}></label>`)
      .join('');
    const submit = (close) => {
      result = Object.fromEntries(new FormData(form));
      close();
    };
    const m = openModal({
      title,
      body: form,
      actions: [{ label: '取消', kind: 'btn-ghost' }, { label: confirm, kind: 'btn-mint', onClick: submit }],
      onClose: () => resolve(result),
    });
    submitOnEnter(form, () => submit(m.close));
  });
}

function folderOptions(selectedId) {
  return store.folders
    .map((f) => `<option value="${f.id}" ${f.id === selectedId ? 'selected' : ''}>${'　'.repeat(Math.max(0, f.depth - 1))}${esc(nameOf(f))}</option>`)
    .join('');
}

function openCreate(kind = 'folder', parentId = currentFolderContext()) {
  const body = document.createElement('form');
  body.className = 'form';
  body.innerHTML = `
    <div class="seg" role="tablist">
      <button type="button" data-kind="folder" class="${kind === 'folder' ? 'is-on' : ''}">${icon('folder')}文件夹</button>
      <button type="button" data-kind="bookmark" class="${kind === 'bookmark' ? 'is-on' : ''}">${icon('bookmark')}书签</button>
    </div>
    <label class="field"><span>名称</span><input class="input" name="title" placeholder="${kind === 'folder' ? '比如：设计灵感' : '留空则使用网址'}" autocomplete="off"></label>
    <label class="field url-field" ${kind === 'folder' ? 'hidden' : ''}><span>网址</span><input class="input" name="url" placeholder="https://"></label>
    <label class="field"><span>放在</span><select class="select" name="parentId">${folderOptions(parentId)}</select></label>`;
  let mode = kind;
  const submit = async (close) => {
    const data = Object.fromEntries(new FormData(body));
    const title = data.title.trim();
    let url = (data.url || '').trim();
    if (mode === 'folder' && !title) return $('input[name=title]', body).focus();
    if (mode === 'bookmark') {
      if (!url) return $('input[name=url]', body).focus();
      if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) url = 'https://' + url;
    }
    close();
    try {
      const n = await store.create({ parentId: data.parentId, title: title || (mode === 'bookmark' ? domainOf(url) : ''), url: mode === 'bookmark' ? url : undefined });
      flashIds([n.id]);
      renderAll();
      toast(`已新建「${title || domainOf(url)}」`, { undo: true });
    } catch (err) {
      toast(`新建失败：${err.message}`, { tone: 'error' });
    }
  };
  const m = openModal({ title: '新建', body, actions: [{ label: '取消', kind: 'btn-ghost' }, { label: '新建', kind: 'btn-mint', onClick: submit }] });
  $$('.seg button', body).forEach((b) =>
    b.addEventListener('click', () => {
      mode = b.dataset.kind;
      $$('.seg button', body).forEach((x) => x.classList.toggle('is-on', x === b));
      $('.url-field', body).hidden = mode === 'folder';
      $('input[name=title]', body).placeholder = mode === 'folder' ? '比如：设计灵感' : '留空则使用网址';
    }),
  );
  submitOnEnter(body, () => submit(m.close));
}

// 回车提交；输入法正在选字时的回车不算
function submitOnEnter(form, fn) {
  form.addEventListener('submit', (e) => e.preventDefault());
  form.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229 || !e.target.matches('input')) return;
    e.preventDefault();
    fn();
  });
}

function pickFolder({ title, confirm, exclude = [] }) {
  return new Promise((resolve) => {
    let chosen = null;
    const blocked = (id) => exclude.some((x) => store.get(x) && !store.get(x).url && store.isInside(id, x));
    const body = document.createElement('div');
    body.className = 'picker';
    body.innerHTML = `<input class="input" type="search" placeholder="筛选文件夹…" autocomplete="off"><div class="picker-list" role="listbox" aria-label="文件夹"></div>`;
    const list = $('.picker-list', body);
    const draw = (q = '') => {
      const query = q.trim().toLowerCase();
      list.innerHTML = store.folders
        .filter((f) => !query || (f.title || '').toLowerCase().includes(query))
        .map((f) => {
          const off = blocked(f.id);
          return `<button type="button" class="pick${chosen === f.id ? ' is-on' : ''}" role="option" data-id="${f.id}" style="--depth:${query ? 0 : f.depth - 1}" ${off ? 'disabled' : ''}>
          ${folderTile(f)}<span>${esc(nameOf(f))}</span>${query ? `<small>${esc(store.pathText(f.id))}</small>` : `<em>${f.count}</em>`}</button>`;
        })
        .join('') || '<p class="muted-note">没有匹配的文件夹</p>';
    };
    draw();
    const m = openModal({
      title,
      body,
      actions: [
        { label: '取消', kind: 'btn-ghost' },
        { label: confirm, kind: 'btn-mint', onClick: (close) => chosen && ((resolve(chosen), (chosen = '__done')), close()) },
      ],
      onClose: () => chosen !== '__done' && resolve(null),
    });
    const ok = m.buttons.at(-1);
    ok.disabled = true;
    $('input', body).addEventListener('input', (e) => draw(e.target.value));
    list.addEventListener('click', (e) => {
      const b = e.target.closest('.pick');
      if (!b) return;
      chosen = b.dataset.id;
      $$('.pick', list).forEach((x) => x.classList.toggle('is-on', x === b));
      ok.disabled = false;
    });
    list.addEventListener('dblclick', (e) => {
      if (e.target.closest('.pick') && chosen) ok.click();
    });
  });
}

function openSettings() {
  const body = document.createElement('div');
  body.className = 'settings';
  const scenes = [
    ['dusk', '黄昏浮岛'],
    ['night', '星夜浮岛'],
    ['image', '自定义图片'],
  ];
  body.innerHTML = `
    <section><h3>背景</h3>
      <div class="scene-cards">${scenes
        .map(([k, l]) => `<button type="button" class="scene-card${settings.scene === k ? ' is-on' : ''}" data-scene="${k}"><span class="scene-thumb thumb-${k}"></span><span>${l}</span></button>`)
        .join('')}</div>
      <div class="setting-row photo-row">
        <button type="button" class="btn" data-pick>${icon('image')}选择图片…</button>
        <button type="button" class="btn btn-ghost" data-clear ${Scene.photoUrl ? '' : 'hidden'}>移除图片</button>
        <small>图片只存在这台电脑的浏览器里</small>
        <input type="file" accept="image/*" hidden>
      </div>
    </section>
    <section><h3>玻璃质感</h3>
      <label class="setting-row"><span>透明度</span><input type="range" name="glass" min="0.04" max="0.3" step="0.01" value="${settings.glass}"><output>${Math.round(settings.glass * 100)}%</output></label>
      <label class="setting-row"><span>背景模糊</span><input type="range" name="blur" min="0" max="40" step="1" value="${settings.blur}"><output>${settings.blur}px</output></label>
    </section>
    <section><h3>其他</h3>
      <label class="setting-row"><span>背景动画</span><input type="checkbox" class="switch" name="motion" ${settings.motion ? 'checked' : ''}></label>
      <div class="setting-row"><span>点开书签时</span><div class="seg" data-open-mode>
        ${[['tab', '新标签页'], ['background', '后台标签页'], ['current', '当前页']].map(([k, l]) => `<button type="button" data-mode="${k}" class="${settings.openMode === k ? 'is-on' : ''}">${l}</button>`).join('')}
      </div></div>
      <p class="settings-note">所有书签数据只在本机处理，不会上传到任何地方。</p>
    </section>`;

  const thumbPhoto = () => {
    const t = $('.thumb-image', body);
    t.style.backgroundImage = Scene.photoUrl ? `url("${Scene.photoUrl}")` : '';
    t.classList.toggle('has-photo', !!Scene.photoUrl);
    $('[data-clear]', body).hidden = !Scene.photoUrl;
  };
  thumbPhoto();
  const setScene = (k) => {
    settings.scene = k;
    $$('.scene-card', body).forEach((c) => c.classList.toggle('is-on', c.dataset.scene === k));
    saveSettings();
  };
  const fileInput = $('input[type=file]', body);
  $$('.scene-card', body).forEach((c) =>
    c.addEventListener('click', () => {
      if (c.dataset.scene === 'image' && !Scene.photoUrl) fileInput.click();
      else setScene(c.dataset.scene);
    }),
  );
  $('[data-pick]', body).addEventListener('click', () => fileInput.click());
  $('[data-clear]', body).addEventListener('click', async () => {
    await Scene.clearPhoto();
    if (settings.scene === 'image') setScene('dusk');
    thumbPhoto();
  });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      await Scene.savePhoto(file);
      setScene('image');
      thumbPhoto();
    } catch (err) {
      toast(`图片保存失败：${err.message}`, { tone: 'error' });
    }
  });
  $$('input[type=range]', body).forEach((r) =>
    r.addEventListener('input', () => {
      settings[r.name] = Number(r.value);
      r.nextElementSibling.textContent = r.name === 'glass' ? `${Math.round(r.value * 100)}%` : `${r.value}px`;
      saveSettings();
    }),
  );
  $('input[name=motion]', body).addEventListener('change', (e) => {
    settings.motion = e.target.checked;
    saveSettings();
  });
  $$('[data-open-mode] button', body).forEach((b) =>
    b.addEventListener('click', () => {
      settings.openMode = b.dataset.mode;
      $$('[data-open-mode] button', body).forEach((x) => x.classList.toggle('is-on', x === b));
      saveSettings();
    }),
  );
  openModal({ title: '设置', body, wide: true, actions: [{ label: '完成', kind: 'btn-mint' }] });
}

function toast(msg, { undo: withUndo = false, tone = '' } = {}) {
  const host = $('#toasts');
  while (host.children.length > 2) host.firstElementChild.remove();
  const t = document.createElement('div');
  t.className = `toast glass${tone ? ' is-' + tone : ''}`;
  t.setAttribute('role', 'status');
  t.innerHTML = `<span>${esc(msg)}</span>${withUndo ? '<button type="button">撤销</button>' : ''}`;
  const dismiss = () => {
    t.classList.add('is-leaving');
    setTimeout(() => t.remove(), 250);
  };
  if (withUndo) {
    $('button', t).addEventListener('click', () => {
      dismiss();
      undo();
    });
  }
  host.append(t);
  setTimeout(dismiss, withUndo ? 6500 : 3400);
}

// ================= 事件 =================

const ACTIONS = {
  go: (el) => setView(el.dataset.view),
  'open-folder': (el) => (hidePops(), openFolderPanel(el.dataset.id)),
  split: (el) => openFolderPanel(el.dataset.id),
  toggle: (el) => {
    const id = el.dataset.id;
    if (S.expanded.has(id)) S.expanded.delete(id);
    else S.expanded.add(id);
    prefs.set('expanded', [...S.expanded]);
    renderTree();
  },
  'collapse-all': () => {
    S.expanded.clear();
    prefs.set('expanded', []);
    renderTree();
  },
  'open-url': (el, e) => (hidePops(), openBookmark(el.dataset.url, e)),
  'panel-close': (el) => closePanel(panelOf(el)),
  'panel-up': (el) => {
    const p = panelOf(el);
    const f = store.get(p.folderId);
    if (f?.parentId && f.parentId !== '0') navigatePanel(p, f.parentId);
  },
  'panel-nav': (el) => navigatePanel(panelOf(el), el.dataset.id),
  'panel-layout': (el) => {
    const p = panelOf(el);
    p.layout = p.layout === 'grid' ? 'list' : 'grid';
    savePanels();
    renderAll();
  },
  'panel-newfolder': (el) => openCreate('folder', panelOf(el).folderId),
  'pick-panel': async () => {
    const id = await pickFolder({ title: '打开文件夹', confirm: '打开' });
    if (id) openFolderPanel(id);
  },
  'close-all': () => {
    S.panels = [];
    savePanels();
    renderAll();
  },
  pw: (el) => {
    S.panelWidth = el.dataset.pw;
    prefs.set('panelWidth', S.panelWidth);
    renderAll();
  },
  chip: (el) => focusPanel(el.dataset.uid),
  special: (el) => openSpecial(el.dataset.kind),
  domain: (el) => openSpecial('search', { query: el.dataset.domain }),
  'search-panel': () => openSpecial('search', { query: $('#search').value.trim() }),
  reveal: (el) => reveal(el.dataset.id),
  edit: (el) => editNode(el.dataset.id),
  delete: (el) => deleteNodes([el.dataset.id]),
  'dupe-keep': (el) => deleteNodes(el.dataset.ids.split(',').slice(1)),
  'sel-move': async () => {
    const ids = store.sortByTree([...S.selection]);
    const target = await pickFolder({ title: `把 ${ids.length} 项移动到…`, confirm: '移动到这里', exclude: ids });
    if (target) runMove(ids, target);
  },
  'sel-open': () => {
    const urls = [...S.selection].map((id) => store.get(id)?.url).filter((u) => u && !/^javascript:/i.test(u));
    urls.forEach((url) => chrome.tabs.create({ url, active: false }));
    toast(`已在后台打开 ${urls.length} 个标签页`);
  },
  'sel-delete': () => deleteNodes([...S.selection]),
  'sel-clear': () => {
    S.selection.clear();
    syncSelection();
  },
  organize: () => toggleOrganize(),
  undo: () => undo(),
  'chrome-manager': () => chrome.tabs.create({ url: 'chrome://bookmarks/' }),
  settings: () => openSettings(),
  new: () => openCreate(),
  insights: () => {
    const pop = $('#insightsPop');
    const show = pop.hidden;
    hidePops();
    if (show) {
      pop.innerHTML = insightsHtml();
      pop.hidden = false;
    }
  },
  menu: () => document.body.classList.toggle('drawer-open'),
};

function onRowClick(e, row) {
  const n = store.get(row.dataset.id);
  if (!n) return;
  e.preventDefault();
  if (S.organize) {
    if (e.shiftKey && S.rangeAnchor) selectRange(row);
    else toggleSelect(n.id);
    return;
  }
  if (n.url) openBookmark(n.url, e);
  else if (e.metaKey || e.ctrlKey) openFolderPanel(n.id);
  else navigatePanel(panelOf(row), n.id);
}

function bindEvents() {
  document.addEventListener('click', (e) => {
    const target = e.target instanceof Element ? e.target : null;
    if (!target) return;
    if (!target.closest('#searchWrap, .insights')) hidePops();
    if (document.body.classList.contains('drawer-open') && !target.closest('#sidebar, .menu-btn')) document.body.classList.remove('drawer-open');

    const row = target.closest('.panel .row[data-id]');
    const act = target.closest('[data-act]');
    if (row && !(act && act.closest('.row-actions'))) return onRowClick(e, row);
    if (!act || act.disabled) return;
    const fn = ACTIONS[act.dataset.act];
    if (fn) {
      e.preventDefault();
      fn(act, e);
    }
  });

  document.addEventListener('dblclick', (e) => {
    const row = e.target instanceof Element && e.target.closest('.panel .row[data-id]');
    if (!row || !S.organize || e.target.closest('.row-actions, .check')) return;
    const n = store.get(row.dataset.id);
    if (!n) return;
    if (n.url) openBookmark(n.url, e);
    else navigatePanel(panelOf(row), n.id);
  });

  // 中键点开书签：交给扩展 API 打开（chrome:// 之类的网址浏览器默认会拦）
  document.addEventListener('auxclick', (e) => {
    const a = e.button === 1 && e.target instanceof Element && e.target.closest('a[data-url]');
    if (!a) return;
    e.preventDefault();
    openBookmark(a.dataset.url, { metaKey: true });
  });

  const search = $('#search');
  search.addEventListener('input', debounce(renderSearchPop, 60));
  search.addEventListener('focus', () => search.value.trim() && renderSearchPop());
  search.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      moveSearchCursor(e.key === 'ArrowDown' ? 1 : -1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const active = $('#searchPop .pop-main.is-active');
      if (active) active.click();
      else if (search.value.trim()) ACTIONS['search-panel']();
    } else if (e.key === 'Escape') {
      search.value = '';
      hidePops();
      search.blur();
    }
  });

  document.addEventListener('keydown', (e) => {
    const typing = e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable]');
    const modal = $('#modals').children.length > 0;
    if (typing || modal) return;
    if (e.key === '/') {
      e.preventDefault();
      search.focus();
      search.select();
    } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      e.preventDefault();
      undo();
    } else if (e.key === 'Escape') {
      hidePops();
      if (S.selection.size) {
        S.selection.clear();
        syncSelection();
      }
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && S.organize && S.selection.size) {
      e.preventDefault();
      deleteNodes([...S.selection]);
    }
  });

  bindDrag();
}
