window.FamilyTreeGallery = (function () {
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
          U.renderShell({ title: 'Photos', subtitle: tree.name });
          U.comingSoon('Gallery', 'Compressed photos and documents arrive in Phase 2.');
        });
      })
      .catch(function () {
        location.replace('index.html');
      });
  }
  return { init: init };
})();
