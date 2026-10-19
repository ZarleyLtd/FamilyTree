window.FamilyTreeTree = (function () {
  'use strict';

  function qs(name) {
    return new URLSearchParams(location.search).get(name);
  }

  function init() {
    var A = window.TreeAccess;
    var API = window.FamilyTreeAPI;
    var U = window.FamilyTreeUI;
    var F = window.Formatters;
    var LayoutP = window.LayoutPedigree;
    var LayoutD = window.LayoutDescendants;
    var LayoutH = window.LayoutHourglass;
    var LayoutF = window.LayoutFan;
    var Pedigree = window.PedigreeChart;
    var Descendants = window.DescendantsChart;
    var Fan = window.FanChart;
    A.captureShareCode();
    if (!A.getShareCode()) {
      location.replace('index.html');
      return;
    }

    var focusId = qs('id') || '';
    var view = qs('view') || 'pedigree';
    if (['pedigree', 'descendants', 'hourglass', 'fan'].indexOf(view) < 0) view = 'pedigree';
    var gens = parseInt(qs('gens'), 10) || (view === 'fan' ? 5 : 4);
    var span = parseInt(qs('span'), 10) === 360 ? 360 : 180;
    var selected = null;
    var collapsed = {};
    var pz = null;
    var lastBBox = null;
    var lastLayout = null;
    var focusBox = null;
    var bundle = null;
    var graph = null;
    var me = null;

    API.lookupTree(A.getShareCode())
      .then(function (tree) {
        return U.refreshMe().then(function (who) {
          me = who;
          U.renderShell({ title: 'Tree', subtitle: tree.name, search: false });
          build();
          if (!focusId) {
            return API.listPersons({ limit: 1 }).then(function (data) {
              var first = data.persons && data.persons[0];
              focusId = (me && me.selfPersonId) || (tree.settings && tree.settings.homePersonId) || (first && first.id) || '';
            });
          }
        });
      })
      .then(function () {
        if (!focusId) {
          U.$('#chartWrap').insertAdjacentHTML(
            'afterbegin',
            '<p class="empty" style="padding:1rem">Add a person first, then open the chart from their profile.</p>'
          );
          return;
        }
        return load();
      })
      .catch(function () {
        location.replace('index.html');
      });

    function genMin() {
      return view === 'fan' ? 3 : 2;
    }
    function genMax() {
      if (view === 'fan') return 6;
      if (view === 'hourglass') return 5;
      return 6;
    }
    function clampGens() {
      gens = Math.max(genMin(), Math.min(genMax(), gens));
    }

    function build() {
      var main = U.$('.app-main');
      main.classList.add('app-main--flush');
      main.innerHTML =
        '<div class="tree-page">' +
        '<div class="tree-toolbar">' +
        '<div class="seg" id="viewSeg" data-help="tree.view">' +
        '<button type="button" data-value="pedigree">Ancestors</button>' +
        '<button type="button" data-value="descendants">Descendants</button>' +
        '<button type="button" data-value="hourglass">Hourglass</button>' +
        '<button type="button" data-value="fan">Fan</button></div>' +
        '<button class="tree-focus" type="button" id="focusBtn" title="Change focus person" data-help="tree.focus"></button>' +
        '<div class="seg" id="spanSeg" data-help="tree.span">' +
        '<button type="button" data-value="180">180\u00b0</button>' +
        '<button type="button" data-value="360">360\u00b0</button></div>' +
        '<div class="stepper" title="Generations" data-help="tree.gens"><button type="button" id="genMinus" aria-label="Fewer generations">\u2212</button><span id="genLabel"></span><button type="button" id="genPlus" aria-label="More generations">+</button></div>' +
        '<button class="btn btn--sm" type="button" id="shareChart" data-help="tree.share">Share</button>' +
        '</div>' +
        '<div class="chart-wrap" id="chartWrap" data-help="tree.chart">' +
        '<svg id="chart" xmlns="http://www.w3.org/2000/svg"><g id="chartG"></g></svg>' +
        '<div class="legend" id="legend" data-help="tree.legend"><span class="pat">Paternal line</span><span class="mat">Maternal line</span></div>' +
        '<div class="chart-controls">' +
        '<button class="btn" type="button" id="zoomIn" aria-label="Zoom in" data-help="tree.zoomIn">+</button>' +
        '<button class="btn" type="button" id="zoomOut" aria-label="Zoom out" data-help="tree.zoomOut">\u2212</button>' +
        '<button class="btn" type="button" id="fit" aria-label="Fit to screen" title="Fit to screen" data-help="tree.fit">\u2194</button>' +
        '<button class="btn" type="button" id="recentre" aria-label="Recentre" title="Recentre" data-help="tree.recentre">\u25CE</button></div>' +
        '<div class="chart-info hidden" id="info" data-help="tree.chartInfo"></div></div></div>';
      var svg = U.$('#chart');
      var g = U.$('#chartG');
      pz = new Pedigree.PanZoom(svg, g);
      U.bindSeg(U.$('#viewSeg'), function (v) {
        view = v;
        clampGens();
        selected = null;
        collapsed = {};
        U.$('#info').classList.add('hidden');
        load();
      });
      U.bindSeg(U.$('#spanSeg'), function (v) {
        span = parseInt(v, 10) === 360 ? 360 : 180;
        load();
      });
      U.$('#focusBtn').onclick = function () {
        U.openPersonPicker('Centre the tree on\u2026', function (x) {
          focusId = x.id;
          selected = null;
          collapsed = {};
          load();
        });
      };
      U.$('#genMinus').onclick = function () {
        if (gens > genMin()) {
          gens -= 1;
          load();
        }
      };
      U.$('#genPlus').onclick = function () {
        if (gens < genMax()) {
          gens += 1;
          load();
        }
      };
      U.$('#zoomIn').onclick = function () { pz.zoomIn(); };
      U.$('#zoomOut').onclick = function () { pz.zoomOut(); };
      U.$('#fit').onclick = function () {
        if (lastBBox) pz.fit(lastBBox);
      };
      U.$('#recentre').onclick = function () {
        if (focusBox) pz.centerOn(focusBox);
        else if (lastBBox) pz.fit(lastBBox);
      };
      U.$('#shareChart').onclick = function () {
        U.copyPageLink(U.$('#shareChart'));
      };
    }

    function syncChrome() {
      U.$$('#viewSeg button').forEach(function (b) {
        b.setAttribute('aria-pressed', b.dataset.value === view ? 'true' : 'false');
      });
      U.$$('#spanSeg button').forEach(function (b) {
        b.setAttribute('aria-pressed', String(span) === b.dataset.value ? 'true' : 'false');
      });
      U.$('#spanSeg').classList.toggle('hidden', view !== 'fan');
      U.$('#legend').classList.toggle('hidden', view !== 'fan');
      U.$('#genLabel').textContent = gens + ' gens';
    }

    function syncUrl() {
      var u = new URL(location.href);
      u.searchParams.set('id', focusId);
      u.searchParams.set('view', view);
      u.searchParams.set('gens', String(gens));
      if (view === 'fan') u.searchParams.set('span', String(span));
      else u.searchParams.delete('span');
      if (A.getShareCode()) u.searchParams.set('t', A.getShareCode());
      history.replaceState(null, '', u);
    }

    function layoutNow() {
      graph = window.FamilyGraph.fromBundle(bundle);
      var opts = { collapsed: collapsed };
      if (view === 'descendants') {
        lastLayout = LayoutD.layoutDescendants(focusId, gens, graph, opts);
      } else if (view === 'hourglass') {
        lastLayout = LayoutH.layoutHourglass(focusId, gens, gens, graph, opts);
      } else if (view === 'fan') {
        lastLayout = LayoutF.layoutFan(focusId, gens, span, graph);
      } else {
        var orient = window.innerWidth >= 760 ? 'h' : 'v';
        lastLayout = LayoutP.layoutPedigree(focusId, gens, orient, graph);
      }
      lastBBox = lastLayout.bbox;
      focusBox = null;
      if (view === 'fan') {
        focusBox = { x: -40, y: -40, width: 80, height: 80 };
      } else {
        (lastLayout.nodes || []).some(function (n) {
          if (n.id === focusId && !n.placeholder) {
            focusBox = { x: n.x, y: n.y, width: n.w, height: n.h };
            return true;
          }
          return false;
        });
      }
    }

    function draw() {
      if (!bundle || !lastLayout) return;
      var g = U.$('#chartG');
      if (view === 'fan') {
        Fan.render(g, lastLayout, {
          selectedId: selected,
          onSelect: function (s) {
            if (pz.dragged) return;
            if (s.id && s.id !== focusId) {
              focusId = s.id;
              selected = null;
              U.$('#info').classList.add('hidden');
              load();
              return;
            }
            select(s.id);
          }
        });
        return;
      }
      var hooks = {
        focusId: focusId,
        selectedId: selected,
        dragged: function () { return pz.dragged; },
        onSelect: function (n) {
          if (pz.dragged) return;
          select(n.id);
        },
        onToggle: function (n) {
          if (collapsed[n.id]) delete collapsed[n.id];
          else collapsed[n.id] = true;
          layoutNow();
          draw();
        },
        onExpand: function (n) {
          focusId = n.id;
          selected = null;
          collapsed = {};
          if (gens < genMax()) gens += 1;
          load();
        },
        onPlaceholder: function (n) {
          if (pz.dragged) return;
          if (!U.requireContributor()) return;
          var child = graph.person(n.forId);
          U.openPersonForm({
            title: 'Add ' + n.placeholder + ' of ' + F.shortName(child),
            defaultSex: n.placeholder === 'father' ? 'M' : 'F',
            defaultSurname: n.placeholder === 'father' ? (child && child.surname) || '' : '',
            onSave: function (payload) {
              API.addParentToPerson({
                childId: n.forId,
                parent: { new: payload.person, birth: payload.birth, death: payload.death },
                sex: n.placeholder === 'father' ? 'M' : 'F'
              })
                .then(load)
                .then(function () {
                  U.brief('Added ' + payload.person.givenNames);
                })
                .catch(function (err) {
                  U.brief(err.message);
                });
            }
          });
        }
      };
      if (view === 'pedigree') Pedigree.render(g, lastLayout, hooks);
      else Descendants.render(g, lastLayout, hooks);
    }

    function load() {
      clampGens();
      syncChrome();
      var req;
      if (view === 'descendants') req = API.getDescendants(focusId, gens);
      else if (view === 'hourglass') req = API.getHourglass(focusId, gens, gens);
      else req = API.getPedigree(focusId, gens);
      return req.then(function (data) {
        bundle = data;
        var focus = (data.persons || []).filter(function (p) { return p.id === focusId; })[0];
        document.title =
          (view === 'fan' ? 'Fan' : view === 'descendants' ? 'Descendants' : view === 'hourglass' ? 'Hourglass' : 'Ancestors') +
          ' \u00b7 Family Tree';
        U.$('#focusBtn').innerHTML =
          (focus ? U.avatar(focus, 'sm') : '') +
          '<span>' +
          U.esc(focus ? F.shortName(focus) : 'Choose someone') +
          '</span> <span class="muted">\u25BE</span>';
        layoutNow();
        draw();
        pz.fit(lastBBox);
        syncUrl();
      }).catch(function (err) {
        U.brief(err.message || 'Could not load the chart');
      });
    }

    function select(id) {
      selected = id;
      var person = graph && graph.person(id);
      if (!person) return;
      var info = U.$('#info');
      info.classList.remove('hidden');
      info.innerHTML =
        U.avatar(person) +
        '<div class="chart-info__body"><div class="chart-info__name">' +
        U.esc(F.fullName(person)) +
        '</div><div class="muted small">' +
        U.esc(F.lifeLine(person) || 'No dates') +
        '</div></div>' +
        '<div class="btn-row" style="flex-wrap:nowrap">' +
        (id !== focusId ? '<button class="btn btn--sm" type="button" id="infoCentre" data-help="tree.infoCentre">Centre</button>' : '') +
        '<a class="btn btn--sm btn--primary" href="person.html?id=' +
        id +
        '" data-help="tree.infoProfile">Profile</a>' +
        '<button class="btn btn--sm btn--icon" type="button" id="infoClose" aria-label="Close">\u2715</button></div>';
      var c = U.$('#infoCentre');
      if (c) {
        c.onclick = function () {
          focusId = id;
          selected = null;
          collapsed = {};
          info.classList.add('hidden');
          load();
        };
      }
      U.$('#infoClose').onclick = function () {
        selected = null;
        info.classList.add('hidden');
        draw();
      };
      draw();
    }

    var resizeTimer = null;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (!bundle) return;
        layoutNow();
        draw();
        pz.fit(lastBBox);
      }, 120);
    });
  }

  return { init: init };
})();
