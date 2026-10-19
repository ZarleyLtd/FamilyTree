/**
 * Gallery tiles and the full-screen photo viewer.
 * Lightbox.open(items, index, { focusPersonId, onChange })
 */
(function (global) {
  'use strict';

  function F() { return global.Formatters; }
  function U() { return global.FamilyTreeUI; }
  function API() { return global.FamilyTreeAPI; }

  function tile(m) {
    var doc = /document|census|certificate/.test(m.kind);
    var title = m.title || 'Untitled';
    var when = m.dateText || '';
    var img = m.url
      ? '<img class="tile__img" src="' + U().esc(m.url) + '" alt="" />'
      : '<span class="tile__ico">' + F().kindIcon(m.kind) + '</span>';
    return (
      '<button type="button" class="tile' + (doc ? ' tile--doc' : '') + (m.url ? ' tile--photo' : '') + '" data-media="' + U().esc(m.id) + '" title="' + U().esc(title) + '">' +
      img +
      '<span class="tile__kind">' + U().esc(F().kindLabel(m.kind)) + '</span>' +
      '<span class="tile__cap">' + U().esc(title) +
      (when ? '<br><span class="tile__when">' + U().esc(when) + '</span>' : '') +
      '</span></button>'
    );
  }

  function personName(p) {
    return ((p.givenNames || '') + ' ' + (p.surname || '')).trim() || 'Unknown';
  }

  function open(list, index, opts) {
    opts = opts || {};
    var items = (list || []).slice();
    var i = Math.max(0, Math.min(index || 0, Math.max(0, items.length - 1)));
    if (!items.length) return;
    var tagMode = false;
    var root = document.createElement('div');
    root.className = 'lightbox';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    document.body.appendChild(root);
    document.body.classList.add('lightbox-open');

    function current() {
      return items[i];
    }

    function replace(media) {
      if (!media) return;
      items[i] = media;
      render();
      if (opts.onChange) opts.onChange(media);
    }

    function close() {
      root.remove();
      document.body.classList.remove('lightbox-open');
      document.removeEventListener('keydown', onKey);
    }

    function render() {
      var m = current();
      if (!m) {
        close();
        return;
      }
      var people = m.people || [];
      var signed = global.TreeAccess && global.TreeAccess.isSignedIn();
      var faces = people.filter(function (p) { return p.region; }).map(function (p) {
        var r = p.region;
        return (
          '<button type="button" class="face-tag" data-face="' + U().esc(p.id) + '" style="left:' + (r.x * 100) + '%;top:' + (r.y * 100) + '%;width:' + (r.w * 100) + '%;height:' + (r.h * 100) + '%">' +
          '<span>' + U().esc(personName(p)) + '</span></button>'
        );
      }).join('');
      var peopleHtml = people.length
        ? people.map(function (p) {
          var bits = '<a href="person.html?id=' + U().esc(p.id) + '">' + U().esc(personName(p)) + '</a>';
          if (signed) {
            if (p.isPrimary) bits += '<span class="lightbox__pill">Profile photo</span>';
            else bits += '<button type="button" class="lightbox__pill" data-profile="' + U().esc(p.id) + '">Set as profile</button>';
            bits += '<button type="button" class="lightbox__pill" data-unlink="' + U().esc(p.id) + '" aria-label="Remove ' + U().esc(personName(p)) + '">\u2715</button>';
          }
          return '<span class="lightbox__person">' + bits + '</span>';
        }).join('')
        : '<div class="small lightbox__none">No one tagged yet.</div>';
      root.innerHTML =
        '<div class="lightbox__top"><span class="small">' + (i + 1) + ' / ' + items.length +
        (tagMode ? ' \u00b7 Tap a face' : '') +
        '</span><div class="btn-row">' +
        (signed ? '<button class="btn btn--sm" type="button" id="lbEdit">\u270E Edit</button>' : '') +
        '<button class="btn btn--icon" type="button" id="lbClose" aria-label="Close">\u2715</button></div></div>' +
        '<div class="lightbox__stage"><div class="lightbox__frame' + (tagMode ? ' is-tagging' : '') + '" id="lbFrame">' +
        '<img class="lightbox__photo" id="lbPhoto" alt="' + U().esc(m.title || '') + '" src="' + U().esc(m.url) + '" />' +
        faces + '</div>' +
        '<button class="lightbox__nav lightbox__nav--l" type="button" id="lbPrev" aria-label="Previous">\u2039</button>' +
        '<button class="lightbox__nav lightbox__nav--r" type="button" id="lbNext" aria-label="Next">\u203A</button></div>' +
        '<div class="lightbox__info"><div class="lightbox__title">' + U().esc(m.title || 'Untitled') + '</div>' +
        '<div class="lightbox__meta">' + U().esc(F().kindLabel(m.kind)) +
        (m.dateText ? ' \u00b7 ' + U().esc(m.dateText) : '') +
        (m.placeText ? ' \u00b7 ' + U().esc(m.placeText) : '') +
        (m.uploadedBy ? ' \u00b7 ' + U().esc(m.uploadedBy) : '') + '</div>' +
        (m.caption ? '<p class="lightbox__caption">' + U().esc(m.caption) + '</p>' : '') +
        '<div class="lightbox__label">People in this photo</div>' +
        '<div class="lightbox__people">' + peopleHtml + '</div>' +
        (signed
          ? '<div class="btn-row lightbox__actions"><button class="btn btn--sm" type="button" id="lbTag">' + (tagMode ? 'Done tagging' : 'Tag a face') + '</button>' +
            '<button class="btn btn--sm" type="button" id="lbAdd">Add person</button>' +
            '<button class="btn btn--sm btn--danger" type="button" id="lbDel">Delete</button></div>'
          : '') +
        '</div>';
      U().$('#lbClose', root).onclick = close;
      U().$('#lbPrev', root).onclick = function () { step(-1); };
      U().$('#lbNext', root).onclick = function () { step(1); };
      if (signed) {
        U().$('#lbEdit', root).onclick = edit;
        U().$('#lbTag', root).onclick = function () {
          tagMode = !tagMode;
          render();
        };
        U().$('#lbAdd', root).onclick = function () { pickPerson(null); };
        U().$('#lbDel', root).onclick = remove;
      }
      U().$$('[data-face]', root).forEach(function (el) {
        el.onclick = function (e) {
          e.stopPropagation();
          clearFace(el.getAttribute('data-face'));
        };
      });
      U().$$('[data-profile]', root).forEach(function (el) {
        el.onclick = function () { setProfile(el.getAttribute('data-profile')); };
      });
      U().$$('[data-unlink]', root).forEach(function (el) {
        el.onclick = function () { unlinkPerson(el.getAttribute('data-unlink')); };
      });
    }

    function step(dir) {
      tagMode = false;
      i = (i + dir + items.length) % items.length;
      render();
    }

    function fail(err) {
      U().brief((err && err.message) || 'Could not update the photo');
    }

    function edit() {
      var m = current();
      var kinds = F().mediaKinds.map(function (k) {
        return '<option value="' + k[0] + '"' + (k[0] === m.kind ? ' selected' : '') + '>' + U().esc(k[1]) + '</option>';
      }).join('');
      U().openSheet(
        'Edit photo',
        '<div class="field"><label for="mdKind">Kind</label><select id="mdKind">' + kinds + '</select></div>' +
        '<div class="field"><label for="mdTitle">Title</label><input type="text" id="mdTitle" value="' + U().esc(m.title || '') + '" /></div>' +
        '<div class="field"><label for="mdCaption">Caption</label><textarea id="mdCaption" rows="2">' + U().esc(m.caption || '') + '</textarea></div>' +
        '<div class="field-row"><div class="field"><label for="mdDate">Date</label><input type="text" id="mdDate" value="' + U().esc(m.dateText || '') + '" placeholder="abt 1952" /></div>' +
        '<div class="field"><label for="mdPlace">Place</label><input type="text" id="mdPlace" value="' + U().esc(m.placeText || '') + '" /></div></div>',
        '<button class="btn" type="button" data-close>Cancel</button><button class="btn btn--primary" type="button" id="mdSave">Save</button>',
        function (sheet) {
          U().$('#mdSave', sheet).onclick = function () {
            API().updateMedia({
              id: m.id,
              patch: {
                kind: U().$('#mdKind', sheet).value,
                title: U().$('#mdTitle', sheet).value.trim(),
                caption: U().$('#mdCaption', sheet).value.trim(),
                dateText: U().$('#mdDate', sheet).value.trim(),
                placeText: U().$('#mdPlace', sheet).value.trim()
              }
            }).then(function (data) {
              U().closeSheet();
              replace(data.media);
              U().brief('Saved');
            }).catch(fail);
          };
        }
      );
    }

    function pickPerson(region) {
      U().openPersonPicker(region ? 'Who is this?' : 'Add a person', function (person) {
        if (!person || !person.id) return;
        var payload = { mediaId: current().id, targetType: 'person', targetId: person.id };
        if (region) payload.region = region;
        API().linkMedia(payload).then(function (data) {
          tagMode = false;
          replace(data.media);
          U().brief(region ? 'Face tagged' : 'Person added');
        }).catch(fail);
      });
    }

    function placeTag(e) {
      var img = U().$('#lbPhoto', root);
      if (!img) return;
      var rect = img.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      var x = (e.clientX - rect.left) / rect.width;
      var y = (e.clientY - rect.top) / rect.height;
      if (x < 0 || y < 0 || x > 1 || y > 1) return;
      var w = 0.22;
      var h = 0.28;
      pickPerson({
        x: Math.min(Math.max(0, x - w / 2), 1 - w),
        y: Math.min(Math.max(0, y - h / 2), 1 - h),
        w: w,
        h: h
      });
    }

    function clearFace(personId) {
      var person = (current().people || []).filter(function (p) { return p.id === personId; })[0];
      if (!person) return;
      U().confirm(
        'Remove this face tag?',
        personName(person) + ' stays linked to the photo, without a box.',
        'Remove tag',
        function () {
          API().linkMedia({
            mediaId: current().id,
            targetType: 'person',
            targetId: personId,
            region: null
          }).then(function (data) {
            replace(data.media);
          }).catch(fail);
        }
      );
    }

    function setProfile(personId) {
      API().linkMedia({
        mediaId: current().id,
        targetType: 'person',
        targetId: personId,
        isPrimary: true
      }).then(function (data) {
        replace(data.media);
        U().brief('Profile photo set');
      }).catch(fail);
    }

    function unlinkPerson(personId) {
      var person = (current().people || []).filter(function (p) { return p.id === personId; })[0];
      U().confirm(
        'Remove this person?',
        (person ? personName(person) : 'They') + ' will no longer be linked to this photo.',
        'Remove',
        function () {
          API().unlinkMedia({
            mediaId: current().id,
            targetType: 'person',
            targetId: personId
          }).then(function (data) {
            replace(data.media);
          }).catch(fail);
        }
      );
    }

    function remove() {
      var m = current();
      U().confirm(
        'Delete this ' + F().kindLabel(m.kind).toLowerCase() + '?',
        '“' + (m.title || 'Untitled') + '” will be hidden. An admin can purge it later.',
        'Delete',
        function () {
          API().deleteMedia(m.id).then(function () {
            items.splice(i, 1);
            if (!items.length) {
              close();
              if (opts.onChange) opts.onChange(null);
              U().brief('Deleted');
              return;
            }
            if (i >= items.length) i = items.length - 1;
            render();
            if (opts.onChange) opts.onChange(null);
            U().brief('Deleted');
          }).catch(fail);
        }
      );
    }

    function onKey(e) {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) return;
      if (document.getElementById('sheet')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    }

    var sx = null;
    var sy = null;
    root.addEventListener('pointerdown', function (e) {
      if (e.target.closest('button, a, input, textarea, select')) return;
      sx = e.clientX;
      sy = e.clientY;
    });
    root.addEventListener('pointerup', function (e) {
      if (sx == null) return;
      var dx = e.clientX - sx;
      var dy = e.clientY - sy;
      sx = null;
      if (tagMode && e.target.closest('.lightbox__photo') && Math.abs(dx) < 14 && Math.abs(dy) < 14) {
        placeTag(e);
        return;
      }
      if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1);
    });
    document.addEventListener('keydown', onKey);
    render();
  }

  function bind(container, list, opts) {
    if (!container) return;
    container.addEventListener('click', function (e) {
      var t = e.target.closest('[data-media]');
      if (!t) return;
      var id = t.getAttribute('data-media');
      var idx = 0;
      (list || []).forEach(function (m, n) {
        if (m.id === id) idx = n;
      });
      open(list, idx, opts);
    });
  }

  global.Lightbox = { tile: tile, open: open, bind: bind };
})(typeof window !== 'undefined' ? window : this);
