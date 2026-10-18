(function () {
  'use strict';
  var S = window.MockStore, U = window.MockUI, C = window.Charts;

  var focusId = U.qs('id') || S.me().self || S.tree.homePerson;
  var view = U.qs('view') || 'pedigree';
  var gens = parseInt(U.qs('gens'), 10) || (view === 'fan' ? 5 : 4);
  var span = 180;
  var selected = null;

  var svg = U.$('#chart'), g = U.$('#chartG');
  var pz = new C.PanZoom(svg, g);
  var lastBBox = null;

  U.renderShell({ title: 'Tree', search: false });

  function syncUrl() {
    var u = new URL(location.href);
    u.searchParams.set('id', focusId);
    u.searchParams.set('view', view);
    u.searchParams.set('gens', gens);
    history.replaceState(null, '', u);
  }

  function render() {
    var focus = S.person(focusId);
    document.title = (view === 'fan' ? 'Fan chart' : view === 'descendants' ? 'Descendants' : 'Ancestors') + ' of ' + S.shortName(focus) + ' · mockup';
    U.$('#focusBtn').innerHTML = U.avatar(focus, 'sm') + '<span>' + U.esc(S.shortName(focus)) + '</span> <span class="muted">▾</span>';
    U.$('#genLabel').textContent = gens + ' gens';
    U.$('#spanSeg').classList.toggle('hidden', view !== 'fan');
    U.$('#legend').classList.toggle('hidden', view === 'descendants');
    U.$$('#viewSeg button').forEach(function (b) {
      b.setAttribute('aria-pressed', b.dataset.value === view ? 'true' : 'false');
    });
    while (g.firstChild) g.removeChild(g.firstChild);

    var layout;
    if (view === 'fan') {
      layout = C.layoutFan(focusId, gens, span);
      C.renderFan(g, layout, { selectedId: selected, onSelect: function (s) {
        if (pz.dragged) return;
        select(s.id);
      } });
    } else {
      var orient = view === 'descendants' ? 'v' : (window.innerWidth >= 760 ? 'h' : 'v');
      layout = view === 'descendants' ? C.layoutDescendants(focusId, gens) : C.layoutPedigree(focusId, gens, orient);
      C.renderNodeChart(g, layout, {
        focusId: focusId, selectedId: selected, down: view === 'descendants',
        onSelect: function (n) {
          if (pz.dragged) return;
          select(n.id);
        },
        onPlaceholder: function (n) {
          if (pz.dragged) return;
          var child = S.person(n.forId);
          U.openPersonForm({
            title: 'Add ' + n.placeholder + ' of ' + S.shortName(child),
            defaultSex: n.placeholder === 'father' ? 'M' : 'F',
            defaultSurname: n.placeholder === 'father' ? child.surname : '',
            onSave: function (input) {
              S.addParent(child.id, input);
              render();
              U.brief('Added ' + input.given + ' ' + input.surname);
            }
          });
        }
      });
    }
    lastBBox = layout.bbox;
    syncUrl();
  }

  function select(id) {
    selected = id;
    var p = S.person(id);
    var info = U.$('#info');
    info.classList.remove('hidden');
    info.innerHTML = U.avatar(p) + '<div class="chart-info__body"><div class="chart-info__name">' + U.esc(S.fullName(p)) + '</div><div class="muted small">' + U.esc(U.lifeLine(p) || 'No dates') + '</div></div>' +
      '<div class="btn-row" style="flex-wrap:nowrap">' + (id !== focusId ? '<button class="btn btn--sm" id="infoCentre">Centre</button>' : '') + '<a class="btn btn--sm btn--primary" href="person.html?id=' + id + '">Profile</a><button class="btn btn--sm btn--icon" id="infoClose" aria-label="Close">✕</button></div>';
    var c = U.$('#infoCentre');
    if (c) c.onclick = function () {
      focusId = id;
      selected = null;
      info.classList.add('hidden');
      render();
      pz.fit(lastBBox);
    };
    U.$('#infoClose').onclick = function () {
      selected = null;
      info.classList.add('hidden');
      render();
    };
    render();
  }

  U.bindSeg(U.$('#viewSeg'), function (v) {
    view = v;
    if (view === 'fan' && gens < 4) gens = 5;
    if (view !== 'fan' && gens > 6) gens = 5;
    selected = null;
    U.$('#info').classList.add('hidden');
    render();
    pz.fit(lastBBox);
  });
  U.bindSeg(U.$('#spanSeg'), function (v) {
    span = parseInt(v, 10);
    render();
    pz.fit(lastBBox);
  });
  U.$('#genMinus').onclick = function () {
    gens = Math.max(2, gens - 1);
    render();
    pz.fit(lastBBox);
  };
  U.$('#genPlus').onclick = function () {
    gens = Math.min(view === 'fan' ? 7 : 6, gens + 1);
    render();
    pz.fit(lastBBox);
  };
  U.$('#focusBtn').onclick = function () {
    U.openPersonPicker('Centre the chart on…', function (p) {
      focusId = p.id;
      selected = null;
      render();
      pz.fit(lastBBox);
    });
  };
  U.$('#zoomIn').onclick = pz.zoomIn;
  U.$('#zoomOut').onclick = pz.zoomOut;
  U.$('#fit').onclick = function () {
    pz.fit(lastBBox);
  };
  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () {
      render();
      pz.fit(lastBBox);
    }, 150);
  });

  render();
  pz.fit(lastBBox);
})();
