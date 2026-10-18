window.FamilyTreeTree = (function () {
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
          U.renderShell({ title: 'Tree', subtitle: tree.name });
          U.comingSoon(
            'Charts',
            'Pedigree, descendants, hourglass and fan charts will be hand-rolled SVG here. Pedigree is first in Phase 1.'
          );
        });
      })
      .catch(function () {
        location.replace('index.html');
      });
  }
  return { init: init };
})();
