/**
 * Fan chart SVG. Layout comes from LayoutFan.
 */
window.FanChart = (function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var F = window.Formatters;

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
  function given(p) {
    return ((p && (p.givenNames || p.given)) || '').split(/\s+/)[0] || '';
  }
  function sur(p) {
    return (p && (p.birthSurname || p.surname)) || '';
  }
  function polar(cx, cy, r, a) {
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  }
  function arcPath(cx, cy, r0, r1, a0, a1) {
    var large = a1 - a0 > Math.PI ? 1 : 0;
    var p1 = polar(cx, cy, r1, a0);
    var p2 = polar(cx, cy, r1, a1);
    var p3 = polar(cx, cy, r0, a1);
    var p4 = polar(cx, cy, r0, a0);
    return 'M' + p1.x + ',' + p1.y +
      ' A' + r1 + ',' + r1 + ' 0 ' + large + ' 1 ' + p2.x + ',' + p2.y +
      ' L' + p3.x + ',' + p3.y +
      ' A' + r0 + ',' + r0 + ' 0 ' + large + ' 0 ' + p4.x + ',' + p4.y + ' Z';
  }

  function render(g, layout, opts) {
    opts = opts || {};
    while (g.firstChild) g.removeChild(g.firstChild);
    var cx = 0;
    var cy = 0;
    (layout.sectors || []).forEach(function (s) {
      var light = Math.min(92, 76 + s.gen * 3);
      var fill = s.side === 'pat'
        ? 'hsl(210 42% ' + light + '%)'
        : 'hsl(345 42% ' + light + '%)';
      var sg = el('g', { 'class': 'fan-g', 'data-help': 'tree.personNode' }, g);
      var path = el('path', { d: arcPath(cx, cy, s.r0, s.r1, s.a0, s.a1), 'class': 'fan-sector', fill: fill }, sg);
      if (s.id === opts.selectedId) {
        path.setAttribute('stroke', '#2a2724');
        path.setAttribute('stroke-width', '2.5');
      }
      var mid = (s.a0 + s.a1) / 2;
      var rm = (s.r0 + s.r1) / 2;
      var pt = polar(cx, cy, rm, mid);
      var p = s.person || {};
      if (s.gen <= 2) {
        text(sg, pt.x, pt.y - 2, clip(given(p), 14), 'fan-text').setAttribute('font-weight', '700');
        text(sg, pt.x, pt.y + 11, clip(sur(p), 14), 'fan-text');
        text(sg, pt.x, pt.y + 23, F.lifespan(p), 'fan-text fan-text--sm');
      } else {
        var deg = (mid * 180) / Math.PI;
        var flip = Math.cos(mid) < 0;
        var rot = flip ? deg + 180 : deg;
        var full = given(p) + ' ' + sur(p);
        var label = s.gen >= 5 ? (given(p)[0] || '') + '. ' + sur(p) : s.gen === 4 ? clip(full, 16) : full;
        var t = text(sg, pt.x, pt.y + 3, label, 'fan-text ' + (s.gen >= 5 ? 'fan-text--xs' : 'fan-text--sm'));
        t.setAttribute('transform', 'rotate(' + rot + ' ' + pt.x + ' ' + pt.y + ')');
        if (s.gen === 3) {
          var t2 = text(sg, pt.x, pt.y + 14, F.lifespan(p), 'fan-text fan-text--xs');
          t2.setAttribute('transform', 'rotate(' + rot + ' ' + pt.x + ' ' + pt.y + ')');
        }
      }
      sg.addEventListener('click', function () {
        if (opts.onSelect) opts.onSelect(s);
      });
    });
    var c = layout.centre || {};
    var person = c.person || {};
    var cg = el('g', { 'class': 'fan-g', 'data-help': 'tree.personNode' }, g);
    el('circle', { cx: cx, cy: cy, r: layout.R0 - 4, 'class': 'fan-centre' }, cg);
    text(cg, cx, cy - 4, clip(given(person), 12), 'fan-text').setAttribute('font-weight', '700');
    text(cg, cx, cy + 10, clip(sur(person), 12), 'fan-text');
    text(cg, cx, cy + 22, F.lifespan(person), 'fan-text fan-text--sm');
    cg.addEventListener('click', function () {
      if (opts.onSelect) opts.onSelect({ id: c.id, person: person, gen: 0 });
    });
  }

  return { render: render };
})();
