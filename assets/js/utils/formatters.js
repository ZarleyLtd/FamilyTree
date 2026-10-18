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

  global.Formatters = {
    esc: esc,
    initialsFromName: initialsFromName,
    relativeTime: relativeTime
  };
})(typeof window !== 'undefined' ? window : this);
