/**
 * Shared display helpers (names, relative time).
 */
(function (global) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function initialsFromName(displayName) {
    var parts = String(displayName || '?').trim().split(/\s+/);
    var a = (parts[0] || '?')[0];
    var b = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (a + b).toUpperCase();
  }

  function relativeTime(iso) {
    if (!iso) return '';
    var t = new Date(iso).getTime();
    if (isNaN(t)) return '';
    var s = Math.round((Date.now() - t) / 1000);
    if (s < 45) return 'just now';
    if (s < 3600) {
      var m = Math.round(s / 60);
      return m + ' min ago';
    }
    if (s < 86400) {
      var h = Math.round(s / 3600);
      return h + ' hour' + (h === 1 ? '' : 's') + ' ago';
    }
    var d = Math.round(s / 86400);
    if (d < 14) return d + ' day' + (d === 1 ? '' : 's') + ' ago';
    return new Date(iso).toLocaleDateString();
  }

  function fullName(p) {
    if (!p) return '';
    var given = p.givenNames || p.given || '';
    var nick = p.nickname ? ' “' + p.nickname + '”' : '';
    var sur = p.surname || '';
    var suf = p.suffix ? ' ' + p.suffix : '';
    return (given + nick + ' ' + sur + suf).trim();
  }

  function shortName(p) {
    if (!p) return '';
    var given = (p.givenNames || p.given || '').split(/\s+/)[0] || '';
    return (given + ' ' + (p.surname || '')).trim();
  }

  function initialsOf(p) {
    if (!p) return '?';
    var g = (p.givenNames || p.given || '?')[0];
    var s = (p.surname || ' ')[0];
    return (g + s).toUpperCase();
  }

  function lifespan(p) {
    if (!p) return '';
    var b = p.birthYear;
    var d = p.deathYear;
    if (p.living) return b ? 'b. ' + b : 'Living';
    return (b || '?') + ' \u2013 ' + (d || '?');
  }

  function lifeLine(p) {
    if (!p) return '';
    var parts = [];
    if (p.birthDateText) parts.push('Born ' + p.birthDateText + (p.birthPlaceShort ? ', ' + p.birthPlaceShort : ''));
    if (p.deathDateText) parts.push('Died ' + p.deathDateText + (p.deathPlaceShort ? ', ' + p.deathPlaceShort : ''));
    else if (p.living && p.birthYear) parts.push('Living');
    return parts.join(' \u00b7 ');
  }

  function eventLabel(type) {
    var map = {
      birth: 'Born', baptism: 'Baptised', marriage: 'Married', divorce: 'Divorced',
      death: 'Died', burial: 'Buried', census: 'Census', residence: 'Residence',
      occupation: 'Occupation', education: 'Education', emigration: 'Emigrated',
      immigration: 'Immigrated', military: 'Military service', retirement: 'Retired', custom: 'Event'
    };
    return map[type] || type;
  }

  global.Formatters = {
    esc: esc,
    initialsFromName: initialsFromName,
    initialsOf: initialsOf,
    relativeTime: relativeTime,
    fullName: fullName,
    shortName: shortName,
    lifespan: lifespan,
    lifeLine: lifeLine,
    eventLabel: eventLabel
  };
})(typeof window !== 'undefined' ? window : this);
