/**
 * Pedigree SVG render + pan/zoom. Layout comes from LayoutPedigree.
 */
window.PedigreeChart = (function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var F = window.Formatters;

  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        e.setAttribute(k, attrs[k]);
      });
    }
    if (parent) parent.appendChild(e);
    return e;
  }
  function text(parent, x, y, str, cls, anchor) {
    var t = el('text', { x: x, y: y, 'class': cls || '', 'text-anchor': anchor || 'middle' }, parent);
    t.textContent = str;
    return t;
  }
  function clip(s, n) {
    s = String(s || '');
    return s.length > n ? s.slice(0, n - 1) + '\u2026' : s;
  }
  function years(p) {
    if (!p) return '';
    return F.lifespan(p);
  }

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
    svg.addEventListener(
      'wheel',
      function (e) {
        e.preventDefault();
        var r = svg.getBoundingClientRect();
        zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - r.left, e.clientY - r.top);
      },
      { passive: false }
    );
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
      return {
        dist: Math.hypot(dx, dy),
        s: s,
        tx: tx,
        ty: ty,
        cx: (pts[0].x + pts[1].x) / 2,
        cy: (pts[0].y + pts[1].y) / 2
      };
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
      if (!bbox || !bbox.width || !bbox.height) return;
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
    this.centerOn = function (box) {
      if (!box || !box.width) return;
      var r = svg.getBoundingClientRect();
      var cx = box.x + box.width / 2;
      var cy = box.y + box.height / 2;
      tx = r.width / 2 - cx * s;
      ty = r.height / 2 - cy * s;
      apply();
    };
    apply();
  }

  function render(g, layout, opts) {
    opts = opts || {};
    while (g.firstChild) g.removeChild(g.firstChild);
    var edgesG = el('g', null, g);
    var nodesG = el('g', null, g);
    var horiz = layout.orient === 'h';
    layout.edges.forEach(function (e) {
      var a = e.from, b = e.to, d;
      if (horiz) {
        var x1 = a.x + a.w, y1 = a.y + a.h / 2, x2 = b.x, y2 = b.y + b.h / 2, mx = (x1 + x2) / 2;
        d = 'M' + x1 + ',' + y1 + ' H' + mx + ' V' + y2 + ' H' + x2;
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
        cls += ' node--' + ((n.person && n.person.sex) || 'U');
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
      var p = n.person || {};
      var nameMax = n.w > 140 ? 20 : 16;
      var label = (p.givenNames || '').split(/\s+/)[0] + ' ' + (p.birthSurname || p.surname || '');
      text(ng, n.w / 2, 18, clip(label, nameMax), 'n-name');
      text(ng, n.w / 2, 34, years(p), 'n-years');
      ng.addEventListener('click', function () {
        if (opts.onSelect) opts.onSelect(n);
      });
    });
  }

  return { PanZoom: PanZoom, render: render };
})();
