window.FamilyTreePeople = (function () {
  'use strict';

  function qs(name) {
    return new URLSearchParams(location.search).get(name);
  }

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

    var filter = qs('surname') ? 'surname:' + qs('surname') : 'all';
    var sort = 'name';
    var q = qs('q') || '';
    var mode = 'people';
    var all = [];

    API.lookupTree(A.getShareCode())
      .then(function (tree) {
        return U.refreshMe().then(function () {
          U.renderShell({ title: 'People', subtitle: tree.name, search: false });
          build();
          return API.listPersons({ limit: 500 });
        });
      })
      .then(function (data) {
        all = (data && data.persons) || [];
        render();
      })
      .catch(function () {
        location.replace('index.html');
      });

    function build() {
      var main = U.$('.app-main');
      main.innerHTML =
        '<div class="people-toolbar">' +
        '<div class="search" data-help="people.search"><span class="ico">\uD83D\uDD0D</span><input type="search" id="q" placeholder="Search by name, nickname or year" autocomplete="off" /></div>' +
        '<div class="chip-row" id="filters" data-help="people.filters"></div>' +
        '<div class="sort-row"><span id="count"></span><span>Sort: <button class="btn btn--sm btn--ghost" type="button" id="sortBtn" data-help="people.sort">Surname</button> <button class="btn btn--sm btn--ghost" type="button" id="indexBtn" data-help="people.surnamesToggle">Surnames</button></span></div>' +
        '</div>' +
        '<div class="people-layout">' +
        '<div class="card" id="list" data-help="people.list" style="padding-top:.2rem;padding-bottom:.2rem"></div>' +
        '<nav class="alpha-index" id="alpha" aria-label="Jump to letter" data-help="people.alpha"></nav>' +
        '</div>' +
        '<button class="fab" id="fabAdd" aria-label="Add person" title="Add person" data-help="people.fab">+</button>';
      U.$('#q').value = q;
      U.$('#q').addEventListener('input', function (e) {
        q = e.target.value.trim();
        render();
      });
      U.$('#indexBtn').addEventListener('click', function () {
        mode = mode === 'surnames' ? 'people' : 'surnames';
        render();
      });
      U.$('#list').addEventListener('click', function (e) {
        var row = e.target.closest('[data-surname]');
        if (!row) return;
        filter = 'surname:' + row.getAttribute('data-surname');
        mode = 'people';
        render();
      });
      U.$('#filters').addEventListener('click', function (e) {
        var chip = e.target.closest('[data-f]');
        if (!chip) return;
        filter = chip.getAttribute('data-f');
        render();
      });
      U.$('#sortBtn').addEventListener('click', function () {
        sort = sort === 'name' ? 'year' : 'name';
        render();
      });
      U.$('#fabAdd').addEventListener('click', addPerson);
    }

    function surnames() {
      var map = {};
      all.forEach(function (p) {
        if (p.surname) map[p.surname] = (map[p.surname] || 0) + 1;
      });
      return Object.keys(map)
        .map(function (s) {
          return { surname: s, count: map[s] };
        })
        .sort(function (a, b) {
          return b.count - a.count || a.surname.localeCompare(b.surname);
        });
    }

    function missing(p) {
      return !p.birthYear || (!p.living && !p.deathYear);
    }

    function filtered() {
      var list = all.slice();
      var ql = q.toLowerCase();
      if (ql) {
        list = list.filter(function (p) {
          return [p.givenNames, p.surname, p.birthSurname, p.nickname, p.birthYear, p.deathYear]
            .join(' ')
            .toLowerCase()
            .indexOf(ql) >= 0;
        });
      }
      list = list.filter(function (p) {
        if (filter === 'living') return p.living;
        if (filter === 'deceased') return !p.living;
        if (filter === 'photo') return !!p.thumbUrl;
        if (filter === 'missing') return missing(p);
        if (filter.indexOf('surname:') === 0) {
          var s = filter.slice(8);
          return p.surname === s || p.birthSurname === s;
        }
        return true;
      });
      if (sort === 'name') {
        list.sort(function (a, b) {
          return (a.surname + a.givenNames).localeCompare(b.surname + b.givenNames);
        });
      } else {
        list.sort(function (a, b) {
          return (a.birthYear || 9999) - (b.birthYear || 9999);
        });
      }
      return list;
    }

    function surnameGroups() {
      var map = {};
      all.forEach(function (p) {
        var names = {};
        if (p.surname) names[p.surname] = 1;
        if (p.birthSurname && p.birthSurname !== p.surname) names[p.birthSurname] = 1;
        Object.keys(names).forEach(function (name) {
          var letter = name[0].toUpperCase();
          var bucket = map[letter] || (map[letter] = {});
          bucket[name] = (bucket[name] || 0) + 1;
        });
      });
      return map;
    }

    function render() {
      var filters = [
        { id: 'all', label: 'All' },
        { id: 'living', label: 'Living' },
        { id: 'deceased', label: 'Deceased' },
        { id: 'photo', label: 'Has photo' },
        { id: 'missing', label: 'Missing info' }
      ].concat(
        surnames()
          .slice(0, 5)
          .map(function (s) {
            return { id: 'surname:' + s.surname, label: s.surname };
          })
      );
      U.$('#filters').innerHTML = filters
        .map(function (f) {
          return (
            '<span class="chip ' +
            (f.id === filter ? 'is-active' : '') +
            '" data-f="' +
            U.esc(f.id) +
            '">' +
            U.esc(f.label) +
            '</span>'
          );
        })
        .join('');
      var list = filtered();
      U.$('#count').textContent = mode === 'surnames'
        ? surnames().length + ' surnames'
        : list.length + ' of ' + all.length + ' people';
      U.$('#sortBtn').textContent = sort === 'name' ? 'Surname' : 'Birth year';
      U.$('#indexBtn').textContent = mode === 'surnames' ? 'People' : 'Surnames';
      if (mode === 'surnames') {
        var groups = surnameGroups();
        var letters = Object.keys(groups).sort();
        var indexHtml = '<div class="surname-index">';
        if (!letters.length) indexHtml += '<p class="empty">No surnames yet.</p>';
        letters.forEach(function (L) {
          indexHtml += '<h3 id="S' + L + '">' + L + '</h3>';
          Object.keys(groups[L]).sort().forEach(function (name) {
            indexHtml += '<button type="button" class="surname-index__row" data-help="people.surnameRow" data-surname="' + U.esc(name) + '"><span>' +
              U.esc(name) + '</span><span class="muted">' + groups[L][name] + '</span></button>';
          });
        });
        U.$('#list').innerHTML = indexHtml + '</div>';
        U.$('#alpha').innerHTML = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(function (L) {
          return groups[L] ? '<a href="#S' + L + '">' + L + '</a>' : '<span class="muted">' + L + '</span>';
        }).join('');
        return;
      }
      var html = '';
      if (!list.length) html = '<p class="empty">No one matches. Add someone with the + button.</p>';
      else if (sort === 'name') {
        var letter = '';
        list.forEach(function (p) {
          var L = (p.surname || '?')[0].toUpperCase();
          if (L !== letter) {
            letter = L;
            html += '<div class="letter-head" id="L' + L + '">' + L + '</div>';
          }
          html += U.personRow(p, {
            tag: p.birthSurname ? 'née ' + p.birthSurname : missing(p) ? '⚠ incomplete' : ''
          });
        });
      } else {
        var decade = null;
        list.forEach(function (p) {
          var d = p.birthYear ? Math.floor(p.birthYear / 10) * 10 : null;
          if (d !== decade) {
            decade = d;
            html += '<div class="letter-head">' + (d ? d + 's' : 'Unknown birth year') + '</div>';
          }
          html += U.personRow(p);
        });
      }
      U.$('#list').innerHTML = html;
      var letters = {};
      list.forEach(function (p) {
        letters[(p.surname || '?')[0].toUpperCase()] = 1;
      });
      U.$('#alpha').innerHTML =
        sort === 'name'
          ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
              .split('')
              .map(function (L) {
                return letters[L]
                  ? '<a href="#L' + L + '">' + L + '</a>'
                  : '<span class="muted">' + L + '</span>';
              })
              .join('')
          : '';
    }

    function addPerson() {
      U.openPersonForm({
        title: 'Add a person',
        intro: 'Not connected to anyone yet – you can add parents, partners and children from their profile.',
        onSave: function (payload) {
          API.createPerson(payload)
            .then(function (data) {
              location.href = 'person.html?id=' + data.person.id + '&new=1';
            })
            .catch(function (e) {
              U.brief(e.message || 'Could not save');
            });
        }
      });
    }
  }

  return { init: init };
})();
