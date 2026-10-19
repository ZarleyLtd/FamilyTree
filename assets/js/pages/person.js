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
      if (state.siblings && state.siblings.length) return state.siblings;
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

    function sibTag(x) {
      var word = x.sex === 'M' ? 'brother' : x.sex === 'F' ? 'sister' : 'sibling';
      if (x.kind === 'half') return 'Half-' + word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    }

    function coalesceFamilies(fams) {
      var out = [];
      var byPair = {};
      (fams || []).forEach(function (f) {
        var a = f.partner1 && f.partner1.id;
        var b = f.partner2 && f.partner2.id;
        if (!a || !b) {
          out.push(f);
          return;
        }
        var key = [a, b].sort().join('|');
        var prev = byPair[key];
        if (!prev) {
          byPair[key] = f;
          out.push(f);
          return;
        }
        var seen = {};
        (prev.children || []).forEach(function (c) {
          seen[c.id] = 1;
        });
        (f.children || []).forEach(function (c) {
          if (!seen[c.id]) {
            prev.children = (prev.children || []).concat([c]);
            seen[c.id] = 1;
          }
        });
        if (!prev.marriage && f.marriage) prev.marriage = f.marriage;
      });
      return out;
    }

    function renderAll() {
      var currentTab = U.$('#tabs button[aria-selected="true"]');
      var activeTab = currentTab ? currentTab.getAttribute('data-tab') : 'family';
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
        '<button type="button" role="tab" data-tab="family" data-help="person.tabFamily" aria-selected="true">Family</button>' +
        '<button type="button" role="tab" data-tab="timeline" data-help="person.tabTimeline" aria-selected="false">Timeline</button>' +
        '<button type="button" role="tab" data-tab="photos" data-help="person.tabPhotos" aria-selected="false">Photos</button>' +
        '<button type="button" role="tab" data-tab="notes" data-help="person.tabNotes" aria-selected="false">Notes</button></div>' +
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
      if (activeTab && activeTab !== 'family') {
        var tabBtn = U.$('#tabs button[data-tab="' + activeTab + '"]');
        if (tabBtn) tabBtn.click();
      }
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
        '" data-help="person.living">' +
        (living ? 'Living' : 'Deceased') +
        '</span>' +
        (living ? '<span class="chip chip--warm" title="Only visible to family with the link" data-help="person.familyOnly">Family only</span>' : '') +
        '</div></div></div>' +
        '<div class="profile-actions">' +
        '<a class="btn btn--primary" href="tree.html?id=' +
        person.id +
        '&view=pedigree" data-help="person.tree">\uD83C\uDF33 Tree</a>' +
        '<button class="btn" type="button" id="btnRelated" data-help="person.related">' +
        (relatedLabel()) +
        '</button>' +
        '<button class="btn" type="button" id="btnShare" data-help="person.share">Share</button>' +
        '<button class="btn" type="button" id="btnPhoto" data-help="person.photo">\uD83D\uDCF7 Photo</button>' +
        '<button class="btn" type="button" id="btnEdit" data-help="person.edit">\u270E Edit</button>' +
        '<button class="btn" type="button" id="btnMore" data-help="person.more">\u22EF</button></div>';
      U.$('#btnRelated').onclick = function () { openRelated(); };
      U.$('#btnShare').onclick = function () { U.copyPageLink(U.$('#btnShare')); };
      U.$('#btnEdit').onclick = editPerson;
      U.$('#btnMore').onclick = moreMenu;
      U.$('#btnPhoto').onclick = function () {
        window.MediaUploader.open({
          personIds: [person.id],
          asProfile: !person.thumbUrl,
          onDone: function () { reload(); }
        });
      };
    }

    function relatedLabel() {
      var me = A.getMe();
      if (me && me.selfPersonId && me.selfPersonId !== p().id) return 'How am I related?';
      return 'Related to\u2026';
    }

    function openRelated(fromId) {
      var person = p();
      var me = A.getMe();
      var start = fromId || (me && me.selfPersonId && me.selfPersonId !== person.id ? me.selfPersonId : '');
      if (!start) {
        U.openPersonPicker('Who is ' + F.shortName(person) + ' related to?', function (x) {
          openRelated(x.id);
        });
        return;
      }
      API.relationship(start, person.id)
        .then(function (rel) {
          showRelation(rel);
        })
        .catch(function (err) {
          U.brief(err.message || 'Could not calculate that');
        });
    }

    function showRelation(rel) {
      var svg = relationSvg(rel);
      U.openSheet(
        'Relationship',
        '<div class="rel-result" data-help="sheet.relation"><div class="rel-result__term">' +
          U.esc(rel.phrase || rel.term || 'No known relationship') +
          '</div>' +
          (rel.description ? '<p class="muted">' + U.esc(rel.description) + '</p>' : '') +
          '</div>' +
          svg +
          '<button class="btn" type="button" id="relOther" data-help="person.relOther">Compare with someone else</button>',
        null,
        function (root) {
          U.$('#relOther', root).onclick = function () {
            U.closeSheet();
            U.openPersonPicker('Compare ' + F.shortName(p()) + ' with\u2026', function (x) {
              openRelated(x.id);
            });
          };
        }
      );
    }

    function relationSvg(rel) {
      var path = (rel.path || []).map(function (p, i, arr) {
        if (!p) return p;
        if (p.kinTerm) return p;
        if (i === arr.length - 1 && i > 0 && rel.term) {
          return Object.assign({}, p, { kinTerm: rel.term });
        }
        return p;
      });
      var layout = window.Kinship.layoutPath(path);
      if (!layout.nodes.length) return '';
      var b = layout.bbox;
      var pad = 8;
      function relLabel(lines, x, y) {
        if (!lines || !lines.length) return '';
        var tspans = lines.map(function (line, i) {
          return '<tspan x="' + x + '" dy="' + (i === 0 ? 0 : 12) + '">' + U.esc(line) + '</tspan>';
        }).join('');
        return '<text class="n-rel" x="' + x + '" y="' + y + '" text-anchor="middle">' + tspans + '</text>';
      }
      var parts = layout.edges.map(function (e) {
        var x1 = e.from.x + e.from.w;
        var y1 = e.from.y + e.from.h / 2;
        var x2 = e.to.x;
        var html = '<path d="M' + x1 + ',' + y1 + ' H' + x2 + '" class="edge" />';
        if (e.belowLabel && e.belowLabel.length) {
          html += relLabel(e.belowLabel, (x1 + x2) / 2, y1 + 12);
        }
        return html;
      });
      layout.nodes.forEach(function (n) {
        var person = n.person || {};
        var given = String(person.givenNames || '').split(/\s+/)[0] || '';
        var raw = (given + ' ' + (person.surname || '')).trim();
        if (raw.length > 16) raw = raw.slice(0, 15) + '\u2026';
        var name = U.esc(raw);
        if (n.topLabel && n.topLabel.length) {
          var firstY = n.y - 4 - (n.topLabel.length - 1) * 12;
          parts.push(relLabel(n.topLabel, n.x + n.w / 2, firstY));
        }
        parts.push(
          '<g class="node node--' + U.esc(person.sex || 'U') + '" transform="translate(' + n.x + ',' + n.y + ')">' +
          '<a href="person.html?id=' + U.esc(n.id) + '">' +
          '<rect width="' + n.w + '" height="' + n.h + '" rx="10" />' +
          '<text class="n-name" x="' + (n.w / 2) + '" y="20" text-anchor="middle">' + name + '</text>' +
          '<text class="n-years" x="' + (n.w / 2) + '" y="36" text-anchor="middle">' + U.esc(F.lifespan(person)) + '</text>' +
          '</a></g>'
        );
      });
      var vbW = b.width + pad * 2;
      var vbH = b.height + pad * 2;
      var w = Math.max(280, vbW);
      return '<div class="rel-chart" data-help="person.relPath"><svg viewBox="' + (-pad) + ' ' + (-pad) + ' ' + vbW + ' ' + vbH +
        '" width="' + w + '" height="' + Math.ceil(vbH) + '" role="img" aria-label="Relationship path">' + parts.join('') + '</svg></div>';
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
          '&view=pedigree" data-help="person.moreAncestors">Ancestors chart</a>' +
          '<button class="btn" type="button" id="mSelf" data-help="person.thisIsMe">This is me</button>' +
          '<button class="btn btn--danger" type="button" id="mDelete" data-help="person.delete">Delete person</button></div>',
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
      var fams = coalesceFamilies(state.families || []);
      var html = '';
      html +=
        '<div class="fam-group" data-help="person.familyGroup"><div class="fam-group__title"><h3>Parents</h3>' +
        (!par.father || !par.mother ? '<button class="add-link" type="button" data-add="parent" data-help="person.addParent">+ Add parent</button>' : '') +
        '</div>';
      html += [par.father, par.mother].filter(Boolean).map(function (x) {
        var tag = x.sex === 'M' ? 'Father' : x.sex === 'F' ? 'Mother' : 'Parent';
        return (
          '<div class="fam-parent">' +
          U.personRow(x, { tag: tag }) +
          '<div class="fam-parent__acts">' +
          '<button type="button" class="add-link" data-add="change-parent" data-parent="' +
          U.esc(x.id) +
          '" data-help="person.changeParent">Change</button>' +
          '<button type="button" class="add-link add-link--danger" data-add="remove-parent" data-parent="' +
          U.esc(x.id) +
          '" data-help="person.removeParent">Remove</button>' +
          '</div></div>'
        );
      }).join('');
      if (!par.father && !par.mother) html += '<p class="empty">No parents recorded.</p>';
      html += '</div>';
      html +=
        '<div class="fam-group" data-help="person.familyGroup"><div class="fam-group__title"><h3>Siblings</h3><button class="add-link" type="button" data-add="sibling" data-help="person.addSibling">+ Add sibling</button></div>';
      html += sibs.length
        ? personRows(sibs, function (x) {
            return { tag: sibTag(x) };
          })
        : '<p class="empty">No siblings recorded.</p>';
      html += '</div>';
      fams.forEach(function (f) {
        var person = p();
        var other = f.partner1 && f.partner1.id === person.id ? f.partner2 : f.partner1;
        var kids = f.children || [];
        html +=
          '<div class="fam-group" data-help="person.familyGroup"><div class="fam-group__title"><h3>' +
          (other ? (other.sex === 'M' ? 'Husband' : other.sex === 'F' ? 'Wife' : 'Partner') : 'Children') +
          '</h3><span class="btn-row"><button class="add-link" type="button" data-add="famphoto" data-help="person.famPhoto" data-fam="' +
          f.id +
          '">+ Photo</button><button class="add-link" type="button" data-add="child" data-help="person.addChild" data-fam="' +
          f.id +
          '">+ Add child</button></span></div>';
        if (other) {
          html +=
            '<div class="fam-parent">' +
            U.personRow(other, { tag: f.marriage && f.marriage.dateText ? 'm. ' + f.marriage.dateText : '' }) +
            '<div class="fam-parent__acts">' +
            '<button type="button" class="add-link add-link--danger" data-add="remove-family" data-fam="' +
            U.esc(f.id) +
            '" data-help="person.removePartner">Remove</button>' +
            '</div></div>';
        } else {
          html +=
            '<div class="fam-parent__acts" style="margin-left:0">' +
            '<button type="button" class="add-link add-link--danger" data-add="remove-family" data-fam="' +
            U.esc(f.id) +
            '" data-help="person.removePartner">Remove this group</button></div>';
        }
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
        '<div class="btn-row" style="margin-top:.4rem"><button class="add-link" type="button" data-add="partner" data-help="person.addPartner">+ Add partner</button>' +
        (!fams.length ? '<button class="add-link" type="button" data-add="child" data-help="person.addChild">+ Add child</button>' : '') +
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

      if (kind === 'famphoto') {
        var fam = (state.families || []).filter(function (f) { return f.id === famId; })[0];
        var ids = [person.id];
        if (fam && fam.partner1 && fam.partner1.id !== person.id) ids.push(fam.partner1.id);
        if (fam && fam.partner2 && fam.partner2.id !== person.id) ids.push(fam.partner2.id);
        window.MediaUploader.open({
          personIds: ids,
          extraLinks: [{ targetType: 'family', targetId: famId }],
          onDone: function () { reload(); }
        });
        return;
      }

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
      } else if (kind === 'change-parent') {
        var oldId = b.getAttribute('data-parent');
        var oldParent = [par.father, par.mother].filter(function (x) {
          return x && x.id === oldId;
        })[0];
        var roleSex = oldParent && oldParent.sex === 'F' ? 'F' : oldParent && oldParent.sex === 'M' ? 'M' : 'U';
        function replaceParent(payload) {
          var body = { childId: person.id, oldParentId: oldId, sex: roleSex };
          if (payload.id && !payload.person) body.parent = { existingId: payload.id };
          else body.parent = { new: payload.person, birth: payload.birth, death: payload.death };
          return API.replaceParentOfPerson(body)
            .then(reload)
            .then(function () {
              U.brief('Changed parent');
            })
            .catch(function (err) {
              U.brief(err.message);
            });
        }
        U.chooseNewOrExisting(
          'Change parent of ' + F.shortName(person),
          function () {
            U.openPersonForm({
              title: 'Replace ' + (roleSex === 'M' ? 'father' : roleSex === 'F' ? 'mother' : 'parent'),
              defaultSurname: roleSex === 'M' ? surname : '',
              defaultSex: roleSex,
              onSave: function (payload) {
                replaceParent(payload);
              }
            });
          },
          function () {
            U.openPersonPicker(
              'Choose parent',
              function (x) {
                replaceParent(x);
              },
              person.id
            );
          }
        );
      } else if (kind === 'remove-family') {
        var famRow = (state.families || []).filter(function (x) {
          return x.id === famId;
        })[0];
        var otherPerson = famRow
          ? famRow.partner1 && famRow.partner1.id === person.id
            ? famRow.partner2
            : famRow.partner1
          : null;
        var kidCount = famRow && famRow.children ? famRow.children.length : 0;
        var who = otherPerson ? F.shortName(otherPerson) : 'this family group';
        var msg =
          (otherPerson
            ? 'They will no longer be shown as a partner of ' + F.shortName(person) + '. Neither person is deleted.'
            : 'This family group will be removed. People in the tree are not deleted.') +
          (kidCount
            ? ' ' +
              kidCount +
              (kidCount === 1 ? ' child' : ' children') +
              ' of this union will no longer be listed under this couple.'
            : '');
        U.confirm('Remove ' + who + '?', msg, 'Remove', function () {
          API.deleteFamily(famId)
            .then(reload)
            .then(function () {
              U.brief('Removed');
            })
            .catch(function (err) {
              U.brief(err.message);
            });
        });
      } else if (kind === 'remove-parent') {
        var removeId = b.getAttribute('data-parent');
        var removeParent = [par.father, par.mother].filter(function (x) {
          return x && x.id === removeId;
        })[0];
        U.confirm(
          'Remove ' + (removeParent ? F.shortName(removeParent) : 'this parent') + '?',
          'They will be unlinked as a parent of ' +
            F.shortName(person) +
            ' only. Brothers and sisters keep their current parents. You can add a different parent afterwards.',
          'Remove',
          function () {
            API.removeParentFromPerson({ childId: person.id, parentId: removeId })
              .then(reload)
              .then(function () {
                U.brief('Removed parent');
              })
              .catch(function (err) {
                U.brief(err.message);
              });
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
                '<div class="field" data-help="sheet.relationType"><label>Relationship</label><div class="seg seg--block" id="fRel">' +
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
                '<div class="field-row" data-help="sheet.dates"><div class="field"><label>Marriage date</label><input type="text" id="fMarr" placeholder="e.g. 8 Jun 1941" /></div><div class="field"><label>Marriage place</label><input type="text" id="fMarrPlace" /></div></div>',
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
      var rows = (state.events || []).map(function (e) {
        return { sort: String(e.dateSort || ''), kind: 'event', event: e };
      });
      (state.families || []).forEach(function (f) {
        if (!f.marriage) return;
        var already = rows.some(function (row) {
          return row.kind === 'event' && String(row.event.id) === String(f.marriage.id);
        });
        if (already) return;
        rows.push({ sort: String(f.marriage.dateSort || ''), kind: 'event', event: f.marriage });
      });
      (state.media || []).forEach(function (m) {
        rows.push({ sort: String(m.dateSort || ''), kind: 'media', media: m });
      });
      rows.sort(function (a, b) {
        if (a.sort && !b.sort) return -1;
        if (!a.sort && b.sort) return 1;
        if (a.sort !== b.sort) return a.sort < b.sort ? -1 : 1;
        if (a.kind !== b.kind) return a.kind === 'event' ? -1 : 1;
        return 0;
      });
      U.$('#timeline').innerHTML =
        '<div class="card__head"><h2>Timeline</h2><button class="add-link" type="button" id="addEvent" data-help="person.addEvent">+ Add event</button></div>' +
        (rows.length
          ? '<ul class="timeline">' +
            rows
              .map(function (row) {
                if (row.kind === 'media') {
                  var m = row.media;
                  var my = m.dateSort ? String(m.dateSort).slice(0, 4) : '?';
                  return (
                    '<li class="tl tl--media" data-help="gallery.tile" data-media="' +
                    U.esc(m.id) +
                    '"><span class="tl__year">' +
                    my +
                    '</span><span class="tl__dot"></span><span><div class="tl__title">' +
                    F.kindIcon(m.kind) +
                    ' ' +
                    U.esc(m.title || 'Untitled') +
                    '</div><div class="tl__meta">' +
                    U.esc(F.kindLabel(m.kind)) +
                    (m.dateText ? ' \u00b7 ' + U.esc(m.dateText) : '') +
                    (m.placeText ? ' \u00b7 ' + U.esc(m.placeText) : '') +
                    '</div></span>' +
                    (m.url ? '<img class="tl__thumb" src="' + U.esc(m.url) + '" alt="" />' : '<span></span>') +
                    '</li>'
                  );
                }
                var e = row.event;
                var year = e.dateSort ? String(e.dateSort).slice(0, 4) : '?';
                return (
                  '<li class="tl" data-help="person.event" data-event="' +
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
        var mediaEl = e.target.closest('[data-media]');
        if (mediaEl) {
          var mid = mediaEl.getAttribute('data-media');
          var list = state.media || [];
          var idx = 0;
          list.forEach(function (m, n) {
            if (String(m.id) === String(mid)) idx = n;
          });
          window.Lightbox.open(list, idx, { focusPersonId: p().id, onChange: function () { reload(); } });
          return;
        }
        var li = e.target.closest('[data-event]');
        if (!li) return;
        editEvent(li.getAttribute('data-event'));
      };
    }

    function editEvent(eventId) {
      var ev = (state.events || []).filter(function (e) {
        return String(e.id) === String(eventId);
      })[0];
      if (!ev) {
        (state.families || []).some(function (f) {
          if (f.marriage && String(f.marriage.id) === String(eventId)) {
            ev = f.marriage;
            return true;
          }
          return false;
        });
      }
      if (!ev) return;
      if (!U.requireContributor()) return;
      U.openSheet(
        'Edit ' + F.eventLabel(ev.type),
        '<div data-help="sheet.event"><div class="field-row"><div class="field" data-help="sheet.dates"><label>Date</label><input type="text" id="evDate" value="' +
          U.esc(ev.dateText || '') +
          '" /></div><div class="field"><label>Place</label><input type="text" id="evPlace" value="' +
          U.esc(ev.placeText || '') +
          '" /></div></div>' +
          '<div class="field"><label>Details</label><textarea id="evDesc" rows="2">' +
          U.esc(ev.description || '') +
          '</textarea></div></div>',
        '<button class="btn btn--danger" type="button" id="evDel">Delete</button><button class="btn" type="button" id="evPhoto">Attach photo</button><button class="btn" type="button" data-close>Cancel</button><button class="btn btn--primary" type="button" id="evSave">Save</button>',
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
          U.$('#evPhoto', root).onclick = function () {
            U.closeSheet();
            window.MediaUploader.open({
              personIds: [p().id],
              extraLinks: [{ targetType: 'event', targetId: ev.id }],
              onDone: function () { reload(); }
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
        '<div data-help="sheet.event"><div class="field"><label>Type</label><select id="evType">' +
          types
            .map(function (t) {
              return '<option value="' + t + '">' + F.eventLabel(t) + '</option>';
            })
            .join('') +
          '</select></div>' +
          '<div class="field-row"><div class="field" data-help="sheet.dates"><label>Date</label><input type="text" id="evDate" placeholder="e.g. 2 Apr 1911 or abt 1935" /></div>' +
          '<div class="field"><label>Place</label><input type="text" id="evPlace" /></div></div>' +
          '<div class="field"><label>Details</label><textarea id="evDesc" rows="2"></textarea></div></div>',
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
      var list = state.media || [];
      U.$('#photos').innerHTML =
        '<div class="card__head"><h2>Photos & documents</h2><button class="add-link" type="button" id="addPhoto" data-help="person.addPhoto">+ Add</button></div>' +
        (list.length
          ? '<div class="media-grid" id="photoGrid" data-help="person.photos">' + list.map(window.Lightbox.tile).join('') + '</div>'
          : '<p class="empty">No photos yet.</p>');
      U.$('#addPhoto').onclick = function () {
        window.MediaUploader.open({
          personIds: [p().id],
          asProfile: !p().thumbUrl,
          onDone: function () { reload(); }
        });
      };
      var grid = U.$('#photoGrid');
      if (grid) {
        window.Lightbox.bind(grid, list, {
          focusPersonId: p().id,
          onChange: function () { reload(); }
        });
      }
    }

    function renderNotes() {
      var list = state.notes || [];
      U.$('#notes').innerHTML =
        '<div class="card__head"><h2>Notes & research</h2><button class="add-link" type="button" id="addNote" data-help="person.addNote">+ Add note</button></div>' +
        '<div data-help="person.notes">' +
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
          : '<p class="empty">No notes yet.</p>') +
        '</div>';
      U.$('#addNote').onclick = function () {
        if (!U.requireContributor()) return;
        U.openSheet(
          'Add note',
          '<div data-help="sheet.note"><div class="field"><label>Kind</label><div class="seg seg--block" id="nKind">' +
            '<button type="button" data-value="note" aria-pressed="true">Note</button>' +
            '<button type="button" data-value="research" aria-pressed="false">Research</button>' +
            '<button type="button" data-value="todo" aria-pressed="false">To do</button></div></div>' +
            '<div class="field"><label>Text</label><textarea id="nBody" rows="4"></textarea></div></div>',
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
