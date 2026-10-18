/**
 * Fuzzy genealogy dates. Store date_text as typed; date_sort / date_qualifier for order.
 * Never use new Date(userText) for genealogy dates.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GenDate = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var MONTHS = {
    jan: 1, january: 1,
    feb: 2, february: 2,
    mar: 3, march: 3,
    apr: 4, april: 4,
    may: 5,
    jun: 6, june: 6,
    jul: 7, july: 7,
    aug: 8, august: 8,
    sep: 9, sept: 9, september: 9,
    oct: 10, october: 10,
    nov: 11, november: 11,
    dec: 12, december: 12
  };

  function pad(n) {
    return n < 10 ? '0' + n : String(n);
  }
  function iso(y, m, d) {
    if (!y || y < 1000 || y > 9999) return null;
    m = m || 1;
    d = d || 1;
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    return y + '-' + pad(m) + '-' + pad(d);
  }
  function expandYear(y) {
    if (y < 100) return y >= 30 ? 1900 + y : 2000 + y;
    return y;
  }
  function monthNum(name) {
    return MONTHS[String(name || '').toLowerCase().replace(/\./g, '')] || 0;
  }

  /**
   * @returns {{ text: string, sort: string|null, qualifier: string, end: string|null }|null}
   */
  function parse(raw) {
    var text = String(raw == null ? '' : raw).trim();
    if (!text) return null;
    var original = text;
    var s = text.toLowerCase().replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
    var qualifier = 'exact';
    var end = null;
    var sort = null;

    if (/^(unknown|unk|\?)$/.test(s)) {
      return { text: original, sort: null, qualifier: 'unknown', end: null };
    }

    var qtr = s.match(/^q([1-4])\s+(\d{4})$/);
    if (qtr) {
      var q = Number(qtr[1]);
      var qy = Number(qtr[2]);
      var qm = [2, 5, 8, 11][q - 1];
      return { text: original, sort: iso(qy, qm, 15), qualifier: 'about', end: null };
    }

    if (/^(circa|ca|c|abt|about|approx|approximately|est|estimated)\b/.test(s)) {
      qualifier = /^(est|estimated)\b/.test(s) ? 'estimated' : 'about';
      s = s.replace(/^(circa|ca|c|abt|about|approx|approximately|est|estimated)\s+/, '');
    } else if (/^(bef|before|by)\b/.test(s)) {
      qualifier = 'before';
      s = s.replace(/^(bef|before|by)\s+/, '');
    } else if (/^(aft|after|from)\b/.test(s)) {
      qualifier = 'after';
      s = s.replace(/^(aft|after|from)\s+/, '');
    } else if (/^(bet|between)\b/.test(s)) {
      qualifier = 'between';
      s = s.replace(/^(bet|between)\s+/, '').replace(/\s+and\s+/g, '-');
    }

    var range = s.match(/^(\d{4})\s*[\-–—to]+\s*(\d{4})$/);
    if (range) {
      var y1 = Number(range[1]);
      var y2 = Number(range[2]);
      return { text: original, sort: iso(y1, 1, 1), qualifier: 'between', end: iso(y2, 12, 31) };
    }

    var ymd = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (ymd) {
      sort = iso(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]));
      return { text: original, sort: sort, qualifier: qualifier, end: end };
    }

    var dmyNum = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (dmyNum) {
      var day = Number(dmyNum[1]);
      var mo = Number(dmyNum[2]);
      var yr = expandYear(Number(dmyNum[3]));
      if (day > 12 && mo <= 12) sort = iso(yr, mo, day);
      else sort = iso(yr, mo, day); // Irish day/month
      return { text: original, sort: sort, qualifier: qualifier, end: end };
    }

    var dMonY = s.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+(of\s+)?([a-z]+)\s+(\d{4})$/);
    if (dMonY) {
      sort = iso(Number(dMonY[4]), monthNum(dMonY[3]), Number(dMonY[1]));
      return { text: original, sort: sort, qualifier: qualifier, end: end };
    }

    var monDY = s.match(/^([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?\s+(\d{4})$/);
    if (monDY && monthNum(monDY[1])) {
      sort = iso(Number(monDY[3]), monthNum(monDY[1]), Number(monDY[2]));
      return { text: original, sort: sort, qualifier: qualifier, end: end };
    }

    var monY = s.match(/^([a-z]+)\s+(\d{4})$/);
    if (monY && monthNum(monY[1])) {
      sort = iso(Number(monY[2]), monthNum(monY[1]), 1);
      if (qualifier === 'exact') qualifier = 'about';
      return { text: original, sort: sort, qualifier: qualifier, end: end };
    }

    var yearOnly = s.match(/^(\d{4})$/);
    if (yearOnly) {
      var y = Number(yearOnly[1]);
      if (qualifier === 'exact') {
        sort = iso(y, 7, 1);
        qualifier = 'about';
      } else if (qualifier === 'before') sort = iso(y, 1, 1);
      else if (qualifier === 'after') sort = iso(y, 12, 31);
      else sort = iso(y, 7, 1);
      return { text: original, sort: sort, qualifier: qualifier, end: end };
    }

    var anyYear = s.match(/(\d{4})/);
    if (anyYear) {
      return { text: original, sort: iso(Number(anyYear[1]), 7, 1), qualifier: 'estimated', end: null };
    }
    return { text: original, sort: null, qualifier: 'unknown', end: null };
  }

  function format(parsed) {
    if (!parsed) return '';
    return parsed.text || '';
  }

  function yearOf(parsed) {
    if (!parsed || !parsed.sort) return null;
    return Number(String(parsed.sort).slice(0, 4)) || null;
  }

  return { parse: parse, format: format, yearOf: yearOf };
});
