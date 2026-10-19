window.FamilyTreeAdmin = (function () {
  'use strict';

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function init() {
    var A = window.TreeAccess;
    var API = window.FamilyTreeAPI;
    var U = window.FamilyTreeUI;
    A.captureShareCode();
    if (!A.getShareCode()) {
      location.replace('index.html');
      return;
    }
    API.lookupTree(A.getShareCode())
      .then(function (tree) {
        return U.refreshMe().then(function (me) {
          U.renderShell({ title: 'Admin', subtitle: tree.name });
          render(tree, me);
        });
      })
      .catch(function () {
        location.replace('index.html');
      });

    function render(tree, me) {
      var main = $('.app-main');
      if (!me) {
        main.innerHTML =
          '<section class="card"><h2>Admin</h2><p>Connect as a contributor first. The first person to register with the bootstrap invite is an admin. Others can enter the admin code to be promoted.</p>' +
          '<div class="btn-row"><button class="btn btn--primary" type="button" id="admConnect" data-help="admin.connect">Connect</button>' +
          '<button class="btn" type="button" id="admReg" data-help="admin.register">Register with an invite</button></div></section>';
        $('#admConnect').onclick = function () {
          U.openConnectSheet();
        };
        $('#admReg').onclick = function () {
          U.openRegisterSheet();
        };
        return;
      }
      if (me.role !== 'admin') {
        main.innerHTML =
          '<section class="card"><h2>Unlock admin</h2>' +
          '<p class="muted small">Signed in as <span class="code">' +
          U.esc(me.handle) +
          '</span>. Enter the tree admin code to unlock this page for your account.</p>' +
          '<div class="field" data-help="admin.unlock"><label for="adminCode">Admin code</label><input type="text" id="adminCode" autocomplete="off" /></div>' +
          '<p class="muted small" id="admErr"></p>' +
          '<button class="btn btn--primary" type="button" id="admUnlock" data-help="admin.unlock">Unlock</button></section>';
        $('#admUnlock').onclick = function () {
          var err = $('#admErr');
          err.textContent = '';
          API.unlockAdmin($('#adminCode').value)
            .then(function () {
              return U.refreshMe();
            })
            .then(function (next) {
              render(tree, next);
            })
            .catch(function (e) {
              err.textContent = e.message || 'Could not unlock';
            });
        };
        return;
      }
      main.innerHTML =
        '<div class="two-col">' +
        '<section class="card" data-help="admin.tree"><div class="card__head"><h2>Tree</h2></div>' +
        '<div class="kv"><div class="kv__k">Name</div><div class="kv__v">' +
        U.esc(tree.name) +
        '</div></div>' +
        '<div class="kv"><div class="kv__k">Share code</div><div><span class="code">' +
        U.esc(A.getShareCode()) +
        '</span></div></div>' +
        '<p class="muted small">Rotating codes and contributor management arrive in Phase 5. You can issue invites now.</p></section>' +
        '<section class="card" data-help="admin.storage"><div class="card__head"><h2>Storage</h2></div>' +
        '<div id="storageBox"><p class="empty">Loading\u2026</p></div></section>' +
        '<section class="card" data-help="admin.invite"><div class="card__head"><h2>Issue an invite</h2></div>' +
        '<p class="muted small">One-time register code, 30 days. Shown once \u2014 send it in a message.</p>' +
        '<div class="field"><label for="invLabel">Label (optional)</label><input type="text" id="invLabel" placeholder="e.g. for Siobh\u00e1n" /></div>' +
        '<p class="muted small" id="invErr"></p>' +
        '<div id="invResult"></div>' +
        '<button class="btn btn--primary" type="button" id="invGo">Issue register invite</button></section>' +
        '</div>' +
        '<section class="card" data-help="admin.invites"><div class="card__head"><h2>Pending invites</h2></div><div id="invList"><p class="empty">Loading\u2026</p></div></section>';

      function fmtBytes(n) {
        n = Number(n) || 0;
        if (n < 1024) return n + ' B';
        if (n < 1024 * 1024) return Math.round(n / 1024) + ' KB';
        if (n < 1024 * 1024 * 1024) return (n / (1024 * 1024)).toFixed(1) + ' MB';
        return (n / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
      }
      API.storageUsage()
        .then(function (usage) {
          var bytes = Number(usage.bytes) || 0;
          var quota = Number(usage.quotaBytes) || 1024 * 1024 * 1024;
          var pct = Math.max(bytes ? 1 : 0, Math.min(100, (bytes / quota) * 100));
          $('#storageBox').innerHTML =
            '<div class="small">' +
            fmtBytes(bytes) +
            ' in ' +
            (usage.count || 0) +
            ' file' +
            (usage.count === 1 ? '' : 's') +
            ' \u00b7 shared project quota ' +
            fmtBytes(quota) +
            '</div><div class="bar"><span style="width:' +
            pct.toFixed(2) +
            '%"></span></div>' +
            '<p class="muted small">' +
            U.esc(usage.note || 'Measured against the shared Apps project quota.') +
            '</p>';
        })
        .catch(function (e) {
          $('#storageBox').innerHTML = '<p class="empty">' + U.esc(e.message) + '</p>';
        });

      function loadInvites() {
        API.listInvites()
          .then(function (data) {
            var list = (data && data.invites) || [];
            var el = $('#invList');
            if (!list.length) {
              el.innerHTML = '<p class="empty">None pending.</p>';
              return;
            }
            el.innerHTML = list
              .map(function (inv) {
                return (
                  '<div class="contrib"><div class="contrib__body"><strong>' +
                  U.esc(inv.purpose) +
                  '</strong> ' +
                  U.esc(inv.label || '') +
                  '<div class="muted small">Expires ' +
                  U.esc(inv.expires_at ? new Date(inv.expires_at).toLocaleString() : '') +
                  '</div></div></div>'
                );
              })
              .join('');
          })
          .catch(function (e) {
            $('#invList').innerHTML = '<p class="empty">' + U.esc(e.message) + '</p>';
          });
      }
      loadInvites();
      $('#invGo').onclick = function () {
        var err = $('#invErr');
        err.textContent = '';
        API.issueInvite({ purpose: 'register', label: $('#invLabel').value })
          .then(function (data) {
            $('#invResult').innerHTML =
              '<p>Invite code (shown once): <span class="code">' +
              U.esc(data.code) +
              '</span> <button class="btn btn--sm" type="button" data-help="admin.copy" data-copy="' +
              U.esc(data.code) +
              '">Copy</button></p>';
            loadInvites();
          })
          .catch(function (e) {
            err.textContent = e.message || 'Could not issue invite';
          });
      };
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
  }

  return { init: init };
})();
