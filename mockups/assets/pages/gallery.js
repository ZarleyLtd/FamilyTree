(function () {
  'use strict';
  var S = window.MockStore, U = window.MockUI;
  U.renderShell({ title: 'Photos & documents', search: false });

  var kind = 'all', q = '', group = 'decade';
  var kinds = ['all', 'photo', 'portrait', 'document', 'census', 'certificate', 'homestead', 'grave'];

  function renderKinds() {
    U.$('#kinds').innerHTML = kinds.map(function (k) {
      return '<span class="chip ' + (k === kind ? 'is-active' : '') + '" data-k="' + k + '">' + (k === 'all' ? 'All' : U.kindIcon[k] + ' ' + U.kindLabel(k) + 's') + '</span>';
    }).join('');
  }

  function filtered() {
    var ql = q.trim().toLowerCase();
    return S.media().filter(function (m) {
      if (kind !== 'all' && m.kind !== kind) return false;
      if (!ql) return true;
      var ppl = m.people.map(S.person).filter(Boolean).map(S.shortName).join(' ');
      return (m.title + ' ' + (m.place || '') + ' ' + ppl + ' ' + (m.date || '')).toLowerCase().indexOf(ql) >= 0;
    }).sort(function (a, b) {
      return (a.year || 0) - (b.year || 0);
    });
  }

  function render() {
    var list = filtered();
    U.$('#count').textContent = list.length + ' items';
    U.$('#groupBtn').textContent = group === 'decade' ? 'Decade' : group === 'kind' ? 'Kind' : 'None';
    var html = '';
    if (!list.length) html = '<p class="empty">Nothing matches.</p>';
    else if (group === 'none') html = '<div class="media-grid media-grid--wide" data-grid>' + list.map(U.tile).join('') + '</div>';
    else {
      var groups = {};
      var order = [];
      list.forEach(function (m) {
        var key = group === 'decade' ? (m.year ? Math.floor(m.year / 10) * 10 + 's' : 'Undated') : U.kindLabel(m.kind) + 's';
        if (!groups[key]) {
          groups[key] = [];
          order.push(key);
        }
        groups[key].push(m);
      });
      if (group === 'kind') order.sort();
      order.forEach(function (k) {
        html += '<div class="list-head"><h3>' + U.esc(k) + '</h3><span class="muted small">' + groups[k].length + '</span></div><div class="media-grid media-grid--wide" data-grid>' + groups[k].map(U.tile).join('') + '</div>';
      });
    }
    U.$('#grid').innerHTML = html;
    U.$$('[data-grid]').forEach(function (gEl) {
      U.bindTiles(gEl, list);
    });
  }

  renderKinds();
  render();
  U.$('#kinds').addEventListener('click', function (e) {
    var c = e.target.closest('[data-k]');
    if (!c) return;
    kind = c.dataset.k;
    renderKinds();
    render();
  });
  U.$('#q').addEventListener('input', function (e) {
    q = e.target.value;
    render();
  });
  U.$('#groupBtn').addEventListener('click', function () {
    group = group === 'decade' ? 'kind' : group === 'kind' ? 'none' : 'decade';
    render();
  });
  U.$('#fabAdd').addEventListener('click', function () {
    U.openUploadSheet([], render);
  });
})();
