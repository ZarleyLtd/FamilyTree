window.FamilyTreePeople = (function () {
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
          U.renderShell({ title: 'People', subtitle: tree.name });
          U.comingSoon(
            'People list',
            'Search, filter and add people will live here. For now the tree is empty \u2014 adding records is Phase 1.'
          );
        });
      })
      .catch(function () {
        location.replace('index.html');
      });
  }
  return { init: init };
})();
