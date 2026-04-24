-- Read-only view for the conversations list page.
-- Provides message_count, last_message_at, and last_message_content
-- without requiring multiple round-trips from the app layer.
create view public.conversation_summary as
select
  c.id,
  c.customer_phone,
  c.bot_id,
  c.created_at,
  b.name                                                as bot_name,
  count(m.id)::int                                      as message_count,
  max(m.created_at)                                     as last_message_at,
  (
    select m2.content
    from public.messages m2
    where m2.conversation_id = c.id
    order by m2.created_at desc
    limit 1
  )                                                     as last_message_content
from public.conversations c
join public.bots b on b.id = c.bot_id
left join public.messages m on m.conversation_id = c.id
group by c.id, c.customer_phone, c.bot_id, c.created_at, b.name;
