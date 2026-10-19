window.FamilyTreeGallery = (function () {
  'use strict';

  function init() {
    var A = window.TreeAccess;
    var API = window.FamilyTreeAPI;
    var U = window.FamilyTreeUI;
    var F = window.Formatters;
    A.captureShareCode();
    if (!A.getShareCode()) {
      location.replace('index.html');
      return;
    }
    var kind = 'all';
    var q = '';
    var group = 'decade';
    var all = [];
    var treeName = '';

    API.lookupTree(A.getShareCode())
      .then(function (tree) {
        treeName = tree.name;
        return U.refreshMe();
      })
      .then(function () {
        U.renderShell({ title: 'Photos', subtitle: treeName });
        paint();
        return load();
      })
      .catch(function () {
        location.replace('index.html');
      });

    function paint() {
      var kinds = ['all'].concat(F.mediaKinds.map(function (k) { return k[0]; }));
      var main = U.$('.app-main');
      main.innerHTML =
        '<div class="gallery-toolbar">' +
        '<div class="search"><span class="ico">\uD83D\uDD0D</span><input type="search" id="q" placeholder="Search titles, places, people" autocomplete="off" /></div>' +
        '<div class="chip-row" id="kinds">' + kinds.map(function (k) {
          var label = k === 'all' ? 'All' : F.kindIcon(k) + ' ' + F.kindPlural(k);
          return '<span class="chip' + (k === kind ? ' is-active' : '') + '" data-k="' + k + '">' + label + '</span>';
        }).join('') + '</div>' +
        '<div class="sort-row"><span id="count"></span><span>Group by: <button class="btn btn--sm btn--ghost" type="button" id="groupBtn"></button></span></div>' +
        '</div><div id="grid"><p class="empty">Loading\u2026</p></div>' +
        '<button class="fab" id="fabAdd" type="button" aria-label="Add photo" title="Add photo">\uD83D\uDCF7</button>';
      U.$('#kinds').addEventListener('click', function (e) {
        var c = e.target.closest('[data-k]');
        if (!c) return;
        kind = c.getAttribute('data-k');
        U.$$('#kinds .chip').forEach(function (x) {
          x.classList.toggle('is-active', x === c);
        });
        render();
      });
      U.$('#q').addEventListener('input', function (e) {
        q = e.target.value;
        render();
      });
      U.$('#groupBtn').addEventListener('click', function () {
        group = group === 'decade' ? 'person' : group === 'person' ? 'kind' : group === 'kind' ? 'none' : 'decade';
        render();
      });
      U.$('#fabAdd').addEventListener('click', function () {
        window.MediaUploader.open({
          onDone: function () { load(); }
        });
      });
    }

    function load() {
      return API.listMedia({ limit: 500 }).then(function (data) {
        all = (data && data.media) || [];
        render();
      }).catch(function (err) {
        U.$('#grid').innerHTML = '<p class="empty">' + U.esc(err.message || 'Could not load photos') + '</p>';
      });
    }

    function yearOf(m) {
      if (m.dateSort) return Number(String(m.dateSort).slice(0, 4));
      var match = String(m.dateText || '').match(/\d{4}/);
      return match ? Number(match[0]) : null;
    }

    function filtered() {
      var ql = q.trim().toLowerCase();
      return all.filter(function (m) {
        if (kind !== 'all' && m.kind !== kind) return false;
        if (!ql) return true;
        var people = (m.people || []).map(function (p) {
          return (p.givenNames || '') + ' ' + (p.surname || '');
        }).join(' ');
        var blob = [m.title, m.caption, m.placeText, m.dateText, people].join(' ').toLowerCase();
        return blob.indexOf(ql) >= 0;
      }).sort(function (a, b) {
        var ya = yearOf(a) || 9999;
        var yb = yearOf(b) || 9999;
        if (ya !== yb) return ya - yb;
        return String(a.title || '').localeCompare(String(b.title || ''));
      });
    }

    function groupLabel() {
      if (group === 'decade') return 'Decade';
      if (group === 'person') return 'Person';
      if (group === 'kind') return 'Kind';
      return 'None';
    }

    function render() {
      if (!U.$('#grid')) return;
      var list = filtered();
      U.$('#count').textContent = list.length + (list.length === 1 ? ' item' : ' items');
      U.$('#groupBtn').textContent = groupLabel();
      var html = '';
      if (!list.length) {
        html = '<p class="empty">' + (all.length ? 'Nothing matches.' : 'No photos yet. Add one with the camera button.') + '</p>';
      } else if (group === 'none') {
        html = '<div class="media-grid media-grid--wide" data-grid>' + list.map(window.Lightbox.tile).join('') + '</div>';
      } else {
        var groups = {};
        var order = [];
        function add(key, m) {
          if (!groups[key]) {
            groups[key] = [];
            order.push(key);
          }
          groups[key].push(m);
        }
        list.forEach(function (m) {
          if (group === 'decade') {
            var y = yearOf(m);
            add(y ? Math.floor(y / 10) * 10 + 's' : 'Undated', m);
          } else if (group === 'kind') {
            add(F.kindPlural(m.kind), m);
          } else {
            var people = m.people || [];
            if (!people.length) add('Untagged', m);
            else people.forEach(function (p) { add(F.shortName(p) || 'Unknown', m); });
          }
        });
        if (group !== 'decade') {
          order.sort(function (a, b) {
            if (a === 'Untagged') return 1;
            if (b === 'Untagged') return -1;
            return a.localeCompare(b);
          });
        } else {
          order.sort(function (a, b) {
            if (a === 'Undated') return 1;
            if (b === 'Undated') return -1;
            return a.localeCompare(b);
          });
        }
        order.forEach(function (key) {
          html += '<div class="list-head"><h3>' + U.esc(key) + '</h3><span class="muted small">' + groups[key].length + '</span></div>' +
            '<div class="media-grid media-grid--wide" data-grid>' + groups[key].map(window.Lightbox.tile).join('') + '</div>';
        });
      }
      U.$('#grid').innerHTML = html;
      U.$$('[data-grid]').forEach(function (gEl) {
        window.Lightbox.bind(gEl, list, { onChange: function () { load(); } });
      });
    }
  }

  return { init: init };
})();
