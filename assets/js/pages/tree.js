window.FamilyTreeTree = (function () {
  'use strict';

  function qs(name) {
    return new URLSearchParams(location.search).get(name);
  }

  function graphFromPedigree(data) {
    var byId = {};
    (data.persons || []).forEach(function (p) {
      byId[p.id] = p;
    });
    var parents = {};
    (data.families || []).forEach(function (f) {
      (f.children || []).forEach(function (c) {
        var cur = parents[c.id] || { fatherId: null, motherId: null };
        var p1 = f.partner1Id && byId[f.partner1Id];
        var p2 = f.partner2Id && byId[f.partner2Id];
        [p1, p2].forEach(function (x) {
          if (!x) return;
          if (x.sex === 'F' && !cur.motherId) cur.motherId = x.id;
          else if (x.sex === 'M' && !cur.fatherId) cur.fatherId = x.id;
          else if (!cur.fatherId) cur.fatherId = x.id;
          else cur.motherId = x.id;
        });
        parents[c.id] = cur;
      });
    });
    return {
      person: function (id) {
        return byId[id] || null;
      },
      parentsOf: function (id) {
        return parents[id] || { fatherId: null, motherId: null };
      }
    };
  }

  function init() {
    var A = window.TreeAccess;
    var API = window.FamilyTreeAPI;
    var U = window.FamilyTreeUI;
    var F = window.Formatters;
    var Layout = window.LayoutPedigree;
    var Chart = window.PedigreeChart;
    A.captureShareCode();
    if (!A.getShareCode()) {
      location.replace('index.html');
      return;
    }

    var focusId = qs('id') || '';
    var view = qs('view') || 'pedigree';
    var gens = parseInt(qs('gens'), 10) || 4;
    var selected = null;
    var pz = null;
    var lastBBox = null;
    var lastLayout = null;
    var pedigree = null;
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
            '<p class="empty" style="padding:1rem">Add a person first, then open the pedigree from their profile.</p>'
          );
          return;
        }
        return load();
      })
      .catch(function () {
        location.replace('index.html');
      });

    function build() {
      var main = U.$('.app-main');
      main.classList.add('app-main--flush');
      main.innerHTML =
        '<div class="tree-page">' +
        '<div class="tree-toolbar">' +
        '<div class="seg" id="viewSeg">' +
        '<button type="button" data-value="pedigree" aria-pressed="true">Ancestors</button>' +
        '<button type="button" data-value="descendants" aria-pressed="false">Descendants</button>' +
        '<button type="button" data-value="fan" aria-pressed="false">Fan</button></div>' +
        '<button class="tree-focus" type="button" id="focusBtn" title="Change focus person"></button>' +
        '<div class="stepper" title="Generations"><button type="button" id="genMinus" aria-label="Fewer generations">\u2212</button><span id="genLabel"></span><button type="button" id="genPlus" aria-label="More generations">+</button></div>' +
        '</div>' +
        '<div class="chart-wrap" id="chartWrap">' +
        '<svg id="chart" xmlns="http://www.w3.org/2000/svg"><g id="chartG"></g></svg>' +
        '<div class="chart-controls">' +
        '<button class="btn" type="button" id="zoomIn" aria-label="Zoom in">+</button>' +
        '<button class="btn" type="button" id="zoomOut" aria-label="Zoom out">\u2212</button>' +
        '<button class="btn" type="button" id="fit" aria-label="Fit to screen" title="Fit to screen">\u2194</button></div>' +
        '<div class="chart-info hidden" id="info"></div></div></div>';
      var svg = U.$('#chart');
      var g = U.$('#chartG');
      pz = new Chart.PanZoom(svg, g);
      U.bindSeg(U.$('#viewSeg'), function (v) {
        if (v !== 'pedigree') {
          U.brief('That chart arrives in Phase 3');
          U.$$('#viewSeg button').forEach(function (b) {
            b.setAttribute('aria-pressed', b.dataset.value === 'pedigree' ? 'true' : 'false');
          });
          return;
        }
        view = v;
        load();
      });
      U.$('#focusBtn').onclick = function () {
        U.openPersonPicker('Centre the tree on…', function (x) {
          focusId = x.id;
          selected = null;
          load();
        });
      };
      U.$('#genMinus').onclick = function () {
        if (gens > 2) {
          gens -= 1;
          load();
        }
      };
      U.$('#genPlus').onclick = function () {
        if (gens < 6) {
          gens += 1;
          load();
        }
      };
      U.$('#zoomIn').onclick = function () {
        pz.zoomIn();
      };
      U.$('#zoomOut').onclick = function () {
        pz.zoomOut();
      };
      U.$('#fit').onclick = function () {
        if (lastBBox) pz.fit(lastBBox);
      };
    }

    function syncUrl() {
      var u = new URL(location.href);
      u.searchParams.set('id', focusId);
      u.searchParams.set('view', 'pedigree');
      u.searchParams.set('gens', String(gens));
      history.replaceState(null, '', u);
    }

    function draw() {
      if (!pedigree || !lastLayout) return;
      Chart.render(U.$('#chartG'), lastLayout, {
        focusId: focusId,
        selectedId: selected,
        onSelect: function (n) {
          if (pz.dragged) return;
          select(n.id);
        },
        onPlaceholder: function (n) {
          if (pz.dragged) return;
          if (!U.requireContributor()) return;
          var child = graphFromPedigree(pedigree).person(n.forId);
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
      });
    }

    function layoutNow() {
      var orient = window.innerWidth >= 760 ? 'h' : 'v';
      lastLayout = Layout.layoutPedigree(focusId, gens, orient, graphFromPedigree(pedigree));
      lastBBox = lastLayout.bbox;
    }

    function load() {
      U.$('#genLabel').textContent = gens + ' gens';
      return API.getPedigree(focusId, gens).then(function (data) {
        pedigree = data;
        var focus = (data.persons || []).filter(function (p) {
          return p.id === focusId;
        })[0];
        U.$('#focusBtn').innerHTML =
          (focus ? U.avatar(focus, 'sm') : '') +
          '<span>' +
          U.esc(focus ? F.shortName(focus) : 'Choose someone') +
          '</span> <span class="muted">\u25BE</span>';
        layoutNow();
        draw();
        pz.fit(lastBBox);
        syncUrl();
      });
    }

    function select(id) {
      selected = id;
      var person = graphFromPedigree(pedigree).person(id);
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
        (id !== focusId ? '<button class="btn btn--sm" type="button" id="infoCentre">Centre</button>' : '') +
        '<a class="btn btn--sm btn--primary" href="person.html?id=' +
        id +
        '">Profile</a>' +
        '<button class="btn btn--sm btn--icon" type="button" id="infoClose" aria-label="Close">\u2715</button></div>';
      var c = U.$('#infoCentre');
      if (c) {
        c.onclick = function () {
          focusId = id;
          selected = null;
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
        if (!pedigree) return;
        layoutNow();
        draw();
        pz.fit(lastBBox);
      }, 120);
    });
  }

  return { init: init };
})();
