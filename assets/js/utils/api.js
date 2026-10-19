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

  function withTree(extra) {
    var A = global.TreeAccess;
    var out = Object.assign({}, extra || {});
    if (A && A.getShareCode()) out.treeCode = A.getShareCode();
    return out;
  }

  function withAccess(extra) {
    var A = global.TreeAccess;
    var out = withTree(extra);
    if (A && A.getSessionToken()) out.sessionToken = A.getSessionToken();
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
      return get('stats', withTree({}));
    },
    recentChanges: function (limit) {
      return get('recentChanges', withTree({ limit: limit }));
    },
    listPersons: function (params) {
      return get('listPersons', withTree(params || {}));
    },
    getPerson: function (id) {
      return get('getPerson', withTree({ id: id }));
    },
    getPedigree: function (focusId, generations) {
      return get('getPedigree', withTree({ focusId: focusId, generations: generations }));
    },
    getDescendants: function (focusId, generations) {
      return get('getDescendants', withTree({ focusId: focusId, generations: generations }));
    },
    getHourglass: function (focusId, up, down) {
      return get('getHourglass', withTree({ focusId: focusId, up: up, down: down }));
    },
    relationship: function (fromId, toId) {
      return get('relationship', withTree({ fromId: fromId, toId: toId }));
    },
    timeline: function (personId) {
      return get('timeline', withTree({ personId: personId }));
    },
    onThisDay: function (month, day) {
      return get('onThisDay', withTree({ month: month, day: day }));
    },
    createPerson: function (body) {
      return post('createPerson', withAccess(body));
    },
    updatePerson: function (body) {
      return post('updatePerson', withAccess(body));
    },
    deletePerson: function (id) {
      return post('deletePerson', withAccess({ id: id }));
    },
    createFamily: function (body) {
      return post('createFamily', withAccess(body));
    },
    deleteFamily: function (id) {
      return post('deleteFamily', withAccess({ id: id }));
    },
    addChild: function (body) {
      return post('addChild', withAccess(body));
    },
    addParentToPerson: function (body) {
      return post('addParentToPerson', withAccess(body));
    },
    removeParentFromPerson: function (body) {
      return post('removeParentFromPerson', withAccess(body));
    },
    replaceParentOfPerson: function (body) {
      return post('replaceParentOfPerson', withAccess(body));
    },
    createEvent: function (body) {
      return post('createEvent', withAccess(body));
    },
    updateEvent: function (body) {
      return post('updateEvent', withAccess(body));
    },
    deleteEvent: function (id) {
      return post('deleteEvent', withAccess({ id: id }));
    },
    createNote: function (body) {
      return post('createNote', withAccess(body));
    },
    setSelfPerson: function (personId) {
      return post('setSelfPerson', withAccess({ personId: personId }));
    },
    listMedia: function (params) {
      return get('listMedia', withTree(params || {}));
    },
    uploadMedia: function (body) {
      return post('uploadMedia', withAccess(body));
    },
    updateMedia: function (body) {
      return post('updateMedia', withAccess(body));
    },
    deleteMedia: function (id) {
      return post('deleteMedia', withAccess({ id: id }));
    },
    linkMedia: function (body) {
      return post('linkMedia', withAccess(body));
    },
    unlinkMedia: function (body) {
      return post('unlinkMedia', withAccess(body));
    },
    storageUsage: function () {
      return post('storageUsage', withAccess({}));
    }
  };
})(typeof window !== 'undefined' ? window : this);
