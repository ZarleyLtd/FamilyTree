(function () {
  'use strict';
  var S = window.MockStore, U = window.MockUI;
  U.renderShell({ title: 'People', search: false });

  var filter = U.qs('surname') ? 'surname:' + U.qs('surname') : 'all';
  var sort = 'name';
  var q = '';

  var st = S.stats();
  var filters = [
    { id: 'all', label: 'All' }, { id: 'living', label: 'Living' }, { id: 'deceased', label: 'Deceased' },
    { id: 'photo', label: 'Has photo' }, { id: 'missing', label: 'Missing info' }
  ].concat(st.surnames.slice(0, 5).map(function (s) {
    return { id: 'surname:' + s.surname, label: s.surname };
  }));

  function renderFilters() {
    U.$('#filters').innerHTML = filters.map(function (f) {
      return '<span class="chip ' + (f.id === filter ? 'is-active' : '') + '" data-f="' + U.esc(f.id) + '">' + U.esc(f.label) + '</span>';
    }).join('');
  }

  function missing(p) {
    return !p.birth || !p.birth.year || !p.birth.place || (!S.isLiving(p) && !p.death);
  }

  function filtered() {
    var list = q ? S.search(q) : S.persons().slice();
    list = list.filter(function (p) {
      if (filter === 'living') return S.isLiving(p);
      if (filter === 'deceased') return !S.isLiving(p);
      if (filter === 'photo') return !!S.primaryMedia(p.id);
      if (filter === 'missing') return missing(p);
      if (filter.indexOf('surname:') === 0) {
        var s = filter.slice(8);
        return p.surname === s || p.birthSurname === s;
      }
      return true;
    });
    if (sort === 'name') list.sort(function (a, b) {
      return (a.surname + a.given).localeCompare(b.surname + b.given);
    });
    else list.sort(S.byBirth);
    return list;
  }

  function render() {
    var list = filtered();
    U.$('#count').textContent = list.length + ' of ' + S.persons().length + ' people';
    U.$('#sortBtn').textContent = sort === 'name' ? 'Surname' : 'Birth year';
    var html = '';
    if (!list.length) html = '<p class="empty">No one matches.</p>';
    else if (sort === 'name') {
      var letter = '';
      list.forEach(function (p) {
        var L = (p.surname || '?')[0].toUpperCase();
        if (L !== letter) {
          letter = L;
          html += '<div class="letter-head" id="L' + L + '">' + L + '</div>';
        }
        html += U.personRow(p, { tag: p.birthSurname ? 'née ' + p.birthSurname : (missing(p) ? '⚠ incomplete' : '') });
      });
    } else {
      var decade = null;
      list.forEach(function (p) {
        var d = p.birth && p.birth.year ? Math.floor(p.birth.year / 10) * 10 : null;
        if (d !== decade) {
          decade = d;
          html += '<div class="letter-head">' + (d ? d + 's' : 'Unknown birth year') + '</div>';
        }
        html += U.personRow(p, { tag: p.birthSurname ? 'née ' + p.birthSurname : '' });
      });
    }
    U.$('#list').innerHTML = html;
    var letters = {};
    list.forEach(function (p) {
      letters[(p.surname || '?')[0].toUpperCase()] = 1;
    });
    U.$('#alpha').innerHTML = sort === 'name' ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(function (L) {
      return letters[L] ? '<a href="#L' + L + '">' + L + '</a>' : '<span style="opacity:.25;padding:.05rem .3rem">' + L + '</span>';
    }).join('') : '';
  }

  renderFilters();
  render();

  U.$('#filters').addEventListener('click', function (e) {
    var c = e.target.closest('[data-f]');
    if (!c) return;
    filter = c.dataset.f;
    renderFilters();
    render();
  });
  U.$('#q').addEventListener('input', function (e) {
    q = e.target.value;
    render();
  });
  U.$('#sortBtn').addEventListener('click', function () {
    sort = sort === 'name' ? 'year' : 'name';
    render();
  });
  U.$('#fabAdd').addEventListener('click', function () {
    U.openPersonForm({
      title: 'Add a person',
      intro: 'Not connected to anyone yet – you can add parents, partners and children from their profile.',
      onSave: function (input) {
        var p = S.addPerson(input);
        location.href = 'person.html?id=' + p.id + '&new=1';
      }
    });
  });
  if (U.qs('focus')) setTimeout(function () {
    U.$('#q').focus();
  }, 100);
})();
