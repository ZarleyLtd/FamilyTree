/**
 * Pick or take a photo, compress it, and upload it with links.
 * MediaUploader.open({ personIds, extraLinks, asProfile, onDone })
 */
(function (global) {
  'use strict';

  function open(opts) {
    opts = opts || {};
    var U = global.FamilyTreeUI;
    var API = global.FamilyTreeAPI;
    var F = global.Formatters;
    if (!U.requireContributor()) return;

    var selected = [];
    var seen = {};
    (opts.personIds || []).forEach(function (id) {
      if (id && !seen[id]) {
        seen[id] = 1;
        selected.push({ id: id, givenNames: '', surname: '', pending: true });
      }
    });
    var compressed = null;
    var previewUrl = null;
    var busy = false;
    var primaryPrimed = false;

    var kindChips = F.mediaKinds.map(function (k, idx) {
      return '<span class="chip' + (idx === 0 ? ' is-active' : '') + '" data-value="' + k[0] + '">' + k[3] + ' ' + U.esc(k[1]) + '</span>';
    }).join('');

    U.openSheet(
      'Add photo or document',
      '<div data-help="sheet.upload"><div class="btn-row">' +
        '<label class="btn file-btn">Take photo<input type="file" accept="image/*" capture="environment" data-file hidden /></label>' +
        '<label class="btn file-btn">Choose photo<input type="file" accept="image/*" data-file hidden /></label></div>' +
        '<p class="muted small" id="upStatus">Large image files are resized to about 100 KB before they are saved. Don\u2019t use this as a place to store your hi-res images.</p>' +
        '<div class="upload-preview" id="upPrev" hidden></div>' +
        '<div id="upForm" hidden>' +
        '<div class="field" data-help="sheet.uploadKind"><label>Kind</label><div class="chip-row" id="upKind">' + kindChips + '</div></div>' +
        '<div class="field"><label for="upTitle">Title</label><input type="text" id="upTitle" placeholder="e.g. Granny at Dollymount, 1952" /></div>' +
        '<div class="field"><label for="upCaption">Caption</label><textarea id="upCaption" rows="2" placeholder="Optional"></textarea></div>' +
        '<div class="field-row"><div class="field"><label for="upDate">Date</label><input type="text" id="upDate" placeholder="abt 1952" /></div>' +
        '<div class="field"><label for="upPlace">Place</label><input type="text" id="upPlace" /></div></div>' +
        '<div class="field" data-help="sheet.uploadPeople"><label>People in this item</label><div class="people-pick" id="upSelected"></div>' +
        '<div class="search" style="margin-top:.45rem"><span class="ico">\uD83D\uDD0D</span><input type="search" id="upQ" placeholder="Search to add someone" autocomplete="off" /></div>' +
        '<div id="upResults"></div></div>' +
        '<label class="checkline" id="upPrimaryWrap"><input type="checkbox" id="upPrimary" /> Set as their profile photo</label>' +
        '</div></div>',
      '<button class="btn" type="button" data-close>Cancel</button><button class="btn btn--primary" type="button" id="upSave" disabled>Upload</button>',
      function (root) {
        function kind() {
          var c = U.$('.chip.is-active', U.$('#upKind', root));
          return c ? c.getAttribute('data-value') : 'photo';
        }
        function renderSelected() {
          var box = U.$('#upSelected', root);
          if (!selected.length) {
            box.innerHTML = '<span class="muted small">No one tagged yet.</span>';
          } else {
            box.innerHTML = selected.map(function (p) {
              var label = p.pending ? 'Selected' : F.shortName(p);
              return '<span class="chip is-active" data-id="' + U.esc(p.id) + '">' + U.esc(label) + ' \u2715</span>';
            }).join('');
          }
          var wrap = U.$('#upPrimaryWrap', root);
          var on = selected.length === 1;
          wrap.hidden = !on;
          if (!primaryPrimed) {
            primaryPrimed = true;
            if (on && opts.asProfile) U.$('#upPrimary', root).checked = true;
          }
        }
        function search(q) {
          API.listPersons({ q: q, limit: 12 }).then(function (data) {
            var rows = ((data && data.persons) || []).filter(function (p) {
              return !seen[p.id];
            });
            selected.forEach(function (s) {
              if (!s.pending) return;
              var match = ((data && data.persons) || []).filter(function (p) { return p.id === s.id; })[0];
              if (match) {
                s.givenNames = match.givenNames;
                s.surname = match.surname;
                s.sex = match.sex;
                s.pending = false;
              }
            });
            renderSelected();
            var list = U.$('#upResults', root);
            list.innerHTML = rows.length
              ? rows.map(function (p) {
                return '<button type="button" class="person-row" data-add="' + U.esc(p.id) + '">' +
                  U.avatar(p) +
                  '<span class="person-row__body"><span class="person-row__name">' + U.esc(F.fullName(p)) + '</span>' +
                  '<span class="person-row__meta">' + U.esc(F.lifespan(p)) + '</span></span></button>';
              }).join('')
              : '';
            U.$$('[data-add]', list).forEach(function (btn) {
              btn.onclick = function () {
                var id = btn.getAttribute('data-add');
                var person = rows.filter(function (p) { return p.id === id; })[0];
                if (!person || seen[id]) return;
                seen[id] = 1;
                selected.push(person);
                U.$('#upQ', root).value = '';
                search('');
              };
            });
          }).catch(function () {});
        }
        U.$('#upKind', root).addEventListener('click', function (e) {
          var c = e.target.closest('.chip');
          if (!c) return;
          U.$$('.chip', U.$('#upKind', root)).forEach(function (x) { x.classList.remove('is-active'); });
          c.classList.add('is-active');
        });
        U.$('#upSelected', root).addEventListener('click', function (e) {
          var c = e.target.closest('[data-id]');
          if (!c) return;
          var id = c.getAttribute('data-id');
          selected = selected.filter(function (p) { return p.id !== id; });
          delete seen[id];
          renderSelected();
        });
        U.$('#upQ', root).addEventListener('input', function (e) {
          search(e.target.value);
        });
        U.$$('[data-file]', root).forEach(function (input) {
          input.addEventListener('change', function () {
            var file = input.files && input.files[0];
            input.value = '';
            if (!file) return;
            var status = U.$('#upStatus', root);
            status.textContent = 'Resizing\u2026';
            U.$('#upSave', root).disabled = true;
            global.ImageCompress.compressToTarget(file).then(function (result) {
              compressed = result;
              if (previewUrl) URL.revokeObjectURL(previewUrl);
              previewUrl = URL.createObjectURL(result.blob);
              var prev = U.$('#upPrev', root);
              prev.hidden = false;
              prev.innerHTML = '<img src="' + previewUrl + '" alt="Preview" />';
              U.$('#upForm', root).hidden = false;
              var kb = Math.max(1, Math.round(result.byteSize / 1024));
              status.textContent = 'Ready \u00b7 ' + kb + ' KB, ' + result.width + '\u00d7' + result.height;
              U.$('#upSave', root).disabled = false;
              if (!U.$('#upTitle', root).value) {
                var base = (file.name || '').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
                if (base) U.$('#upTitle', root).value = base;
              }
            }).catch(function (err) {
              compressed = null;
              status.textContent = err.message || 'Could not read that photo';
            });
          });
        });
        U.$('#upSave', root).onclick = function () {
          if (!compressed || busy) return;
          busy = true;
          var btn = U.$('#upSave', root);
          btn.disabled = true;
          var one = selected.length === 1;
          var primary = one && U.$('#upPrimary', root).checked;
          var links = selected.map(function (p) {
            return { targetType: 'person', targetId: p.id, isPrimary: primary && p.id === selected[0].id };
          });
          (opts.extraLinks || []).forEach(function (link) {
            if (link && link.targetType && link.targetId) {
              links.push({ targetType: link.targetType, targetId: link.targetId });
            }
          });
          API.uploadMedia({
            base64: compressed.base64,
            mimeType: compressed.mimeType,
            width: compressed.width,
            height: compressed.height,
            kind: kind(),
            title: U.$('#upTitle', root).value.trim(),
            caption: U.$('#upCaption', root).value.trim(),
            dateText: U.$('#upDate', root).value.trim(),
            placeText: U.$('#upPlace', root).value.trim(),
            links: links
          }).then(function (data) {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            U.closeSheet();
            U.brief('Uploaded');
            if (opts.onDone) opts.onDone(data.media);
          }).catch(function (err) {
            busy = false;
            btn.disabled = false;
            U.brief(err.message || 'Upload failed');
          });
        };
        renderSelected();
        (opts.personIds || []).forEach(function (id) {
          API.getPerson(id).then(function (data) {
            var person = data && data.person;
            if (!person) return;
            selected.forEach(function (s) {
              if (s.id !== id) return;
              s.givenNames = person.givenNames;
              s.surname = person.surname;
              s.sex = person.sex;
              s.pending = false;
            });
            renderSelected();
          }).catch(function () {});
        });
        search('');
      }
    );
  }

  global.MediaUploader = { open: open };
})(typeof window !== 'undefined' ? window : this);
