/**
 * Shared shell: header, nav, account sheets (Connect / Register / Reset).
 */
window.FamilyTreeUI = (function () {
  'use strict';

  var A = window.TreeAccess;
  var API = window.FamilyTreeAPI;
  var F = window.Formatters;

  var NAV = [
    { id: 'home', href: 'index.html', ico: '\uD83C\uDFE1', label: 'Home' },
    { id: 'people', href: 'people.html', ico: '\uD83D\uDC65', label: 'People' },
    { id: 'tree', href: 'tree.html', ico: '\uD83C\uDF33', label: 'Tree' },
    { id: 'gallery', href: 'gallery.html', ico: '\uD83D\uDDBC\uFE0F', label: 'Photos' },
    { id: 'admin', href: 'admin.html', ico: '\u2699\uFE0F', label: 'Admin' }
  ];

  function esc(s) {
    return F.esc(s);
  }
  function $(sel, root) {
    return (root || document).querySelector(sel);
  }
  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function brief(text, anchor, ms) {
    if (window.BriefMessage && BriefMessage.show) {
      BriefMessage.show(text, anchor || null, { durationMs: ms || 1400 });
      return;
    }
  }

  function renderShell(opts) {
    opts = opts || {};
    var page = document.body.dataset.page;
    var me = A.getMe();
    var signedIn = A.isSignedIn();
    var header = $('.app-header');
    if (header) {
      var chip = signedIn
        ? '<button type="button" class="me-chip" id="meChip" title="Signed in as ' +
          esc(me.handle) +
          '"><span class="avatar avatar--sm">' +
          esc(F.initialsFromName(me.displayName || me.handle)) +
          '</span>' +
          esc(me.displayName || me.handle) +
          '</button>'
        : '<button type="button" class="me-chip me-chip--guest" id="meChip">Connect</button>';
      header.innerHTML =
        (opts.back ? '<a class="app-header__btn" href="' + esc(opts.back) + '" aria-label="Back">\u2190</a>' : '') +
        '<div class="app-header__title">' +
        esc(opts.title || 'Family tree') +
        (opts.subtitle ? '<small>' + esc(opts.subtitle) + '</small>' : '') +
        '</div>' +
        (opts.search !== false && !opts.landing
          ? '<a class="app-header__btn" href="people.html" aria-label="Search">\uD83D\uDD0D</a>'
          : '') +
        (opts.landing ? '' : chip);
      var chipEl = $('#meChip');
      if (chipEl) chipEl.addEventListener('click', openAccountMenu);
    }
    var links = NAV.map(function (n) {
      return (
        '<a href="' +
        n.href +
        '" class="' +
        (n.id === page ? 'is-active' : '') +
        '"><span class="ico">' +
        n.ico +
        '</span><span>' +
        n.label +
        '</span></a>'
      );
    }).join('');
    var tab = $('.tabbar');
    if (tab) tab.innerHTML = links;
    var side = $('.sidenav');
    if (side) side.innerHTML = links;
  }

  function openAccountMenu() {
    var me = A.getMe();
    if (!A.isSignedIn()) {
      openConnectSheet();
      return;
    }
    openSheet(
      'Signed in as ' + me.displayName,
      '<p class="muted small">Handle <span class="code">' +
        esc(me.handle) +
        '</span> \u00b7 ' +
        esc(me.role) +
        '<br>Same handle and password work on any device.</p>' +
        '<div class="btn-row" style="flex-direction:column;align-items:stretch">' +
        '<button class="btn" type="button" id="accSwitch">Connect as someone else</button>' +
        '<button class="btn" type="button" id="accReset">Forgot password\u2026</button>' +
        '<button class="btn btn--danger" type="button" id="accOut">Sign out</button></div>',
      null,
      function (root) {
        $('#accSwitch', root).onclick = function () {
          closeSheet();
          openConnectSheet();
        };
        $('#accReset', root).onclick = function () {
          closeSheet();
          openResetSheet(me.handle);
        };
        $('#accOut', root).onclick = function () {
          var btn = this;
          API.signOut()
            .catch(function () {
              /* revoke locally even if the request fails */
            })
            .then(function () {
              A.signOutLocal();
              closeSheet();
              brief('Signed out', btn);
              location.reload();
            });
        };
      }
    );
  }

  function openConnectSheet() {
    openSheet(
      'Connect as a contributor',
      '<p class="muted small">Use the handle and password you chose when you registered.</p>' +
        '<div class="field"><label for="cnHandle">Handle</label><input type="text" id="cnHandle" autocomplete="username" placeholder="e.g. siobhan" /></div>' +
        '<div class="field"><label for="cnPass">Password</label><input type="password" id="cnPass" autocomplete="current-password" /></div>' +
        '<p class="small"><a href="#" id="cnForgot">Forgot password?</a> \u00b7 <a href="#" id="cnReg">Register with an invite</a></p>' +
        '<p class="muted small" id="cnErr"></p>',
      '<button class="btn" type="button" data-close>Cancel</button><button class="btn btn--primary" type="button" id="cnGo">Connect</button>',
      function (root) {
        function go() {
          var errEl = $('#cnErr', root);
          errEl.textContent = '';
          var handle = $('#cnHandle', root).value;
          var password = $('#cnPass', root).value;
          $('#cnGo', root).disabled = true;
          API.connect({ handle: handle, password: password })
            .then(function (data) {
              A.setSession(data.sessionToken, data.contributor);
              closeSheet();
              location.reload();
            })
            .catch(function (e) {
              errEl.textContent = e.message || 'Could not connect';
              $('#cnGo', root).disabled = false;
            });
        }
        $('#cnGo', root).onclick = go;
        $('#cnPass', root).addEventListener('keydown', function (e) {
          if (e.key === 'Enter') go();
        });
        $('#cnForgot', root).onclick = function (e) {
          e.preventDefault();
          closeSheet();
          openResetSheet($('#cnHandle', root).value);
        };
        $('#cnReg', root).onclick = function (e) {
          e.preventDefault();
          closeSheet();
          openRegisterSheet();
        };
        setTimeout(function () {
          $('#cnHandle', root).focus();
        }, 50);
      }
    );
  }

  function openRegisterSheet() {
    openSheet(
      'Register as a contributor',
      '<p class="muted small">You need a one-time invite from an admin. It cannot be reused. After this, Connect with your handle and password on any device.</p>' +
        '<div class="field"><label for="rgInvite">Invite code</label><input type="text" id="rgInvite" placeholder="e.g. N8KQ2M" autocomplete="off" /></div>' +
        '<div class="field-row"><div class="field"><label for="rgHandle">Handle</label><input type="text" id="rgHandle" placeholder="letters, no spaces" autocomplete="username" /></div>' +
        '<div class="field"><label for="rgName">Display name</label><input type="text" id="rgName" placeholder="Shown on edits" /></div></div>' +
        '<div class="field-row"><div class="field"><label for="rgPass">Password</label><input type="password" id="rgPass" autocomplete="new-password" /></div>' +
        '<div class="field"><label for="rgPass2">Confirm</label><input type="password" id="rgPass2" autocomplete="new-password" /></div></div>' +
        '<p class="muted small" id="rgErr"></p>',
      '<button class="btn" type="button" data-close>Cancel</button><button class="btn btn--primary" type="button" id="rgGo">Register</button>',
      function (root) {
        $('#rgGo', root).onclick = function () {
          var errEl = $('#rgErr', root);
          errEl.textContent = '';
          if ($('#rgPass', root).value !== $('#rgPass2', root).value) {
            errEl.textContent = 'Passwords do not match';
            return;
          }
          $('#rgGo', root).disabled = true;
          API.register({
            inviteCode: $('#rgInvite', root).value,
            handle: $('#rgHandle', root).value,
            displayName: $('#rgName', root).value,
            password: $('#rgPass', root).value
          })
            .then(function (data) {
              A.setSession(data.sessionToken, data.contributor);
              closeSheet();
              location.reload();
            })
            .catch(function (e) {
              errEl.textContent = e.message || 'Could not register';
              $('#rgGo', root).disabled = false;
            });
        };
        setTimeout(function () {
          $('#rgInvite', root).focus();
        }, 50);
      }
    );
  }

  function openResetSheet(prefillHandle) {
    openSheet(
      'Reset password',
      '<p class="muted small">The original invite cannot reset a password. Ask an admin to issue a <strong>reset code</strong> (one use, 24 hours). Then enter it here.</p>' +
        '<div class="field"><label for="rsHandle">Handle</label><input type="text" id="rsHandle" value="' +
        esc(prefillHandle || '') +
        '" autocomplete="username" /></div>' +
        '<div class="field"><label for="rsCode">Reset code</label><input type="text" id="rsCode" placeholder="from an admin" autocomplete="off" /></div>' +
        '<div class="field"><label for="rsPass">New password</label><input type="password" id="rsPass" autocomplete="new-password" /></div>' +
        '<p class="muted small" id="rsErr"></p>',
      '<button class="btn" type="button" data-close>Cancel</button><button class="btn btn--primary" type="button" id="rsGo">Set new password</button>',
      function (root) {
        $('#rsGo', root).onclick = function () {
          var errEl = $('#rsErr', root);
          errEl.textContent = '';
          $('#rsGo', root).disabled = true;
          API.resetPassword({
            handle: $('#rsHandle', root).value,
            resetCode: $('#rsCode', root).value,
            newPassword: $('#rsPass', root).value
          })
            .then(function () {
              A.signOutLocal();
              closeSheet();
              brief('Password changed \u2013 Connect with the new one');
              openConnectSheet();
            })
            .catch(function (e) {
              errEl.textContent = e.message || 'Could not reset password';
              $('#rsGo', root).disabled = false;
            });
        };
      }
    );
  }

  function requireContributor(thenFn) {
    if (A.isSignedIn()) {
      if (thenFn) thenFn();
      return true;
    }
    openSheet(
      'Connect to edit',
      '<p>Anyone with the family link can look around. To add or change people, photos or notes, connect as a contributor.</p>' +
        '<div class="btn-row" style="flex-direction:column;align-items:stretch">' +
        '<button class="btn btn--primary" type="button" id="needIn">Connect</button>' +
        '<button class="btn" type="button" id="needReg">Register with an invite</button></div>',
      null,
      function (root) {
        $('#needIn', root).onclick = function () {
          closeSheet();
          openConnectSheet();
        };
        $('#needReg', root).onclick = function () {
          closeSheet();
          openRegisterSheet();
        };
      }
    );
    return false;
  }

  function openSheet(title, bodyHtml, footHtml, onReady) {
    closeSheet();
    var root = document.createElement('div');
    root.className = 'sheet-backdrop';
    root.id = 'sheet';
    root.innerHTML =
      '<div class="sheet" role="dialog" aria-modal="true"><div class="sheet__grab"></div>' +
      '<div class="sheet__head"><h2>' +
      esc(title) +
      '</h2><button class="btn btn--icon" type="button" data-close aria-label="Close">\u2715</button></div>' +
      '<div class="sheet__body">' +
      bodyHtml +
      '</div>' +
      (footHtml ? '<div class="sheet__foot">' + footHtml + '</div>' : '') +
      '</div>';
    document.body.appendChild(root);
    root.addEventListener('click', function (e) {
      if (e.target === root || e.target.closest('[data-close]')) closeSheet();
    });
    document.body.style.overflow = 'hidden';
    if (onReady) onReady(root);
    return root;
  }
  function closeSheet() {
    var ex = $('#sheet');
    if (ex) ex.remove();
    document.body.style.overflow = '';
  }

  function avatar(p, size) {
    var cls = 'avatar avatar--' + ((p && p.sex) || 'U') + (size ? ' avatar--' + size : '');
    if (p && p.thumbUrl) {
      return '<span class="' + cls + ' avatar--img" style="background-image:url(\'' + esc(p.thumbUrl) + '\')" aria-hidden="true"></span>';
    }
    return '<span class="' + cls + '" aria-hidden="true">' + esc(F.initialsOf(p)) + '</span>';
  }

  function personRow(p, opts) {
    opts = opts || {};
    var meta = opts.meta != null ? opts.meta : F.lifespan(p) + (p.birthPlaceShort ? ' \u00b7 ' + p.birthPlaceShort : '');
    return (
      '<a class="person-row" href="person.html?id=' +
      esc(p.id) +
      '">' +
      avatar(p) +
      '<span class="person-row__body"><span class="person-row__name">' +
      esc(F.fullName(p)) +
      '</span><span class="person-row__meta">' +
      esc(meta) +
      '</span></span>' +
      (opts.tag ? '<span class="person-row__tag">' + esc(opts.tag) + '</span>' : '') +
      '<span class="person-row__chev">\u203A</span></a>'
    );
  }

  function bindSeg(root, onChange) {
    $$('button', root).forEach(function (b) {
      b.addEventListener('click', function () {
        $$('button', root).forEach(function (x) {
          x.setAttribute('aria-pressed', x === b ? 'true' : 'false');
        });
        if (onChange) onChange(b.dataset.value, b);
      });
    });
  }
  function segValue(root) {
    var b = $('button[aria-pressed="true"]', root);
    return b ? b.dataset.value : null;
  }

  function personPayloadFromForm(root, extra) {
    var sw = $('#fLiving', root);
    var living = sw ? sw.getAttribute('aria-checked') === 'true' : true;
    var birthText = $('#fBirth', root) ? $('#fBirth', root).value.trim() : '';
    var birthPlace = $('#fBirthPlace', root) ? $('#fBirthPlace', root).value.trim() : '';
    var deathText = $('#fDeath', root) ? $('#fDeath', root).value.trim() : '';
    var deathPlace = $('#fDeathPlace', root) ? $('#fDeathPlace', root).value.trim() : '';
    var payload = {
      person: {
        givenNames: $('#fGiven', root).value.trim(),
        surname: $('#fSurname', root).value.trim(),
        birthSurname: $('#fBirthSurname', root) ? $('#fBirthSurname', root).value.trim() : '',
        nickname: $('#fNick', root) ? $('#fNick', root).value.trim() : '',
        sex: segValue($('#fSex', root)),
        living: living
      },
      birth: birthText || birthPlace ? { dateText: birthText, placeText: birthPlace } : null,
      death: !living && (deathText || deathPlace) ? { dateText: deathText, placeText: deathPlace } : null
    };
    if (extra) Object.keys(extra).forEach(function (k) {
      payload[k] = extra[k];
    });
    return payload;
  }

  function openPersonForm(cfg) {
    if (!requireContributor()) return;
    cfg = cfg || {};
    var v = cfg.values || {};
    var sex = v.sex || cfg.defaultSex || 'U';
    var living = v.living != null ? v.living : true;
    var body =
      (cfg.intro ? '<p class="muted small">' + esc(cfg.intro) + '</p>' : '') +
      '<div class="field-row">' +
      '<div class="field"><label>Given names</label><input type="text" id="fGiven" autocomplete="off" placeholder="e.g. Mary Josephine" value="' +
      esc(v.given || v.givenNames || '') +
      '" /></div>' +
      '<div class="field"><label>Surname</label><input type="text" id="fSurname" autocomplete="off" value="' +
      esc(v.surname || cfg.defaultSurname || '') +
      '" /></div></div>' +
      '<div class="field-row">' +
      '<div class="field"><label>Birth surname</label><input type="text" id="fBirthSurname" value="' +
      esc(v.birthSurname || '') +
      '" /></div>' +
      '<div class="field"><label>Nickname</label><input type="text" id="fNick" value="' +
      esc(v.nickname || '') +
      '" /></div></div>' +
      '<div class="field"><label>Sex</label><div class="seg seg--block" id="fSex">' +
      '<button type="button" data-value="M" aria-pressed="' +
      (sex === 'M') +
      '">Male</button>' +
      '<button type="button" data-value="F" aria-pressed="' +
      (sex === 'F') +
      '">Female</button>' +
      '<button type="button" data-value="U" aria-pressed="' +
      (sex === 'U') +
      '">Unknown</button></div></div>' +
      '<div class="field-row">' +
      '<div class="field"><label>Birth date</label><input type="text" id="fBirth" placeholder="e.g. abt 1842, Q2 1864" value="' +
      esc(v.birth || v.birthDateText || '') +
      '" /><span class="hint">Approximate is fine: abt, bef, aft, 1850–1855</span></div>' +
      '<div class="field"><label>Birth place</label><input type="text" id="fBirthPlace" placeholder="Townland, county" value="' +
      esc(v.birthPlace || v.birthPlaceShort || '') +
      '" /></div></div>' +
      '<div class="toggle"><div><strong>Living</strong><div class="hint muted small">Living people are only shown to family with the link</div></div>' +
      '<button type="button" class="switch" id="fLiving" role="switch" aria-checked="' +
      living +
      '"></button></div>' +
      '<div id="deathFields" class="' +
      (living ? 'hidden' : '') +
      '"><div class="field-row">' +
      '<div class="field"><label>Death date</label><input type="text" id="fDeath" placeholder="e.g. 14 Mar 1931" value="' +
      esc(v.death || v.deathDateText || '') +
      '" /></div>' +
      '<div class="field"><label>Death place</label><input type="text" id="fDeathPlace" value="' +
      esc(v.deathPlace || v.deathPlaceShort || '') +
      '" /></div></div></div>' +
      (cfg.extraHtml || '');
    openSheet(
      cfg.title || 'Add a person',
      body,
      '<button class="btn" type="button" data-close>Cancel</button><button class="btn btn--primary" type="button" id="fSave">' +
        esc(cfg.saveLabel || 'Save') +
        '</button>',
      function (root) {
        $$('.seg', root).forEach(function (seg) {
          bindSeg(seg);
        });
        var sw = $('#fLiving', root);
        sw.addEventListener('click', function () {
          var on = sw.getAttribute('aria-checked') !== 'true';
          sw.setAttribute('aria-checked', String(on));
          $('#deathFields', root).classList.toggle('hidden', on);
        });
        setTimeout(function () {
          $('#fGiven', root).focus();
        }, 50);
        $('#fSave', root).onclick = function () {
          var given = $('#fGiven', root).value.trim();
          if (!given) {
            brief('Given name is needed', $('#fGiven', root));
            return;
          }
          var payload = personPayloadFromForm(root);
          if (cfg.collectExtra) cfg.collectExtra(root, payload);
          closeSheet();
          cfg.onSave(payload);
        };
      }
    );
  }

  function openPersonPicker(title, onPick, excludeId) {
    openSheet(
      title,
      '<div class="search"><span class="ico">\uD83D\uDD0D</span><input type="search" id="pkQ" placeholder="Search by name or year" autocomplete="off" /></div><div id="pkList" style="margin-top:.6rem"></div>',
      null,
      function (root) {
        var list = $('#pkList', root);
        function render(q) {
          API.listPersons({ q: q, limit: 40 })
            .then(function (data) {
              var res = ((data && data.persons) || []).filter(function (p) {
                return p.id !== excludeId;
              });
              list.innerHTML = res.length
                ? res
                    .map(function (p) {
                      return personRow(p).replace(
                        'href="person.html?id=' + p.id + '"',
                        'href="#" data-pick="' + p.id + '"'
                      );
                    })
                    .join('')
                : '<p class="empty">No one matches.</p>';
            })
            .catch(function (e) {
              list.innerHTML = '<p class="empty">' + esc(e.message) + '</p>';
            });
        }
        render('');
        $('#pkQ', root).addEventListener('input', function (e) {
          render(e.target.value);
        });
        list.addEventListener('click', function (e) {
          var a = e.target.closest('[data-pick]');
          if (!a) return;
          e.preventDefault();
          var id = a.getAttribute('data-pick');
          closeSheet();
          API.getPerson(id)
            .then(function (data) {
              onPick(data.person);
            })
            .catch(function () {
              onPick({ id: id });
            });
        });
        setTimeout(function () {
          $('#pkQ', root).focus();
        }, 50);
      }
    );
  }

  function chooseNewOrExisting(title, onNew, onExisting) {
    openSheet(
      title,
      '<div class="btn-row" style="flex-direction:column;align-items:stretch">' +
        '<button class="btn btn--primary" type="button" id="chNew">\u2795 Create a new person</button>' +
        '<button class="btn" type="button" id="chExisting">\uD83D\uDD0E Choose someone already in the tree</button></div>',
      null,
      function (root) {
        $('#chNew', root).onclick = function () {
          closeSheet();
          onNew();
        };
        $('#chExisting', root).onclick = function () {
          closeSheet();
          onExisting();
        };
      }
    );
  }

  function comingSoon(title, blurb) {
    var main = $('.app-main');
    if (!main) return;
    main.innerHTML =
      '<section class="card"><h2>' +
      esc(title) +
      '</h2><p class="muted">' +
      esc(blurb) +
      '</p><p class="phase-note">This view is a shell for Phase 0. Editing people, charts and photos arrive in later phases.</p></section>';
  }

  function refreshMe() {
    if (!A.isSignedIn()) return Promise.resolve(null);
    return API.whoAmI()
      .then(function (me) {
        A.setSession(A.getSessionToken(), me);
        return me;
      })
      .catch(function (e) {
        if (e.status === 403) {
          A.signOutLocal();
        }
        return null;
      });
  }

  return {
    $: $,
    $$: $$,
    esc: esc,
    brief: brief,
    renderShell: renderShell,
    openConnectSheet: openConnectSheet,
    openRegisterSheet: openRegisterSheet,
    openResetSheet: openResetSheet,
    openAccountMenu: openAccountMenu,
    requireContributor: requireContributor,
    openSheet: openSheet,
    closeSheet: closeSheet,
    comingSoon: comingSoon,
    refreshMe: refreshMe,
    avatar: avatar,
    personRow: personRow,
    bindSeg: bindSeg,
    segValue: segValue,
    openPersonForm: openPersonForm,
    openPersonPicker: openPersonPicker,
    chooseNewOrExisting: chooseNewOrExisting,
    confirm: function (title, message, label, onYes) {
      if (window.ConfirmDialog) ConfirmDialog.show(title, message, label, onYes);
    }
  };
})();
