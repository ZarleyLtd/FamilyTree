/**
 * SVG for descendant and hourglass charts. Layout comes from LayoutDescendants / LayoutHourglass.
 */
window.DescendantsChart = (function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var F = window.Formatters;
  var PW = 112;
  var PGAP = 8;

  function el(name, attrs, parent) {
    var node = document.createElementNS(NS, name);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        node.setAttribute(k, attrs[k]);
      });
    }
    if (parent) parent.appendChild(node);
    return node;
  }
  function text(parent, x, y, str, cls) {
    var t = el('text', { x: x, y: y, 'class': cls || '', 'text-anchor': 'middle' }, parent);
    t.textContent = str;
    return t;
  }
  function clip(s, n) {
    s = String(s || '');
    return s.length > n ? s.slice(0, n - 1) + '\u2026' : s;
  }
  function labelOf(p) {
    var given = ((p && p.givenNames) || '').split(/\s+/)[0] || '';
    return (given + ' ' + ((p && (p.birthSurname || p.surname)) || '')).trim();
  }

  function linkPath(a, b) {
    var upper = (a.y + a.h / 2) <= (b.y + b.h / 2) ? a : b;
    var lower = upper === a ? b : a;
    var x1 = upper.x + upper.w / 2;
    var y1 = upper.y + upper.h;
    var x2 = lower.x + lower.w / 2;
    var y2 = lower.y;
    var my = (y1 + y2) / 2;
    return 'M' + x1 + ',' + y1 + ' V' + my + ' H' + x2 + ' V' + y2;
  }

  function drawCard(parent, n, opts, x, y, w, h) {
    var p = n.person || {};
    var cls = 'node node--' + (p.sex || 'U');
    if (n.id === opts.focusId) cls += ' node--focus';
    if (n.id === opts.selectedId) cls += ' node--selected';
    if (n.partnerOf) cls += ' node--partner';
    var g = el('g', { 'class': cls, transform: 'translate(' + x + ',' + y + ')', 'data-help': 'tree.personNode' }, parent);
    el('rect', { width: w, height: h, rx: 10 }, g);
    var nameMax = w > 124 ? 16 : 14;
    text(g, w / 2, 20, clip(labelOf(p), nameMax), 'n-name');
    text(g, w / 2, 36, F.lifespan(p), 'n-years');
    g.addEventListener('click', function () {
      if (opts.onSelect) opts.onSelect(n);
    });
    return g;
  }

  function render(g, layout, opts) {
    opts = opts || {};
    while (g.firstChild) g.removeChild(g.firstChild);
    var edgesG = el('g', null, g);
    var nodesG = el('g', null, g);
    (layout.edges || []).forEach(function (e) {
      if (!e.from || !e.to) return;
      var path = el('path', { d: linkPath(e.from, e.to), 'class': 'edge' }, edgesG);
      if (e.dashed) path.setAttribute('stroke-dasharray', '4 3');
    });
    (layout.nodes || []).forEach(function (n) {
      if (n.placeholder) {
        var ph = el('g', { 'class': 'node node--ph', transform: 'translate(' + n.x + ',' + n.y + ')', 'data-help': 'tree.placeholder' }, nodesG);
        el('rect', { width: n.w, height: n.h, rx: 10 }, ph);
        text(ph, n.w / 2, n.h / 2 + 4, '+ Add ' + n.placeholder, '');
        ph.addEventListener('click', function () {
          if (opts.onPlaceholder) opts.onPlaceholder(n);
        });
        return;
      }
      drawCard(nodesG, n, opts, n.x, n.y, n.w, n.h);
      (n.partners || []).forEach(function (pt, i) {
        var px = n.x + n.w + PGAP + i * (PW + PGAP);
        var py = n.y;
        var path = el('path', {
          d: 'M' + (n.x + n.w) + ',' + (n.y + n.h / 2) + ' H' + px,
          'class': 'edge edge--union'
        }, edgesG);
        path.setAttribute('stroke-dasharray', '2 3');
        drawCard(nodesG, { id: pt.id, person: pt.person, partnerOf: n.id }, opts, px, py, PW, n.h);
      });
      if (n.childCount) {
        var expanded = !n.collapsed && !n.depthLimited;
        var badge = el('g', { 'class': 'node-toggle', transform: 'translate(' + (n.x + n.w / 2) + ',' + (n.y + n.h) + ')', 'data-help': 'tree.collapse' }, nodesG);
        el('circle', { r: 16, cy: 10, 'class': 'node-toggle__hit' }, badge);
        el('circle', { r: 11, cy: 10, 'class': 'node-toggle__face' }, badge);
        text(badge, 0, 14, expanded ? '\u2212' : '+' + (n.hiddenCount || n.childCount), 'n-toggle');
        badge.addEventListener('click', function (ev) {
          ev.stopPropagation();
          if (opts.dragged && opts.dragged()) return;
          if (n.depthLimited && opts.onExpand) opts.onExpand(n);
          else if (opts.onToggle) opts.onToggle(n);
        });
      }
    });
  }

  return { render: render };
})();
