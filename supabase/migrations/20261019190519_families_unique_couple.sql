-- One family union per unordered couple (both partners set). Merge duplicates first.

with ranked as (
  select
    f.id,
    f.tree_id,
    f.relationship_type,
    least(f.partner1_id, f.partner2_id) as a,
    greatest(f.partner1_id, f.partner2_id) as b,
    row_number() over (
      partition by f.tree_id, least(f.partner1_id, f.partner2_id), greatest(f.partner1_id, f.partner2_id)
      order by
        case f.relationship_type
          when 'married' then 0
          when 'partners' then 1
          else 2
        end,
        f.created_at asc,
        f.id asc
    ) as rn
  from familytree.families f
  where f.deleted_at is null
    and f.partner1_id is not null
    and f.partner2_id is not null
),
dupes as (
  select r.id as drop_id, k.id as keep_id
  from ranked r
  join ranked k
    on k.tree_id = r.tree_id
   and k.a = r.a
   and k.b = r.b
   and k.rn = 1
  where r.rn > 1
),
moved_children as (
  insert into familytree.family_children (family_id, child_id, relation_type, seq)
  select
    d.keep_id,
    fc.child_id,
    fc.relation_type,
    coalesce((select max(x.seq) from familytree.family_children x where x.family_id = d.keep_id), -1)
      + row_number() over (partition by d.keep_id order by fc.seq, fc.child_id)
  from familytree.family_children fc
  join dupes d on d.drop_id = fc.family_id
  on conflict (family_id, child_id) do nothing
  returning family_id
),
moved_events as (
  update familytree.events e
  set family_id = d.keep_id
  from dupes d
  where e.family_id = d.drop_id
    and e.deleted_at is null
  returning e.id
),
moved_notes as (
  update familytree.notes n
  set target_id = d.keep_id
  from dupes d
  where n.target_type = 'family'
    and n.target_id = d.drop_id
    and n.deleted_at is null
  returning n.id
),
moved_media as (
  update familytree.media_links ml
  set target_id = d.keep_id
  from dupes d
  where ml.target_type = 'family'
    and ml.target_id = d.drop_id
    and not exists (
      select 1
      from familytree.media_links x
      where x.media_id = ml.media_id
        and x.target_type = 'family'
        and x.target_id = d.keep_id
    )
  returning ml.id
),
dropped as (
  update familytree.families f
  set deleted_at = now(), updated_by = 'system'
  from dupes d
  where f.id = d.drop_id
    and f.deleted_at is null
  returning f.id
)
delete from familytree.family_children fc
using dropped d
where fc.family_id = d.id;

create unique index if not exists families_unique_couple
  on familytree.families (
    tree_id,
    least(partner1_id, partner2_id),
    greatest(partner1_id, partner2_id)
  )
  where deleted_at is null
    and partner1_id is not null
    and partner2_id is not null;
