/**
 * Confirm sheet for destructive actions. Uses FamilyTreeUI.openSheet when present.
 */
(function (global) {
  'use strict';

  function confirmDialog(title, message, label, onYes) {
    var U = global.FamilyTreeUI;
    if (U && U.openSheet) {
      U.openSheet(
        title,
        '<p data-help="sheet.confirm">' + U.esc(message) + '</p>',
        '<button class="btn" type="button" data-close>Cancel</button><button class="btn btn--danger" type="button" id="confirmYes">' +
          U.esc(label || 'OK') +
          '</button>',
        function (root) {
          var yes = root.querySelector('#confirmYes');
          if (yes) {
            yes.addEventListener('click', function () {
              U.closeSheet();
              if (onYes) onYes();
            });
          }
        }
      );
      return;
    }
    if (global.confirm(message)) {
      if (onYes) onYes();
    }
  }

  global.ConfirmDialog = { show: confirmDialog };
})(typeof window !== 'undefined' ? window : this);
