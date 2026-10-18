(function () {
  'use strict';
  var S = window.MockStore, U = window.MockUI;
  U.renderShell({ title: 'Admin', subtitle: 'Tree settings, access and history', search: false });

  var home = S.person(S.tree.homePerson);
  var st = S.stats();

  U.$('#settings').innerHTML = '<div class="card__head"><h2>Tree</h2></div>' +
    '<div class="kv"><span class="kv__k">Name</span><span class="kv__v">' + U.esc(S.tree.name) + ' <button class="btn btn--sm btn--ghost" data-mock="Rename">Edit</button></span></div>' +
    '<div class="kv"><span class="kv__k">Home person</span><span class="kv__v">' + U.esc(S.shortName(home)) + ' <button class="btn btn--sm btn--ghost" id="pickHome">Change</button></span></div>' +
    '<div class="kv"><span class="kv__k">Living age limit</span><span class="kv__v">110 years</span></div>' +
    '<div class="kv"><span class="kv__k">Default chart depth</span><span class="kv__v">4 generations</span></div>';

  var shareUrl = 'https://zarleyltd.github.io/FamilyTree/?t=' + S.tree.shareCode;
  var pending = S.invites().filter(function (inv) {
    return !inv.usedAt;
  });
  U.$('#codes').innerHTML = '<div class="card__head"><h2>Access</h2></div>' +
    '<p class="muted small">Anyone with the share link can view. Editing is a person identity: you issue a one-time invite, they pick a handle and password, then Connect on any device.</p>' +
    '<div class="kv"><span class="kv__k">Share link<div class="muted small">view everything incl. living people</div></span><span class="kv__v"><span class="code">' + S.tree.shareCode + '</span></span></div>' +
    '<div class="btn-row" style="margin:.4rem 0 .8rem"><button class="btn btn--sm btn--primary" id="copyShare">Copy share link</button><button class="btn btn--sm" data-mock="Share code rotated – old links stop working">Rotate</button></div>' +
    '<div class="kv"><span class="kv__k">Admin code<div class="muted small">unlocks this page</div></span><span class="kv__v"><span class="code">••••••</span> <button class="btn btn--sm btn--ghost" data-mock="Admin code changed">Change</button></span></div>' +
    '<div class="card__head" style="margin-top:1rem"><h2>Pending invites</h2><button class="btn btn--sm btn--primary" id="issueInvite">Issue invite</button></div>' +
    (pending.length ? pending.map(function (inv) {
      return '<div class="kv"><span class="kv__k"><span class="code">' + U.esc(inv.code) + '</span>' +
        (inv.label ? '<div class="muted small">' + U.esc(inv.label) + '</div>' : '<div class="muted small">unlabelled</div>') +
        '</span><span class="kv__v muted small">expires ' + U.esc(inv.expires) + '</span></div>';
    }).join('') : '<p class="empty">No unused invites. Issue one, send the code in a message, they Register once.</p>');

  function renderContributors() {
    var list = S.allContributors();
    U.$('#contributors').innerHTML = '<div class="card__head"><h2>Contributors</h2><span class="muted small">' + list.length + ' people</span></div>' +
      '<p class="muted small">One row per person, not per device. Sessions are separate and expire.</p>' +
      list.map(function (c) {
        var p = c.self ? S.person(c.self) : null;
        return '<div class="contrib"><span class="change__who">' + U.esc(c.name[0]) + '</span><div class="contrib__body"><strong>' + U.esc(c.name) + '</strong> <span class="chip" style="margin-left:.3rem">' + c.role + '</span>' +
          '<div class="muted small">@' + U.esc(c.handle) + (p ? ' · is ' + U.esc(S.shortName(p)) : '') + ' · ' + c.edits + ' edits · ' + (c.sessions || 0) + ' session' + ((c.sessions || 0) === 1 ? '' : 's') + ' · last seen ' + U.esc(c.lastSeen) + '</div></div>' +
          '<button class="btn btn--sm btn--ghost" data-contrib="' + U.esc(c.id) + '">\u22EF</button></div>';
      }).join('');
  }
  renderContributors();

  var noParents = S.persons().filter(function (p) {
    var par = S.parentsOf(p.id);
    return !par.father && !par.mother;
  }).length;
  var noBirth = S.persons().filter(function (p) {
    return !p.birth || !p.birth.year;
  }).length;
  var noPhoto = S.persons().filter(function (p) {
    return !S.primaryMedia(p.id);
  }).length;
  U.$('#quality').innerHTML = '<div class="card__head"><h2>Data quality</h2></div>' +
    '<div class="kv"><span class="kv__k">People with no parents recorded</span><a class="kv__v" href="people.html">' + noParents + '</a></div>' +
    '<div class="kv"><span class="kv__k">People with no birth year</span><a class="kv__v" href="people.html?f=missing">' + noBirth + '</a></div>' +
    '<div class="kv"><span class="kv__k">People with no portrait</span><a class="kv__v" href="people.html">' + noPhoto + '</a></div>' +
    '<div class="kv"><span class="kv__k">Possible duplicates</span><span class="kv__v">0</span></div>' +
    '<div class="kv"><span class="kv__k">Children born before a parent</span><span class="kv__v">0</span></div>' +
    '<div class="btn-row" style="margin-top:.6rem"><button class="btn btn--sm" data-mock="GEDCOM export (later phase)">Export GEDCOM</button><button class="btn btn--sm" data-mock="GEDCOM import (later phase)">Import GEDCOM</button></div>';

  var usedMb = (st.media * 0.09).toFixed(1);
  U.$('#storage').innerHTML = '<div class="card__head"><h2>Storage</h2></div>' +
    '<div class="small">' + usedMb + ' MB of 1 GB used (' + st.media + ' items, ≈ 90 KB each)</div><div class="bar"><span style="width:' + Math.max(1, usedMb / 10) + '%"></span></div>' +
    '<div class="muted small">Shared Supabase project. At this size there is room for roughly ' + Math.round((1024 - usedMb) / 0.09).toLocaleString() + ' more photos.</div>';

  function renderLog() {
    U.$('#log').innerHTML = '<div class="card__head"><h2>Change log</h2><span class="muted small">newest first</span></div>' +
      S.changes().map(function (c, i) {
        var diff = c.action === 'update' ? '<div class="diff">birth.date_text: <span class="del">“1856”</span> → <span class="ins">“abt 1858”</span></div>' : '';
        return '<div class="change"><span class="change__who">' + U.esc(c.actor[0]) + '</span><div class="change__body">' + U.esc(c.summary) + diff +
          '<div class="change__meta">' + U.esc(c.actor) + ' · ' + U.esc(c.when) + ' · <a href="#" data-revert="' + i + '">Revert</a></div></div></div>';
      }).join('');
  }
  renderLog();

  U.$('#danger').innerHTML = '<div class="card__head"><h2>Danger zone</h2></div>' +
    '<div class="btn-row"><button class="btn btn--danger btn--sm" data-mock="Would permanently remove soft-deleted records">Purge deleted records</button>' +
    '<button class="btn btn--danger btn--sm" id="resetMock">Reset mockup sample data</button></div>';

  document.addEventListener('click', function (e) {
    var m = e.target.closest('[data-mock]');
    if (m) {
      e.preventDefault();
      U.brief(m.dataset.mock, m, 1800);
      return;
    }
    var r = e.target.closest('[data-revert]');
    if (r) {
      e.preventDefault();
      var c = S.changes()[parseInt(r.dataset.revert, 10)];
      U.confirm('Revert this change?', '“' + c.summary + '” by ' + c.actor + ' will be undone. This is itself logged.', 'Revert', function () {
        U.brief('Reverted (mock)');
      });
    }
  });
  U.$('#issueInvite').addEventListener('click', function () {
    U.openSheet(
      'Issue a register invite',
      '<p class="muted small">Shown once. Send it in a message. It cannot be reused after they register, and it cannot reset a password later.</p>' +
        '<div class="field"><label>Label (optional, for you)</label><input type="text" id="invLabel" placeholder="e.g. for Aoife" /></div>',
      '<button class="btn" data-close>Cancel</button><button class="btn btn--primary" id="invGo">Create invite</button>',
      function (root) {
        U.$('#invGo', root).onclick = function () {
          var r = S.issueInvite('register', U.$('#invLabel', root).value.trim(), null);
          U.closeSheet();
          U.openSheet(
            'Invite created',
            '<p>Give them this code. They Register with it, choose a handle and a password, then Connect on any device.</p>' +
              '<p style="text-align:center;font-size:1.6rem"><span class="code">' + U.esc(r.code) + '</span></p>' +
              '<p class="muted small">Expires ' + U.esc(r.expires) + '. The real API also returns the plaintext once, then stores only a hash.</p>',
            '<button class="btn btn--primary" id="invDone">Done</button>',
            function (doneRoot) {
              U.$('#invDone', doneRoot).onclick = function () {
                location.reload();
              };
            }
          );
        };
      }
    );
  });
  U.$('#contributors').addEventListener('click', function (e) {
    var b = e.target.closest('[data-contrib]');
    if (!b) return;
    var c = S.allContributors().filter(function (x) {
      return x.id === b.dataset.contrib;
    })[0];
    if (!c) return;
    U.openSheet(
      c.name,
      '<p class="muted small">@' + U.esc(c.handle) + ' \u00b7 ' + U.esc(c.role) + '</p>' +
        '<div class="btn-row" style="flex-direction:column;align-items:stretch">' +
        '<button class="btn" id="cReset">Issue password-reset code</button>' +
        '<button class="btn" data-mock="Would sign out all of ' + U.esc(c.name) + '\u2019s sessions">Sign out everywhere</button>' +
        '<button class="btn" data-mock="Role changed (mock)">Make admin</button>' +
        '<button class="btn btn--danger" data-mock="' + U.esc(c.name) + ' disabled \u2013 sessions revoked">Disable</button></div>',
      null,
      function (root) {
        U.$('#cReset', root).onclick = function () {
          var r = S.issueInvite('reset', null, c.id);
          U.closeSheet();
          U.openSheet(
            'Reset code for @' + c.handle,
            '<p>Send this to ' + U.esc(c.name) + '. They enter handle + this code + a new password. It works once and expires in 24 hours. Their other sessions will be signed out when they use it.</p>' +
              '<p style="text-align:center;font-size:1.6rem"><span class="code">' + U.esc(r.code) + '</span></p>',
            '<button class="btn btn--primary" data-close>Done</button>'
          );
        };
      }
    );
  });
  U.$('#copyShare').addEventListener('click', function () {
    if (navigator.clipboard) navigator.clipboard.writeText(shareUrl).catch(function () {});
    U.brief('Copied ' + shareUrl.replace('https://', ''), this, 2000);
  });
  U.$('#pickHome').addEventListener('click', function () {
    U.openPersonPicker('Choose home person', function (p) {
      U.brief('Home person set to ' + S.shortName(p) + ' (mock)');
    });
  });
  U.$('#resetMock').addEventListener('click', function () {
    S.reset();
    U.brief('Sample data reset');
    setTimeout(function () {
      location.reload();
    }, 600);
  });
  if (location.hash === '#log') U.$('#log').scrollIntoView();
})();
