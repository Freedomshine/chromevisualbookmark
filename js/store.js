// 书签数据层：读取整棵树、统计整理建议、执行可撤销的移动/编辑/删除
import { domainOf, normalizeUrl, debounce } from './util.js';

const B = chrome.bookmarks;
const ROOT = '0';

export const store = {
  root: null,
  byId: new Map(),
  bookmarks: [],
  folders: [], // 深度优先顺序，不含根节点 0
  stats: null,
  busy: 0,
  quietUntil: 0,
  undoStack: [],
  idMap: new Map(), // 撤销删除后重建的节点会换新 id，这里记下对应关系
  onChange: null,

  async load() {
    const [root] = await B.getTree();
    const byId = new Map();
    const bookmarks = [];
    const folders = [];
    let order = 0;
    const walk = (node, depth) => {
      node.depth = depth;
      node.order = order++;
      byId.set(node.id, node);
      if (node.url) {
        bookmarks.push(node);
        return 1;
      }
      if (depth > 0) folders.push(node);
      let total = 0;
      let direct = 0;
      let sub = 0;
      for (const child of node.children || []) {
        total += walk(child, depth + 1);
        if (child.url) direct++;
        else sub++;
      }
      node.count = total;
      node.direct = direct;
      node.subfolders = sub;
      return total;
    };
    walk(root, 0);
    Object.assign(this, { root, byId, bookmarks, folders });
    this.stats = this.computeStats();
  },

  listen(onChange) {
    this.onChange = onChange;
    const schedule = debounce(() => {
      if (this.busy) schedule();
      // 自己刚做完的操作已经刷新过，忽略随后到达的同批事件
      else if (Date.now() > this.quietUntil) this.refresh();
    }, 140);
    for (const ev of ['onCreated', 'onRemoved', 'onChanged', 'onMoved', 'onChildrenReordered', 'onImportEnded']) {
      B[ev]?.addListener(schedule);
    }
  },

  async refresh() {
    await this.load();
    this.onChange?.();
  },

  get(id) {
    return this.byId.get(id);
  },
  roots() {
    return this.root?.children || [];
  },
  isRoot(id) {
    return id === ROOT || this.byId.get(id)?.parentId === ROOT;
  },
  // 根目录（书签栏/其他书签等）和托管书签不能被移动、改名或删除
  isLocked(id) {
    const n = this.byId.get(id);
    return !n || this.isRoot(id) || !!n.unmodifiable;
  },
  isInside(id, ancestorId) {
    for (let n = this.byId.get(id); n; n = this.byId.get(n.parentId)) {
      if (n.id === ancestorId) return true;
    }
    return false;
  },
  ancestors(id) {
    const out = [];
    let n = this.byId.get(id);
    while (n && n.parentId && n.parentId !== ROOT) {
      n = this.byId.get(n.parentId);
      if (n) out.unshift(n);
    }
    return out;
  },
  // 书签所在位置，如“书签栏 / 工具 / 设计”
  pathText(id) {
    return this.ancestors(id).map((n) => n.title).join(' / ');
  },
  sortByTree(ids) {
    return [...ids].filter((id) => this.byId.has(id)).sort((a, b) => this.byId.get(a).order - this.byId.get(b).order);
  },

  computeStats() {
    const groups = new Map();
    const domains = new Map();
    for (const b of this.bookmarks) {
      const key = normalizeUrl(b.url);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(b);
      const d = domainOf(b.url);
      if (d) domains.set(d, (domains.get(d) || 0) + 1);
    }
    const dupes = [...groups.values()].filter((g) => g.length > 1).sort((a, b) => b.length - a.length);
    return {
      dupes,
      dupeExtra: dupes.reduce((s, g) => s + g.length - 1, 0),
      empty: this.folders.filter((f) => !this.isRoot(f.id) && !(f.children || []).length),
      loose: this.bookmarks.filter((b) => this.isRoot(b.parentId)),
      untitled: this.bookmarks.filter((b) => !(b.title || '').trim()),
      recent: [...this.bookmarks].sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0)).slice(0, 60),
      rank: this.folders.filter((f) => f.direct > 0).sort((a, b) => b.direct - a.direct),
      topDomains: [...domains].sort((a, b) => b[1] - a[1]).slice(0, 8),
      maxDepth: this.folders.reduce((m, f) => Math.max(m, f.depth), 0),
    };
  },

  // ---------- 写操作（全部可撤销） ----------

  resolve(id) {
    while (id && this.idMap.has(id)) id = this.idMap.get(id);
    return id;
  },

  async run(fn) {
    this.busy++;
    try {
      return await fn();
    } finally {
      this.busy--;
      this.quietUntil = Date.now() + 500;
      await this.refresh();
    }
  },

  pushUndo(label, undo) {
    this.undoStack.push({ label, undo });
    if (this.undoStack.length > 50) this.undoStack.shift();
  },

  async undo() {
    const entry = this.undoStack.pop();
    if (!entry) return null;
    await this.run(entry.undo);
    return entry.label;
  },

  // 把 id 放到 anchorId 紧后面；anchorId 为空则放到最前
  async placeAfter(id, parentId, anchorId) {
    let anchorIndex = -1;
    if (anchorId) {
      const [a] = await B.get(anchorId).catch(() => []);
      if (a && a.parentId === parentId) anchorIndex = a.index;
    }
    await B.move(id, { parentId, index: anchorIndex + 1 });
    // 校验一次落点，防止不同 Chrome 版本对同级移动的下标解释不一致
    const [m] = await B.get(id);
    const [a2] = anchorId && anchorIndex >= 0 ? await B.get(anchorId) : [null];
    const expected = a2 ? a2.index + 1 : 0;
    if (m.parentId === parentId && m.index !== expected) {
      await B.move(id, { parentId, index: expected });
    }
  },

  // 把一组节点移动到 parentId 里第 beforeIndex 个位置之前（null 表示末尾）
  move(ids, parentId, beforeIndex = null) {
    return this.run(async () => {
      const target = this.get(parentId);
      if (!target || target.url || parentId === ROOT) throw new Error('目标不是文件夹');
      const moving = this.sortByTree(ids)
        .map((id) => this.get(id))
        .filter((n) => n && !this.isLocked(n.id) && !(!n.url && this.isInside(parentId, n.id)));
      if (!moving.length) return { moved: 0, skipped: ids.length };

      const movingIds = new Set(moving.map((n) => n.id));
      const kids = target.children || [];
      const end = beforeIndex == null ? kids.length : Math.min(beforeIndex, kids.length);
      let anchor = null;
      for (let i = end - 1; i >= 0; i--) {
        if (!movingIds.has(kids[i].id)) {
          anchor = kids[i].id;
          break;
        }
      }

      const origin = moving.map((n) => {
        const siblings = this.get(n.parentId).children;
        return { id: n.id, parentId: n.parentId, index: n.index, predId: n.index > 0 ? siblings[n.index - 1].id : null };
      });

      for (const n of moving) {
        await this.placeAfter(n.id, parentId, anchor);
        anchor = n.id;
      }

      this.pushUndo(`移动 ${moving.length} 项`, async () => {
        // 按原位置从前往后还原，每项放回原来的前一个兄弟之后
        for (const o of [...origin].sort((a, b) => a.index - b.index)) {
          const id = this.resolve(o.id);
          const parent = this.resolve(o.parentId);
          const pred = this.resolve(o.predId);
          await this.placeAfter(id, parent, pred);
        }
      });
      return { moved: moving.length, skipped: ids.length - moving.length };
    });
  },

  update(id, changes) {
    return this.run(async () => {
      const n = this.get(id);
      const old = { title: n.title };
      if (n.url) old.url = n.url;
      await B.update(id, changes);
      this.pushUndo('编辑', () => B.update(this.resolve(id), old));
    });
  },

  create({ parentId, title, url }) {
    return this.run(async () => {
      const n = await B.create(url ? { parentId, title, url } : { parentId, title });
      this.pushUndo(url ? '新建书签' : '新建文件夹', () => B.remove(this.resolve(n.id)));
      return n;
    });
  },

  // 从网页拖进来的链接：依次插到 index 处（null 为末尾），一次撤销全部
  addLinks(parentId, index, links) {
    return this.run(async () => {
      const ids = [];
      for (const [i, { url, title }] of links.entries()) {
        const props = { parentId, url, title };
        if (index != null) props.index = index + i;
        ids.push((await B.create(props)).id);
      }
      this.pushUndo(`收藏 ${ids.length} 个链接`, async () => {
        for (const id of ids) await B.remove(this.resolve(id));
      });
      return ids;
    });
  },

  remove(ids) {
    return this.run(async () => {
      const set = new Set(ids.filter((id) => !this.isLocked(id)));
      // 父文件夹也在删除列表里时，子项跟着父级一起走
      const top = [...set].filter((id) => {
        for (let n = this.get(this.get(id).parentId); n; n = this.get(n.parentId)) {
          if (set.has(n.id)) return false;
        }
        return true;
      });
      const snapshots = [];
      for (const id of top) {
        const [sub] = await B.getSubTree(id);
        snapshots.push(sub);
      }
      for (const s of snapshots) {
        if (s.url) await B.remove(s.id);
        else await B.removeTree(s.id);
      }
      this.pushUndo(`删除 ${snapshots.length} 项`, async () => {
        for (const s of [...snapshots].sort((a, b) => a.index - b.index)) {
          await this.recreate(s, this.resolve(s.parentId), s.index);
        }
      });
      return snapshots.length;
    });
  },

  async recreate(snap, parentId, index) {
    const siblings = await B.getChildren(parentId);
    const props = { parentId, index: Math.min(index, siblings.length), title: snap.title };
    if (snap.url) props.url = snap.url;
    const n = await B.create(props);
    this.idMap.set(snap.id, n.id);
    for (const [i, child] of (snap.children || []).entries()) {
      await this.recreate(child, n.id, i);
    }
  },
};
