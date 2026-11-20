# Contextual help (this project)

This project is the reference implementation of the shared CursorSites **contextual help** pattern: tap **?**, then tap a control, and a popover explains the feature (never a particular person, photo, or other record).

- **Canonical spec:** [`../../cursor-sites-shared/ui/CONTEXTUAL_HELP.md`](../../cursor-sites-shared/ui/CONTEXTUAL_HELP.md)
- **Engine:** [`../assets/js/components/contextual-help.js`](../assets/js/components/contextual-help.js) (`ContextualHelp.init()` from `main.js`)
- **Styles:** [`../assets/css/contextual-help.css`](../assets/css/contextual-help.css) (imported from `style.css`)
- **Catalog:** [`../assets/js/utils/help-catalog.js`](../assets/js/utils/help-catalog.js) (`window.FamilyTreeHelpCatalog`)

The **?** button is rendered by `shell.js` on every page, and again in sheet and lightbox headers. Topic keys live in `data-help` attributes; page fallbacks use `body[data-page]`, with `body.page-landing` selecting the `landing` topic.
