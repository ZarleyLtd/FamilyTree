(function () {
  'use strict';
  var S = window.MockStore, U = window.MockUI;
  U.renderShell({ subtitle: 'Shared with 5 family members' });

  var account = S.me();
  var me = account.self ? S.person(account.self) : S.person(S.tree.homePerson);
  var st = S.stats();

  if (account.signedIn) {
    U.$('#meCard').innerHTML =
      '<div class="hero-me">' + U.avatar(me, 'lg') +
      '<div class="hero-me__body"><div class="muted small">Signed in as ' + U.esc(account.handle) + '</div><div class="hero-me__name">' + U.esc(S.fullName(me) || account.name) + '</div>' +
      '<div class="muted small">' + (me ? U.esc(U.lifespan(me)) + ' · ' : '') + U.esc(account.role) + ' · ' + st.generations + ' generations recorded</div></div>' +
      (me ? '<a class="btn btn--sm" href="person.html?id=' + me.id + '">Profile</a>' : '') + '</div>' +
      '<div class="quick-grid">' +
      '<a class="quick" href="tree.html?id=' + (me ? me.id : S.tree.homePerson) + '&view=pedigree"><span class="ico">🌳</span>My ancestors</a>' +
      '<a class="quick" href="tree.html?id=' + (me ? me.id : S.tree.homePerson) + '&view=fan"><span class="ico">🪭</span>Fan chart</a>' +
      '<a class="quick" href="#" id="qAdd"><span class="ico">➕</span>Add person</a>' +
      '<a class="quick" href="#" id="qPhoto"><span class="ico">📷</span>Add photo</a>' +
      '</div>';
  } else {
    U.$('#meCard').innerHTML =
      '<div class="hero-me">' + U.avatar(me, 'lg') +
      '<div class="hero-me__body"><div class="muted small">You are browsing</div><div class="hero-me__name">' + U.esc(S.tree.name) + '</div>' +
      '<div class="muted small">Viewing as a guest. Connect to add people and photos.</div></div></div>' +
      '<div class="quick-grid">' +
      '<a class="quick" href="tree.html?id=' + S.tree.homePerson + '&view=pedigree"><span class="ico">🌳</span>Ancestors</a>' +
      '<a class="quick" href="tree.html?id=' + S.tree.homePerson + '&view=fan"><span class="ico">🪭</span>Fan chart</a>' +
      '<a class="quick" href="#" id="qAdd"><span class="ico">➕</span>Add person</a>' +
      '<a class="quick" href="#" id="qConnect"><span class="ico">🔑</span>Connect</a>' +
      '</div>';
  }

  U.$('#stats').innerHTML = [
    [st.persons, 'people'], [st.living, 'living'], [st.families, 'families'], [st.media, 'photos & documents']
  ].map(function (x) {
    return '<div class="stat"><div class="stat__n">' + x[0] + '</div><div class="stat__l">' + x[1] + '</div></div>';
  }).join('');

  U.$('#changes').innerHTML = S.changes().slice(0, 7).map(function (c) {
    var href = c.targetType === 'media' ? 'gallery.html' : 'person.html?id=' + c.target;
    return '<a class="change" href="' + href + '" style="color:inherit;text-decoration:none"><span class="change__who">' + U.esc(c.actor[0]) + '</span>' +
      '<span class="change__body">' + U.esc(c.summary) + '<div class="change__meta">' + U.esc(c.actor) + ' · ' + U.esc(c.when) + '</div></span></a>';
  }).join('');

  // This month
  var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var mon = months[new Date().getMonth()];
  var items = [];
  S.persons().forEach(function (p) {
    S.eventsOf(p.id).forEach(function (e) {
      if (e.date && e.date.indexOf(mon) >= 0 && /birth|death|marriage/.test(e.type)) {
        items.push({ p: p, e: e });
      }
    });
  });
  var seen = {};
  items = items.filter(function (it) {
    var k = it.e.type + it.e.year + (it.e.type === 'marriage' ? it.e.date : it.p.id);
    if (seen[k]) return false;
    seen[k] = 1;
    return true;
  }).sort(function (a, b) {
    return a.e.year - b.e.year;
  });
  U.$('#onThisDay').innerHTML = items.length ? items.map(function (it) {
    var yrs = new Date().getFullYear() - it.e.year;
    var what = it.e.type === 'birth' ? 'born' : it.e.type === 'death' ? 'died' : 'married' + (it.e.description ? ' ' + it.e.description : '');
    return '<a class="onday" href="person.html?id=' + it.p.id + '" style="color:inherit;text-decoration:none"><span class="onday__year">' + it.e.year + '</span>' + U.avatar(it.p, 'sm') +
      '<span style="flex:1;min-width:0"><strong>' + U.esc(S.shortName(it.p)) + '</strong> ' + U.esc(what) + '<div class="muted small">' + U.esc(it.e.date) + ' · ' + yrs + ' years ago</div></span></a>';
  }).join('') : '<p class="empty">No anniversaries recorded for ' + mon + ' yet.</p>';

  U.$('#surnames').innerHTML = st.surnames.slice(0, 8).map(function (s) {
    return '<a class="chip" href="people.html?surname=' + encodeURIComponent(s.surname) + '" style="text-decoration:none">' + U.esc(s.surname) + ' <span class="muted">' + s.count + '</span></a>';
  }).join('');

  // search
  var inp = U.$('#homeSearch'), res = U.$('#homeResults');
  inp.addEventListener('input', function () {
    var q = inp.value.trim();
    if (!q) {
      res.classList.add('hidden');
      return;
    }
    var list = S.search(q).slice(0, 8);
    res.innerHTML = list.length ? list.map(function (p) {
      return U.personRow(p);
    }).join('') : '<p class="empty">No match. <a href="#" id="addFromSearch">Add “' + U.esc(q) + '” as a new person</a></p>';
    res.classList.remove('hidden');
  });
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.search-wrap')) res.classList.add('hidden');
    if (e.target.id === 'addFromSearch') {
      e.preventDefault();
      addPerson(inp.value.trim());
    }
  });

  function addPerson(prefill) {
    var parts = (prefill || '').split(/\s+/);
    U.openPersonForm({
      title: 'Add a person',
      intro: 'Not connected to anyone yet – you can add parents, partners and children from their profile.',
      values: prefill ? { given: parts.slice(0, -1).join(' ') || parts[0], surname: parts.length > 1 ? parts[parts.length - 1] : '' } : null,
      onSave: function (input) {
        var p = S.addPerson(input);
        location.href = 'person.html?id=' + p.id + '&new=1';
      }
    });
  }
  U.$('#fabAdd').addEventListener('click', function () {
    addPerson('');
  });
  U.$('#qAdd').addEventListener('click', function (e) {
    e.preventDefault();
    if (!U.requireContributor()) return;
    addPerson('');
  });
  var qPhoto = U.$('#qPhoto');
  if (qPhoto) qPhoto.addEventListener('click', function (e) {
    e.preventDefault();
    U.openUploadSheet([], function () {
      location.href = 'gallery.html';
    });
  });
  var qConnect = U.$('#qConnect');
  if (qConnect) qConnect.addEventListener('click', function (e) {
    e.preventDefault();
    U.openConnectSheet();
  });
  U.$('#btnReset').addEventListener('click', function () {
    S.reset();
    location.reload();
  });
})();
