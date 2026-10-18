/**
 * Shared UI helpers for the mockup: shell (header/nav), avatars, sheets,
 * brief messages, person rows, the add-person form, the lightbox and a person picker.
 */
window.MockUI = (function () {
  'use strict';

  var S = window.MockStore;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function $(sel, root) {
    return (root || document).querySelector(sel);
  }
  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }
  function qs(name) {
    return new URLSearchParams(location.search).get(name);
  }
  function hue(id) {
    var h = 0;
    for (var i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
    return h;
  }

  // ---- avatar ---------------------------------------------------------------

  function initials(p) {
    return ((p.given || '?')[0] + (p.surname || ' ')[0]).toUpperCase();
  }
  function avatar(p, size) {
    var m = S.primaryMedia(p.id);
    var cls = 'avatar avatar--' + (p.sex || 'U') + (size ? ' avatar--' + size : '') + (m ? ' avatar--photo' : '');
    var style = m ? ' style="--h:' + m.hue + '"' : '';
    return '<span class="' + cls + '"' + style + ' aria-hidden="true">' + esc(initials(p)) + '</span>';
  }

  // ---- text -----------------------------------------------------------------

  function lifespan(p) {
    var b = p.birth && p.birth.year;
    var d = p.death && p.death.year;
    if (S.isLiving(p)) return b ? 'b. ' + b : 'Living';
    return (b || '?') + ' \u2013 ' + (d || '?');
  }
  function lifeLine(p) {
    var parts = [];
    if (p.birth) parts.push('Born ' + (p.birth.text || '?') + (p.birth.place ? ', ' + p.birth.place : ''));
    if (p.death) {
      var a = S.age(p);
      parts.push('Died ' + (p.death.text || '?') + (p.death.place ? ', ' + p.death.place : '') + (a != null ? ' (aged ' + a + ')' : ''));
    } else if (S.isLiving(p) && p.birth && p.birth.year) {
      parts.push('Aged ' + S.age(p));
    }
    return parts.join(' \u00b7 ');
  }
  function eventLabel(type) {
    var map = {
      birth: 'Born', baptism: 'Baptised', marriage: 'Married', divorce: 'Divorced', death: 'Died', burial: 'Buried',
      census: 'Census', residence: 'Residence', occupation: 'Occupation', education: 'Education', emigration: 'Emigrated',
      immigration: 'Immigrated', military: 'Military service', retirement: 'Retired', custom: 'Event'
    };
    return map[type] || type;
  }
  var kindIcon = { portrait: '\uD83D\uDC64', photo: '\uD83D\uDDBC\uFE0F', document: '\uD83D\uDCDC', census: '\uD83D\uDCF0', certificate: '\uD83D\uDCC4', grave: '\uD83E\uDEA6', homestead: '\uD83C\uDFE0', map: '\uD83D\uDDFA\uFE0F', other: '\uD83D\uDCCE' };
  function kindLabel(k) {
    return k.charAt(0).toUpperCase() + k.slice(1);
  }

  // ---- shell ----------------------------------------------------------------

  var NAV = [
    { id: 'home', href: 'index.html', ico: '\uD83C\uDFE1', label: 'Home' },
    { id: 'people', href: 'people.html', ico: '\uD83D\uDC65', label: 'People' },
    { id: 'tree', href: 'tree.html', ico: '\uD83C\uDF33', label: 'Tree' },
    { id: 'gallery', href: 'gallery.html', ico: '\uD83D\uDDBC\uFE0F', label: 'Photos' },
    { id: 'admin', href: 'admin.html', ico: '\u2699\uFE0F', label: 'Admin' }
  ];

  function renderShell(opts) {
    opts = opts || {};
    var page = document.body.dataset.page;
    var account = S.me();
    var mePerson = account.self ? S.person(account.self) : null;
    var header = $('.app-header');
    if (header) {
      var chip = account.signedIn
        ? '<button type="button" class="me-chip" id="meChip" title="Signed in as ' + esc(account.handle) + '">' +
          (mePerson ? avatar(mePerson, 'sm') : '<span class="avatar avatar--sm">' + esc((account.name || '?')[0]) + '</span>') +
          esc(account.name) + '</button>'
        : '<button type="button" class="me-chip me-chip--guest" id="meChip">Connect</button>';
      header.innerHTML =
        (opts.back ? '<a class="app-header__btn" href="' + esc(opts.back) + '" aria-label="Back">\u2190</a>' : '') +
        '<div class="app-header__title">' + esc(opts.title || S.tree.name) + (opts.subtitle ? '<small>' + esc(opts.subtitle) + '</small>' : '') + '</div>' +
        (opts.search !== false ? '<a class="app-header__btn" href="people.html?focus=1" aria-label="Search">\uD83D\uDD0D</a>' : '') +
        chip;
      var chipEl = $('#meChip');
      if (chipEl) chipEl.addEventListener('click', openAccountMenu);
    }
    var links = NAV.map(function (n) {
      return '<a href="' + n.href + '" class="' + (n.id === page ? 'is-active' : '') + '"><span class="ico">' + n.ico + '</span><span>' + n.label + '</span></a>';
    }).join('');
    var tab = $('.tabbar');
    if (tab) tab.innerHTML = links;
    var side = $('.sidenav');
    if (side) side.innerHTML = links + '<div class="sidenav__foot">Mockup \u00b7 fictional data<br>Nothing is saved to a server</div>';
  }

  function openAccountMenu() {
    var account = S.me();
    if (!account.signedIn) {
      openConnectSheet();
      return;
    }
    openSheet(
      'Signed in as ' + account.name,
      '<p class="muted small">Handle <span class="code">' + esc(account.handle) + '</span> \u00b7 ' + esc(account.role) +
        '<br>Same handle and password work on any device. This mock session lives in this tab only.</p>' +
        '<div class="btn-row" style="flex-direction:column;align-items:stretch">' +
        '<button class="btn" id="accSwitch">Connect as someone else</button>' +
        '<button class="btn" id="accReset">Forgot password\u2026</button>' +
        '<button class="btn btn--danger" id="accOut">Sign out</button></div>',
      null,
      function (root) {
        $('#accSwitch', root).onclick = function () {
          closeSheet();
          openConnectSheet();
        };
        $('#accReset', root).onclick = function () {
          closeSheet();
          openResetSheet(account.handle);
        };
        $('#accOut', root).onclick = function () {
          S.signOut();
          closeSheet();
          location.reload();
        };
      }
    );
  }

  function openConnectSheet() {
    openSheet(
      'Connect as a contributor',
      '<p class="muted small">Use the handle and password you chose when you registered. Mock seed password for the sample people is <span class="code">' +
        esc(S.SEED_PASSWORD) +
        '</span> (e.g. handle <span class="code">siobhan</span>).</p>' +
        '<div class="field"><label>Handle</label><input type="text" id="cnHandle" autocomplete="username" placeholder="e.g. siobhan" /></div>' +
        '<div class="field"><label>Password</label><input type="password" id="cnPass" autocomplete="current-password" /></div>' +
        '<p class="small"><a href="#" id="cnForgot">Forgot password?</a> \u00b7 <a href="#" id="cnReg">Register with an invite</a></p>' +
        '<p class="muted small" id="cnErr"></p>',
      '<button class="btn" data-close>Cancel</button><button class="btn btn--primary" id="cnGo">Connect</button>',
      function (root) {
        function go() {
          var r = S.connect($('#cnHandle', root).value, $('#cnPass', root).value);
          if (r.error) {
            $('#cnErr', root).textContent = r.error;
            return;
          }
          closeSheet();
          location.reload();
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
        '<div class="field"><label>Invite code</label><input type="text" id="rgInvite" placeholder="e.g. N8KQ2M" autocomplete="off" /><span class="hint">Sample unused invites: N8KQ2M (for Aoife), F3PL7W</span></div>' +
        '<div class="field-row"><div class="field"><label>Handle</label><input type="text" id="rgHandle" placeholder="letters, no spaces" autocomplete="username" /></div>' +
        '<div class="field"><label>Display name</label><input type="text" id="rgName" placeholder="Shown on edits" /></div></div>' +
        '<div class="field-row"><div class="field"><label>Password</label><input type="password" id="rgPass" autocomplete="new-password" /></div>' +
        '<div class="field"><label>Confirm</label><input type="password" id="rgPass2" autocomplete="new-password" /></div></div>' +
        '<p class="muted small" id="rgErr"></p>',
      '<button class="btn" data-close>Cancel</button><button class="btn btn--primary" id="rgGo">Register</button>',
      function (root) {
        $('#rgGo', root).onclick = function () {
          if ($('#rgPass', root).value !== $('#rgPass2', root).value) {
            $('#rgErr', root).textContent = 'Passwords do not match';
            return;
          }
          var r = S.register({
            inviteCode: $('#rgInvite', root).value,
            handle: $('#rgHandle', root).value,
            displayName: $('#rgName', root).value,
            password: $('#rgPass', root).value
          });
          if (r.error) {
            $('#rgErr', root).textContent = r.error;
            return;
          }
          closeSheet();
          location.reload();
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
        '<div class="field"><label>Handle</label><input type="text" id="rsHandle" value="' + esc(prefillHandle || '') + '" autocomplete="username" /></div>' +
        '<div class="field"><label>Reset code</label><input type="text" id="rsCode" placeholder="from an admin" autocomplete="off" /></div>' +
        '<div class="field"><label>New password</label><input type="password" id="rsPass" autocomplete="new-password" /></div>' +
        '<p class="muted small" id="rsErr"></p>',
      '<button class="btn" data-close>Cancel</button><button class="btn btn--primary" id="rsGo">Set new password</button>',
      function (root) {
        $('#rsGo', root).onclick = function () {
          var r = S.resetPassword({
            handle: $('#rsHandle', root).value,
            resetCode: $('#rsCode', root).value,
            newPassword: $('#rsPass', root).value
          });
          if (r.error) {
            $('#rsErr', root).textContent = r.error;
            return;
          }
          closeSheet();
          brief('Password changed \u2013 Connect with the new one');
          openConnectSheet();
        };
      }
    );
  }

  function requireContributor(thenFn) {
    if (S.isSignedIn()) {
      if (thenFn) thenFn();
      return true;
    }
    openSheet(
      'Connect to edit',
      '<p>Anyone with the family link can look around. To add or change people, photos or notes, connect as a contributor.</p>' +
        '<div class="btn-row" style="flex-direction:column;align-items:stretch">' +
        '<button class="btn btn--primary" id="needIn">Connect</button>' +
        '<button class="btn" id="needReg">Register with an invite</button></div>',
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

  // ---- brief message --------------------------------------------------------

  function brief(text, anchor, ms) {
    var el = document.createElement('div');
    el.className = 'brief';
    el.textContent = text;
    document.body.appendChild(el);
    var x = window.innerWidth / 2;
    var y = window.innerHeight * 0.35;
    if (anchor && anchor.getBoundingClientRect) {
      var r = anchor.getBoundingClientRect();
      x = r.left + r.width / 2;
      y = r.top - 8;
      if (y < 40) y = r.bottom + 36;
    }
    el.style.left = Math.max(80, Math.min(window.innerWidth - 80, x)) + 'px';
    el.style.top = y + 'px';
    setTimeout(function () {
      el.classList.add('brief--fading');
      setTimeout(function () {
        el.remove();
      }, 300);
    }, ms || 1400);
  }

  // ---- sheet ----------------------------------------------------------------

  function openSheet(title, bodyHtml, footHtml, onReady) {
    closeSheet();
    var root = document.createElement('div');
    root.className = 'sheet-backdrop';
    root.id = 'sheet';
    root.innerHTML =
      '<div class="sheet" role="dialog" aria-modal="true"><div class="sheet__grab"></div>' +
      '<div class="sheet__head"><h2>' + esc(title) + '</h2><button class="btn btn--icon" data-close aria-label="Close">\u2715</button></div>' +
      '<div class="sheet__body">' + bodyHtml + '</div>' +
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
  function confirm(title, message, label, onYes) {
    openSheet(title, '<p>' + esc(message) + '</p>', '<button class="btn" data-close>Cancel</button><button class="btn btn--danger" id="confirmYes">' + esc(label) + '</button>', function (root) {
      $('#confirmYes', root).addEventListener('click', function () {
        closeSheet();
        onYes();
      });
    });
  }

  // ---- segmented controls ---------------------------------------------------

  function bindSeg(root, onChange) {
    $$('button', root).forEach(function (b) {
      b.addEventListener('click', function () {
        $$('button', root).forEach(function (x) {
          x.setAttribute('aria-pressed', x === b ? 'true' : 'false');
        });
        if (onChange) onChange(b.dataset.value);
      });
    });
  }
  function segValue(root) {
    var b = $('button[aria-pressed="true"]', root);
    return b ? b.dataset.value : null;
  }

  // ---- person rows ----------------------------------------------------------

  function personRow(p, opts) {
    opts = opts || {};
    var meta = opts.meta != null ? opts.meta : lifespan(p) + (p.birth && p.birth.place ? ' \u00b7 ' + p.birth.place.split(',')[0] : '');
    return (
      '<a class="person-row" href="person.html?id=' + esc(p.id) + '">' +
      avatar(p) +
      '<span class="person-row__body"><span class="person-row__name">' + esc(S.fullName(p)) + '</span>' +
      '<span class="person-row__meta">' + esc(meta) + '</span></span>' +
      (opts.tag ? '<span class="person-row__tag">' + esc(opts.tag) + '</span>' : '') +
      '<span class="person-row__chev">\u203A</span></a>'
    );
  }

  // ---- fuzzy date (mock) ----------------------------------------------------

  function parseDate(text) {
    text = (text || '').trim();
    if (!text) return null;
    var m = /(\d{4})/.exec(text);
    return { text: text, year: m ? parseInt(m[1], 10) : null, place: '' };
  }

  // ---- add person form ------------------------------------------------------

  /**
   * @param {{title:string, defaultSurname?:string, defaultSex?:string, relation?:string, onSave:function(input)}} cfg
   */
  function openPersonForm(cfg) {
    if (!S.isSignedIn()) {
      requireContributor();
      return;
    }
    var v = cfg.values || {};
    var sex = v.sex || cfg.defaultSex || 'U';
    var living = v.living != null ? v.living : true;
    var body =
      (cfg.intro ? '<p class="muted small">' + esc(cfg.intro) + '</p>' : '') +
      '<div class="field-row">' +
      '<div class="field"><label>Given names</label><input type="text" id="fGiven" autocomplete="off" placeholder="e.g. Mary Josephine" value="' + esc(v.given || '') + '" /></div>' +
      '<div class="field"><label>Surname</label><input type="text" id="fSurname" autocomplete="off" value="' + esc(v.surname || cfg.defaultSurname || '') + '" /></div>' +
      '</div>' +
      '<div class="field"><label>Sex</label><div class="seg seg--block" id="fSex">' +
      '<button type="button" data-value="M" aria-pressed="' + (sex === 'M') + '">Male</button>' +
      '<button type="button" data-value="F" aria-pressed="' + (sex === 'F') + '">Female</button>' +
      '<button type="button" data-value="U" aria-pressed="' + (sex === 'U') + '">Unknown</button></div></div>' +
      '<div class="field-row">' +
      '<div class="field"><label>Birth date</label><input type="text" id="fBirth" placeholder="e.g. abt 1842, Q2 1864" value="' + esc(v.birth || '') + '" /><span class="hint">Approximate is fine: abt, bef, aft, 1850\u20131855</span></div>' +
      '<div class="field"><label>Birth place</label><input type="text" id="fBirthPlace" placeholder="Townland, county" value="' + esc(v.birthPlace || '') + '" /></div>' +
      '</div>' +
      '<div class="toggle"><div><strong>Living</strong><div class="hint muted small">Living people are only shown to family with the link</div></div><button type="button" class="switch" id="fLiving" role="switch" aria-checked="' + living + '"></button></div>' +
      '<div id="deathFields" class="' + (living ? 'hidden' : '') + '"><div class="field-row">' +
      '<div class="field"><label>Death date</label><input type="text" id="fDeath" placeholder="e.g. 14 Mar 1931" value="' + esc(v.death || '') + '" /></div>' +
      '<div class="field"><label>Death place</label><input type="text" id="fDeathPlace" value="' + esc(v.deathPlace || '') + '" /></div></div></div>' +
      (cfg.extraHtml || '');
    var foot = '<button class="btn" data-close>Cancel</button><button class="btn btn--primary" id="fSave">' + esc(cfg.saveLabel || 'Save') + '</button>';
    openSheet(cfg.title, body, foot, function (root) {
      bindSeg($('#fSex', root));
      var sw = $('#fLiving', root);
      sw.addEventListener('click', function () {
        var on = sw.getAttribute('aria-checked') !== 'true';
        sw.setAttribute('aria-checked', String(on));
        $('#deathFields', root).classList.toggle('hidden', on);
      });
      setTimeout(function () {
        $('#fGiven', root).focus();
      }, 50);
      $('#fSave', root).addEventListener('click', function () {
        var given = $('#fGiven', root).value.trim();
        if (!given) {
          brief('Given name is needed', $('#fGiven', root));
          return;
        }
        var living = sw.getAttribute('aria-checked') === 'true';
        var birth = parseDate($('#fBirth', root).value);
        if (birth) birth.place = $('#fBirthPlace', root).value.trim();
        var death = living ? null : parseDate($('#fDeath', root).value);
        if (death) death.place = $('#fDeathPlace', root).value.trim();
        var input = { given: given, surname: $('#fSurname', root).value.trim(), sex: segValue($('#fSex', root)), birth: birth, death: death, living: living };
        closeSheet();
        cfg.onSave(input);
      });
    });
  }

  // ---- person picker --------------------------------------------------------

  function openPersonPicker(title, onPick, excludeId) {
    var body = '<div class="search"><span class="ico">\uD83D\uDD0D</span><input type="search" id="pkQ" placeholder="Search by name or year" autocomplete="off" /></div><div id="pkList" style="margin-top:.6rem"></div>';
    openSheet(title, body, null, function (root) {
      var list = $('#pkList', root);
      function render(q) {
        var res = q ? S.search(q) : S.persons().slice().sort(S.byBirth).reverse();
        res = res.filter(function (p) {
          return p.id !== excludeId;
        }).slice(0, 30);
        list.innerHTML = res.length ? res.map(function (p) {
          return personRow(p).replace('href="person.html?id=' + p.id + '"', 'href="#" data-pick="' + p.id + '"');
        }).join('') : '<p class="empty">No one matches.</p>';
      }
      render('');
      $('#pkQ', root).addEventListener('input', function (e) {
        render(e.target.value);
      });
      list.addEventListener('click', function (e) {
        var a = e.target.closest('[data-pick]');
        if (!a) return;
        e.preventDefault();
        closeSheet();
        onPick(S.person(a.dataset.pick));
      });
      setTimeout(function () {
        $('#pkQ', root).focus();
      }, 50);
    });
  }

  // ---- media tiles + lightbox -----------------------------------------------

  function tile(m) {
    var doc = /document|census|certificate/.test(m.kind);
    return (
      '<button class="tile' + (doc ? ' tile--doc' : '') + '" style="--h:' + m.hue + '" data-media="' + esc(m.id) + '" title="' + esc(m.title) + '">' +
      '<span class="tile__kind">' + esc(kindLabel(m.kind)) + '</span>' +
      '<span class="tile__ico">' + kindIcon[m.kind] + '</span>' +
      '<span class="tile__cap">' + esc(m.title) + '<br><span style="opacity:.8;font-weight:500">' + esc(m.date || '') + '</span></span></button>'
    );
  }

  function openLightbox(list, index) {
    var i = index;
    var root = document.createElement('div');
    root.className = 'lightbox';
    document.body.appendChild(root);
    document.body.style.overflow = 'hidden';
    function render() {
      var m = list[i];
      var people = m.people.map(S.person).filter(Boolean);
      root.innerHTML =
        '<div class="lightbox__top"><span class="small">' + (i + 1) + ' / ' + list.length + '</span><div class="btn-row">' +
        '<button class="btn btn--sm" id="lbEdit">\u270E Edit</button><button class="btn btn--icon" id="lbClose" aria-label="Close">\u2715</button></div></div>' +
        '<div class="lightbox__stage"><div class="lightbox__img" style="--h:' + m.hue + '">' + kindIcon[m.kind] + '</div>' +
        '<button class="lightbox__nav lightbox__nav--l" id="lbPrev" aria-label="Previous">\u2039</button><button class="lightbox__nav lightbox__nav--r" id="lbNext" aria-label="Next">\u203A</button></div>' +
        '<div class="lightbox__info"><div class="lightbox__title">' + esc(m.title) + '</div>' +
        '<div class="lightbox__meta">' + esc(kindLabel(m.kind)) + (m.date ? ' \u00b7 ' + esc(m.date) : '') + (m.place ? ' \u00b7 ' + esc(m.place) : '') + '</div>' +
        (people.length ? '<div class="lightbox__people">' + people.map(function (p) {
          return '<a href="person.html?id=' + p.id + '">' + esc(S.shortName(p)) + '</a>';
        }).join('') + '</div>' : '<div class="small" style="opacity:.6">No one tagged yet \u2013 tap Edit to tag people</div>') +
        '<p class="small" style="opacity:.5;margin-top:.8rem">Swipe or use arrow keys to move between items. Pinch to zoom (in the real app).</p></div>';
      $('#lbClose', root).onclick = close;
      $('#lbPrev', root).onclick = prev;
      $('#lbNext', root).onclick = next;
      $('#lbEdit', root).onclick = function () {
        brief('Edit caption / tags (mock)', this);
      };
    }
    function close() {
      root.remove();
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    }
    function prev() {
      i = (i - 1 + list.length) % list.length;
      render();
    }
    function next() {
      i = (i + 1) % list.length;
      render();
    }
    function onKey(e) {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    }
    document.addEventListener('keydown', onKey);
    var sx = null;
    root.addEventListener('pointerdown', function (e) {
      sx = e.clientX;
    });
    root.addEventListener('pointerup', function (e) {
      if (sx == null) return;
      var dx = e.clientX - sx;
      sx = null;
      if (Math.abs(dx) > 50) dx < 0 ? next() : prev();
    });
    render();
  }

  function bindTiles(container, list) {
    container.addEventListener('click', function (e) {
      var t = e.target.closest('[data-media]');
      if (!t) return;
      var idx = list.findIndex(function (m) {
        return m.id === t.dataset.media;
      });
      openLightbox(list, Math.max(0, idx));
    });
  }

  // ---- upload sheet (mock) --------------------------------------------------

  function openUploadSheet(preselect, onDone) {
    if (!S.isSignedIn()) {
      requireContributor();
      return;
    }
    var hue = Math.floor(Math.random() * 360);
    var people = S.persons().slice().sort(S.byBirth).reverse().slice(0, 40);
    var body =
      '<div class="upload-preview" id="upPrev" style="--h:' + hue + '">\uD83D\uDCF7</div>' +
      '<p class="muted small">In the real app this is the camera / photo picker. The image is resized to about 100 KB before upload.</p>' +
      '<div class="field"><label>Kind</label><div class="chip-row" id="upKind">' +
      ['photo', 'portrait', 'document', 'census', 'certificate', 'grave', 'homestead'].map(function (k, idx) {
        return '<span class="chip ' + (idx === 0 ? 'is-active' : '') + '" data-value="' + k + '">' + kindIcon[k] + ' ' + kindLabel(k) + '</span>';
      }).join('') + '</div></div>' +
      '<div class="field"><label>Title</label><input type="text" id="upTitle" placeholder="e.g. Granny at Dollymount, 1952" /></div>' +
      '<div class="field-row"><div class="field"><label>Date</label><input type="text" id="upDate" placeholder="abt 1952" /></div>' +
      '<div class="field"><label>Place</label><input type="text" id="upPlace" /></div></div>' +
      '<div class="field"><label>People in this item</label><div class="people-pick" id="upPeople">' +
      people.map(function (p) {
        var on = preselect && preselect.indexOf(p.id) >= 0;
        return '<span class="chip ' + (on ? 'is-active' : '') + '" data-value="' + p.id + '">' + esc(S.shortName(p)) + '</span>';
      }).join('') + '</div></div>';
    openSheet('Add photo or document', body, '<button class="btn" data-close>Cancel</button><button class="btn btn--primary" id="upSave">Upload</button>', function (root) {
      function chipToggle(container, single) {
        container.addEventListener('click', function (e) {
          var c = e.target.closest('.chip');
          if (!c) return;
          if (single) $$('.chip', container).forEach(function (x) {
            x.classList.remove('is-active');
          });
          c.classList.toggle('is-active', single ? true : !c.classList.contains('is-active'));
        });
      }
      chipToggle($('#upKind', root), true);
      chipToggle($('#upPeople', root), false);
      $('#upSave', root).addEventListener('click', function () {
        var title = $('#upTitle', root).value.trim() || 'Untitled';
        var kind = $('.chip.is-active', $('#upKind', root)).dataset.value;
        var ppl = $$('.chip.is-active', $('#upPeople', root)).map(function (c) {
          return c.dataset.value;
        });
        var d = parseDate($('#upDate', root).value);
        var m = S.addMedia({ kind: kind, title: title, date: d ? d.text : '', year: d ? d.year : null, place: $('#upPlace', root).value.trim(), people: ppl, hue: hue });
        closeSheet();
        brief('Uploaded \u201c' + title + '\u201d');
        if (onDone) onDone(m);
      });
    });
  }

  return {
    esc: esc, $: $, $$: $$, qs: qs, hue: hue,
    avatar: avatar, initials: initials, lifespan: lifespan, lifeLine: lifeLine, eventLabel: eventLabel, kindIcon: kindIcon, kindLabel: kindLabel,
    renderShell: renderShell, brief: brief, openSheet: openSheet, closeSheet: closeSheet, confirm: confirm,
    bindSeg: bindSeg, segValue: segValue, personRow: personRow, parseDate: parseDate,
    openPersonForm: openPersonForm, openPersonPicker: openPersonPicker,
    tile: tile, openLightbox: openLightbox, bindTiles: bindTiles, openUploadSheet: openUploadSheet,
    requireContributor: requireContributor, openConnectSheet: openConnectSheet, openRegisterSheet: openRegisterSheet
  };
})();
