-- Free-text place and range end for media, matching events.
-- place_id stays for a later places hierarchy (Phase 5).

alter table familytree.media
  add column if not exists place_text text,
  add column if not exists date_end_sort date;
