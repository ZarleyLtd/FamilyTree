/**
 * Contextual help copy. Keys match data-help attributes.
 * Text explains features, never a specific person, photo or other record.
 */
window.FamilyTreeHelpCatalog = {
  pages: {
    landing: {
      title: 'Welcome',
      body: 'This site is a shared family tree. Paste a share code from a relative, or open the link they sent you. Without a code you cannot see anyone in the tree.'
    },
    home: {
      title: 'Family home',
      body: 'A snapshot of this tree: search, shortcuts, counts, recent edits and anniversaries. Anyone with the family link can look around. Connect as a contributor to add or change people and photos.'
    },
    people: {
      title: 'People',
      body: 'Everyone in the tree, searchable and filterable. Tap a row to open that person’s profile. Use + to add someone new (you will be asked to connect if you are browsing as a guest).'
    },
    person: {
      title: 'Person profile',
      body: 'Facts, family, a timeline of events and photos, and notes for one person. Buttons along the top open the chart, relationship calculator, editing and photos. Nothing here is shown to the public web — only people with the family link see living relatives.'
    },
    tree: {
      title: 'Charts',
      body: 'Draw this family as ancestors, descendants, hourglass or a fan. Drag to pan, pinch or scroll to zoom. Tap a person to select them, then open their profile or recentre the chart.'
    },
    gallery: {
      title: 'Photos & documents',
      body: 'Pictures and scans attached to the tree, grouped how you like. Tap a tile to open it full screen. The camera button adds a new item (compressed in the browser so originals are not stored here).'
    },
    admin: {
      title: 'Admin',
      body: 'Tree settings for administrators. Issue one-time invites so relatives can register, and watch storage use. Rotating codes, contributor management and reverting edits come in a later phase.'
    }
  },
  topics: {
    'chrome.back': {
      title: 'Back',
      body: 'Returns to the people list. The person you were viewing is unchanged.'
    },
    'chrome.search': {
      title: 'Find people',
      body: 'Opens the people list so you can search by name, nickname or year. On some pages there is also a search box in the page itself.'
    },
    'chrome.share': {
      title: 'Copy link',
      body: 'Copies a link to this page that includes the family share code. Anyone you send it to can view the same tree, including living people. It does not give them permission to edit.'
    },
    'chrome.account': {
      title: 'Your account',
      body: 'If you are a guest, this opens Connect so you can sign in. If you are signed in, it shows your handle and lets you switch account, reset a password, or sign out. The same handle and password work on any device.'
    },
    'chrome.navHome': {
      title: 'Home',
      body: 'The family landing page: search, shortcuts, counts, recent changes and “on this day”.'
    },
    'chrome.navPeople': {
      title: 'People',
      body: 'A searchable list of everyone in the tree, with filters and a surname index.'
    },
    'chrome.navTree': {
      title: 'Tree',
      body: 'Charts of ancestors, descendants, hourglass and fan for a focus person.'
    },
    'chrome.navGallery': {
      title: 'Photos',
      body: 'All photos and documents in the tree, with a lightbox and upload.'
    },
    'chrome.navAdmin': {
      title: 'Admin',
      body: 'Settings for people who administer this tree: invites, storage, and later contributor tools. You still need to connect, and non-admins must enter the admin code.'
    },
    'chrome.personRow': {
      title: 'A person in a list',
      body: 'Opens that person’s profile — family, timeline, photos and notes. This help is about the list row, not about the individual.'
    },

    'landing.shareCode': {
      title: 'Share code',
      body: 'The secret code from a family link (or written down by an admin). Paste it here if you opened the site without ?t= in the address. It is stored on this device so you do not have to enter it every time.'
    },
    'landing.open': {
      title: 'Open the tree',
      body: 'Saves the share code you typed and loads the family home. If the code is wrong you will stay on this screen.'
    },
    'landing.setup': {
      title: 'Create the tree',
      body: 'Used only when no tree exists yet. Creating one shows the share, admin and first-invite codes once — copy them somewhere safe. The first person to register with the invite becomes an admin.'
    },
    'landing.codes': {
      title: 'One-time codes',
      body: 'These plaintext codes are shown only now. The share code lets anyone view; the admin code unlocks admin; the invite is a one-time register for the first admin. They are stored hashed after this.'
    },
    'landing.copy': {
      title: 'Copy a code',
      body: 'Copies that code to the clipboard so you can paste it into a message or password manager. Do this before you leave the page.'
    },

    'home.search': {
      title: 'Search the tree',
      body: 'Type a name, nickname or year. Matching people appear underneath; tap one to open their profile. If nobody matches, you can add a new person (you will need to connect).'
    },
    'home.quickTree': {
      title: 'Tree shortcut',
      body: 'Opens the ancestor chart. You can switch to descendants, hourglass or fan once you are there.'
    },
    'home.quickPeople': {
      title: 'People shortcut',
      body: 'Opens the full people list with search and filters.'
    },
    'home.quickAdd': {
      title: 'Add a person',
      body: 'Creates someone who is not linked to anyone yet. After saving, open their profile to add parents, a partner or children. Guests are asked to connect first.'
    },
    'home.quickAdmin': {
      title: 'Admin shortcut',
      body: 'Opens the admin page. You must be signed in; non-admins also need the tree’s admin code.'
    },
    'home.quickConnect': {
      title: 'Connect',
      body: 'Sign in with the handle and password you chose when you registered. That is what lets you add and edit. Viewing does not need an account — only the family link.'
    },
    'home.stats': {
      title: 'Counts',
      body: 'How many people, living people, family unions and photos are in this tree. They update as relatives add records.'
    },
    'home.changes': {
      title: 'Recent changes',
      body: 'A short feed of edits (who added or changed something, and when). Tap a row to jump to that person when the change was about a person. It is an activity list, not a biography.'
    },
    'home.surnames': {
      title: 'Surnames',
      body: 'The most common surnames in the tree. Tap one to open the people list filtered to that name.'
    },
    'home.statistics': {
      title: 'Statistics',
      body: 'Highlights such as longest lived, oldest living, how many have a photo, and common given names. Names here are links into profiles or the people list — the panel itself is just a summary.'
    },
    'home.onThisDay': {
      title: 'On this day',
      body: 'Births, deaths, marriages and photos whose recorded date falls on today’s calendar day (any year). Tap an item to open the person or the gallery.'
    },
    'home.fab': {
      title: 'Add a person',
      body: 'The same as the Add person shortcut: create a new record, then connect them to the tree from their profile. You will be asked to connect if you are a guest.'
    },

    'people.search': {
      title: 'Search people',
      body: 'Filters the list as you type. Matches given names, surname, birth surname, nickname and years. Clear the box to see everyone again.'
    },
    'people.filters': {
      title: 'Filters',
      body: 'Narrow the list to living or deceased people, those with a photo, those missing a birth or death year, or a common surname. Tap All to clear.'
    },
    'people.sort': {
      title: 'Sort',
      body: 'Switches between surname order (with an A–Z jump list) and birth-year order (grouped by decade).'
    },
    'people.surnamesToggle': {
      title: 'Surname index',
      body: 'Switches the page between the people list and a surname index. Tap a surname to filter the list to that name.'
    },
    'people.alpha': {
      title: 'Jump to a letter',
      body: 'On a wide screen, jump the list to that initial letter of the surname. Letters with nobody yet are dimmed.'
    },
    'people.list': {
      title: 'People list',
      body: 'Everyone matching the current search and filters. Tap a row to open that profile. This help is about the list, not about any one person.'
    },
    'people.surnameRow': {
      title: 'A surname',
      body: 'Filters the people list to everyone who uses this surname (including as a birth surname).'
    },
    'people.fab': {
      title: 'Add a person',
      body: 'Creates a new person. They start unlinked; add parents, partners or children from their profile afterwards.'
    },

    'person.living': {
      title: 'Living or deceased',
      body: 'Living people are treated as private: their details are only returned to devices that hold the family share code. The flag is set from dates (no death, and born within about 110 years) unless someone overrides it when editing.'
    },
    'person.familyOnly': {
      title: 'Family only',
      body: 'A reminder that this living person’s details are not on the public internet. Only people with the share link see them.'
    },
    'person.tree': {
      title: 'Open the chart',
      body: 'Opens the ancestor chart centred on this person. From there you can switch view, change how many generations to show, or pick a different focus.'
    },
    'person.related': {
      title: 'Relationship calculator',
      body: 'Explains how this person is related to you (if you have marked “this is me” on your own profile) or to someone you pick. It uses the tree links, not DNA.'
    },
    'person.share': {
      title: 'Share this profile',
      body: 'Copies a link to this person that includes the family share code, so a relative can open the same profile.'
    },
    'person.photo': {
      title: 'Add a photo',
      body: 'Attach a picture or scan to this person. The file is compressed in the browser (about 100 KB) before it is saved. You can also set it as their profile portrait.'
    },
    'person.edit': {
      title: 'Edit this person',
      body: 'Change names, sex, living flag, and birth or death date and place. Dates can be approximate (abt, bef, Q2 1864). Every save is recorded in the change log.'
    },
    'person.more': {
      title: 'More actions',
      body: 'Extra tools for this person: jump to their ancestor chart, mark them as you (for “How am I related?”), or soft-delete them. An admin can restore a deleted person later.'
    },
    'person.tabFamily': {
      title: 'Family tab',
      body: 'Parents, siblings, partners and children. Siblings who share the same recorded parents are listed together; a Half-brother or Half-sister tag means they share one parent and the other parent is known and different. Use the + links to add or link people. Change or Remove on a parent if they were linked incorrectly.'
    },
    'person.tabTimeline': {
      title: 'Timeline tab',
      body: 'Events (birth, marriage, census and so on) and dated photos in date order. Tap an event to edit it, or a photo to open the lightbox. Add event records facts that are not just birth and death.'
    },
    'person.tabPhotos': {
      title: 'Photos tab',
      body: 'Pictures and documents linked to this person. Tap a tile to view it full screen, or + Add to upload another.'
    },
    'person.tabNotes': {
      title: 'Notes tab',
      body: 'Free-text notes, research jottings and to-dos attached to this person. They are for the family working on the tree, not a published biography.'
    },
    'person.addParent': {
      title: 'Add a parent',
      body: 'Create a new person or link someone already in the tree as a parent. The tree keeps one parental union where possible. If the wrong parent is already listed, use Change or Remove on that row instead.'
    },
    'person.changeParent': {
      title: 'Change parent',
      body: 'Replace this parent with someone else, new or already in the tree. Only this person’s link changes; brothers and sisters keep the original parent.'
    },
    'person.removeParent': {
      title: 'Remove parent',
      body: 'Unlinks this parent from this person. Brothers and sisters are unchanged. Use this when the wrong parent was attached; you can add the correct one afterwards.'
    },
    'person.addSibling': {
      title: 'Add a sibling',
      body: 'Adds a brother or sister who shares this person’s parents. They are attached to the same parent union, so they show as full siblings. If no parents exist yet, a placeholder parent union is created so the sibling can be attached.'
    },
    'person.addPartner': {
      title: 'Add a partner',
      body: 'Creates or links a spouse or partner. If this couple already exists, that family is reused rather than creating a second group. You can record a marriage date and place at the same time.'
    },
    'person.removePartner': {
      title: 'Remove partner',
      body: 'Unlinks this husband, wife or partner from this person. Both people stay in the tree. Use this when the wrong spouse was attached. Children of this union are not deleted, but they are no longer listed under this couple.'
    },
    'person.addChild': {
      title: 'Add a child',
      body: 'Creates or links a child of this person (and of their partner, if a family already exists). You can mark the relationship as birth, adopted, step or foster.'
    },
    'person.famPhoto': {
      title: 'Family photo',
      body: 'Uploads a picture attached to this couple and their children, not only to one person.'
    },
    'person.familyGroup': {
      title: 'A family group',
      body: 'One union of two partners (or one parent) and their children. The same couple is kept as a single group. Names open profiles. This help is about the grouping, not about the people in it.'
    },
    'person.event': {
      title: 'An event',
      body: 'A dated fact on this person’s timeline (census, residence, occupation, and so on). Tap to edit the date, place and details, attach a photo, or remove it. Approximate dates are fine.'
    },
    'person.addEvent': {
      title: 'Add an event',
      body: 'Records something that happened in this person’s life besides birth and death. Dates can be fuzzy. Birth, death and marriage are usually added from the profile or partner form instead.'
    },
    'person.photos': {
      title: 'Photos of this person',
      body: 'Tiles of media linked to this profile. Tap one to open the lightbox. This help is about the grid, not about a particular picture.'
    },
    'person.addPhoto': {
      title: 'Add a photo here',
      body: 'Same as the camera button on the profile: compress and upload, then link the item to this person.'
    },
    'person.notes': {
      title: 'Notes',
      body: 'Notes, research and to-dos already saved on this person. They are attributed to whoever wrote them.'
    },
    'person.addNote': {
      title: 'Add a note',
      body: 'A short text attached to this person. Choose Note, Research or To do so others can see what kind of reminder it is.'
    },
    'person.thisIsMe': {
      title: 'This is me',
      body: 'Marks this person as you on your contributor account. “How am I related?” on other profiles then starts from here. It does not change the tree data.'
    },
    'person.delete': {
      title: 'Delete person',
      body: 'Soft-deletes this person so they disappear from the tree. An admin can restore them from the change log later. You will be asked to confirm.'
    },
    'person.relPath': {
      title: 'Relationship path',
      body: 'A mini chart of how the calculator walked the tree between two people (up to a common ancestor and down again). Each box after the starting person is labelled with how they are related to that starting person. Each link is the direct relationship between those two neighbours. Tap a box to open that profile. The wording is a kinship term, not a DNA result.'
    },
    'person.relOther': {
      title: 'Compare with someone else',
      body: 'Pick a different person to run the relationship calculator against. Useful when you have not marked “this is me”, or you want a cousin-to-cousin path.'
    },
    'person.moreAncestors': {
      title: 'Ancestors chart',
      body: 'Opens the ancestor view centred on this person — the same as the Tree button on the profile.'
    },

    'tree.view': {
      title: 'Chart type',
      body: 'Ancestors looks up from the focus person, Descendants looks down, Hourglass does both, Fan draws ancestors as coloured arcs. The focus person stays the same until you change them.'
    },
    'tree.focus': {
      title: 'Focus person',
      body: 'Who the chart is drawn around. Tap to pick someone else. You can also recentre by selecting a person on the chart and choosing Centre.'
    },
    'tree.span': {
      title: 'Fan span',
      body: '180° is a semicircle (often easier to read); 360° wraps all the way around the focus person. Only applies to the fan view.'
    },
    'tree.gens': {
      title: 'Generations',
      body: 'How many generations to load and draw. Fewer is quicker and less crowded; more shows a wider family. There is a cap so the chart stays usable on a phone.'
    },
    'tree.share': {
      title: 'Share this chart',
      body: 'Copies a link that includes the focus person, view and the family share code, so someone else opens the same chart.'
    },
    'tree.chart': {
      title: 'The chart',
      body: 'Drag to pan, pinch or use the mouse wheel to zoom. Tap a person to select them (then open their profile or recentre). Empty space is just the canvas — it is not a record.'
    },
    'tree.personNode': {
      title: 'A person on the chart',
      body: 'Selects this person and shows a small panel: open their profile, or centre the chart on them. This help is about that gesture, not about the individual. Dragging pans the whole chart instead.'
    },
    'tree.placeholder': {
      title: 'Missing parent',
      body: 'A slot where a parent has not been recorded. Tap to add that father or mother (you will need to connect).'
    },
    'tree.collapse': {
      title: 'Show or hide children',
      body: 'On descendants and hourglass, this badge collapses or expands this person’s children so a large tree is easier to read. If the label is a plus and a number, more generations are available — tap to load them.'
    },
    'tree.zoomIn': {
      title: 'Zoom in',
      body: 'Enlarges the chart around the centre of the view. You can also pinch on a phone or scroll the mouse wheel.'
    },
    'tree.zoomOut': {
      title: 'Zoom out',
      body: 'Shrinks the chart so more of the family fits on screen.'
    },
    'tree.fit': {
      title: 'Fit to screen',
      body: 'Zooms and pans so the whole current chart fits in the window.'
    },
    'tree.recentre': {
      title: 'Recentre',
      body: 'Pans so the focus person is in the middle of the view, without changing how many generations are loaded.'
    },
    'tree.legend': {
      title: 'Fan colours',
      body: 'On the fan chart, one colour is the paternal line and the other is the maternal line, so you can see which side of the family an ancestor sits on.'
    },
    'tree.chartInfo': {
      title: 'Selected person',
      body: 'A short panel for whoever you tapped on the chart. Centre redraws around them; Profile opens their page. Close dismisses the panel. It is a navigation aid, not extra private data.'
    },
    'tree.infoCentre': {
      title: 'Centre on this person',
      body: 'Makes the selected person the new focus and reloads the chart around them.'
    },
    'tree.infoProfile': {
      title: 'Open profile',
      body: 'Leaves the chart and opens the selected person’s full page.'
    },

    'gallery.search': {
      title: 'Search photos',
      body: 'Filters tiles by title, caption, place, date text, or the names of people tagged in the item.'
    },
    'gallery.kinds': {
      title: 'Kind of item',
      body: 'Show only photos, portraits, documents, certificates and so on. All brings every item back.'
    },
    'gallery.group': {
      title: 'Group by',
      body: 'Cycles how the grid is arranged: by decade, by person tagged, by kind, or a single ungrouped grid.'
    },
    'gallery.tile': {
      title: 'A photo or document',
      body: 'Opens the lightbox so you can see it larger, swipe between items, and see who is tagged. This help is about the tile, not about the picture itself.'
    },
    'gallery.fab': {
      title: 'Add a photo',
      body: 'Take or choose a picture. It is compressed in the browser to about 100 KB before upload — this is not a place to archive originals.'
    },
    'gallery.lightbox': {
      title: 'Photo viewer',
      body: 'Full-screen view of one item. Pinch or scroll to zoom the picture only — the close button, title and captions stay put. At normal size, swipe to slide to the next photo. The list underneath is people tagged in this picture. Close with the × or Escape.'
    },
    'gallery.prev': {
      title: 'Previous item',
      body: 'Slides in the previous photo or document. On a phone you can also swipe. Zoom does not move these controls.'
    },
    'gallery.next': {
      title: 'Next item',
      body: 'Slides in the next photo or document. On a phone you can also swipe. Arrow keys work on a keyboard.'
    },
    'gallery.zoom': {
      title: 'Zoom the photo',
      body: 'Pinch, use the mouse wheel, or tap + and −. Only the picture zooms and pans. The ×, arrows, title and people list stay where they are. Double-tap the photo to jump in or back out. Swipe between photos once you are back at normal size.'
    },
    'gallery.people': {
      title: 'People in this photo',
      body: 'Who has been tagged on this item. Tap a name to open their profile. Contributors can set it as a profile portrait or remove a tag. This is tagging, not a description of the scene.'
    },
    'gallery.tag': {
      title: 'Tag a face',
      body: 'Turns on face-tagging: tap on the photo to mark a region, then pick who it is. Tap again when you are done. Tags are boxes on the image, not a facial-recognition scan.'
    },
    'gallery.addPerson': {
      title: 'Add a person to this photo',
      body: 'Link someone already in the tree (or create them) so this item shows on their profile too.'
    },
    'gallery.edit': {
      title: 'Edit this item',
      body: 'Change title, caption, kind, date and place, or who is linked. The image file itself stays the compressed copy that was uploaded.'
    },
    'gallery.delete': {
      title: 'Delete this item',
      body: 'Soft-deletes the media record. You will be asked to confirm. An admin can restore it later from the change log.'
    },

    'admin.connect': {
      title: 'Connect to use admin',
      body: 'Admin tools need a contributor account. Connect with your handle and password, then if you are not already an admin you will be asked for the tree admin code.'
    },
    'admin.register': {
      title: 'Register',
      body: 'Create a contributor account with a one-time invite. The first person to use the bootstrap invite becomes an admin; later invites are issued from this page.'
    },
    'admin.unlock': {
      title: 'Admin code',
      body: 'Promotes your signed-in account to admin for this tree. The code was shown once when the tree was created (or rotated later). It is not the same as the share code used for viewing.'
    },
    'admin.tree': {
      title: 'This tree',
      body: 'The tree’s name and the share code stored on this device. Rotating the share or admin code, and managing other contributors, arrives in the next collaboration phase. Invites can be issued now.'
    },
    'admin.storage': {
      title: 'Storage',
      body: 'How much space photos use in the shared project bucket. Images are kept small on purpose. If this bar grows large, we may move the tree to its own project later.'
    },
    'admin.invite': {
      title: 'Issue an invite',
      body: 'Creates a one-time register code (optional label, e.g. who it is for). It is shown once — send it in a message. After they register, they sign in with the handle and password they chose.'
    },
    'admin.invites': {
      title: 'Pending invites',
      body: 'Register codes that have not been used yet and have not expired. Once claimed they disappear from this list. The plaintext code is never shown again.'
    },
    'admin.copy': {
      title: 'Copy invite',
      body: 'Copies the freshly issued code so you can send it. After you leave this result, you cannot see the plaintext again.'
    },

    'sheet.dialog': {
      title: 'A form overlay',
      body: 'A sheet for a single task (sign in, add a person, upload, and so on). Fill it in and confirm, or cancel. On a phone it rises from the bottom; on a wide screen it is a dialog. Tap ? then a field for details of that field.'
    },
    'sheet.confirm': {
      title: 'Please confirm',
      body: 'A destructive or hard-to-undo action. Cancel leaves things as they were. Confirming runs the action and writes it to the change log where relevant.'
    },
    'sheet.connect': {
      title: 'Connect',
      body: 'Sign in with the handle and password from when you registered. That session lets this device edit. Forgot password needs a reset code from an admin — the original invite cannot be reused.'
    },
    'sheet.register': {
      title: 'Register',
      body: 'Claim a one-time invite: choose a unique handle, a display name (shown on edits) and a password. After this, Connect on any device with that handle and password. The invite cannot be used again.'
    },
    'sheet.reset': {
      title: 'Reset password',
      body: 'An admin issues a reset code (one use, 24 hours). Enter your handle, that code and a new password. You will need to Connect again afterwards.'
    },
    'sheet.personForm': {
      title: 'Person form',
      body: 'Given names and surname are the usual display name. Birth surname is the name at birth if it later changed. Nickname is optional. Saving writes a change-log entry.'
    },
    'sheet.dates': {
      title: 'Genealogy dates',
      body: 'Type dates as you would on a family sheet: 12 Mar 1901, Mar 1901, 1901, abt 1842, bef 1900, 1850–1855, or Q2 1864. The site stores what you typed plus a sort date. Do not use a date picker — approximate is expected.'
    },
    'sheet.living': {
      title: 'Living flag',
      body: 'Turn this off if the person has died, then fill in death date and place if you know them. Living people’s details stay inside the family link. The server also infers living from dates when you leave this unset.'
    },
    'sheet.sex': {
      title: 'Sex',
      body: 'Used for chart colours and for labels such as mother or husband. Unknown is fine when records do not say.'
    },
    'sheet.relationType': {
      title: 'Child relationship',
      body: 'How this child is connected to the family: birth, adopted, step or foster. It does not change whose profile they appear on, only the tag on the family group.'
    },
    'sheet.picker': {
      title: 'Choose a person',
      body: 'Search the tree and tap someone already recorded. Use this when you are linking an existing person rather than creating a duplicate.'
    },
    'sheet.choose': {
      title: 'New or existing',
      body: 'Create a brand-new person, or link someone who is already in the tree. Prefer linking when they are already recorded, so you do not end up with two records for one person.'
    },
    'sheet.upload': {
      title: 'Add a photo or document',
      body: 'Take or choose an image. It is resized to about 100 KB JPEG before upload — keep your originals elsewhere. Then add a title, kind, optional date and place, and who appears in it.'
    },
    'sheet.uploadKind': {
      title: 'Kind of media',
      body: 'What this file is (photo, portrait, certificate, grave, and so on). It only affects labels and gallery filters, not how the file is stored.'
    },
    'sheet.uploadPeople': {
      title: 'People in this item',
      body: 'Link the people who appear in (or are the subject of) this file so it shows on their profiles. Search to add more. Optionally set it as someone’s profile portrait.'
    },
    'sheet.event': {
      title: 'Event form',
      body: 'A dated fact: type, date (approximate is fine), place and optional details. Birth and death are usually edited on the person form; this is for census, occupation, burial and the rest.'
    },
    'sheet.note': {
      title: 'Note form',
      body: 'A short text on this person. Kind is Note, Research or To do so the family can tell a fact from a reminder.'
    },
    'sheet.relation': {
      title: 'Relationship result',
      body: 'The kinship wording and a path through the tree. It only knows links that have been entered. Compare with someone else to run it again from a different starting person.'
    }
  }
};
