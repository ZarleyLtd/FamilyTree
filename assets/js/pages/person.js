window.FamilyTreePerson = (function () {
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
    var id = qs('id');
    if (!id) {
      location.replace('people.html');
      return;
    }
    var state = null;
    var treeName = '';

    API.lookupTree(A.getShareCode())
      .then(function (tree) {
        treeName = tree.name;
        return U.refreshMe();
      })
      .then(function () {
        return reload();
      })
      .catch(function () {
        location.replace('people.html');
      });

    function reload() {
      return API.getPerson(id).then(function (data) {
        state = data;
        renderAll();
        return data;
      });
    }

    function p() {
      return state.person;
    }

    function parentPair() {
      var fam = (state.parents || [])[0];
      if (!fam) return { father: null, mother: null, family: null };
      var a = fam.partner1, b = fam.partner2;
      var father = null, mother = null;
      [a, b].forEach(function (x) {
        if (!x) return;
        if (x.sex === 'F' && !mother) mother = x;
        else if (x.sex === 'M' && !father) father = x;
        else if (!father) father = x;
        else mother = x;
      });
      return { father: father, mother: mother, family: fam };
    }

    function siblings() {
      var out = [];
      var seen = {};
      (state.parents || []).forEach(function (fam) {
        (fam.children || []).forEach(function (c) {
          if (c.id !== id && !seen[c.id]) {
            seen[c.id] = 1;
            out.push(c);
          }
        });
      });
      return out;
    }

    function renderAll() {
      var person = p();
      document.title = F.fullName(person) + ' · Family Tree';
      U.renderShell({
        title: F.fullName(person),
        subtitle: F.lifespan(person),
        back: 'people.html'
      });
      var main = U.$('.app-main');
      var banner = qs('new')
        ? '<div class="banner">Added. Now connect them: add parents, a partner or children below.</div>'
        : '';
      main.innerHTML =
        banner +
        '<section class="card" id="hero"></section>' +
        '<div class="tabs" role="tablist" id="tabs">' +
        '<button type="button" role="tab" data-tab="family" aria-selected="true">Family</button>' +
        '<button type="button" role="tab" data-tab="timeline" aria-selected="false">Timeline</button>' +
        '<button type="button" role="tab" data-tab="photos" aria-selected="false">Photos</button>' +
        '<button type="button" role="tab" data-tab="notes" aria-selected="false">Notes</button></div>' +
        '<div class="profile-grid" id="grid">' +
        '<section class="card is-active" data-tab="family" id="family"></section>' +
        '<section class="card" data-tab="timeline" id="timeline"></section>' +
        '<section class="card" data-tab="photos" id="photos"></section>' +
        '<section class="card" data-tab="notes" id="notes"></section></div>';
      renderHero();
      renderFamily();
      renderTimeline();
      renderPhotos();
      renderNotes();
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
    }

    function renderHero() {
      var person = p();
      var living = person.living;
      U.$('#hero').innerHTML =
        '<div class="profile-hero">' +
        U.avatar(person, 'xl') +
        '<div class="profile-hero__body"><h1>' +
        U.esc(F.fullName(person)) +
        '</h1>' +
        (person.birthSurname ? '<div class="muted small">née ' + U.esc(person.birthSurname) + '</div>' : '') +
        '<div class="profile-hero__life">' +
        U.esc(F.lifeLine(person) || 'No dates recorded yet') +
        '</div>' +
        '<div class="btn-row"><span class="chip ' +
        (living ? 'chip--living' : 'chip--deceased') +
        '">' +
        (living ? 'Living' : 'Deceased') +
        '</span>' +
        (living ? '<span class="chip chip--warm" title="Only visible to family with the link">Family only</span>' : '') +
        '</div></div></div>' +
        '<div class="profile-actions">' +
        '<a class="btn btn--primary" href="tree.html?id=' +
        person.id +
        '&view=pedigree">\uD83C\uDF33 Tree</a>' +
        '<button class="btn" type="button" id="btnEdit">\u270E Edit</button>' +
        '<button class="btn" type="button" id="btnMore">\u22EF</button></div>';
      U.$('#btnEdit').onclick = editPerson;
      U.$('#btnMore').onclick = moreMenu;
    }

    function editPerson() {
      var person = p();
      U.openPersonForm({
        title: 'Edit ' + F.shortName(person),
        saveLabel: 'Save changes',
        values: {
          given: person.givenNames,
          surname: person.surname,
          birthSurname: person.birthSurname,
          nickname: person.nickname,
          sex: person.sex,
          living: person.living,
          birth: person.birthDateText,
          birthPlace: person.birthPlaceShort,
          death: person.deathDateText,
          deathPlace: person.deathPlaceShort
        },
        onSave: function (payload) {
          payload.id = person.id;
          API.updatePerson(payload)
            .then(reload)
            .then(function () {
              U.brief('Saved');
            })
            .catch(function (e) {
              U.brief(e.message || 'Could not save');
            });
        }
      });
    }

    function moreMenu() {
      var person = p();
      U.openSheet(
        'More',
        '<div class="btn-row" style="flex-direction:column;align-items:stretch">' +
          '<a class="btn" href="tree.html?id=' +
          person.id +
          '&view=pedigree">Ancestors chart</a>' +
          '<button class="btn" type="button" id="mSelf">This is me</button>' +
          '<button class="btn btn--danger" type="button" id="mDelete">Delete person</button></div>',
        null,
        function (root) {
          U.$('#mSelf', root).onclick = function () {
            U.closeSheet();
            if (!U.requireContributor()) return;
            API.setSelfPerson(person.id)
              .then(function () {
                return U.refreshMe();
              })
              .then(function () {
                U.brief('Marked as you');
              })
              .catch(function (e) {
                U.brief(e.message);
              });
          };
          U.$('#mDelete', root).onclick = function () {
            U.closeSheet();
            U.confirm(
              'Delete ' + F.shortName(person) + '?',
              'They will be removed from the tree. An admin can restore them from the change log later.',
              'Delete',
              function () {
                API.deletePerson(person.id)
                  .then(function () {
                    location.href = 'people.html';
                  })
                  .catch(function (e) {
                    U.brief(e.message);
                  });
              }
            );
          };
        }
      );
    }

    function personRows(list, optsFn) {
      return list.length
        ? list
            .map(function (x) {
              return U.personRow(x, optsFn && optsFn(x));
            })
            .join('')
        : '';
    }

    function renderFamily() {
      var par = parentPair();
      var sibs = siblings();
      var fams = state.families || [];
      var html = '';
      html +=
        '<div class="fam-group"><div class="fam-group__title"><h3>Parents</h3>' +
        (!par.father || !par.mother ? '<button class="add-link" type="button" data-add="parent">+ Add parent</button>' : '') +
        '</div>';
      html += personRows([par.father, par.mother].filter(Boolean), function (x) {
        return { tag: x.sex === 'M' ? 'Father' : x.sex === 'F' ? 'Mother' : 'Parent' };
      });
      if (!par.father && !par.mother) html += '<p class="empty">No parents recorded.</p>';
      html += '</div>';
      html +=
        '<div class="fam-group"><div class="fam-group__title"><h3>Siblings</h3><button class="add-link" type="button" data-add="sibling">+ Add sibling</button></div>';
      html += sibs.length ? personRows(sibs) : '<p class="empty">No siblings recorded.</p>';
      html += '</div>';
      fams.forEach(function (f) {
        var person = p();
        var other = f.partner1 && f.partner1.id === person.id ? f.partner2 : f.partner1;
        var kids = f.children || [];
        html +=
          '<div class="fam-group"><div class="fam-group__title"><h3>' +
          (other ? (other.sex === 'M' ? 'Husband' : other.sex === 'F' ? 'Wife' : 'Partner') : 'Children') +
          '</h3><button class="add-link" type="button" data-add="child" data-fam="' +
          f.id +
          '">+ Add child</button></div>';
        if (other) html += U.personRow(other, { tag: f.marriage && f.marriage.dateText ? 'm. ' + f.marriage.dateText : '' });
        if (f.marriage && f.marriage.dateText) {
          html +=
            '<div class="fam-union">Married ' +
            U.esc(f.marriage.dateText) +
            (f.marriage.placeText ? ', ' + U.esc(f.marriage.placeText) : '') +
            '</div>';
        }
        html += '<div style="padding-left:.6rem;border-left:2px solid var(--line);margin-left:1.3rem">';
        html += kids.length
          ? personRows(kids, function (x) {
              return x.relationType && x.relationType !== 'birth' ? { tag: x.relationType } : null;
            })
          : '<p class="empty">No children recorded.</p>';
        html += '</div></div>';
      });
      html +=
        '<div class="btn-row" style="margin-top:.4rem"><button class="add-link" type="button" data-add="partner">+ Add partner</button>' +
        (!fams.length ? '<button class="add-link" type="button" data-add="child">+ Add child</button>' : '') +
        '</div>';
      var el = U.$('#family');
      el.innerHTML = html;
      el.onclick = onAdd;
    }

    function onAdd(e) {
      var b = e.target.closest('[data-add]');
      if (!b) return;
      if (!U.requireContributor()) return;
      var kind = b.dataset.add;
      var famId = b.dataset.fam;
      var person = p();
      var par = parentPair();
      var surname = person.sex === 'F' && person.birthSurname ? person.birthSurname : person.surname;

      if (kind === 'parent') {
        var missingSex = !par.father ? 'M' : 'F';
        U.chooseNewOrExisting(
          'Add parent of ' + F.shortName(person),
          function () {
            U.openPersonForm({
              title: 'Add ' + (missingSex === 'M' ? 'father' : 'mother'),
              defaultSurname: missingSex === 'M' ? surname : '',
              defaultSex: missingSex,
              onSave: function (payload) {
                API.addParentToPerson({
                  childId: person.id,
                  parent: { new: payload.person, birth: payload.birth, death: payload.death },
                  sex: missingSex
                })
                  .then(reload)
                  .then(function () {
                    U.brief('Added parent');
                  })
                  .catch(function (err) {
                    U.brief(err.message);
                  });
              }
            });
          },
          function () {
            U.openPersonPicker(
              'Choose parent',
              function (x) {
                API.addParentToPerson({ childId: person.id, parent: { existingId: x.id }, sex: missingSex })
                  .then(reload)
                  .then(function () {
                    U.brief('Linked ' + F.shortName(x));
                  })
                  .catch(function (err) {
                    U.brief(err.message);
                  });
              },
              person.id
            );
          }
        );
      } else if (kind === 'child') {
        function addToFamily(familyId, payloadOrId) {
          var body = { familyId: familyId, relationType: payloadOrId.relationType || 'birth' };
          if (payloadOrId.id && !payloadOrId.person) body.childId = payloadOrId.id;
          else {
            body.child = payloadOrId.person;
            body.birth = payloadOrId.birth;
            body.death = payloadOrId.death;
          }
          return API.addChild(body).then(reload);
        }
        function ensureFamily() {
          if (famId) return Promise.resolve(famId);
          if ((state.families || [])[0]) return Promise.resolve(state.families[0].id);
          return API.createFamily({ partner1Id: person.id }).then(function (data) {
            return data.family.id;
          });
        }
        U.chooseNewOrExisting(
          'Add child of ' + F.shortName(person),
          function () {
            U.openPersonForm({
              title: 'Add child',
              defaultSurname: surname,
              extraHtml:
                '<div class="field"><label>Relationship</label><div class="seg seg--block" id="fRel">' +
                '<button type="button" data-value="birth" aria-pressed="true">Birth</button>' +
                '<button type="button" data-value="adopted" aria-pressed="false">Adopted</button>' +
                '<button type="button" data-value="step" aria-pressed="false">Step</button>' +
                '<button type="button" data-value="foster" aria-pressed="false">Foster</button></div></div>',
              collectExtra: function (root, payload) {
                payload.relationType = U.segValue(U.$('#fRel', root)) || 'birth';
              },
              onSave: function (payload) {
                ensureFamily()
                  .then(function (fid) {
                    return addToFamily(fid, payload);
                  })
                  .then(function () {
                    U.brief('Added child');
                  })
                  .catch(function (err) {
                    U.brief(err.message);
                  });
              }
            });
          },
          function () {
            U.openPersonPicker(
              'Choose child',
              function (x) {
                ensureFamily()
                  .then(function (fid) {
                    return addToFamily(fid, x);
                  })
                  .then(function () {
                    U.brief('Linked ' + F.shortName(x));
                  })
                  .catch(function (err) {
                    U.brief(err.message);
                  });
              },
              person.id
            );
          }
        );
      } else if (kind === 'partner') {
        U.chooseNewOrExisting(
          'Add partner of ' + F.shortName(person),
          function () {
            U.openPersonForm({
              title: 'Add partner',
              defaultSex: person.sex === 'M' ? 'F' : person.sex === 'F' ? 'M' : 'U',
              extraHtml:
                '<div class="field-row"><div class="field"><label>Marriage date</label><input type="text" id="fMarr" placeholder="e.g. 8 Jun 1941" /></div><div class="field"><label>Marriage place</label><input type="text" id="fMarrPlace" /></div></div>',
              collectExtra: function (root, payload) {
                payload.marriageDate = U.$('#fMarr', root) && U.$('#fMarr', root).value.trim();
                payload.marriagePlace = U.$('#fMarrPlace', root) && U.$('#fMarrPlace', root).value.trim();
              },
              onSave: function (payload) {
                API.createPerson(payload)
                  .then(function (created) {
                    var marriage =
                      payload.marriageDate || payload.marriagePlace
                        ? { dateText: payload.marriageDate, placeText: payload.marriagePlace }
                        : null;
                    return API.createFamily({
                      partner1Id: person.id,
                      partner2Id: created.person.id,
                      relationshipType: marriage ? 'married' : 'partners',
                      marriage: marriage
                    });
                  })
                  .then(reload)
                  .then(function () {
                    U.brief('Added partner');
                  })
                  .catch(function (err) {
                    U.brief(err.message);
                  });
              }
            });
          },
          function () {
            U.openPersonPicker(
              'Choose partner',
              function (x) {
                API.createFamily({ partner1Id: person.id, partner2Id: x.id, relationshipType: 'partners' })
                  .then(reload)
                  .then(function () {
                    U.brief('Linked ' + F.shortName(x));
                  })
                  .catch(function (err) {
                    U.brief(err.message);
                  });
              },
              person.id
            );
          }
        );
      } else if (kind === 'sibling') {
        U.chooseNewOrExisting(
          'Add sibling of ' + F.shortName(person),
          function () {
            U.openPersonForm({
              title: 'Add sibling',
              defaultSurname: surname,
              onSave: function (payload) {
                var chain = par.family
                  ? Promise.resolve(par.family.id)
                  : API.addParentToPerson({
                      childId: person.id,
                      parent: { new: { givenNames: 'Unknown', surname: surname, sex: 'U' } }
                    }).then(function (r) {
                      return r.familyId;
                    });
                chain
                  .then(function (fid) {
                    return API.addChild({
                      familyId: fid,
                      child: payload.person,
                      birth: payload.birth,
                      death: payload.death
                    });
                  })
                  .then(reload)
                  .then(function () {
                    U.brief('Added sibling');
                  })
                  .catch(function (err) {
                    U.brief(err.message);
                  });
              }
            });
          },
          function () {
            U.openPersonPicker(
              'Choose sibling',
              function (x) {
                var chain = par.family
                  ? Promise.resolve(par.family.id)
                  : API.addParentToPerson({
                      childId: person.id,
                      parent: { new: { givenNames: 'Unknown', surname: surname, sex: 'U' } }
                    }).then(function (r) {
                      return r.familyId;
                    });
                chain
                  .then(function (fid) {
                    return API.addChild({ familyId: fid, childId: x.id });
                  })
                  .then(reload)
                  .then(function () {
                    U.brief('Linked ' + F.shortName(x));
                  })
                  .catch(function (err) {
                    U.brief(err.message);
                  });
              },
              person.id
            );
          }
        );
      }
    }

    var evIcon = {
      birth: '\uD83D\uDC76',
      baptism: '\u26EA',
      marriage: '\uD83D\uDC8D',
      death: '\uD83D\uDD6F\uFE0F',
      burial: '\uD83E\uDEA6',
      census: '\uD83D\uDCF0',
      residence: '\uD83C\uDFE0',
      occupation: '\uD83E\uDDF0',
      emigration: '\uD83D\uDEA2',
      immigration: '\uD83D\uDEA2',
      military: '\uD83C\uDF96\uFE0F',
      education: '\uD83C\uDF93',
      custom: '\uD83D\uDCCC'
    };

    function renderTimeline() {
      var evs = (state.events || []).slice().sort(function (a, b) {
        return String(a.dateSort || '') < String(b.dateSort || '') ? -1 : 1;
      });
      U.$('#timeline').innerHTML =
        '<div class="card__head"><h2>Timeline</h2><button class="add-link" type="button" id="addEvent">+ Add event</button></div>' +
        (evs.length
          ? '<ul class="timeline">' +
            evs
              .map(function (e) {
                var year = e.dateSort ? String(e.dateSort).slice(0, 4) : '?';
                return (
                  '<li class="tl" data-event="' +
                  U.esc(e.id) +
                  '"><span class="tl__year">' +
                  year +
                  '</span><span class="tl__dot"></span><span><div class="tl__title">' +
                  (evIcon[e.type] || '') +
                  ' ' +
                  U.esc(F.eventLabel(e.type)) +
                  '</div><div class="tl__meta">' +
                  U.esc(e.dateText || '') +
                  (e.placeText ? ' \u00b7 ' + U.esc(e.placeText) : '') +
                  '</div>' +
                  (e.description ? '<div class="small">' + U.esc(e.description) + '</div>' : '') +
                  '</span></li>'
                );
              })
              .join('') +
            '</ul>'
          : '<p class="empty">No events yet.</p>');
      U.$('#addEvent').onclick = addEvent;
      U.$('#timeline').onclick = function (e) {
        var li = e.target.closest('[data-event]');
        if (!li) return;
        editEvent(li.getAttribute('data-event'));
      };
    }

    function editEvent(eventId) {
      var ev = (state.events || []).filter(function (e) {
        return String(e.id) === String(eventId);
      })[0];
      if (!ev) return;
      if (!U.requireContributor()) return;
      U.openSheet(
        'Edit ' + F.eventLabel(ev.type),
        '<div class="field-row"><div class="field"><label>Date</label><input type="text" id="evDate" value="' +
          U.esc(ev.dateText || '') +
          '" /></div><div class="field"><label>Place</label><input type="text" id="evPlace" value="' +
          U.esc(ev.placeText || '') +
          '" /></div></div>' +
          '<div class="field"><label>Details</label><textarea id="evDesc" rows="2">' +
          U.esc(ev.description || '') +
          '</textarea></div>',
        '<button class="btn btn--danger" type="button" id="evDel">Delete</button><button class="btn" type="button" data-close>Cancel</button><button class="btn btn--primary" type="button" id="evSave">Save</button>',
        function (root) {
          U.$('#evSave', root).onclick = function () {
            API.updateEvent({
              id: ev.id,
              dateText: U.$('#evDate', root).value.trim(),
              placeText: U.$('#evPlace', root).value.trim(),
              description: U.$('#evDesc', root).value.trim()
            })
              .then(function () {
                U.closeSheet();
                return reload();
              })
              .then(function () {
                U.brief('Event saved');
              })
              .catch(function (err) {
                U.brief(err.message);
              });
          };
          U.$('#evDel', root).onclick = function () {
            U.closeSheet();
            U.confirm('Delete this event?', 'It can be restored later from the change log.', 'Delete', function () {
              API.deleteEvent(ev.id)
                .then(reload)
                .then(function () {
                  U.brief('Event removed');
                })
                .catch(function (err) {
                  U.brief(err.message);
                });
            });
          };
        }
      );
    }

    function addEvent() {
      if (!U.requireContributor()) return;
      var types = ['census', 'residence', 'occupation', 'baptism', 'burial', 'emigration', 'military', 'education', 'custom'];
      U.openSheet(
        'Add event for ' + F.shortName(p()),
        '<div class="field"><label>Type</label><select id="evType">' +
          types
            .map(function (t) {
              return '<option value="' + t + '">' + F.eventLabel(t) + '</option>';
            })
            .join('') +
          '</select></div>' +
          '<div class="field-row"><div class="field"><label>Date</label><input type="text" id="evDate" placeholder="e.g. 2 Apr 1911 or abt 1935" /></div>' +
          '<div class="field"><label>Place</label><input type="text" id="evPlace" /></div></div>' +
          '<div class="field"><label>Details</label><textarea id="evDesc" rows="2"></textarea></div>',
        '<button class="btn" type="button" data-close>Cancel</button><button class="btn btn--primary" type="button" id="evSave">Save</button>',
        function (root) {
          U.$('#evSave', root).onclick = function () {
            API.createEvent({
              personId: p().id,
              type: U.$('#evType', root).value,
              dateText: U.$('#evDate', root).value.trim(),
              placeText: U.$('#evPlace', root).value.trim(),
              description: U.$('#evDesc', root).value.trim()
            })
              .then(function () {
                U.closeSheet();
                return reload();
              })
              .then(function () {
                U.brief('Event added');
              })
              .catch(function (err) {
                U.brief(err.message);
              });
          };
        }
      );
    }

    function renderPhotos() {
      U.$('#photos').innerHTML =
        '<div class="card__head"><h2>Photos & documents</h2></div>' +
        '<p class="empty">Photos arrive in Phase 2. You can still add people and dates now.</p>';
    }

    function renderNotes() {
      var list = state.notes || [];
      U.$('#notes').innerHTML =
        '<div class="card__head"><h2>Notes & research</h2><button class="add-link" type="button" id="addNote">+ Add note</button></div>' +
        (p().bio ? '<p>' + U.esc(p().bio) + '</p>' : '') +
        (list.length
          ? list
              .map(function (n) {
                return (
                  '<div class="note note--' +
                  n.kind +
                  '"><div class="note__kind">' +
                  (n.kind === 'todo' ? 'To do' : n.kind === 'research' ? 'Research' : 'Note') +
                  '</div>' +
                  U.esc(n.body) +
                  '<div class="note__meta">' +
                  U.esc(n.createdBy || '') +
                  ' \u00b7 ' +
                  U.esc(F.relativeTime(n.createdAt)) +
                  '</div></div>'
                );
              })
              .join('')
          : '<p class="empty">No notes yet.</p>');
      U.$('#addNote').onclick = function () {
        if (!U.requireContributor()) return;
        U.openSheet(
          'Add note',
          '<div class="field"><label>Kind</label><div class="seg seg--block" id="nKind">' +
            '<button type="button" data-value="note" aria-pressed="true">Note</button>' +
            '<button type="button" data-value="research" aria-pressed="false">Research</button>' +
            '<button type="button" data-value="todo" aria-pressed="false">To do</button></div></div>' +
            '<div class="field"><label>Text</label><textarea id="nBody" rows="4"></textarea></div>',
          '<button class="btn" type="button" data-close>Cancel</button><button class="btn btn--primary" type="button" id="nSave">Save</button>',
          function (root) {
            U.bindSeg(U.$('#nKind', root));
            U.$('#nSave', root).onclick = function () {
              var body = U.$('#nBody', root).value.trim();
              if (!body) return;
              API.createNote({ targetType: 'person', targetId: p().id, kind: U.segValue(U.$('#nKind', root)), body: body })
                .then(function () {
                  U.closeSheet();
                  return reload();
                })
                .then(function () {
                  U.brief('Note added');
                })
                .catch(function (err) {
                  U.brief(err.message);
                });
            };
          }
        );
      };
    }
  }

  return { init: init };
})();
