/**
 * Share-code capture (?t=) into localStorage, plus session token for edits.
 * The server is the authority — this only remembers what the user already has.
 */
(function (global) {
  'use strict';

  var CODE_KEY = 'familytree.shareCode';
  var SESSION_KEY = 'familytree.sessionToken';
  var ME_KEY = 'familytree.me';

  function getShareCode() {
    return (localStorage.getItem(CODE_KEY) || '').trim().toUpperCase();
  }

  function setShareCode(code) {
    code = String(code || '').trim().toUpperCase().replace(/\s+/g, '');
    if (code) localStorage.setItem(CODE_KEY, code);
    else localStorage.removeItem(CODE_KEY);
    return getShareCode();
  }

  function captureShareCode() {
    var params = new URLSearchParams(location.search);
    var t = params.get('t');
    if (t && t.trim()) setShareCode(t);
    return getShareCode();
  }

  function clearShareCode() {
    localStorage.removeItem(CODE_KEY);
  }

  function getSessionToken() {
    return localStorage.getItem(SESSION_KEY) || '';
  }

  function setSession(sessionToken, contributor) {
    if (sessionToken) localStorage.setItem(SESSION_KEY, sessionToken);
    else localStorage.removeItem(SESSION_KEY);
    if (contributor) localStorage.setItem(ME_KEY, JSON.stringify(contributor));
    else localStorage.removeItem(ME_KEY);
  }

  function getMe() {
    try {
      return JSON.parse(localStorage.getItem(ME_KEY) || 'null');
    } catch (e) {
      return null;
    }
  }

  function isSignedIn() {
    return !!(getSessionToken() && getMe());
  }

  function signOutLocal() {
    setSession('', null);
  }

  global.TreeAccess = {
    getShareCode: getShareCode,
    setShareCode: setShareCode,
    captureShareCode: captureShareCode,
    clearShareCode: clearShareCode,
    getSessionToken: getSessionToken,
    setSession: setSession,
    getMe: getMe,
    isSignedIn: isSignedIn,
    signOutLocal: signOutLocal
  };
})(typeof window !== 'undefined' ? window : this);
