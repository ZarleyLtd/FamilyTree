/**
 * FamilyTree API client — Supabase Edge Function familytree-api.
 */
(function (global) {
  'use strict';

  function baseUrl() {
    var c = global.FAMILYTREE_CONFIG || {};
    return c.API_URL || '';
  }

  function parseJsonResponse(res) {
    return res.json().then(function (json) {
      if (!res.ok || (json && json.error)) {
        var err = new Error((json && (json.error || json.message)) || 'Request failed (' + res.status + ')');
        err.status = res.status;
        throw err;
      }
      return json.data;
    });
  }

  function get(action, params) {
    var url = new URL(baseUrl());
    url.searchParams.set('action', action);
    if (params) {
      Object.keys(params).forEach(function (k) {
        if (params[k] != null && params[k] !== '') url.searchParams.set(k, params[k]);
      });
    }
    return fetch(url.toString(), {
      method: 'GET',
      credentials: 'omit',
      headers: { Accept: 'application/json' }
    }).then(parseJsonResponse);
  }

  function post(action, body) {
    var payload = Object.assign({ action: action }, body || {});
    return fetch(baseUrl(), {
      method: 'POST',
      credentials: 'omit',
      headers: {
        'Content-Type': 'text/plain;charset=UTF-8',
        Accept: 'application/json'
      },
      body: JSON.stringify(payload)
    }).then(parseJsonResponse);
  }

  function withAccess(extra) {
    var A = global.TreeAccess;
    var out = Object.assign({}, extra || {});
    if (A) {
      if (A.getShareCode()) out.treeCode = A.getShareCode();
      if (A.getSessionToken()) out.sessionToken = A.getSessionToken();
    }
    return out;
  }

  global.FamilyTreeAPI = {
    status: function () {
      return get('status');
    },
    lookupTree: function (treeCode) {
      return get('lookupTree', { treeCode: treeCode });
    },
    bootstrapTree: function (body) {
      return post('bootstrapTree', body);
    },
    register: function (body) {
      return post('register', withAccess(body));
    },
    connect: function (body) {
      return post('connect', withAccess(body));
    },
    resetPassword: function (body) {
      return post('resetPassword', withAccess(body));
    },
    signOut: function () {
      return post('signOut', withAccess({}));
    },
    whoAmI: function () {
      return post('whoAmI', withAccess({}));
    },
    unlockAdmin: function (adminCode) {
      return post('unlockAdmin', withAccess({ adminCode: adminCode }));
    },
    issueInvite: function (body) {
      return post('issueInvite', withAccess(body));
    },
    listInvites: function () {
      return post('listInvites', withAccess({}));
    },
    stats: function () {
      return get('stats', withAccess({}));
    },
    recentChanges: function (limit) {
      return get('recentChanges', withAccess({ limit: limit }));
    }
  };
})(typeof window !== 'undefined' ? window : this);
