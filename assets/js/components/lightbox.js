/**
 * Gallery tiles and the full-screen photo viewer.
 * Lightbox.open(items, index, { focusPersonId, onChange })
 * The photo zooms/pans and slides; chrome (close, title, people) stays put.
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
      '<button type="button" class="tile' + (doc ? ' tile--doc' : '') + (m.url ? ' tile--photo' : '') + '" data-help="gallery.tile" data-media="' + U().esc(m.id) + '" title="' + U().esc(title) + '">' +
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
    var scale = 1;
    var tx = 0;
    var ty = 0;
    var slideDx = 0;
    var animating = false;
    var slideTimer = 0;
    var slideGen = 0;
    var pointers = new Map();
    var gesture = null;
    var lastTap = 0;
    var lastTapX = 0;
    var lastTapY = 0;

    var root = document.createElement('div');
    root.className = 'lightbox';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('data-help', 'gallery.lightbox');
    document.body.appendChild(root);
    document.body.classList.add('lightbox-open');

    function $(sel) {
      return U().$(sel, root);
    }

    function current() {
      return items[i];
    }

    function itemAt(offset) {
      var n = items.length;
      return items[(i + offset % n + n) % n];
    }

    function helpArmed() {
      return document.body.classList.contains('help-mode');
    }

    function stageW() {
      var st = $('#lbStage');
      return st ? st.clientWidth : window.innerWidth;
    }

    function applyZoom() {
      var z = $('#lbZoom');
      if (!z) return;
      z.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + scale + ')';
    }

    function applyTrack(animate) {
      var track = $('#lbTrack');
      if (!track) return;
      track.style.transition = animate ? 'transform .28s ease-out' : 'none';
      track.style.transform = 'translate3d(' + (-stageW() + slideDx) + 'px,0,0)';
    }

    function resetZoom() {
      scale = 1;
      tx = 0;
      ty = 0;
      applyZoom();
    }

    function clampPan() {
      if (scale <= 1.02) {
        scale = 1;
        tx = 0;
        ty = 0;
        return;
      }
      var st = $('#lbStage');
      var img = $('#lbPhoto');
      if (!st || !img) return;
      var maxX = Math.max(0, (img.offsetWidth * scale - st.clientWidth) / 2 + 32);
      var maxY = Math.max(0, (img.offsetHeight * scale - st.clientHeight) / 2 + 32);
      tx = Math.min(maxX, Math.max(-maxX, tx));
      ty = Math.min(maxY, Math.max(-maxY, ty));
    }

    function setScaleAt(ns, clientX, clientY) {
      ns = Math.max(1, Math.min(4.5, ns));
      var st = $('#lbStage');
      if (!st) return;
      var r = st.getBoundingClientRect();
      var px = clientX - r.left - r.width / 2;
      var py = clientY - r.top - r.height / 2;
      var from = scale || 1;
      tx = px - (px - tx) * (ns / from);
      ty = py - (py - ty) * (ns / from);
      scale = ns;
      clampPan();
      applyZoom();
    }

    function zoomCenter(factor) {
      var st = $('#lbStage');
      if (!st) return;
      var r = st.getBoundingClientRect();
      setScaleAt(scale * factor, r.left + r.width / 2, r.top + r.height / 2);
    }

    function facesHtml(m) {
      return (m.people || []).filter(function (p) { return p.region; }).map(function (p) {
        var r = p.region;
        return (
          '<button type="button" class="face-tag" data-face="' + U().esc(p.id) + '" style="left:' + (r.x * 100) + '%;top:' + (r.y * 100) + '%;width:' + (r.w * 100) + '%;height:' + (r.h * 100) + '%">' +
          '<span>' + U().esc(personName(p)) + '</span></button>'
        );
      }).join('');
    }

    function slideInner(m, isCurrent) {
      if (!m || !m.url) {
        return '<div class="lightbox__ph" aria-hidden="true">' + (m ? F().kindIcon(m.kind) : '') + '</div>';
      }
      var tagging = isCurrent && tagMode ? ' is-tagging' : '';
      return (
        '<div class="lightbox__frame' + tagging + '"' + (isCurrent ? ' id="lbFrame"' : '') + '>' +
        '<div class="lightbox__zoom"' + (isCurrent ? ' id="lbZoom"' : '') + '>' +
        '<img class="lightbox__photo"' + (isCurrent ? ' id="lbPhoto"' : '') +
        ' alt="' + U().esc(m.title || '') + '" src="' + U().esc(m.url) + '" draggable="false" />' +
        (isCurrent ? facesHtml(m) : '') +
        '</div></div>'
      );
    }

    function bindFaces() {
      U().$$('[data-face]', root).forEach(function (el) {
        el.onclick = function (e) {
          e.stopPropagation();
          clearFace(el.getAttribute('data-face'));
        };
      });
    }

    function paintSlides() {
      var prev = $('#lbSlidePrev');
      var cur = $('#lbSlideCur');
      var next = $('#lbSlideNext');
      if (!prev || !cur || !next) return;
      if (items.length === 1) {
        prev.innerHTML = '';
        next.innerHTML = '';
      } else {
        prev.innerHTML = slideInner(itemAt(-1), false);
        next.innerHTML = slideInner(itemAt(1), false);
      }
      cur.innerHTML = slideInner(current(), true);
      bindFaces();
      applyZoom();
    }

    function paintChrome() {
      var m = current();
      if (!m) return;
      var count = $('#lbCount');
      if (count) count.textContent = (i + 1) + ' / ' + items.length + (tagMode ? ' \u00b7 Tap a face' : '');
      var signed = global.TreeAccess && global.TreeAccess.isSignedIn();
      var editBtn = $('#lbEdit');
      if (editBtn) editBtn.classList.toggle('hidden', !signed);
      var people = m.people || [];
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
      var info = $('#lbInfo');
      if (info) {
        info.innerHTML =
          '<div class="lightbox__title">' + U().esc(m.title || 'Untitled') + '</div>' +
          '<div class="lightbox__meta">' + U().esc(F().kindLabel(m.kind)) +
          (m.dateText ? ' \u00b7 ' + U().esc(m.dateText) : '') +
          (m.placeText ? ' \u00b7 ' + U().esc(m.placeText) : '') +
          (m.uploadedBy ? ' \u00b7 ' + U().esc(m.uploadedBy) : '') + '</div>' +
          (m.caption ? '<p class="lightbox__caption">' + U().esc(m.caption) + '</p>' : '') +
          '<div class="lightbox__label">People in this photo</div>' +
          '<div class="lightbox__people" data-help="gallery.people">' + peopleHtml + '</div>' +
          (signed
            ? '<div class="btn-row lightbox__actions"><button class="btn btn--sm" type="button" id="lbTag" data-help="gallery.tag">' + (tagMode ? 'Done tagging' : 'Tag a face') + '</button>' +
              '<button class="btn btn--sm" type="button" id="lbAdd" data-help="gallery.addPerson">Add person</button>' +
              '<button class="btn btn--sm btn--danger" type="button" id="lbDel" data-help="gallery.delete">Delete</button></div>'
            : '');
        if (signed) {
          $('#lbTag').onclick = function () {
            tagMode = !tagMode;
            paintChrome();
            var frame = $('#lbFrame');
            if (frame) frame.classList.toggle('is-tagging', tagMode);
          };
          $('#lbAdd').onclick = function () { pickPerson(null); };
          $('#lbDel').onclick = remove;
        }
        U().$$('[data-profile]', root).forEach(function (el) {
          el.onclick = function () { setProfile(el.getAttribute('data-profile')); };
        });
        U().$$('[data-unlink]', root).forEach(function (el) {
          el.onclick = function () { unlinkPerson(el.getAttribute('data-unlink')); };
        });
      }
    }

    function refresh() {
      resetZoom();
      slideDx = 0;
      paintChrome();
      paintSlides();
      applyTrack(false);
      requestAnimationFrame(function () {
        applyTrack(false);
      });
    }

    function replace(media) {
      if (!media) return;
      items[i] = media;
      refresh();
      if (opts.onChange) opts.onChange(media);
    }

    function close() {
      if (slideTimer) clearTimeout(slideTimer);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('keydown', onKey);
      root.remove();
      document.body.classList.remove('lightbox-open');
    }

    function settleSlide(dir, gen) {
      if (gen != null && gen !== slideGen) return;
      if (slideTimer) {
        clearTimeout(slideTimer);
        slideTimer = 0;
      }
      if (!animating) return;
      animating = false;
      i = (i + dir + items.length) % items.length;
      tagMode = false;
      slideDx = 0;
      scale = 1;
      tx = 0;
      ty = 0;
      paintChrome();
      paintSlides();
      applyTrack(false);
    }

    function finishSlide(dir) {
      if (items.length < 2) {
        slideDx = 0;
        applyTrack(true);
        return;
      }
      animating = true;
      var gen = ++slideGen;
      slideDx = dir > 0 ? -stageW() : stageW();
      applyTrack(true);
      var track = $('#lbTrack');
      function done(e) {
        if (gen !== slideGen) return;
        if (e && e.propertyName && e.propertyName.indexOf('transform') < 0) return;
        if (track) track.removeEventListener('transitionend', done);
        settleSlide(dir, gen);
      }
      if (track) track.addEventListener('transitionend', done);
      slideTimer = setTimeout(function () { done(); }, 360);
    }

    function step(dir) {
      if (animating || helpArmed()) return;
      if (items.length < 2) return;
      resetZoom();
      finishSlide(dir);
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
      var img = $('#lbPhoto');
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
        '\u201c' + (m.title || 'Untitled') + '\u201d will be hidden. An admin can purge it later.',
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
            refresh();
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
      if (e.key === '+' || e.key === '=') zoomCenter(1.25);
      if (e.key === '-' || e.key === '_') zoomCenter(1 / 1.25);
    }

    function onResize() {
      applyTrack(false);
      clampPan();
      applyZoom();
    }

    function bindGestures() {
      var stage = $('#lbStage');
      if (!stage) return;
      stage.addEventListener(
        'wheel',
        function (e) {
          if (helpArmed()) return;
          e.preventDefault();
          setScaleAt(scale * (e.deltaY < 0 ? 1.12 : 1 / 1.12), e.clientX, e.clientY);
        },
        { passive: false }
      );
      stage.addEventListener('pointerdown', function (e) {
        if (helpArmed()) return;
        if (e.target.closest('button, a')) return;
        if (animating) return;
        try {
          stage.setPointerCapture(e.pointerId);
        } catch (err) { /* ignore */ }
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.size === 1) {
          gesture = {
            mode: scale > 1.02 ? 'pan' : 'slide',
            x: e.clientX,
            y: e.clientY,
            tx: tx,
            ty: ty,
            t0: Date.now(),
            moved: 0
          };
        } else if (pointers.size === 2) {
          var pts = Array.from(pointers.values());
          gesture = {
            mode: 'pinch',
            dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1,
            s: scale,
            tx: tx,
            ty: ty,
            cx: (pts[0].x + pts[1].x) / 2,
            cy: (pts[0].y + pts[1].y) / 2
          };
          slideDx = 0;
          applyTrack(false);
        }
      });
      stage.addEventListener('pointermove', function (e) {
        if (!pointers.has(e.pointerId) || !gesture) return;
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (gesture.mode === 'pinch' && pointers.size >= 2) {
          var pts = Array.from(pointers.values());
          var d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
          scale = gesture.s;
          tx = gesture.tx;
          ty = gesture.ty;
          setScaleAt(gesture.s * (d / gesture.dist), (pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2);
          return;
        }
        var dx = e.clientX - gesture.x;
        var dy = e.clientY - gesture.y;
        gesture.moved = Math.max(gesture.moved, Math.hypot(dx, dy));
        if (gesture.mode === 'slide') {
          slideDx = items.length < 2 ? dx * 0.28 : dx;
          applyTrack(false);
        } else if (gesture.mode === 'pan') {
          tx = gesture.tx + dx;
          ty = gesture.ty + dy;
          clampPan();
          applyZoom();
        }
      });
      function pointerEnd(e) {
        if (!pointers.has(e.pointerId)) return;
        pointers.delete(e.pointerId);
        if (pointers.size === 1 && gesture && gesture.mode === 'pinch') {
          var p = Array.from(pointers.values())[0];
          gesture = {
            mode: scale > 1.02 ? 'pan' : 'slide',
            x: p.x,
            y: p.y,
            tx: tx,
            ty: ty,
            t0: Date.now(),
            moved: 0
          };
          return;
        }
        if (pointers.size) return;
        var g = gesture;
        gesture = null;
        if (!g) return;
        if (g.mode === 'slide') {
          var dt = Date.now() - g.t0;
          var dx = slideDx;
          var horiz = Math.abs(dx) > Math.abs(e.clientY - g.y) * 0.85;
          var flick = Math.abs(dx) > 36 && dt < 300;
          var far = Math.abs(dx) > Math.min(64, stageW() * 0.2);
          if (items.length > 1 && horiz && (flick || far)) {
            finishSlide(dx < 0 ? 1 : -1);
            return;
          }
          slideDx = 0;
          applyTrack(true);
        } else {
          clampPan();
          applyZoom();
        }
        if (g.moved < 12) {
          var now = Date.now();
          if (tagMode && e.target.closest('.lightbox__photo, .lightbox__zoom, .lightbox__frame')) {
            placeTag(e);
            lastTap = 0;
            return;
          }
          if (now - lastTap < 320 && Math.hypot(e.clientX - lastTapX, e.clientY - lastTapY) < 30) {
            lastTap = 0;
            if (scale > 1.08) {
              resetZoom();
            } else {
              setScaleAt(2.4, e.clientX, e.clientY);
            }
          } else {
            lastTap = now;
            lastTapX = e.clientX;
            lastTapY = e.clientY;
          }
        }
      }
      stage.addEventListener('pointerup', pointerEnd);
      stage.addEventListener('pointercancel', pointerEnd);
    }

    root.innerHTML =
      '<div class="lightbox__top"><span class="small" id="lbCount"></span><div class="btn-row">' +
      '<button class="btn btn--sm hidden" type="button" id="lbEdit" data-help="gallery.edit">\u270E Edit</button>' +
      '<button class="btn btn--icon" type="button" data-help-toggle aria-pressed="false" aria-label="Help: tap, then tap a control" title="Help">?</button>' +
      '<button class="btn btn--icon" type="button" id="lbClose" aria-label="Close">\u2715</button></div></div>' +
      '<div class="lightbox__stage" id="lbStage">' +
      '<div class="lightbox__track" id="lbTrack">' +
      '<div class="lightbox__slide" id="lbSlidePrev"></div>' +
      '<div class="lightbox__slide" id="lbSlideCur"></div>' +
      '<div class="lightbox__slide" id="lbSlideNext"></div></div>' +
      '<button class="lightbox__nav lightbox__nav--l" type="button" id="lbPrev" aria-label="Previous" data-help="gallery.prev">\u2039</button>' +
      '<button class="lightbox__nav lightbox__nav--r" type="button" id="lbNext" aria-label="Next" data-help="gallery.next">\u203A</button>' +
      '<div class="lightbox__zoom-btns" data-help="gallery.zoom">' +
      '<button class="btn" type="button" id="lbZoomIn" aria-label="Zoom in">+</button>' +
      '<button class="btn" type="button" id="lbZoomOut" aria-label="Zoom out">\u2212</button></div></div>' +
      '<div class="lightbox__info" id="lbInfo"></div>';

    $('#lbClose').onclick = close;
    $('#lbPrev').onclick = function () { step(-1); };
    $('#lbNext').onclick = function () { step(1); };
    $('#lbZoomIn').onclick = function () { zoomCenter(1.35); };
    $('#lbZoomOut').onclick = function () { zoomCenter(1 / 1.35); };
    $('#lbEdit').onclick = edit;
    bindGestures();
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    refresh();
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
