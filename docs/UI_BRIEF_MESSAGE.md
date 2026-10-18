# Brief message (this project)

This project uses the shared CursorSites **brief message** pattern.

- **Canonical spec:** [`../../cursor-sites-shared/ui/BRIEF_MESSAGE.md`](../../cursor-sites-shared/ui/BRIEF_MESSAGE.md)
- **Synced utility:** [`../assets/js/utils/brief-message.js`](../assets/js/utils/brief-message.js)
- **Synced styles:** [`../assets/css/brief-message.css`](../assets/css/brief-message.css) (imported from `style.css`)

## Example in this project

Connect / register feedback, “copied” on invite codes, and Phase 0 no-ops such as “Adding people comes in the next phase” use `BriefMessage.show(text, anchorEl)`.
