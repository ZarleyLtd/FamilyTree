/**
 * Entry: route by document.body.dataset.page to the page module's init().
 */
(function () {
  'use strict';
  if (window.ContextualHelp && typeof window.ContextualHelp.init === 'function') {
    window.ContextualHelp.init();
  }
  var page = document.body && document.body.dataset.page;
  var map = {
    home: window.FamilyTreeHome,
    people: window.FamilyTreePeople,
    person: window.FamilyTreePerson,
    tree: window.FamilyTreeTree,
    gallery: window.FamilyTreeGallery,
    admin: window.FamilyTreeAdmin
  };
  var mod = map[page];
  if (mod && typeof mod.init === 'function') mod.init();
})();
