-- FS-24 / FS-25: synthetic door-check fixtures (admission demo + acceptance matrix).
-- Run in the Supabase SQL editor AFTER the biletflow_web migrations (see deploy/README.md).
-- Re-runnable: rows use fixed IDs and are replaced on every run.
--
-- Before running, create three accounts through the web sign-up (or Supabase Auth) and confirm them:
--   organizer, assigned staff, attendee. Put their emails below.
-- Creates:
--   Event A "BiletFlow Door Demo"        - organizer owns it, staff is assigned (can scan)
--   Event B "Unassigned Event B"          - same organizer, staff NOT assigned (must never appear for staff)
--   Tickets on A: 3 valid, 1 checked_in, 1 cancelled, 1 refunded; 1 valid ticket on B (wrong-event test)
do $$
declare
  c_organizer_email text := 'demo.organizer@example.com';
  c_staff_email     text := 'demo.staff@example.com';
  c_attendee_email  text := 'demo.attendee@example.com';

  v_org uuid; v_staff uuid; v_att uuid;
  e_a  uuid := 'b1e70000-0000-4000-8000-00000000000a';
  e_b  uuid := 'b1e70000-0000-4000-8000-00000000000b';
  tt_a uuid := 'b1e70000-0000-4000-8000-0000000000a1';
  tt_b uuid := 'b1e70000-0000-4000-8000-0000000000b1';
  o_a  uuid := 'b1e70000-0000-4000-8000-0000000000a2';
  o_b  uuid := 'b1e70000-0000-4000-8000-0000000000b2';
begin
  select id into v_org   from auth.users where lower(email) = lower(c_organizer_email);
  select id into v_staff from auth.users where lower(email) = lower(c_staff_email);
  select id into v_att   from auth.users where lower(email) = lower(c_attendee_email);
  if v_org is null or v_staff is null or v_att is null then
    raise exception 'Create and confirm the organizer, staff and attendee accounts first (check the emails at the top).';
  end if;

  -- roles are server-controlled (FS-01): set them here, not from a client
  update profiles set role = 'organizer'   where id = v_org;
  update profiles set role = 'event_admin' where id = v_staff;
  update profiles set role = 'attendee'    where id = v_att;

  delete from event_staff where event_id in (e_a, e_b);
  delete from tickets     where event_id in (e_a, e_b);
  delete from orders      where id in (o_a, o_b);
  delete from ticket_types where id in (tt_a, tt_b);
  delete from events      where id in (e_a, e_b);

  insert into events (id, organizer_id, title, description, category, event_date, starts_at, ends_at, timezone,
                      venue, venue_name, venue_address, status, visibility, capacity)
  values
    (e_a, v_org, 'BiletFlow Door Demo', 'Synthetic event for admission tests', 'Meetup',
     now() + interval '1 day', now() + interval '1 day', now() + interval '1 day 3 hours', 'Asia/Almaty',
     'NU Atrium', 'NU Atrium', 'Kabanbay Batyr Ave 53, Astana', 'published', 'public', 50),
    (e_b, v_org, 'Unassigned Event B', 'Staff is not assigned here', 'Meetup',
     now() + interval '2 days', now() + interval '2 days', now() + interval '2 days 2 hours', 'Asia/Almaty',
     'NU Library', 'NU Library', 'Kabanbay Batyr Ave 53, Astana', 'published', 'public', 50);

  insert into ticket_types (id, event_id, name, description, price, quantity, max_per_order, is_hidden)
  values (tt_a, e_a, 'Free entry', 'Synthetic free tier', 0, 50, 5, false),
         (tt_b, e_b, 'Free entry', 'Synthetic free tier', 0, 50, 5, false);

  insert into orders (id, user_id, event_id, ticket_type_id, quantity, total_amount, status)
  values (o_a, v_att, e_a, tt_a, 6, 0, 'completed'),
         (o_b, v_att, e_b, tt_b, 1, 0, 'completed');

  insert into tickets (id, order_id, ticket_type_id, user_id, event_id, status, attendee_name, attendee_email)
  values
    ('b1e70000-0000-4000-8000-000000000101', o_a, tt_a, v_att, e_a, 'valid',      'Arman Valid',     c_attendee_email),
    ('b1e70000-0000-4000-8000-000000000102', o_a, tt_a, v_att, e_a, 'valid',      'Dana Valid',      c_attendee_email),
    ('b1e70000-0000-4000-8000-000000000103', o_a, tt_a, v_att, e_a, 'valid',      'Aigerim Valid',   c_attendee_email),
    ('b1e70000-0000-4000-8000-000000000104', o_a, tt_a, v_att, e_a, 'checked_in', 'Nurlan Used',     c_attendee_email),
    ('b1e70000-0000-4000-8000-000000000105', o_a, tt_a, v_att, e_a, 'cancelled',  'Saule Cancelled', c_attendee_email),
    ('b1e70000-0000-4000-8000-000000000106', o_a, tt_a, v_att, e_a, 'refunded',   'Timur Refunded',  c_attendee_email),
    ('b1e70000-0000-4000-8000-000000000201', o_b, tt_b, v_att, e_b, 'valid',      'Other Event',     c_attendee_email);

  insert into event_staff (event_id, user_id, assigned_by) values (e_a, v_staff, v_org);

  raise notice 'Fixtures ready. Attendee user id for tools/make-test-qr.mjs: %', v_att;
end $$;
