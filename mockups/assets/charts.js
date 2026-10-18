/**
 * Hand-rolled SVG charts: pedigree (ancestors), descendants, fan.
 * Layout functions are pure (data in → positioned nodes out); render functions draw SVG.
 * PanZoom adds drag / wheel / pinch to an <svg> with an inner <g>.
 */
window.Charts = (function () {
  'use strict';

  var S = window.MockStore;
  var NS = 'http://www.w3.org/2000/svg';

  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      e.setAttribute(k, attrs[k]);
    });
    if (parent) parent.appendChild(e);
    return e;
  }
  function text(parent, x, y, str, cls, anchor) {
    var t = el('text', { x: x, y: y, 'class': cls || '', 'text-anchor': anchor || 'middle' }, parent);
    t.textContent = str;
    return t;
  }
  function years(p) {
    var b = p.birth && p.birth.year;
    var d = p.death && p.death.year;
    if (S.isLiving(p)) return b ? 'b. ' + b : '';
    return (b || '?') + ' \u2013 ' + (d || '?');
  }
  function clip(s, n) {
    return s.length > n ? s.slice(0, n - 1) + '\u2026' : s;
  }

  // ---------------------------------------------------------------------------
  // PanZoom
  // ---------------------------------------------------------------------------

  function PanZoom(svg, g) {
    var s = 1, tx = 0, ty = 0;
    var pointers = new Map();
    var start = null;
    var moved = 0;
    var self = this;
    this.dragged = false;

    function apply() {
      g.setAttribute('transform', 'translate(' + tx + ',' + ty + ') scale(' + s + ')');
    }
    function zoomAt(factor, cx, cy) {
      var ns = Math.max(0.2, Math.min(4, s * factor));
      tx = cx - (cx - tx) * (ns / s);
      ty = cy - (cy - ty) * (ns / s);
      s = ns;
      apply();
    }
    svg.addEventListener('wheel', function (e) {
      e.preventDefault();
      var r = svg.getBoundingClientRect();
      zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });

    svg.addEventListener('pointerdown', function (e) {
      svg.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      moved = 0;
      self.dragged = false;
      if (pointers.size === 1) start = { x: e.clientX, y: e.clientY, tx: tx, ty: ty };
      if (pointers.size === 2) start = pinchStart();
    });
    function pinchStart() {
      var pts = Array.from(pointers.values());
      var dx = pts[0].x - pts[1].x, dy = pts[0].y - pts[1].y;
      return { dist: Math.hypot(dx, dy), s: s, tx: tx, ty: ty, cx: (pts[0].x + pts[1].x) / 2, cy: (pts[0].y + pts[1].y) / 2 };
    }
    svg.addEventListener('pointermove', function (e) {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1 && start) {
        var dx = e.clientX - start.x, dy = e.clientY - start.y;
        moved = Math.max(moved, Math.hypot(dx, dy));
        if (moved > 6) self.dragged = true;
        tx = start.tx + dx;
        ty = start.ty + dy;
        apply();
      } else if (pointers.size === 2 && start && start.dist) {
        var pts = Array.from(pointers.values());
        var d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        var r = svg.getBoundingClientRect();
        var cx = (pts[0].x + pts[1].x) / 2 - r.left, cy = (pts[0].y + pts[1].y) / 2 - r.top;
        var ns = Math.max(0.2, Math.min(4, start.s * (d / start.dist)));
        tx = cx - (start.cx - r.left - start.tx) * (ns / start.s);
        ty = cy - (start.cy - r.top - start.ty) * (ns / start.s);
        s = ns;
        self.dragged = true;
        apply();
      }
    });
    function up(e) {
      pointers.delete(e.pointerId);
      if (pointers.size === 1) {
        var p = Array.from(pointers.values())[0];
        start = { x: p.x, y: p.y, tx: tx, ty: ty };
      } else if (pointers.size === 0) start = null;
    }
    svg.addEventListener('pointerup', up);
    svg.addEventListener('pointercancel', up);

    this.fit = function (bbox, pad) {
      pad = pad == null ? 24 : pad;
      var r = svg.getBoundingClientRect();
      if (!bbox.width || !bbox.height) return;
      s = Math.min((r.width - pad * 2) / bbox.width, (r.height - pad * 2) / bbox.height, 1.6);
      tx = (r.width - bbox.width * s) / 2 - bbox.x * s;
      ty = (r.height - bbox.height * s) / 2 - bbox.y * s;
      apply();
    };
    this.zoomIn = function () {
      var r = svg.getBoundingClientRect();
      zoomAt(1.25, r.width / 2, r.height / 2);
    };
    this.zoomOut = function () {
      var r = svg.getBoundingClientRect();
      zoomAt(1 / 1.25, r.width / 2, r.height / 2);
    };
    apply();
  }

  // ---------------------------------------------------------------------------
  // Pedigree layout: focus + ancestors in a binary tree
  // ---------------------------------------------------------------------------

  /**
   * @param {string} focusId
   * @param {number} gens  total generations including focus (e.g. 4)
   * @param {'h'|'v'} orient  horizontal (focus left) or vertical (focus bottom)
   */
  function layoutPedigree(focusId, gens, orient) {
    var W = orient === 'h' ? 150 : 118, H = 46, GAPX = 56, GAPY = orient === 'h' ? 10 : 8;
    var nodes = [], edges = [];
    var slots = Math.pow(2, gens - 1);
    var total = orient === 'h' ? slots * (H + GAPY) : slots * (W + GAPY);

    function pos(gen, slot) {
      var span = total / Math.pow(2, gen);
      var c = (slot + 0.5) * span;
      if (orient === 'h') return { x: gen * (W + GAPX), y: c - H / 2 };
      return { x: c - W / 2, y: (gens - 1 - gen) * (H + GAPX) };
    }
    function place(id, gen, slot, childNode) {
      var p = S.person(id);
      var pt = pos(gen, slot);
      var node = { id: id, person: p, gen: gen, slot: slot, x: pt.x, y: pt.y, w: W, h: H };
      nodes.push(node);
      if (childNode) edges.push({ from: childNode, to: node });
      if (gen + 1 >= gens) return;
      var par = S.parentsOf(id);
      [par.father, par.mother].forEach(function (parent, i) {
        var sl = slot * 2 + i;
        if (parent) place(parent.id, gen + 1, sl, node);
        else {
          var pp = pos(gen + 1, sl);
          var ph = { id: null, placeholder: i === 0 ? 'father' : 'mother', forId: id, gen: gen + 1, slot: sl, x: pp.x, y: pp.y, w: W, h: H };
          nodes.push(ph);
          edges.push({ from: node, to: ph, dashed: true });
        }
      });
    }
    place(focusId, 0, 0, null);
    return { nodes: nodes, edges: edges, orient: orient, bbox: bbox(nodes) };
  }

  function bbox(nodes) {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach(function (n) {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.w);
      maxY = Math.max(maxY, n.y + n.h);
    });
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  // ---------------------------------------------------------------------------
  // Descendants layout: tidy top-down tree
  // ---------------------------------------------------------------------------

  function layoutDescendants(focusId, gens) {
    var W = 128, H = 54, GAPX = 14, GAPY = 70;
    var nodes = [], edges = [];

    function build(id, depth) {
      var p = S.person(id);
      var node = { id: id, person: p, gen: depth, w: W, h: H, children: [], partners: S.partnersOf(id) };
      if (depth + 1 < gens) {
        S.childrenOf(id).forEach(function (c) {
          node.children.push(build(c.id, depth + 1));
        });
      }
      node.width = Math.max(W + GAPX, node.children.reduce(function (a, c) {
        return a + c.width;
      }, 0));
      return node;
    }
    function assign(node, x0, parent) {
      node.x = x0 + node.width / 2 - W / 2;
      node.y = node.gen * (H + GAPY);
      nodes.push(node);
      if (parent) edges.push({ from: parent, to: node });
      var cx = x0;
      node.children.forEach(function (c) {
        assign(c, cx, node);
        cx += c.width;
      });
    }
    var root = build(focusId, 0);
    assign(root, 0, null);
    return { nodes: nodes, edges: edges, orient: 'v', bbox: bbox(nodes) };
  }

  // ---------------------------------------------------------------------------
  // Render node/edge charts
  // ---------------------------------------------------------------------------

  function renderNodeChart(g, layout, opts) {
    opts = opts || {};
    var edgesG = el('g', null, g);
    var nodesG = el('g', null, g);
    var horiz = layout.orient === 'h';

    layout.edges.forEach(function (e) {
      var a = e.from, b = e.to, d;
      if (horiz) {
        var x1 = a.x + a.w, y1 = a.y + a.h / 2, x2 = b.x, y2 = b.y + b.h / 2, mx = (x1 + x2) / 2;
        d = 'M' + x1 + ',' + y1 + ' H' + mx + ' V' + y2 + ' H' + x2;
      } else if (layout.orient === 'v' && b.gen > a.gen && opts.down) {
        var ax = a.x + a.w / 2, ay = a.y + a.h, bx = b.x + b.w / 2, by = b.y, my = (ay + by) / 2;
        d = 'M' + ax + ',' + ay + ' V' + my + ' H' + bx + ' V' + by;
      } else {
        var ax2 = a.x + a.w / 2, ay2 = a.y, bx2 = b.x + b.w / 2, by2 = b.y + b.h, my2 = (ay2 + by2) / 2;
        d = 'M' + ax2 + ',' + ay2 + ' V' + my2 + ' H' + bx2 + ' V' + by2;
      }
      var path = el('path', { d: d, 'class': 'edge' }, edgesG);
      if (e.dashed) path.setAttribute('stroke-dasharray', '4 3');
    });

    layout.nodes.forEach(function (n) {
      var cls = 'node';
      if (n.placeholder) cls += ' node--ph';
      else {
        cls += ' node--' + (n.person.sex || 'U');
        if (n.id === opts.focusId) cls += ' node--focus';
        if (n.id === opts.selectedId) cls += ' node--selected';
      }
      var ng = el('g', { 'class': cls, transform: 'translate(' + n.x + ',' + n.y + ')' }, nodesG);
      el('rect', { width: n.w, height: n.h, rx: 10 }, ng);
      if (n.placeholder) {
        text(ng, n.w / 2, n.h / 2 + 4, '+ Add ' + n.placeholder, '', 'middle');
        ng.addEventListener('click', function () {
          if (opts.onPlaceholder) opts.onPlaceholder(n);
        });
        return;
      }
      var p = n.person;
      var nameMax = n.w > 140 ? 20 : n.w > 120 ? 16 : 14;
      text(ng, n.w / 2, 18, clip(p.given + ' ' + (p.birthSurname || p.surname), nameMax), 'n-name');
      var sub = years(p);
      if (n.partners && n.partners.length) {
        var pt = n.partners.map(function (x) {
          return x.given;
        }).join(', ');
        text(ng, n.w / 2, 32, sub, 'n-years');
        text(ng, n.w / 2, 45, clip('\u221E ' + pt, 20), 'n-years');
      } else {
        text(ng, n.w / 2, 34, sub, 'n-years');
      }
      ng.addEventListener('click', function () {
        if (opts.onSelect) opts.onSelect(n);
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Fan chart
  // ---------------------------------------------------------------------------

  function polar(cx, cy, r, a) {
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  }
  function arcPath(cx, cy, r0, r1, a0, a1) {
    var large = a1 - a0 > Math.PI ? 1 : 0;
    var p1 = polar(cx, cy, r1, a0), p2 = polar(cx, cy, r1, a1), p3 = polar(cx, cy, r0, a1), p4 = polar(cx, cy, r0, a0);
    return 'M' + p1.x + ',' + p1.y + ' A' + r1 + ',' + r1 + ' 0 ' + large + ' 1 ' + p2.x + ',' + p2.y +
      ' L' + p3.x + ',' + p3.y + ' A' + r0 + ',' + r0 + ' 0 ' + large + ' 0 ' + p4.x + ',' + p4.y + ' Z';
  }

  /**
   * @param {string} focusId
   * @param {number} gens  rings including centre
   * @param {number} spanDeg 180 or 360
   */
  function layoutFan(focusId, gens, spanDeg) {
    var R0 = 54, RING = gens > 5 ? 58 : 66;
    var span = (spanDeg / 180) * Math.PI;
    var startA = spanDeg === 360 ? -Math.PI / 2 - span / 2 : Math.PI; // 180°: upper half from π to 2π
    var sectors = [];
    var centre = { id: focusId, person: S.person(focusId) };

    function place(id, gen, slot) {
      if (gen >= gens) return;
      var count = Math.pow(2, gen);
      var a0 = startA + (slot / count) * span, a1 = startA + ((slot + 1) / count) * span;
      var p = S.person(id);
      sectors.push({ id: id, person: p, gen: gen, slot: slot, a0: a0, a1: a1, r0: R0 + (gen - 1) * RING, r1: R0 + gen * RING, side: slot < count / 2 ? 'pat' : 'mat' });
      var par = S.parentsOf(id);
      if (par.father) place(par.father.id, gen + 1, slot * 2);
      if (par.mother) place(par.mother.id, gen + 1, slot * 2 + 1);
    }
    var par = S.parentsOf(focusId);
    if (par.father) place(par.father.id, 1, 0);
    if (par.mother) place(par.mother.id, 1, 1);
    var R = R0 + (gens - 1) * RING;
    var bb = spanDeg === 360 ? { x: -R, y: -R, width: 2 * R, height: 2 * R } : { x: -R, y: -R, width: 2 * R, height: R + R0 };
    return { centre: centre, sectors: sectors, R0: R0, bbox: bb };
  }

  function renderFan(g, layout, opts) {
    opts = opts || {};
    var cx = 0, cy = 0;
    layout.sectors.forEach(function (s) {
      var light = 78 + s.gen * 3;
      var fill = s.side === 'pat' ? 'hsl(210 45% ' + Math.min(92, light) + '%)' : 'hsl(345 45% ' + Math.min(92, light) + '%)';
      var sg = el('g', { 'class': 'fan-g' }, g);
      var path = el('path', { d: arcPath(cx, cy, s.r0, s.r1, s.a0, s.a1), 'class': 'fan-sector', fill: fill }, sg);
      if (s.id === opts.selectedId) {
        path.setAttribute('stroke', '#2a2724');
        path.setAttribute('stroke-width', '2.5');
      }
      var mid = (s.a0 + s.a1) / 2, rm = (s.r0 + s.r1) / 2;
      var pt = polar(cx, cy, rm, mid);
      var p = s.person;
      if (s.gen <= 2) {
        text(sg, pt.x, pt.y - 2, clip(p.given, 14), 'fan-text').setAttribute('font-weight', '700');
        text(sg, pt.x, pt.y + 11, clip(p.birthSurname || p.surname, 14), 'fan-text');
        text(sg, pt.x, pt.y + 23, years(p), 'fan-text fan-text--sm');
      } else {
        var deg = (mid * 180) / Math.PI;
        var flip = Math.cos(mid) < 0;
        var rot = flip ? deg + 180 : deg;
        var label = s.gen >= 5 ? (p.given[0] + '. ' + (p.birthSurname || p.surname)) : s.gen === 4 ? clip(p.given + ' ' + (p.birthSurname || p.surname), 16) : p.given + ' ' + (p.birthSurname || p.surname);
        var t = text(sg, pt.x, pt.y + 3, label, 'fan-text ' + (s.gen >= 5 ? 'fan-text--xs' : 'fan-text--sm'));
        t.setAttribute('transform', 'rotate(' + rot + ' ' + pt.x + ' ' + pt.y + ')');
        if (s.gen === 3) {
          var t2 = text(sg, pt.x, pt.y + 14, years(p), 'fan-text fan-text--xs');
          t2.setAttribute('transform', 'rotate(' + rot + ' ' + pt.x + ' ' + pt.y + ')');
          t2.setAttribute('fill', '#736d63');
        }
      }
      sg.addEventListener('click', function () {
        if (opts.onSelect) opts.onSelect(s);
      });
    });
    // centre
    var c = layout.centre;
    var cg = el('g', { 'class': 'fan-g node node--focus' }, g);
    el('circle', { cx: cx, cy: cy, r: layout.R0 - 4, fill: '#fff', stroke: '#4f7a45', 'stroke-width': 2.5 }, cg);
    text(cg, cx, cy - 2, clip(c.person.given, 10), 'fan-text').setAttribute('font-weight', '700');
    text(cg, cx, cy + 11, clip(c.person.birthSurname || c.person.surname, 10), 'fan-text');
    text(cg, cx, cy + 23, years(c.person), 'fan-text fan-text--sm');
    cg.addEventListener('click', function () {
      if (opts.onSelect) opts.onSelect({ id: c.id, person: c.person, gen: 0 });
    });
  }

  return {
    el: el, PanZoom: PanZoom,
    layoutPedigree: layoutPedigree, layoutDescendants: layoutDescendants, layoutFan: layoutFan,
    renderNodeChart: renderNodeChart, renderFan: renderFan
  };
})();
