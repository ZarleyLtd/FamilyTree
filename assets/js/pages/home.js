window.FamilyTreeHome = (function () {
  'use strict';

  var A, API, U, F;

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function showLanding(opts) {
    opts = opts || {};
    document.body.classList.add('page-landing');
    U.renderShell({ title: 'Family tree', landing: true, search: false });
    var main = $('.app-main');
    var emptySetup = opts.hasTrees === false;
    var html =
      '<div class="landing">' +
      '<div class="tree-mark" aria-hidden="true">\uD83C\uDF33</div>' +
      '<h1>Family Tree</h1>' +
      '<p class="muted">A shared tree for the family. Anyone with the link can look around; people the admin invites can add and edit from any device.</p>';
    if (opts.error) {
      html += '<p class="muted" style="color:var(--danger)">' + U.esc(opts.error) + '</p>';
    }
    html +=
      '<section class="card">' +
      '<div class="field" data-help="landing.shareCode"><label for="pasteCode">I have a share code</label>' +
      '<input type="text" id="pasteCode" placeholder="e.g. K7PX2Q" autocomplete="off" /></div>' +
      '<button class="btn btn--primary btn--block" type="button" id="openCode" data-help="landing.open">Open the tree</button>' +
      '<p class="muted small" style="margin-top:.6rem">Ask a family member for the link if you do not have a code.</p>' +
      '</section>';
    if (emptySetup) {
      html +=
        '<section class="card" id="setupCard" data-help="landing.setup">' +
        '<h2>Set up this family\u2019s tree</h2>' +
        '<p class="muted small">No tree exists yet. Creating one shows the share, admin and first-invite codes <strong>once</strong> \u2014 copy them somewhere safe.</p>' +
        '<div class="field"><label for="treeName">Tree name</label>' +
        '<input type="text" id="treeName" value="Family tree" maxlength="80" /></div>' +
        '<p class="muted small" id="setupErr"></p>' +
        '<button class="btn btn--warm btn--block" type="button" id="bootstrapGo">Create the tree</button>' +
        '</section>';
    }
    html += '</div>';
    main.innerHTML = html;
    $('#openCode').addEventListener('click', function () {
      var code = $('#pasteCode').value;
      if (!code.trim()) {
        U.brief('Enter a share code', $('#pasteCode'));
        return;
      }
      A.setShareCode(code);
      location.href = 'index.html?t=' + encodeURIComponent(A.getShareCode());
    });
    var boot = $('#bootstrapGo');
    if (boot) {
      boot.addEventListener('click', function () {
        var errEl = $('#setupErr');
        errEl.textContent = '';
        boot.disabled = true;
        API.bootstrapTree({ name: $('#treeName').value })
          .then(function (data) {
            A.setShareCode(data.shareCode);
            main.innerHTML =
              '<div class="landing"><div class="tree-mark" aria-hidden="true">\uD83C\uDF33</div>' +
              '<h1>' +
              U.esc(data.tree.name) +
              '</h1>' +
              '<section class="card codes-once" data-help="landing.codes"><h2>Save these codes now</h2>' +
              '<p class="muted small">They are not stored in plaintext after this. The first person to register with the invite becomes an admin.</p>' +
              kvRow('Share code', data.shareCode, 'Anyone with this can view') +
              kvRow('Admin code', data.adminCode, 'Unlocks the admin page') +
              kvRow('First invite', data.inviteCode, 'One-time register for the first admin') +
              '<div class="btn-row" style="margin-top:1rem">' +
              '<button class="btn btn--primary" type="button" id="goTree" data-help="landing.open">Open the tree</button>' +
              '<button class="btn" type="button" id="goReg" data-help="sheet.register">Register as first admin</button>' +
              '</div></section></div>';
            $('#goTree').onclick = function () {
              location.href = 'index.html?t=' + encodeURIComponent(data.shareCode);
            };
            $('#goReg').onclick = function () {
              location.href = 'index.html?t=' + encodeURIComponent(data.shareCode) + '&register=1';
            };
          })
          .catch(function (e) {
            errEl.textContent = e.message || 'Could not create the tree';
            boot.disabled = false;
          });
      });
    }
  }

  function kvRow(label, value, hint) {
    return (
      '<div class="kv"><div class="kv__k">' +
      U.esc(label) +
      '</div><div><span class="code">' +
      U.esc(value) +
      '</span><div class="kv__v">' +
      U.esc(hint) +
      '</div></div>' +
      '<button class="btn btn--sm" type="button" data-help="landing.copy" data-copy="' +
      U.esc(value) +
      '">Copy</button></div>'
    );
  }

  function bindCopy() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-copy]');
      if (!btn) return;
      var text = btn.getAttribute('data-copy');
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          U.brief('Copied', btn);
        });
      }
    });
  }

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  function renderHome(tree, stats, changes, me, today) {
    document.body.classList.remove('page-landing');
    U.renderShell({ title: tree.name, subtitle: 'Shared family tree' });
    var main = $('.app-main');
    var signedIn = !!me;
    var hero;
    if (signedIn) {
      hero =
        '<div class="hero-me"><span class="avatar avatar--lg">' +
        U.esc(F.initialsFromName(me.displayName)) +
        '</span><div class="hero-me__body"><div class="muted small">Signed in as ' +
        U.esc(me.handle) +
        '</div><div class="hero-me__name">' +
        U.esc(me.displayName) +
        '</div>' +
        '<div class="muted small">' +
        U.esc(me.role) +
        ' \u00b7 Connect on any device with this handle</div></div></div>' +
        '<div class="quick-grid">' +
        '<a class="quick" href="tree.html" data-help="home.quickTree"><span class="ico">\uD83C\uDF33</span>Tree</a>' +
        '<a class="quick" href="people.html" data-help="home.quickPeople"><span class="ico">\uD83D\uDC65</span>People</a>' +
        '<a class="quick" href="#" id="qAdd" data-help="home.quickAdd"><span class="ico">\u2795</span>Add person</a>' +
        '<a class="quick" href="admin.html" data-help="home.quickAdmin"><span class="ico">\u2699\uFE0F</span>Admin</a>' +
        '</div>';
    } else {
      hero =
        '<div class="hero-me"><span class="avatar avatar--lg">\uD83C\uDF33</span>' +
        '<div class="hero-me__body"><div class="muted small">You are browsing</div><div class="hero-me__name">' +
        U.esc(tree.name) +
        '</div>' +
        '<div class="muted small">Viewing as a guest. Connect to add people and photos.</div></div></div>' +
        '<div class="quick-grid">' +
        '<a class="quick" href="tree.html" data-help="home.quickTree"><span class="ico">\uD83C\uDF33</span>Tree</a>' +
        '<a class="quick" href="people.html" data-help="home.quickPeople"><span class="ico">\uD83D\uDC65</span>People</a>' +
        '<a class="quick" href="#" id="qAdd" data-help="home.quickAdd"><span class="ico">\u2795</span>Add person</a>' +
        '<a class="quick" href="#" id="qConnect" data-help="home.quickConnect"><span class="ico">\uD83D\uDD11</span>Connect</a>' +
        '</div>';
    }
    var changeHtml =
      changes && changes.length
        ? changes
            .map(function (c) {
                var href =
                c.targetType === 'persons' && c.targetId
                  ? 'person.html?id=' + c.targetId
                  : 'people.html';
              return (
                '<a class="change" data-help="home.changes" href="' +
                href +
                '" style="color:inherit;text-decoration:none"><span class="change__who">' +
                U.esc((c.actorName || '?')[0]) +
                '</span><span class="change__body">' +
                U.esc(c.summary || c.action) +
                '<div class="change__meta">' +
                U.esc(c.actorName || '') +
                ' \u00b7 ' +
                U.esc(F.relativeTime(c.createdAt)) +
                '</div></span></a>'
              );
            })
            .join('')
        : '<p class="empty">No edits yet. When someone adds a person, it will show up here.</p>';
    var surnameHtml =
      stats.surnames && stats.surnames.length
        ? stats.surnames
            .slice(0, 8)
            .map(function (s) {
              return (
                '<a class="chip" href="people.html?surname=' +
                encodeURIComponent(s.surname) +
                '" style="text-decoration:none">' +
                U.esc(s.surname) +
                ' <span class="muted">' +
                s.count +
                '</span></a>'
              );
            })
            .join('')
        : '<p class="empty">No surnames yet.</p>';
    main.innerHTML =
      '<div class="search-wrap" data-help="home.search">' +
      '<div class="search"><span class="ico">\uD83D\uDD0D</span><input type="search" id="homeSearch" placeholder="Search people, e.g. a surname or year" autocomplete="off" /></div>' +
      '<div class="search-results hidden" id="homeResults"></div></div>' +
      '<section class="card" id="meCard">' +
      hero +
      '</section>' +
      '<div class="stat-grid" data-help="home.stats">' +
      stat(stats.persons, 'people') +
      stat(stats.living, 'living') +
      stat(stats.families, 'families') +
      stat(stats.media, 'photos & documents') +
      '</div>' +
      '<div class="two-col" style="margin-top:.9rem">' +
      '<section class="card" data-help="home.changes"><div class="card__head"><h2>Recent changes</h2></div><div id="changes">' +
      changeHtml +
      '</div></section>' +
      '<section class="card" data-help="home.surnames"><div class="card__head"><h2>Surnames</h2><a class="btn btn--sm btn--ghost" href="people.html">People</a></div>' +
      '<div class="chip-row" id="surnames" style="flex-wrap:wrap">' +
      surnameHtml +
      '</div></section>' +
      '</div>' +
      '<div class="two-col" style="margin-top:.9rem">' +
      statisticsCard(stats) +
      onThisDayCard(today) +
      '</div>' +
      '<button class="fab" id="fabAdd" aria-label="Add person" title="Add person" data-help="home.fab">+</button>';

    function addPerson(prefill) {
      var parts = (prefill || '').split(/\s+/).filter(Boolean);
      U.openPersonForm({
        title: 'Add a person',
        intro: 'Not connected to anyone yet – you can add parents, partners and children from their profile.',
        values: prefill
          ? { given: parts.slice(0, -1).join(' ') || parts[0], surname: parts.length > 1 ? parts[parts.length - 1] : '' }
          : null,
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
    var fab = $('#fabAdd');
    if (fab) fab.addEventListener('click', function () { addPerson(''); });
    var qAdd = $('#qAdd');
    if (qAdd) {
      qAdd.addEventListener('click', function (e) {
        e.preventDefault();
        addPerson('');
      });
    }
    var qConnect = $('#qConnect');
    if (qConnect) {
      qConnect.addEventListener('click', function (e) {
        e.preventDefault();
        U.openConnectSheet();
      });
    }
    var inp = $('#homeSearch');
    var res = $('#homeResults');
    var searchTimer = null;
    inp.addEventListener('input', function () {
      var q = inp.value.trim();
      clearTimeout(searchTimer);
      if (!q) {
        res.classList.add('hidden');
        return;
      }
      searchTimer = setTimeout(function () {
        API.listPersons({ q: q, limit: 8 }).then(function (data) {
          var list = (data && data.persons) || [];
          res.innerHTML = list.length
            ? list.map(function (p) { return U.personRow(p); }).join('')
            : '<p class="empty">No match. <a href="#" id="addFromSearch">Add “' + U.esc(q) + '” as a new person</a></p>';
          res.classList.remove('hidden');
        });
      }, 180);
    });
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.search-wrap')) res.classList.add('hidden');
      if (e.target.id === 'addFromSearch') {
        e.preventDefault();
        addPerson(inp.value.trim());
      }
    });
  }

  function stat(n, label) {
    return '<div class="stat"><div class="stat__n">' + (n || 0) + '</div><div class="stat__l">' + label + '</div></div>';
  }

  function personLink(p, text) {
    if (!p || !p.id) return U.esc(text);
    return '<a href="person.html?id=' + U.esc(p.id) + '">' + U.esc(text) + '</a>';
  }

  function statisticsCard(stats) {
    var rows = [];
    if (stats.longestLived) {
      var life = stats.longestLived;
      rows.push('<div class="otd otd--stack">' + personLink(life, (life.givenNames || '') + ' ' + (life.surname || '')) +
        '<span class="muted">Longest lived, ' + life.years + ' years</span></div>');
    }
    if (stats.oldestLiving) {
      var old = stats.oldestLiving;
      rows.push('<div class="otd otd--stack">' + personLink(old, (old.givenNames || '') + ' ' + (old.surname || '')) +
        '<span class="muted">Oldest living, born ' + old.birthYear + '</span></div>');
    }
    rows.push('<div class="otd otd--stack"><span>' + (stats.withPhoto || 0) + ' with a photo</span><span class="muted">' +
      (stats.missingBirth || 0) + ' missing a birth year</span></div>');
    var names = (stats.commonNames || []).map(function (n) {
      return '<a class="chip" href="people.html?q=' + encodeURIComponent(n.name) + '">' +
        U.esc(n.name) + ' <span class="muted">' + n.count + '</span></a>';
    }).join('');
    return '<section class="card" data-help="home.statistics"><div class="card__head"><h2>Statistics</h2></div>' +
      rows.join('') +
      (names ? '<div class="chip-row" style="flex-wrap:wrap;margin-top:.6rem">' + names + '</div>' : '') +
      '</section>';
  }

  function onThisDayCard(today) {
    var when = today && today.month ? MONTHS[(today.month || 1) - 1] + ' ' + today.day : 'today';
    var items = (today && today.items) || [];
    var html = items.length
      ? items.map(function (item) {
        var what = item.kind === 'media'
          ? (item.title || 'Photo')
          : (item.label || ((item.type === 'birth' ? 'Born' : item.type === 'death' ? 'Died' : item.type === 'marriage' ? 'Married' : (item.title || item.type || 'Event')) +
            (((item.givenNames || '') + ' ' + (item.surname || '')).trim() ? ': ' + ((item.givenNames || '') + ' ' + (item.surname || '')).trim() : '')));
        var ago = item.yearsAgo === 0 ? 'today' : item.yearsAgo ? item.yearsAgo + ' years ago' : '';
        var href = item.personId ? 'person.html?id=' + encodeURIComponent(item.personId) : (item.kind === 'media' ? 'gallery.html' : 'people.html');
        return '<a class="otd" href="' + href + '"><span class="otd__year">' + U.esc(item.year || '') +
          '</span><span><div class="tl__title">' + U.esc(what) + '</div><div class="tl__meta">' + U.esc(ago) +
          (item.placeText ? ' \u00b7 ' + U.esc(item.placeText) : '') + '</div></span></a>';
      }).join('')
      : '<p class="empty">Nothing recorded for ' + U.esc(when) + '.</p>';
    return '<section class="card" data-help="home.onThisDay"><div class="card__head"><h2>On this day</h2><span class="muted small">' +
      U.esc(when) + '</span></div>' + html + '</section>';
  }

  function init() {
    A = window.TreeAccess;
    API = window.FamilyTreeAPI;
    U = window.FamilyTreeUI;
    F = window.Formatters;
    bindCopy();
    A.captureShareCode();
    var code = A.getShareCode();
    if (!code) {
      API.status()
        .then(function (s) {
          showLanding({ hasTrees: !!(s && s.hasTrees) });
        })
        .catch(function () {
          showLanding({ hasTrees: true, error: 'Could not reach the server. You can still paste a share code.' });
        });
      return;
    }
    Promise.all([API.lookupTree(code), U.refreshMe()])
      .then(function (pair) {
        var tree = pair[0];
        var me = pair[1];
        var now = new Date();
        return Promise.all([
          API.stats(),
          API.recentChanges(8),
          API.onThisDay(now.getMonth() + 1, now.getDate()).catch(function () {
            return { month: now.getMonth() + 1, day: now.getDate(), items: [] };
          })
        ]).then(function (rest) {
          renderHome(tree, rest[0] || {}, (rest[1] && rest[1].changes) || [], me, rest[2] || { items: [] });
          if (new URLSearchParams(location.search).get('register') === '1' && !me) {
            U.openRegisterSheet();
          }
        });
      })
      .catch(function (e) {
        if (e.status === 403 || e.status === 404) {
          A.clearShareCode();
          showLanding({ hasTrees: true, error: 'That share code is not valid.' });
          return;
        }
        showLanding({ hasTrees: true, error: e.message || 'Could not load the tree.' });
      });
  }

  return { init: init };
})();
