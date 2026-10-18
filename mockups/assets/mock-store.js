/**
 * In-memory store over MOCK_DATA with a sessionStorage overlay so additions made
 * in the mockup survive page navigation (but nothing is persisted anywhere real).
 */
window.MockStore = (function () {
  'use strict';

  var KEY = 'familytree_mock_overlay_v1';
  var AUTH_KEY = 'familytree_mock_auth_v1';
  var SESSION_KEY = 'familytree_mock_session_v1';
  var SEED_PASSWORD = 'family';
  var base = window.MOCK_DATA;
  var overlay = load();
  var auth = loadAuth();
  var sessionId = loadSession();

  function load() {
    try {
      var raw = sessionStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { persons: [], families: [], familyChildren: [], events: [], media: [], notes: [], changes: [] };
  }
  function save() {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(overlay));
    } catch (e) {}
  }
  function loadAuth() {
    try {
      var raw = sessionStorage.getItem(AUTH_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { extraContributors: [], invites: clone(base.invites), passwords: {}, resetCodes: {} };
  }
  function saveAuth() {
    try {
      sessionStorage.setItem(AUTH_KEY, JSON.stringify(auth));
    } catch (e) {}
  }
  function loadSession() {
    try {
      var raw = sessionStorage.getItem(SESSION_KEY);
      if (raw === 'signed-out') return null;
      if (raw) return raw;
    } catch (e) {}
    return 'c1';
  }
  function saveSession() {
    try {
      if (sessionId) sessionStorage.setItem(SESSION_KEY, sessionId);
      else sessionStorage.setItem(SESSION_KEY, 'signed-out');
    } catch (e) {}
  }
  function reset() {
    try {
      sessionStorage.removeItem(KEY);
      sessionStorage.removeItem(AUTH_KEY);
      sessionStorage.removeItem(SESSION_KEY);
    } catch (e) {}
    overlay = load();
    auth = loadAuth();
    sessionId = loadSession();
  }

  function uid(prefix) {
    return prefix + '_' + Math.random().toString(36).slice(2, 8);
  }

  function clone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  // ---- persons --------------------------------------------------------------

  function persons() {
    return base.persons.concat(overlay.persons);
  }
  function person(id) {
    var list = persons();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function currentYear() {
    return new Date().getFullYear();
  }
  function isLiving(p) {
    if (!p) return false;
    if (typeof p.living === 'boolean') return p.living;
    if (p.death) return false;
    if (p.birth && p.birth.year) return currentYear() - p.birth.year < 110;
    return true;
  }
  function age(p) {
    if (!p || !p.birth || !p.birth.year) return null;
    var end = p.death && p.death.year ? p.death.year : currentYear();
    return end - p.birth.year;
  }

  // ---- families -------------------------------------------------------------

  function families() {
    var list = clone(base.families).concat(clone(overlay.families));
    overlay.familyChildren.forEach(function (fc) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === fc.familyId && list[i].children.indexOf(fc.childId) < 0) {
          list[i].children.push(fc.childId);
        }
      }
    });
    return list;
  }
  function family(id) {
    var list = families();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  /** Families in which this person is a partner. */
  function familiesOf(id) {
    return families().filter(function (f) {
      return f.p1 === id || f.p2 === id;
    });
  }
  /** Family (or families) in which this person is a child. */
  function parentFamilies(id) {
    return families().filter(function (f) {
      return f.children.indexOf(id) >= 0;
    });
  }
  /** { father, mother } from the first parent family (by sex, falling back to slot). */
  function parentsOf(id) {
    var fams = parentFamilies(id);
    if (!fams.length) return { father: null, mother: null, family: null };
    var f = fams[0];
    var a = person(f.p1);
    var b = person(f.p2);
    var father = null;
    var mother = null;
    [a, b].forEach(function (p) {
      if (!p) return;
      if (p.sex === 'F' && !mother) mother = p;
      else if (p.sex === 'M' && !father) father = p;
      else if (!father) father = p;
      else mother = p;
    });
    return { father: father, mother: mother, family: f };
  }
  function siblingsOf(id) {
    var out = [];
    parentFamilies(id).forEach(function (f) {
      f.children.forEach(function (c) {
        if (c !== id && out.indexOf(c) < 0) out.push(c);
      });
    });
    return out.map(person).filter(Boolean).sort(byBirth);
  }
  function childrenOf(id) {
    var out = [];
    familiesOf(id).forEach(function (f) {
      f.children.forEach(function (c) {
        if (out.indexOf(c) < 0) out.push(c);
      });
    });
    return out.map(person).filter(Boolean).sort(byBirth);
  }
  function partnersOf(id) {
    return familiesOf(id)
      .map(function (f) {
        return person(f.p1 === id ? f.p2 : f.p1);
      })
      .filter(Boolean);
  }
  function byBirth(a, b) {
    var ya = (a.birth && a.birth.year) || 9999;
    var yb = (b.birth && b.birth.year) || 9999;
    return ya - yb;
  }

  // ---- events ---------------------------------------------------------------

  /** All events for a person incl. derived birth/marriage/death, sorted by year. */
  function eventsOf(id) {
    var p = person(id);
    if (!p) return [];
    var out = [];
    if (p.birth) out.push({ type: 'birth', date: p.birth.text, year: p.birth.year, place: p.birth.place });
    familiesOf(id).forEach(function (f) {
      if (f.marriage) {
        var other = person(f.p1 === id ? f.p2 : f.p1);
        out.push({
          type: 'marriage',
          date: f.marriage.text,
          year: f.marriage.year,
          place: f.marriage.place,
          description: other ? 'to ' + fullName(other) : ''
        });
      }
    });
    (base.events[id] || []).forEach(function (e) {
      out.push(e);
    });
    overlay.events
      .filter(function (e) {
        return e.personId === id;
      })
      .forEach(function (e) {
        out.push(e);
      });
    if (p.death) out.push({ type: 'death', date: p.death.text, year: p.death.year, place: p.death.place });
    var order = { birth: 0, baptism: 1, death: 8, burial: 9 };
    return out.sort(function (a, b) {
      var d = (a.year || 0) - (b.year || 0);
      if (d) return d;
      return (order[a.type] != null ? order[a.type] : 5) - (order[b.type] != null ? order[b.type] : 5);
    });
  }

  // ---- media ----------------------------------------------------------------

  function media() {
    return base.media.concat(overlay.media);
  }
  function mediaOf(id) {
    return media().filter(function (m) {
      return m.people.indexOf(id) >= 0;
    });
  }
  function primaryMedia(id) {
    var list = media();
    for (var i = 0; i < list.length; i++) if (list[i].primaryFor === id) return list[i];
    return null;
  }

  // ---- notes / changes ------------------------------------------------------

  function notesOf(id) {
    return (base.notes[id] || []).concat(
      overlay.notes.filter(function (n) {
        return n.personId === id;
      })
    );
  }
  function changes() {
    return overlay.changes.slice().reverse().concat(base.changes);
  }

  // ---- naming ---------------------------------------------------------------

  function fullName(p) {
    if (!p) return '';
    var parts = [p.given];
    if (p.nickname) parts.push('\u201c' + p.nickname + '\u201d');
    parts.push(p.surname);
    if (p.suffix) parts.push(p.suffix);
    return parts.join(' ');
  }
  function shortName(p) {
    return p ? p.given + ' ' + p.surname : '';
  }

  // ---- mutations (mock) -----------------------------------------------------

  function logChange(summary, target, targetType) {
    var actor = me();
    overlay.changes.push({
      when: 'Just now',
      actor: actor.name || 'Guest',
      action: 'create',
      summary: summary,
      target: target,
      targetType: targetType || 'person'
    });
  }

  // ---- contributors / sessions (mock) --------------------------------------

  function contributors() {
    return clone(base.contributors).concat(clone(auth.extraContributors)).filter(function (c) {
      return !c.disabledAt;
    });
  }
  function allContributors() {
    return clone(base.contributors).concat(clone(auth.extraContributors));
  }
  function contributorById(id) {
    var list = allContributors();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function contributorByHandle(handle) {
    handle = String(handle || '').trim().toLowerCase();
    var list = allContributors();
    for (var i = 0; i < list.length; i++) if (list[i].handle === handle) return list[i];
    return null;
  }
  function currentContributor() {
    return sessionId ? contributorById(sessionId) : null;
  }
  function isSignedIn() {
    var c = currentContributor();
    return !!(c && !c.disabledAt);
  }
  function me() {
    var c = currentContributor();
    if (!c || c.disabledAt) return { signedIn: false, name: null, role: null, self: null, handle: null, id: null };
    return { signedIn: true, name: c.name, role: c.role, self: c.self, handle: c.handle, id: c.id };
  }
  function passwordOf(c) {
    return auth.passwords[c.id] || SEED_PASSWORD;
  }
  function signOut() {
    sessionId = null;
    saveSession();
  }
  function signIn(id) {
    sessionId = id;
    saveSession();
    return me();
  }
  function connect(handle, password) {
    var c = contributorByHandle(handle);
    if (!c) return { error: 'No contributor with that handle' };
    if (c.disabledAt) return { error: 'This contributor is disabled' };
    if (String(password || '') !== passwordOf(c)) return { error: 'Incorrect password' };
    return { error: null, contributor: signIn(c.id) };
  }
  function register(input) {
    var code = String(input.inviteCode || '').trim().toUpperCase();
    var handle = String(input.handle || '').trim().toLowerCase();
    var name = String(input.displayName || '').trim();
    var password = String(input.password || '');
    if (!code) return { error: 'Invite code is needed' };
    if (!/^[a-z][a-z0-9_]{1,23}$/.test(handle)) return { error: 'Handle: letters, numbers, underscore; start with a letter' };
    if (contributorByHandle(handle)) return { error: 'That handle is already taken' };
    if (!name) return { error: 'Display name is needed' };
    if (password.length < 4) return { error: 'Choose a password of at least 4 characters' };
    var invite = null;
    auth.invites.forEach(function (inv) {
      if (inv.code === code) invite = inv;
    });
    if (!invite || invite.purpose !== 'register') return { error: 'Unknown invite code' };
    if (invite.usedAt) return { error: 'That invite has already been used' };
    var c = {
      id: uid('c'),
      handle: handle,
      name: name,
      role: 'contributor',
      lastSeen: 'Just now',
      edits: 0,
      self: null,
      sessions: 1
    };
    invite.usedAt = 'Just now';
    invite.claimedBy = name;
    auth.extraContributors.push(c);
    auth.passwords[c.id] = password;
    saveAuth();
    return { error: null, contributor: signIn(c.id) };
  }
  function resetPassword(input) {
    var handle = String(input.handle || '').trim().toLowerCase();
    var code = String(input.resetCode || '').trim().toUpperCase();
    var password = String(input.newPassword || '');
    var c = contributorByHandle(handle);
    if (!c) return { error: 'No contributor with that handle' };
    if (password.length < 4) return { error: 'Choose a password of at least 4 characters' };
    if (!auth.resetCodes[c.id] || auth.resetCodes[c.id] !== code) return { error: 'Unknown or expired reset code' };
    auth.passwords[c.id] = password;
    delete auth.resetCodes[c.id];
    saveAuth();
    if (sessionId === c.id) signOut();
    return { error: null };
  }
  function invites() {
    return clone(auth.invites);
  }
  function issueInvite(purpose, label, contributorId) {
    var alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var code = '';
    for (var i = 0; i < 6; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
    if (purpose === 'reset') {
      var c = contributorById(contributorId);
      if (!c) return { error: 'Choose a contributor' };
      auth.resetCodes[c.id] = code;
      saveAuth();
      return { error: null, code: code, purpose: 'reset', handle: c.handle, expires: 'in 24 hours' };
    }
    var inv = {
      id: uid('inv'),
      purpose: 'register',
      code: code,
      label: label || null,
      usedAt: null,
      expires: 'in 30 days'
    };
    auth.invites.push(inv);
    saveAuth();
    return { error: null, code: code, purpose: 'register', expires: inv.expires };
  }
  function revokeInvite(id) {
    auth.invites = auth.invites.filter(function (inv) {
      return inv.id !== id;
    });
    saveAuth();
  }

  function addPerson(input) {
    var p = {
      id: uid('p'),
      given: input.given || 'Unknown',
      surname: input.surname || '',
      birthSurname: input.birthSurname || undefined,
      sex: input.sex || 'U',
      birth: input.birth || null,
      death: input.death || null,
      living: typeof input.living === 'boolean' ? input.living : undefined
    };
    overlay.persons.push(p);
    logChange('Added ' + fullName(p) + (p.birth && p.birth.text ? ' (b. ' + p.birth.text + ')' : ''), p.id);
    save();
    return p;
  }

  function addChildTo(familyId, childId) {
    overlay.familyChildren.push({ familyId: familyId, childId: childId });
    save();
  }

  function addFamily(p1, p2, marriage) {
    var f = { id: uid('f'), p1: p1, p2: p2, type: 'married', marriage: marriage || null, children: [] };
    overlay.families.push(f);
    save();
    return f;
  }

  /** Add a new child of `parentId` (creating a single-parent family if needed, or using the given family). */
  function addChild(parentId, familyId, input) {
    var child = addPerson(input);
    var fam = familyId ? family(familyId) : null;
    if (!fam) {
      var fams = familiesOf(parentId);
      fam = fams.length ? fams[0] : addFamily(parentId, null, null);
    }
    addChildTo(fam.id, child.id);
    return child;
  }

  function addPartner(personId, input, marriage) {
    var partner = addPerson(input);
    var me = person(personId);
    var f = me && me.sex === 'F' ? addFamily(partner.id, personId, marriage) : addFamily(personId, partner.id, marriage);
    return { partner: partner, family: f };
  }

  function addParent(childId, input) {
    var parent = addPerson(input);
    var fams = parentFamilies(childId);
    if (fams.length) {
      var f = fams[0];
      var slot = !f.p1 ? 'p1' : !f.p2 ? 'p2' : null;
      if (slot) {
        // overlay families are mutable; base ones need a copy into overlay
        var isOverlay = overlay.families.some(function (x) {
          return x.id === f.id;
        });
        if (isOverlay) {
          overlay.families.forEach(function (x) {
            if (x.id === f.id) x[slot] = parent.id;
          });
        } else {
          var copy = clone(f);
          copy[slot] = parent.id;
          copy.id = uid('f');
          overlay.families.push(copy);
          overlay.familyChildren = overlay.familyChildren.filter(function (fc) {
            return !(fc.familyId === f.id && fc.childId === childId);
          });
        }
        save();
        return parent;
      }
    }
    var nf = parent.sex === 'F' ? addFamily(null, parent.id, null) : addFamily(parent.id, null, null);
    addChildTo(nf.id, childId);
    return parent;
  }

  function addEvent(personId, ev) {
    ev.personId = personId;
    overlay.events.push(ev);
    var p = person(personId);
    logChange('Added event: ' + shortName(p) + ' \u2013 ' + ev.type + (ev.date ? ' ' + ev.date : ''), personId);
    save();
  }

  function addNote(personId, note) {
    note.personId = personId;
    note.by = me().name || 'Guest';
    note.when = 'Just now';
    overlay.notes.push(note);
    save();
  }

  function addMedia(m) {
    m.id = uid('m');
    m.hue = m.hue != null ? m.hue : Math.floor(Math.random() * 360);
    overlay.media.push(m);
    logChange('Added ' + m.kind + ' \u201c' + m.title + '\u201d', m.id, 'media');
    save();
    return m;
  }

  function search(q) {
    q = (q || '').trim().toLowerCase();
    if (!q) return [];
    return persons().filter(function (p) {
      var hay = (p.given + ' ' + p.surname + ' ' + (p.birthSurname || '') + ' ' + (p.nickname || '') + ' ' + ((p.birth && p.birth.year) || '')).toLowerCase();
      return q.split(/\s+/).every(function (tok) {
        return hay.indexOf(tok) >= 0;
      });
    });
  }

  function stats() {
    var ps = persons();
    var living = ps.filter(isLiving).length;
    var surnames = {};
    ps.forEach(function (p) {
      var s = p.birthSurname || p.surname;
      surnames[s] = (surnames[s] || 0) + 1;
    });
    var top = Object.keys(surnames)
      .map(function (k) {
        return { surname: k, count: surnames[k] };
      })
      .sort(function (a, b) {
        return b.count - a.count;
      });
    return { persons: ps.length, living: living, deceased: ps.length - living, families: families().length, media: media().length, surnames: top, generations: 6 };
  }

  return {
    tree: base.tree,
    SEED_PASSWORD: SEED_PASSWORD,
    me: me,
    isSignedIn: isSignedIn,
    currentContributor: currentContributor,
    contributors: contributors,
    allContributors: allContributors,
    invites: invites,
    connect: connect,
    register: register,
    resetPassword: resetPassword,
    signOut: signOut,
    issueInvite: issueInvite,
    revokeInvite: revokeInvite,
    persons: persons,
    person: person,
    isLiving: isLiving,
    age: age,
    families: families,
    family: family,
    familiesOf: familiesOf,
    parentFamilies: parentFamilies,
    parentsOf: parentsOf,
    siblingsOf: siblingsOf,
    childrenOf: childrenOf,
    partnersOf: partnersOf,
    eventsOf: eventsOf,
    media: media,
    mediaOf: mediaOf,
    primaryMedia: primaryMedia,
    notesOf: notesOf,
    changes: changes,
    fullName: fullName,
    shortName: shortName,
    addPerson: addPerson,
    addChild: addChild,
    addPartner: addPartner,
    addParent: addParent,
    addEvent: addEvent,
    addNote: addNote,
    addMedia: addMedia,
    search: search,
    stats: stats,
    reset: reset,
    byBirth: byBirth
  };
})();
