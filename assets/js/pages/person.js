window.FamilyTreePerson = (function () {
  'use strict';
  function init() {
    var A = window.TreeAccess;
    var API = window.FamilyTreeAPI;
    var U = window.FamilyTreeUI;
    A.captureShareCode();
    if (!A.getShareCode()) {
      location.replace('index.html');
      return;
    }
    API.lookupTree(A.getShareCode())
      .then(function (tree) {
        return U.refreshMe().then(function () {
          U.renderShell({ title: 'Person', subtitle: tree.name, back: 'people.html' });
          U.comingSoon('Person profile', 'Facts, family, timeline and photos will live here in Phase 1.');
        });
      })
      .catch(function () {
        location.replace('index.html');
      });
  }
  return { init: init };
})();
