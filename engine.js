/* 作図道場 — コンパスと定規の作図エンジン
 * 幾何計算（node からも使える）と、ブラウザ上の作図ボード。 */
(function () {
  'use strict';

  const EPS = 1e-6;
  const pt = (x, y) => ({ x, y });
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  // ---------- 幾何 ----------
  function mkLine(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy);
    return { type: 'line', p: pt(a.x, a.y), q: pt(b.x, b.y), ux: dx / L, uy: dy / L };
  }
  function mkCircle(c, r) { return { type: 'circle', c: pt(c.x, c.y), r }; }
  function lineDist(l, p) { return Math.abs((p.x - l.p.x) * l.uy - (p.y - l.p.y) * l.ux); }
  function curveDist(cv, p) { return cv.type === 'line' ? lineDist(cv, p) : Math.abs(dist(cv.c, p) - cv.r); }
  function project(cv, p) {
    if (cv.type === 'line') {
      const t = (p.x - cv.p.x) * cv.ux + (p.y - cv.p.y) * cv.uy;
      return pt(cv.p.x + t * cv.ux, cv.p.y + t * cv.uy);
    }
    const d = dist(cv.c, p) || 1;
    return pt(cv.c.x + cv.r * (p.x - cv.c.x) / d, cv.c.y + cv.r * (p.y - cv.c.y) / d);
  }
  function reflect(l, p) { const f = project(l, p); return pt(2 * f.x - p.x, 2 * f.y - p.y); }
  function sameCurve(u, v) {
    if (u.type !== v.type) return false;
    if (u.type === 'circle') return dist(u.c, v.c) < EPS && Math.abs(u.r - v.r) < EPS;
    return lineDist(u, v.p) < EPS && lineDist(u, v.q) < EPS;
  }
  function intersect(u, v) {
    if (u.type === 'line' && v.type === 'line') {
      const den = u.ux * v.uy - u.uy * v.ux;
      if (Math.abs(den) < 1e-12) return [];
      const t = ((v.p.x - u.p.x) * v.uy - (v.p.y - u.p.y) * v.ux) / den;
      return [pt(u.p.x + t * u.ux, u.p.y + t * u.uy)];
    }
    if (u.type === 'circle' && v.type === 'line') return intersect(v, u);
    if (u.type === 'line') {
      const f = project(u, v.c), d = dist(f, v.c);
      if (d > v.r + EPS) return [];
      const h = Math.sqrt(Math.max(0, v.r * v.r - d * d));
      if (h < EPS) return [f];
      return [pt(f.x - h * u.ux, f.y - h * u.uy), pt(f.x + h * u.ux, f.y + h * u.uy)];
    }
    const d = dist(u.c, v.c);
    if (d < EPS || d > u.r + v.r + EPS || d < Math.abs(u.r - v.r) - EPS) return [];
    const a = (u.r * u.r - v.r * v.r + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, u.r * u.r - a * a));
    const ex = (v.c.x - u.c.x) / d, ey = (v.c.y - u.c.y) / d;
    const mx = u.c.x + a * ex, my = u.c.y + a * ey;
    if (h < EPS) return [pt(mx, my)];
    return [pt(mx - h * ey, my + h * ex), pt(mx + h * ey, my - h * ex)];
  }

  // 点と線の集まり。線を足すと、既存の線との交点が自動で点になる。
  class Scene {
    constructor() { this.points = []; this.curves = []; }
    addPoint(p, kind) {
      const e = this.points.find(q => dist(q, p) < EPS);
      if (e) return e;
      const n = { x: p.x, y: p.y, kind };
      this.points.push(n);
      return n;
    }
    addCurve(cv) {
      const e = this.curves.find(c => sameCurve(c, cv));
      if (e) return { curve: e, isNew: false };
      for (const o of this.curves) for (const ip of intersect(cv, o)) this.addPoint(ip, 'x');
      this.curves.push(cv);
      return { curve: cv, isNew: true };
    }
  }

  // ---------- 問題データの解釈 ----------
  function buildGiven(prob) {
    const scene = new Scene(), named = {}, ids = {};
    const g = prob.given;
    const ref = v => (typeof v === 'string' ? named[v] : pt(v[0], v[1]));
    for (const k in g.points || {}) {
      const p = scene.addPoint(pt(g.points[k][0], g.points[k][1]), 'given');
      p.label = k;
      named[k] = p;
    }
    for (const c of g.curves || []) {
      let cv;
      if (c.type === 'circle') {
        const ctr = ref(c.c);
        cv = mkCircle(ctr, c.r != null ? c.r : dist(ctr, ref(c.through)));
      } else {
        const a = ref(c.a), b = ref(c.b);
        cv = mkLine(a, b);
        cv.ea = pt(a.x, a.y); cv.eb = pt(b.x, b.y);
      }
      cv.given = true; cv.draw = c.type; cv.label = c.label; cv.labelAt = c.labelAt;
      scene.addCurve(cv);
      ids[c.id] = cv;
    }
    return { scene, named, ids };
  }

  const isFrame = s => !!(s.c || s.l || s.cr || (s.p && s.at));

  function choose(cands, pick, named) {
    if (!pick) return cands[0];
    const by = f => cands.reduce((a, b) => (f(b) > f(a) ? b : a));
    if (pick === 'up') return by(p => p.y);
    if (pick === 'down') return by(p => -p.y);
    if (pick === 'right') return by(p => p.x);
    if (pick === 'left') return by(p => -p.x);
    if (pick.near) return by(p => -dist(p, named[pick.near]));
    if (pick.far) return by(p => dist(p, named[pick.far]));
    throw new Error('unknown pick');
  }

  // お手本の手順を upto 手目（steps の添字）の手前まで実行する
  function runSolution(prob, upto) {
    const { scene, named, ids } = buildGiven(prob);
    const steps = prob.steps;
    const n = upto == null ? steps.length : upto;
    let moves = 0, last = null;
    const need = k => { if (!named[k]) throw new Error(prob.slug + ': 点 ' + k + ' が未定義'); return named[k]; };
    for (let i = 0; i < n; i++) {
      const st = steps[i];
      if (st.c || st.l || st.cr) {
        let cv;
        if (st.c) cv = mkCircle(need(st.c[0]), dist(need(st.c[0]), need(st.c[1])));
        else if (st.cr) cv = mkCircle(need(st.cr[2]), dist(need(st.cr[0]), need(st.cr[1])));
        else cv = mkLine(need(st.l[0]), need(st.l[1]));
        const r = scene.addCurve(cv);
        if (!r.isNew) throw new Error(prob.slug + ': 手順 ' + i + ' の線は重複');
        moves++;
        ids[st.id || 's' + i] = r.curve;
        last = { curve: r.curve };
      } else if (st.p) {
        let p;
        if (st.at) {
          p = pt(st.at[0], st.at[1]);
          if (st.on) p = project(ids[st.on], p);
        } else {
          const u = ids[st.on[0]], v = ids[st.on[1]];
          if (!u || !v) throw new Error(prob.slug + ': 線 ' + st.on + ' が未定義');
          const cands = intersect(u, v);
          if (!cands.length) throw new Error(prob.slug + ': ' + st.p + ' の交点がない');
          p = choose(cands, st.pick, named);
        }
        const node = scene.addPoint(p, st.at ? 'free' : 'x');
        node.label = st.label != null ? st.label : st.p;
        named[st.p] = node;
        if (st.at) last = { point: node };
      }
    }
    return { scene, named, ids, moves, last };
  }

  function computeGoal(prob) {
    const { named } = runSolution(prob);
    const g = prob.goal;
    const P = n => { if (!named[n]) throw new Error(prob.slug + ': 目標の点 ' + n + ' が未定義'); return pt(named[n].x, named[n].y); };
    const base = {
      lines: (g.lines || []).map(([a, b]) => [P(a), P(b)]),
      points: (g.points || []).map(P),
      circles: (g.circles || []).map(([c, t]) => ({ c: P(c), r: dist(P(c), P(t)) })),
      poly: g.poly ? g.poly.map(P) : null,
    };
    const variants = [base];
    if (g.mirror) {
      const m = mkLine(P(g.mirror[0]), P(g.mirror[1]));
      const R = p => reflect(m, p);
      variants.push({
        lines: base.lines.map(([a, b]) => [R(a), R(b)]),
        points: base.points.map(R),
        circles: base.circles.map(c => ({ c: R(c.c), r: c.r })),
        poly: base.poly && base.poly.map(R),
      });
    }
    return variants;
  }

  // 目標がどこまでできているか。done が全体数に達したら完成。
  function checkGoal(scene, variants) {
    const lines = scene.curves.filter(c => !c.given && c.type === 'line');
    const circles = scene.curves.filter(c => !c.given && c.type === 'circle');
    let best = { done: -1 };
    for (const v of variants) {
      const items = [
        ...v.lines.map(([a, b]) => lines.some(l => lineDist(l, a) < EPS && lineDist(l, b) < EPS)),
        ...v.points.map(p => scene.points.some(q => dist(p, q) < EPS)),
        ...v.circles.map(c => circles.some(k => dist(k.c, c.c) < EPS && Math.abs(k.r - c.r) < EPS)),
      ];
      const done = items.filter(Boolean).length;
      if (done > best.done) best = { done, total: items.length, variant: v };
    }
    best.solved = best.done === best.total;
    return best;
  }

  // 問題全体が収まる範囲
  function bbox(prob) {
    const { scene, named } = runSolution(prob);
    const xs = [], ys = [];
    for (const k in named) { xs.push(named[k].x); ys.push(named[k].y); }
    for (const c of scene.curves) if (c.given && c.type === 'circle') {
      xs.push(c.c.x - c.r, c.c.x + c.r); ys.push(c.c.y - c.r, c.c.y + c.r);
    }
    for (const c of scene.curves) if (c.given && c.type === 'line') {
      xs.push(c.ea.x, c.eb.x); ys.push(c.ea.y, c.eb.y);
    }
    // お手本の円も、極端に大きくなければ収める
    const diag = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    for (const c of scene.curves) if (!c.given && c.type === 'circle' && c.r < 0.8 * diag) {
      xs.push(c.c.x - c.r, c.c.x + c.r); ys.push(c.c.y - c.r, c.c.y + c.r);
    }
    if (prob.view) { xs.push(prob.view[0], prob.view[2]); ys.push(prob.view[1], prob.view[3]); }
    return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  }

  const core = { EPS, dist, mkLine, mkCircle, intersect, project, Scene, buildGiven, runSolution, computeGoal, checkGoal, bbox, isFrame };
  if (typeof module !== 'undefined' && module.exports) { module.exports = core; return; }

  // ---------- ブラウザ：作図ボード ----------
  const ICON = {
    circle: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="1.6" class="f"/></svg>',
    line: '<svg viewBox="0 0 24 24"><path d="M3 19L21 5"/><circle cx="8" cy="15" r="1.6" class="f"/><circle cx="16" cy="9" r="1.6" class="f"/></svg>',
    point: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2" class="f"/></svg>',
    compass: '<svg viewBox="0 0 24 24"><path d="M4 7h7" stroke-dasharray="2 2"/><circle cx="15" cy="14" r="6"/><circle cx="15" cy="14" r="1.4" class="f"/></svg>',
  };
  const TOOLS = {
    circle: { name: 'コンパス', need: 2, help: ['円の中心にする点を選んでください', '円が通る点を選んでください'] },
    line: { name: '定規', need: 2, help: ['直線が通る1つ目の点を選んでください', '直線が通る2つ目の点を選んでください'] },
    point: { name: '点', need: 1, help: ['点をとる場所を選んでください（線や円の上にもとれます）'] },
    compass: { name: '長さを写す', need: 3, help: ['写したい長さの片方の端を選んでください', 'もう一方の端を選んでください', '円の中心にする点を選んでください'] },
  };

  const store = {
    get() { try { return JSON.parse(localStorage.getItem('sakuzu-solved') || '{}'); } catch (e) { return {}; } },
    set(slug, moves) {
      try {
        const s = store.get();
        if (!s[slug] || moves < s[slug]) s[slug] = moves;
        localStorage.setItem('sakuzu-solved', JSON.stringify(s));
      } catch (e) { /* 保存できない環境では何もしない */ }
    },
  };

  function h(tag, attrs, html) {
    const e = document.createElement(tag);
    for (const k in attrs || {}) e.setAttribute(k, attrs[k]);
    if (html != null) e.innerHTML = html;
    return e;
  }

  class Board {
    constructor(el, prob, siblings) {
      this.el = el; this.prob = prob; this.siblings = siblings || {};
      this.tools = prob.tools || ['circle', 'line', 'point', 'compass'];
      this.tool = this.tools[0];
      this.actions = []; this.redoStack = []; this.sel = [];
      this.mode = 'play';
      this.goal = computeGoal(prob);
      this.frames = prob.steps.map((s, i) => (isFrame(s) ? i : -1)).filter(i => i >= 0);
      this.par = runSolution(prob).moves;
      this.view = null; this.hover = null; this.solvedShown = false;
      this.build();
      this.rebuild();
    }

    build() {
      const el = this.el;
      el.classList.add('sz-board');
      const bar = h('div', { class: 'sz-tools', role: 'toolbar', 'aria-label': '道具' });
      for (const t of this.tools) {
        const b = h('button', { type: 'button', 'data-tool': t }, ICON[t] + '<span>' + TOOLS[t].name + '</span>');
        b.addEventListener('click', () => this.setTool(t));
        bar.appendChild(b);
      }
      this.toolBar = bar;
      const wrap = h('div', { class: 'sz-canvas-wrap' });
      this.canvas = h('canvas', { 'aria-label': '作図ボード' });
      wrap.appendChild(this.canvas);
      const zoom = h('div', { class: 'sz-zoom' });
      [['＋', '拡大', () => this.zoomBy(1.25)], ['−', '縮小', () => this.zoomBy(0.8)], ['⤢', '全体を表示', () => { this.fit(); this.draw(); }]]
        .forEach(([t, l, f]) => { const b = h('button', { type: 'button', title: l, 'aria-label': l }, t); b.addEventListener('click', f); zoom.appendChild(b); });
      wrap.appendChild(zoom);
      this.caption = h('div', { class: 'sz-caption', hidden: '' });
      wrap.appendChild(this.caption);

      this.status = h('div', { class: 'sz-status' });
      this.movesEl = h('span', { class: 'sz-moves' });
      this.msgEl = h('span', { class: 'sz-msg', 'aria-live': 'polite' });
      this.status.append(this.movesEl, this.msgEl);

      const act = h('div', { class: 'sz-actions' });
      const btn = (label, f, cls) => { const b = h('button', { type: 'button', class: cls || '' }, label); b.addEventListener('click', f); act.appendChild(b); return b; };
      this.undoBtn = btn('↶ 戻す', () => this.undo());
      this.redoBtn = btn('↷ 進む', () => this.redo());
      this.resetBtn = btn('最初から', () => this.reset());
      btn('ヒント', () => { this.hintEl.hidden = !this.hintEl.hidden; });
      btn('お手本を見る', () => this.startDemo(), 'primary');
      this.actBar = act;

      const demo = h('div', { class: 'sz-demo-bar', hidden: '' });
      const dbtn = (label, f, cls) => { const b = h('button', { type: 'button', class: cls || '' }, label); b.addEventListener('click', f); demo.appendChild(b); return b; };
      this.prevBtn = dbtn('◀ 前へ', () => this.demoStep(-1));
      this.demoCount = h('span', { class: 'sz-demo-count' });
      demo.appendChild(this.demoCount);
      this.nextBtn = dbtn('次へ ▶', () => this.demoStep(1), 'primary');
      dbtn('自分で作図する', () => this.endDemo());
      this.demoBar = demo;

      this.hintEl = h('p', { class: 'sz-hint', hidden: '' }, '<b>ヒント：</b>' + this.prob.hint);
      this.doneEl = h('div', { class: 'sz-done', hidden: '' });

      el.append(bar, wrap, this.status, act, demo, this.hintEl, this.doneEl);
      this.ctx = this.canvas.getContext('2d');
      this.bindPointer();
      new ResizeObserver(() => this.resize()).observe(wrap);
      el.addEventListener('keydown', e => this.onKey(e));
      document.addEventListener('keydown', e => { if (e.target === document.body) this.onKey(e); });
      if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => this.draw());
      this.setTool(this.tool);
    }

    onKey(e) {
      if (this.mode !== 'play') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? this.redo() : this.undo(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); this.redo(); }
      else if (e.key === 'Escape') { this.sel = []; this.updateStatus(); this.draw(); }
    }

    setTool(t) {
      this.tool = t; this.sel = [];
      for (const b of this.toolBar.children) b.classList.toggle('active', b.dataset.tool === t);
      this.updateStatus(); this.draw();
    }

    // ---- 座標変換 ----
    resize() {
      const r = this.canvas.getBoundingClientRect();
      if (!r.width) return;
      this.dpr = window.devicePixelRatio || 1;
      this.w = r.width; this.h = r.height;
      this.canvas.width = Math.round(r.width * this.dpr);
      this.canvas.height = Math.round(r.height * this.dpr);
      if (!this.view) this.fit();
      this.draw();
    }
    fit() {
      const b = bbox(this.prob);
      const bw = Math.max(b.x1 - b.x0, 0.5), bh = Math.max(b.y1 - b.y0, 0.5);
      const scale = Math.min(this.w / (bw * 1.25), this.h / (bh * 1.25));
      this.view = { ox: (b.x0 + b.x1) / 2, oy: (b.y0 + b.y1) / 2, scale };
    }
    sx(x) { return this.w / 2 + (x - this.view.ox) * this.view.scale; }
    sy(y) { return this.h / 2 - (y - this.view.oy) * this.view.scale; }
    toWorld(X, Y) { return pt(this.view.ox + (X - this.w / 2) / this.view.scale, this.view.oy - (Y - this.h / 2) / this.view.scale); }
    zoomAt(X, Y, f) {
      const w = this.toWorld(X, Y);
      const s = Math.min(4000, Math.max(4, this.view.scale * f));
      this.view.scale = s;
      this.view.ox = w.x - (X - this.w / 2) / s;
      this.view.oy = w.y + (Y - this.h / 2) / s;
      this.draw();
    }
    zoomBy(f) { this.zoomAt(this.w / 2, this.h / 2, f); }

    bindPointer() {
      const cv = this.canvas, ptrs = new Map();
      const pos = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
      cv.addEventListener('pointerdown', e => {
        cv.setPointerCapture(e.pointerId);
        const p = pos(e);
        ptrs.set(e.pointerId, p);
        this.touch = e.pointerType !== 'mouse';
        if (ptrs.size === 1) this.down = { ...p, moved: false, ox: this.view.ox, oy: this.view.oy };
        else if (ptrs.size === 2) {
          const [a, b] = [...ptrs.values()];
          this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, scale: this.view.scale };
          this.down = null;
        }
      });
      cv.addEventListener('pointermove', e => {
        const p = pos(e);
        if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, p);
        if (this.pinch && ptrs.size === 2) {
          const [a, b] = [...ptrs.values()];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          this.zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, (this.pinch.scale * d / this.pinch.d) / this.view.scale);
          return;
        }
        if (this.down) {
          const dx = p.x - this.down.x, dy = p.y - this.down.y;
          if (!this.down.moved && Math.hypot(dx, dy) > 6) this.down.moved = true;
          if (this.down.moved) {
            this.view.ox = this.down.ox - dx / this.view.scale;
            this.view.oy = this.down.oy + dy / this.view.scale;
            this.draw();
            return;
          }
        }
        if (e.pointerType === 'mouse') { this.hover = this.pickAt(p.x, p.y); this.draw(); }
      });
      const end = e => {
        const p = pos(e);
        if (e.type === 'pointerup' && this.down && !this.down.moved && ptrs.size === 1) this.click(p.x, p.y);
        ptrs.delete(e.pointerId);
        if (ptrs.size < 2) this.pinch = null;
        if (ptrs.size === 0) this.down = null;
      };
      cv.addEventListener('pointerup', end);
      cv.addEventListener('pointercancel', end);
      cv.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { this.hover = null; this.draw(); } });
      cv.addEventListener('wheel', e => {
        e.preventDefault();
        const p = pos(e);
        this.zoomAt(p.x, p.y, Math.exp(-e.deltaY * 0.0015));
      }, { passive: false });
    }

    // 画面上の位置から、選ばれる点を決める（既存の点 → 線上の点 → 何もない所）
    pickAt(X, Y) {
      const w = this.toWorld(X, Y), tol = (this.touch ? 22 : 12) / this.view.scale;
      let best = null, bd = tol;
      for (const p of this.scene.points) { const d = dist(p, w); if (d < bd) { bd = d; best = p; } }
      if (best) return { pt: best, existing: true };
      let bc = null, bcd = tol * 0.7;
      for (const c of this.scene.curves) { const d = curveDist(c, w); if (d < bcd) { bcd = d; bc = c; } }
      if (bc) return { pt: project(bc, w), on: bc };
      return { pt: w, free: true };
    }

    click(X, Y) {
      if (this.mode !== 'play') return;
      const tgt = this.pickAt(X, Y);
      if (this.tool === 'point') {
        if (tgt.existing) { this.flash('そこにはもう点があります'); return; }
        this.commit({ t: 'point', pts: [pt(tgt.pt.x, tgt.pt.y)] });
        return;
      }
      if (this.sel.length === 1 && dist(this.sel[0], tgt.pt) < EPS) { this.flash('別の点を選んでください'); return; }
      this.sel.push(pt(tgt.pt.x, tgt.pt.y));
      if (this.sel.length === TOOLS[this.tool].need) {
        const a = { t: this.tool, pts: this.sel };
        this.sel = [];
        this.commit(a);
      } else { this.updateStatus(); this.draw(); }
    }

    replay(actions) {
      const { scene } = buildGiven(this.prob);
      let moves = 0, dup = false;
      for (const a of actions) {
        const ps = a.pts.map(p => scene.addPoint(p, 'free'));
        let cv = null;
        if (a.t === 'line') cv = mkLine(ps[0], ps[1]);
        else if (a.t === 'circle') cv = mkCircle(ps[0], dist(ps[0], ps[1]));
        else if (a.t === 'compass') cv = mkCircle(ps[2], dist(ps[0], ps[1]));
        dup = false;
        if (cv) { if (scene.addCurve(cv).isNew) moves++; else dup = true; }
      }
      return { scene, moves, dup };
    }
    commit(a) {
      const r = this.replay([...this.actions, a]);
      if (r.dup) { this.flash('同じ線はもうかいてあります'); this.draw(); return; }
      this.actions.push(a); this.redoStack = [];
      this.apply(r);
    }
    rebuild() { this.apply(this.replay(this.actions)); }
    apply(r) {
      this.scene = r.scene; this.moves = r.moves;
      this.progress = checkGoal(this.scene, this.goal);
      if (this.progress.solved && !this.solvedShown) this.showDone();
      if (!this.progress.solved) { this.solvedShown = false; this.doneEl.hidden = true; }
      this.updateStatus(); this.draw();
    }
    undo() { if (this.sel.length) { this.sel = []; this.updateStatus(); this.draw(); return; } if (!this.actions.length) return; this.redoStack.push(this.actions.pop()); this.rebuild(); }
    redo() { if (!this.redoStack.length) return; this.actions.push(this.redoStack.pop()); this.rebuild(); }
    reset() {
      if (!this.actions.length) return;
      // 1回目のクリックで確認、もう一度押すと消す
      if (!this.resetArmed) {
        this.resetArmed = true; this.resetBtn.textContent = 'もう一度押すと全部消します';
        clearTimeout(this.resetT);
        this.resetT = setTimeout(() => { this.resetArmed = false; this.resetBtn.textContent = '最初から'; }, 3000);
        return;
      }
      clearTimeout(this.resetT); this.resetArmed = false; this.resetBtn.textContent = '最初から';
      this.actions = []; this.redoStack = []; this.sel = []; this.rebuild();
    }

    flash(msg) {
      this.msgEl.textContent = msg; this.msgEl.classList.add('warn');
      clearTimeout(this.flashT);
      this.flashT = setTimeout(() => { this.msgEl.classList.remove('warn'); this.updateStatus(); }, 1800);
    }
    updateStatus() {
      if (!this.scene) return;
      const g = this.progress;
      this.movesEl.innerHTML = '手数 <b>' + this.moves + '</b>　目標 <b>' + Math.max(g.done, 0) + '/' + g.total + '</b>';
      this.undoBtn.disabled = !this.actions.length && !this.sel.length;
      this.redoBtn.disabled = !this.redoStack.length;
      if (!this.msgEl.classList.contains('warn')) this.msgEl.textContent = TOOLS[this.tool].help[this.sel.length] || '';
    }

    showDone() {
      this.solvedShown = true;
      const m = this.moves, par = this.par, p = this.prob;
      store.set(p.slug, m);
      const cmp = m < par ? 'お手本より少ない手数です。おみごと！' : m === par ? 'お手本と同じ手数です。' : 'お手本は' + par + '手。もっと少ない手数にも挑戦してみましょう。';
      const url = location.origin + location.pathname;
      const text = '「' + p.title + '」を' + m + '手で作図できた！ #作図道場';
      const share = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(url);
      const next = this.siblings.next;
      this.doneEl.innerHTML = '<p class="sz-done-title">🎉 作図完成！ ' + m + '手</p><p>' + cmp + '</p><p class="sz-done-links">' +
        '<a class="button" href="' + share + '" target="_blank" rel="noopener">X でシェア</a>' +
        (next ? ' <a class="button primary" href="' + next.href + '">次の問題「' + next.title + '」へ →</a>' : '') + '</p>';
      this.doneEl.hidden = false;
    }

    // ---- お手本 ----
    startDemo() {
      this.mode = 'demo'; this.sel = []; this.demoK = -1;
      this.toolBar.classList.add('dim'); this.actBar.hidden = true; this.status.hidden = true; this.demoBar.hidden = false;
      this.renderDemo();
    }
    endDemo() {
      this.mode = 'play'; this.demo = null;
      this.toolBar.classList.remove('dim'); this.actBar.hidden = false; this.status.hidden = false; this.demoBar.hidden = true; this.caption.hidden = true;
      this.updateStatus(); this.draw();
    }
    demoStep(d) {
      this.demoK = Math.max(-1, Math.min(this.frames.length - 1, this.demoK + d));
      this.renderDemo();
    }
    renderDemo() {
      const fr = this.frames, k = this.demoK, steps = this.prob.steps;
      const upto = k + 1 < fr.length ? fr[k + 1] : steps.length;
      const r = runSolution(this.prob, upto);
      const lastFrame = k === fr.length - 1;
      this.demo = { scene: r.scene, last: k < 0 ? null : r.last, goal: lastFrame ? checkGoal(r.scene, this.goal).variant : null };
      this.caption.hidden = false;
      this.caption.innerHTML = k < 0 ? 'はじめの状態です。「次へ」で手順を1つずつ見られます。'
        : '<b>手順 ' + (k + 1) + '/' + fr.length + '</b>　' + steps[fr[k]].say;
      this.demoCount.textContent = (k + 1) + ' / ' + fr.length;
      this.prevBtn.disabled = k < 0; this.nextBtn.disabled = lastFrame;
      this.draw();
    }

    // ---- 描画 ----
    draw() {
      if (!this.view || !this.scene) return;
      const ctx = this.ctx, W = this.w, H = this.h, cs = getComputedStyle(this.el);
      const col = n => cs.getPropertyValue(n).trim();
      const C = { bg: col('--cv-bg'), grid: col('--cv-grid'), given: col('--cv-given'), line: col('--cv-line'), circle: col('--cv-circle'), point: col('--cv-point'), accent: col('--cv-accent'), good: col('--cv-good'), label: col('--cv-label') };
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
      this.drawGrid(C);
      const demo = this.mode === 'demo' ? this.demo : null;
      const S = demo ? demo.scene : this.scene;
      const goal = demo ? demo.goal : (this.progress.solved ? this.progress.variant : null);
      ctx.lineCap = 'round';

      if (goal && goal.poly) {
        ctx.beginPath();
        goal.poly.forEach((p, i) => (i ? ctx.lineTo(this.sx(p.x), this.sy(p.y)) : ctx.moveTo(this.sx(p.x), this.sy(p.y))));
        ctx.closePath(); ctx.globalAlpha = 0.16; ctx.fillStyle = C.good; ctx.fill(); ctx.globalAlpha = 1;
      }
      for (const c of S.curves) {
        const isLast = demo && demo.last && demo.last.curve === c;
        ctx.setLineDash([]);
        if (c.given) { ctx.strokeStyle = C.given; ctx.lineWidth = 2.2; }
        else { ctx.strokeStyle = c.type === 'line' ? C.line : C.circle; ctx.lineWidth = 1.5; }
        if (isLast) { ctx.strokeStyle = C.accent; ctx.lineWidth = 2.8; }
        this.drawCurve(c, C);
      }
      if (goal) {
        ctx.strokeStyle = C.good; ctx.lineWidth = 3.6; ctx.setLineDash([]);
        if (goal.poly) {
          ctx.beginPath();
          goal.poly.forEach((p, i) => (i ? ctx.lineTo(this.sx(p.x), this.sy(p.y)) : ctx.moveTo(this.sx(p.x), this.sy(p.y))));
          ctx.closePath(); ctx.stroke();
        } else for (const [a, b] of goal.lines) this.drawCurve(mkLine(a, b), C);
        for (const c of goal.circles) this.drawCurve(mkCircle(c.c, c.r), C);
      }
      // 作図中のプレビュー
      if (!demo && this.sel.length && this.hover) {
        const a = this.sel[0], hp = this.hover.pt;
        ctx.strokeStyle = C.accent; ctx.lineWidth = 1.3; ctx.setLineDash([6, 5]);
        if (this.tool === 'line' && dist(a, hp) > EPS) this.drawCurve(mkLine(a, hp), C);
        if (this.tool === 'circle') this.drawCurve(mkCircle(a, dist(a, hp)), C);
        if (this.tool === 'compass') {
          if (this.sel.length === 1) { ctx.beginPath(); ctx.moveTo(this.sx(a.x), this.sy(a.y)); ctx.lineTo(this.sx(hp.x), this.sy(hp.y)); ctx.stroke(); }
          else this.drawCurve(mkCircle(hp, dist(this.sel[0], this.sel[1])), C);
        }
        ctx.setLineDash([]);
      }
      // 点
      for (const p of S.points) {
        const X = this.sx(p.x), Y = this.sy(p.y);
        if (X < -20 || Y < -20 || X > W + 20 || Y > H + 20) continue;
        const isLast = demo && demo.last && demo.last.point === p;
        ctx.beginPath();
        if (p.kind === 'given') { ctx.arc(X, Y, 4.6, 0, 7); ctx.fillStyle = C.given; }
        else if (p.kind === 'free') { ctx.arc(X, Y, 3.6, 0, 7); ctx.fillStyle = C.line; }
        else { ctx.arc(X, Y, 2.8, 0, 7); ctx.fillStyle = C.point; }
        if (isLast || (p.label && demo && p.kind !== 'given')) ctx.fillStyle = isLast ? C.accent : C.given;
        ctx.fill();
      }
      if (goal) for (const p of goal.points) { ctx.beginPath(); ctx.arc(this.sx(p.x), this.sy(p.y), 6.5, 0, 7); ctx.fillStyle = C.good; ctx.fill(); }
      // 選択中の点・ホバー
      ctx.lineWidth = 2; ctx.strokeStyle = C.accent;
      for (const p of this.mode === 'play' ? this.sel : []) { ctx.beginPath(); ctx.arc(this.sx(p.x), this.sy(p.y), 7.5, 0, 7); ctx.stroke(); }
      if (!demo && this.hover && this.hover.existing) {
        ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(this.sx(this.hover.pt.x), this.sy(this.hover.pt.y), 9, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
      }
      // ラベル
      ctx.font = '600 15px "Hiragino Sans","Noto Sans JP",sans-serif'; ctx.textBaseline = 'bottom';
      for (const p of S.points) if (p.label && (p.kind === 'given' || demo)) this.label(p.label, this.sx(p.x) + 7, this.sy(p.y) - 5, C);
      for (const c of S.curves) if (c.label && c.labelAt) this.label(c.label, this.sx(c.labelAt[0]), this.sy(c.labelAt[1]), C, true);
    }
    label(t, X, Y, C, italic) {
      const ctx = this.ctx;
      ctx.font = (italic ? 'italic ' : '') + '600 15px "Hiragino Sans","Noto Sans JP",serif';
      ctx.lineWidth = 3.5; ctx.strokeStyle = C.bg; ctx.strokeText(t, X, Y);
      ctx.fillStyle = C.label; ctx.fillText(t, X, Y);
    }
    drawGrid(C) {
      const ctx = this.ctx, s = this.view.scale;
      let step = 1; while (step * s < 28) step *= 2; while (step * s > 90) step /= 2;
      const w0 = this.toWorld(0, this.h), w1 = this.toWorld(this.w, 0);
      ctx.fillStyle = C.grid;
      for (let x = Math.floor(w0.x / step) * step; x <= w1.x; x += step)
        for (let y = Math.floor(w0.y / step) * step; y <= w1.y; y += step) ctx.fillRect(this.sx(x) - 0.75, this.sy(y) - 0.75, 1.5, 1.5);
    }
    drawCurve(c, C) {
      const ctx = this.ctx;
      ctx.beginPath();
      if (c.type === 'circle') { ctx.arc(this.sx(c.c.x), this.sy(c.c.y), c.r * this.view.scale, 0, Math.PI * 2); ctx.stroke(); return; }
      const R = Math.hypot(this.w, this.h) / this.view.scale;
      const f = project(c, this.toWorld(this.w / 2, this.h / 2));
      const seg = (a, b) => { ctx.beginPath(); ctx.moveTo(this.sx(a.x), this.sy(a.y)); ctx.lineTo(this.sx(b.x), this.sy(b.y)); ctx.stroke(); };
      const far = (o, s) => pt(o.x + s * c.ux * R * 2, o.y + s * c.uy * R * 2);
      if (c.given && (c.draw === 'seg' || c.draw === 'ray')) {
        const sw = ctx.strokeStyle, lw = ctx.lineWidth;
        ctx.setLineDash([4, 6]); ctx.lineWidth = 1; ctx.globalAlpha = 0.45;
        seg(pt(f.x - c.ux * R, f.y - c.uy * R), pt(f.x + c.ux * R, f.y + c.uy * R));
        ctx.setLineDash([]); ctx.lineWidth = lw; ctx.globalAlpha = 1; ctx.strokeStyle = sw;
        if (c.draw === 'seg') seg(c.ea, c.eb);
        else seg(c.ea, far(c.ea, 1 + dist(c.ea, f) / R));
        return;
      }
      seg(pt(f.x - c.ux * R, f.y - c.uy * R), pt(f.x + c.ux * R, f.y + c.uy * R));
    }
  }

  // ---------- コメント欄（giscus） ----------
  // GitHub Discussions を有効にしたあと、repoId / categoryId を設定するとコメント欄が表示される。
  const GISCUS = { repo: 'kodaka-yutaro/sakuzu', repoId: '', category: 'Announcements', categoryId: '' };
  function initComments() {
    const box = document.getElementById('comments');
    if (!box) return;
    if (!GISCUS.repoId || !GISCUS.categoryId) { box.innerHTML = '<p class="muted">コメント欄は準備中です。</p>'; return; }
    const s = document.createElement('script');
    const attrs = {
      src: 'https://giscus.app/client.js', 'data-repo': GISCUS.repo, 'data-repo-id': GISCUS.repoId,
      'data-category': GISCUS.category, 'data-category-id': GISCUS.categoryId, 'data-mapping': 'pathname',
      'data-strict': '1', 'data-reactions-enabled': '1', 'data-emit-metadata': '0', 'data-input-position': 'top',
      'data-theme': 'preferred_color_scheme', 'data-lang': 'ja', 'data-loading': 'lazy', crossorigin: 'anonymous', async: '',
    };
    for (const k in attrs) s.setAttribute(k, attrs[k]);
    box.appendChild(s);
  }

  function init() {
    const list = window.SAKUZU_PROBLEMS || [];
    document.querySelectorAll('[data-sakuzu]').forEach(el => {
      const i = list.findIndex(p => p.slug === el.dataset.sakuzu);
      if (i < 0) return;
      const next = list[i + 1];
      el.sakuzuBoard = new Board(el, list[i], { next: next && { href: next.slug + '.html', title: next.title } });
    });
    const solved = store.get();
    document.querySelectorAll('[data-solved-slug]').forEach(el => {
      const m = solved[el.dataset.solvedSlug];
      if (m) { el.textContent = '✓ ' + m + '手で完成'; el.hidden = false; }
    });
    initComments();
  }
  window.Sakuzu = core;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
