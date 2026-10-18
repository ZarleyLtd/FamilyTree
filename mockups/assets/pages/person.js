(function () {
  'use strict';
  var S = window.MockStore, U = window.MockUI, K = window.Kinship;

  var id = U.qs('id') || S.me().self || S.tree.homePerson;
  var p = S.person(id);
  if (!p) {
    location.replace('people.html');
    return;
  }
  U.renderShell({ title: S.fullName(p), subtitle: U.lifespan(p), back: 'people.html' });
  document.title = S.fullName(p) + ' · Family Tree mockup';
  if (U.qs('new')) U.$('#newBanner').classList.remove('hidden');

  var meId = S.me().self;

  // ---- hero -----------------------------------------------------------------
  function renderHero() {
    var living = S.isLiving(p);
    U.$('#hero').innerHTML =
      '<div class="profile-hero">' + U.avatar(p, 'xl') +
      '<div class="profile-hero__body"><h1>' + U.esc(S.fullName(p)) + '</h1>' +
      (p.birthSurname ? '<div class="muted small">née ' + U.esc(p.birthSurname) + '</div>' : '') +
      '<div class="profile-hero__life">' + U.esc(U.lifeLine(p) || 'No dates recorded yet') + '</div>' +
      '<div class="btn-row"><span class="chip ' + (living ? 'chip--living' : 'chip--deceased') + '">' + (living ? 'Living' : 'Deceased') + '</span>' +
      (p.occupation ? '<span class="chip">' + U.esc(p.occupation) + '</span>' : '') +
      (living ? '<span class="chip chip--warm" title="Only visible to family with the link">🔒 Family only</span>' : '') +
      '</div></div></div>' +
      '<div class="profile-actions">' +
      '<a class="btn btn--primary" href="tree.html?id=' + p.id + '&view=pedigree">🌳 Tree</a>' +
      (p.id !== meId ? '<button class="btn" id="btnRel">🧭 Related to me?</button>' : '<span class="chip chip--living" style="align-self:center">This is you</span>') +
      '<button class="btn" id="btnEdit">✎ Edit</button>' +
      '<button class="btn" id="btnPhoto">📷 Add photo</button>' +
      '<button class="btn" id="btnMore">⋯</button>' +
      '</div>';
    var rel = U.$('#btnRel');
    if (rel) rel.addEventListener('click', showRelationship);
    U.$('#btnEdit').addEventListener('click', editPerson);
    U.$('#btnPhoto').addEventListener('click', function () {
      U.openUploadSheet([p.id], function () {
        renderPhotos();
        renderTimeline();
      });
    });
    U.$('#btnMore').addEventListener('click', function (e) {
      U.openSheet('More', '<div class="btn-row" style="flex-direction:column;align-items:stretch">' +
        '<a class="btn" href="tree.html?id=' + p.id + '&view=descendants">Descendants chart</a>' +
        '<a class="btn" href="tree.html?id=' + p.id + '&view=fan">Fan chart</a>' +
        '<button class="btn" id="mShare">Copy link to this person</button>' +
        '<button class="btn" id="mMerge">Merge with a duplicate…</button>' +
        '<button class="btn btn--danger" id="mDelete">Delete person</button></div>', null, function (root) {
        U.$('#mShare', root).onclick = function () {
          U.closeSheet();
          U.brief('Link copied (includes the family share code)', e.target);
        };
        U.$('#mMerge', root).onclick = function () {
          U.closeSheet();
          U.openPersonPicker('Merge ' + S.shortName(p) + ' with…', function (other) {
            U.brief('Would merge with ' + S.shortName(other) + ' (mock)');
          }, p.id);
        };
        U.$('#mDelete', root).onclick = function () {
          U.closeSheet();
          U.confirm('Delete ' + S.shortName(p) + '?', 'They will be removed from the tree. An admin can restore them from the change log.', 'Delete', function () {
            U.brief('Deleted (mock) – admins can restore');
            setTimeout(function () {
              location.href = 'people.html';
            }, 900);
          });
        };
      });
    });
  }

  function editPerson() {
    U.openPersonForm({
      title: 'Edit ' + S.shortName(p),
      saveLabel: 'Save changes',
      values: {
        given: p.given, surname: p.surname, sex: p.sex, living: S.isLiving(p),
        birth: p.birth ? p.birth.text : '', birthPlace: p.birth ? p.birth.place : '',
        death: p.death ? p.death.text : '', deathPlace: p.death ? p.death.place : ''
      },
      onSave: function (input) {
        // mock: mutate in memory for this page only
        p.given = input.given;
        p.surname = input.surname;
        p.sex = input.sex;
        p.birth = input.birth || p.birth;
        p.death = input.living ? null : input.death || p.death;
        p.living = input.living;
        renderAll();
        U.brief('Saved – logged as “' + (S.me().name || 'Guest') + ' edited ' + S.shortName(p) + '”');
      }
    });
  }

  // ---- relationship ---------------------------------------------------------
  function showRelationship() {
    var r = K.relation(meId, p.id);
    var path = r.path.map(S.person).filter(Boolean);
    var body = '<div class="rel-result"><div class="muted small">' + U.esc(S.shortName(p)) + ' is</div><div class="rel-result__term">' + U.esc(r.term) + '</div>' +
      (r.description ? '<div class="muted small" style="margin-top:.3rem">' + U.esc(r.description) + '</div>' : '') + '</div>';
    if (path.length > 1) {
      body += '<div class="rel-path">' + path.map(function (x, i) {
        var next = path[i + 1];
        var arrow = '';
        if (next) {
          var isParent = S.parentsOf(x.id).father && S.parentsOf(x.id).father.id === next.id || S.parentsOf(x.id).mother && S.parentsOf(x.id).mother.id === next.id;
          var isChild = S.childrenOf(x.id).some(function (c) {
            return c.id === next.id;
          });
          arrow = isParent ? '↑ ' + (next.sex === 'M' ? 'father' : next.sex === 'F' ? 'mother' : 'parent') : isChild ? '↓ ' + (next.sex === 'M' ? 'son' : next.sex === 'F' ? 'daughter' : 'child') : '↔ ' + (next.sex === 'M' ? 'husband' : 'wife');
        }
        return '<div class="rel-path__step">' + U.avatar(x, 'sm') + '<a href="person.html?id=' + x.id + '">' + U.esc(S.shortName(x)) + '</a><span class="muted small">' + U.esc(U.lifespan(x)) + '</span></div>' +
          (arrow ? '<div class="rel-path__arrow">' + arrow + '</div>' : '');
      }).join('') + '</div>';
    }
    U.openSheet('How are we related?', body, '<button class="btn" data-close>Close</button>');
  }

  // ---- family ---------------------------------------------------------------
  function personRows(list, opts) {
    return list.length ? list.map(function (x) {
      return U.personRow(x, opts && opts(x));
    }).join('') : '';
  }

  function renderFamily() {
    var par = S.parentsOf(p.id);
    var sibs = S.siblingsOf(p.id);
    var fams = S.familiesOf(p.id);
    var html = '';

    html += '<div class="fam-group"><div class="fam-group__title"><h3>Parents</h3>' +
      ((!par.father || !par.mother) ? '<button class="add-link" data-add="parent">+ Add parent</button>' : '') + '</div>';
    html += personRows([par.father, par.mother].filter(Boolean), function (x) {
      return { tag: x.sex === 'M' ? 'Father' : x.sex === 'F' ? 'Mother' : 'Parent' };
    });
    if (!par.father && !par.mother) html += '<p class="empty">No parents recorded.</p>';
    html += '</div>';

    html += '<div class="fam-group"><div class="fam-group__title"><h3>Siblings</h3><button class="add-link" data-add="sibling">+ Add sibling</button></div>';
    html += sibs.length ? personRows(sibs) : '<p class="empty">No siblings recorded.</p>';
    html += '</div>';

    fams.forEach(function (f) {
      var other = S.person(f.p1 === p.id ? f.p2 : f.p1);
      var kids = f.children.map(S.person).filter(Boolean).sort(S.byBirth);
      html += '<div class="fam-group"><div class="fam-group__title"><h3>' + (other ? (other.sex === 'M' ? 'Husband' : other.sex === 'F' ? 'Wife' : 'Partner') : 'Children') + '</h3>' +
        '<button class="add-link" data-add="child" data-fam="' + f.id + '">+ Add child</button></div>';
      if (other) html += U.personRow(other, { tag: f.marriage ? 'm. ' + (f.marriage.year || '') : '' });
      if (f.marriage) html += '<div class="fam-union">💍 Married ' + U.esc(f.marriage.text) + (f.marriage.place ? ', ' + U.esc(f.marriage.place) : '') + '</div>';
      html += '<div style="padding-left:.6rem;border-left:2px solid var(--line);margin-left:1.3rem">';
      html += kids.length ? personRows(kids) : '<p class="empty">No children recorded.</p>';
      html += '</div></div>';
    });
    html += '<div class="btn-row" style="margin-top:.4rem"><button class="add-link" data-add="partner">+ Add partner</button>' +
      (!fams.length ? '<button class="add-link" data-add="child">+ Add child</button>' : '') + '</div>';
    U.$('#family').innerHTML = html;

    U.$('#family').addEventListener('click', onAdd);
  }

  function onAdd(e) {
    var b = e.target.closest('[data-add]');
    if (!b) return;
    if (!U.requireContributor()) return;
    var kind = b.dataset.add;
    var famId = b.dataset.fam;
    var par = S.parentsOf(p.id);
    var surname = p.sex === 'F' && p.birthSurname ? p.birthSurname : p.surname;
    function choose(title, onNew, onExisting) {
      U.openSheet(title, '<div class="btn-row" style="flex-direction:column;align-items:stretch">' +
        '<button class="btn btn--primary" id="chNew">➕ Create a new person</button>' +
        '<button class="btn" id="chExisting">🔎 Choose someone already in the tree</button></div>', null, function (root) {
        U.$('#chNew', root).onclick = function () {
          U.closeSheet();
          onNew();
        };
        U.$('#chExisting', root).onclick = function () {
          U.closeSheet();
          onExisting();
        };
      });
    }
    if (kind === 'parent') {
      var missingSex = !par.father ? 'M' : 'F';
      choose('Add parent of ' + S.shortName(p), function () {
        U.openPersonForm({ title: 'Add ' + (missingSex === 'M' ? 'father' : 'mother'), defaultSurname: missingSex === 'M' ? surname : '', defaultSex: missingSex, onSave: function (input) {
          S.addParent(p.id, input);
          renderAll();
          U.brief('Added ' + input.given + ' as ' + (input.sex === 'M' ? 'father' : 'mother'));
        } });
      }, function () {
        U.openPersonPicker('Choose parent', function (x) {
          U.brief('Would link ' + S.shortName(x) + ' as parent (mock)');
        }, p.id);
      });
    } else if (kind === 'child') {
      choose('Add child of ' + S.shortName(p), function () {
        U.openPersonForm({ title: 'Add child', defaultSurname: p.sex === 'F' ? (S.partnersOf(p.id)[0] || {}).surname || surname : surname, onSave: function (input) {
          S.addChild(p.id, famId, input);
          renderAll();
          U.brief('Added ' + input.given);
        } });
      }, function () {
        U.openPersonPicker('Choose child', function (x) {
          U.brief('Would link ' + S.shortName(x) + ' as child (mock)');
        }, p.id);
      });
    } else if (kind === 'partner') {
      choose('Add partner of ' + S.shortName(p), function () {
        U.openPersonForm({ title: 'Add partner', defaultSex: p.sex === 'M' ? 'F' : p.sex === 'F' ? 'M' : 'U',
          extraHtml: '<div class="field-row"><div class="field"><label>Marriage date</label><input type="text" id="fMarr" placeholder="e.g. 8 Jun 1941" /></div><div class="field"><label>Marriage place</label><input type="text" id="fMarrPlace" /></div></div>',
          onSave: function (input) {
            S.addPartner(p.id, input, null);
            renderAll();
            U.brief('Added ' + input.given + ' as partner');
          } });
      }, function () {
        U.openPersonPicker('Choose partner', function (x) {
          U.brief('Would link ' + S.shortName(x) + ' as partner (mock)');
        }, p.id);
      });
    } else if (kind === 'sibling') {
      var famOf = par.family;
      choose('Add sibling of ' + S.shortName(p), function () {
        U.openPersonForm({ title: 'Add sibling', defaultSurname: surname, onSave: function (input) {
          if (famOf) S.addChild(famOf.p1 || famOf.p2, famOf.id, input);
          else {
            var parent = S.addParent(p.id, { given: 'Unknown', surname: surname, sex: 'U' });
            S.addChild(parent.id, null, input);
          }
          renderAll();
          U.brief('Added ' + input.given + ' as sibling');
        } });
      }, function () {
        U.openPersonPicker('Choose sibling', function (x) {
          U.brief('Would link ' + S.shortName(x) + ' as sibling (mock)');
        }, p.id);
      });
    }
  }

  // ---- timeline -------------------------------------------------------------
  var evIcon = { birth: '👶', baptism: '⛪', marriage: '💍', death: '🕯️', burial: '🪦', census: '📰', residence: '🏠', occupation: '🧰', emigration: '🚢', immigration: '🚢', military: '🎖️', education: '🎓', custom: '📌' };
  function renderTimeline() {
    var evs = S.eventsOf(p.id).map(function (e) {
      return { year: e.year || 0, html: '<li class="tl"><span class="tl__year">' + (e.year || '?') + '</span><span class="tl__dot"></span><span><div class="tl__title">' + (evIcon[e.type] || '') + ' ' + U.esc(U.eventLabel(e.type)) + (e.description && e.type === 'marriage' ? ' ' + U.esc(e.description) : '') + '</div>' +
        '<div class="tl__meta">' + U.esc(e.date || '') + (e.place ? ' · ' + U.esc(e.place) : '') + '</div>' + (e.description && e.type !== 'marriage' ? '<div class="small">' + U.esc(e.description) + '</div>' : '') + '</span></li>' };
    });
    S.mediaOf(p.id).forEach(function (m) {
      if (!m.year) return;
      evs.push({ year: m.year, html: '<li class="tl tl--media"><span class="tl__year">' + m.year + '</span><span class="tl__dot"></span><span><div class="tl__title">' + U.kindIcon[m.kind] + ' ' + U.esc(m.title) + '</div><div class="tl__meta">' + U.esc(U.kindLabel(m.kind)) + ' · ' + U.esc(m.date) + '</div></span></li>' });
    });
    evs.sort(function (a, b) {
      return a.year - b.year;
    });
    U.$('#timeline').innerHTML = '<div class="card__head"><h2>Timeline</h2><button class="add-link" id="addEvent">+ Add event</button></div>' +
      (evs.length ? '<ul class="timeline">' + evs.map(function (e) {
        return e.html;
      }).join('') + '</ul>' : '<p class="empty">No events yet.</p>');
    U.$('#addEvent').addEventListener('click', addEvent);
  }
  function addEvent() {
    if (!U.requireContributor()) return;
    var types = ['census', 'residence', 'occupation', 'baptism', 'burial', 'emigration', 'military', 'education', 'custom'];
    U.openSheet('Add event for ' + S.shortName(p),
      '<div class="field"><label>Type</label><select id="evType">' + types.map(function (t) {
        return '<option value="' + t + '">' + U.eventLabel(t) + '</option>';
      }).join('') + '</select></div>' +
      '<div class="field-row"><div class="field"><label>Date</label><input type="text" id="evDate" placeholder="e.g. 2 Apr 1911 or abt 1935" /></div>' +
      '<div class="field"><label>Place</label><input type="text" id="evPlace" /></div></div>' +
      '<div class="field"><label>Details</label><textarea id="evDesc" rows="2" placeholder="e.g. Head of household, aged 43"></textarea></div>' +
      '<div class="field"><label>Source (optional, later phase)</label><input type="text" disabled placeholder="Cite a census return, certificate…" /></div>',
      '<button class="btn" data-close>Cancel</button><button class="btn btn--primary" id="evSave">Save</button>',
      function (root) {
        U.$('#evSave', root).onclick = function () {
          var d = U.parseDate(U.$('#evDate', root).value);
          S.addEvent(p.id, { type: U.$('#evType', root).value, date: d ? d.text : '', year: d ? d.year : null, place: U.$('#evPlace', root).value.trim(), description: U.$('#evDesc', root).value.trim() });
          U.closeSheet();
          renderTimeline();
          U.brief('Event added');
        };
      });
  }

  // ---- photos ---------------------------------------------------------------
  function renderPhotos() {
    var list = S.mediaOf(p.id).sort(function (a, b) {
      return (a.year || 0) - (b.year || 0);
    });
    U.$('#photos').innerHTML = '<div class="card__head"><h2>Photos & documents</h2><button class="add-link" id="addPhoto">+ Add</button></div>' +
      (list.length ? '<div class="media-grid" id="mediaGrid">' + list.map(U.tile).join('') + '</div>' : '<p class="empty">Nothing yet. Add a portrait, a certificate, a census page or a photo of the family home.</p>');
    if (list.length) U.bindTiles(U.$('#mediaGrid'), list);
    U.$('#addPhoto').onclick = function () {
      U.openUploadSheet([p.id], function () {
        renderPhotos();
        renderTimeline();
      });
    };
  }

  // ---- notes ----------------------------------------------------------------
  function renderNotes() {
    var list = S.notesOf(p.id);
    U.$('#notes').innerHTML = '<div class="card__head"><h2>Notes & research</h2><button class="add-link" id="addNote">+ Add note</button></div>' +
      (p.bio ? '<p>' + U.esc(p.bio) + '</p>' : '') +
      (list.length ? list.map(function (n) {
        return '<div class="note note--' + n.kind + '"><div class="note__kind">' + (n.kind === 'todo' ? '☐ To do' : n.kind === 'research' ? '🔎 Research' : 'Note') + '</div>' + U.esc(n.body) + '<div class="note__meta">' + U.esc(n.by) + ' · ' + U.esc(n.when) + '</div></div>';
      }).join('') : '<p class="empty">No notes yet.</p>');
    U.$('#addNote').onclick = function () {
      if (!U.requireContributor()) return;
      U.openSheet('Add note', '<div class="field"><label>Kind</label><div class="seg seg--block" id="nKind"><button data-value="note" aria-pressed="true">Note</button><button data-value="research" aria-pressed="false">Research</button><button data-value="todo" aria-pressed="false">To do</button></div></div>' +
        '<div class="field"><label>Text</label><textarea id="nBody" rows="4" placeholder="Stories, sources to check, things to ask Auntie Pat…"></textarea></div>',
        '<button class="btn" data-close>Cancel</button><button class="btn btn--primary" id="nSave">Save</button>', function (root) {
          U.bindSeg(U.$('#nKind', root));
          U.$('#nSave', root).onclick = function () {
            var body = U.$('#nBody', root).value.trim();
            if (!body) return;
            S.addNote(p.id, { kind: U.segValue(U.$('#nKind', root)), body: body });
            U.closeSheet();
            renderNotes();
            U.brief('Note added');
          };
        });
    };
  }

  // ---- tabs -----------------------------------------------------------------
  U.$('#tabs').addEventListener('click', function (e) {
    var b = e.target.closest('[data-tab]');
    if (!b) return;
    U.$$('#tabs button').forEach(function (x) {
      x.setAttribute('aria-selected', x === b ? 'true' : 'false');
    });
    U.$$('#grid > section').forEach(function (s) {
      s.classList.toggle('is-active', s.dataset.tab === b.dataset.tab);
    });
  });

  function renderAll() {
    renderHero();
    U.$('#family').replaceWith(U.$('#family').cloneNode(false));
    renderFamily();
    renderTimeline();
    renderPhotos();
    renderNotes();
  }
  renderAll();
})();
