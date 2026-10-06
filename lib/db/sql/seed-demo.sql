-- DEMO DATA, for trying the app on a development database.
--
-- NEVER load this into the real (published) database: it creates accounts with
-- well-known passwords. It refuses to run if the database holds any account or
-- student that is not demo data, and is safe to run more than once (it skips
-- what already exists).
--
--   pnpm --filter @workspace/scripts run sql lib/db/sql/seed-demo.sql
--
-- Sign in as   boss / boss-demo-pw   (super admin)
--              sara / sara-demo-pw   (admin)
--              omar / omar-demo-pw   (admin)

BEGIN;

-- The demo people are listed once, here; the safety check and the inserts both use these lists.
CREATE TEMP TABLE demo_staff (username text, password text, display_name text, role text) ON COMMIT DROP;
INSERT INTO demo_staff VALUES
  ('boss', 'boss-demo-pw', 'Hala', 'super'),
  ('sara', 'sara-demo-pw', 'Sara', 'admin'),
  ('omar', 'omar-demo-pw', 'Omar', 'admin');

CREATE TEMP TABLE demo_students (student_id text, full_name text, is_active boolean) ON COMMIT DROP;
INSERT INTO demo_students VALUES
  ('1001', 'Layla Hassan',        true),
  ('1002', 'Yusuf Ibrahim',       true),
  ('1003', 'Karim Nasser',        false),  -- access revoked
  ('1004', 'Nour Saleh',          true),
  ('1005', 'أحمد الفاطمي',        true),
  ('1006', 'Mariam Khalil',       true),
  ('1007', 'Omar Haddad',         true),
  ('1008', 'فاطمة الزهراء',       true),
  ('1009', 'Sami Aziz',           true),
  ('1010', 'Dina Farouk',         true);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM staff WHERE lower(username) NOT IN (SELECT lower(username) FROM demo_staff))
     OR EXISTS (SELECT 1 FROM students WHERE student_id NOT IN (SELECT student_id FROM demo_students)) THEN
    RAISE EXCEPTION 'Refusing to load demo data: this database has accounts or students that are not demo data. Demo data is only for an empty development database.';
  END IF;
END $$;

INSERT INTO staff (username, password_hash, display_name, role)
SELECT username, crypt(password, gen_salt('bf', 10)), display_name, role FROM demo_staff
ON CONFLICT ((lower(username))) DO NOTHING;

INSERT INTO events (id, name, sort_order, is_open) VALUES
  ('rehearsal',  'Rehearsal',           1, true),
  ('graduation', 'Graduation ceremony', 2, true),
  ('trophy',     'Trophy handover',     3, false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO students (student_id, full_name, is_active)
SELECT student_id, full_name, is_active FROM demo_students
ON CONFLICT (student_id) DO NOTHING;

-- The rehearsal and the ceremony show the seating plan; every student has one fixed seat
-- (the last two are left without one on purpose, so the "no seat yet" notice has something to show).
UPDATE events SET has_seating = true WHERE id IN ('rehearsal', 'graduation');
UPDATE students s
SET seat_row = d.seat_row, seat_number = d.seat_number
FROM (VALUES
  ('1001', 'F', 7), ('1002', 'B', 4), ('1003', 'K', 3), ('1004', 'A', 1), ('1005', 'A', 12),
  ('1006', 'C', 9), ('1007', 'E', 8), ('1008', 'R', 2)
) AS d (student_id, seat_row, seat_number)
WHERE s.student_id = d.student_id AND s.seat_row IS NULL;

-- Everyone is on the rehearsal and graduation lists; only three get a trophy.
INSERT INTO registrations (student_id, event_id)
SELECT s.student_id, e.id
FROM students s
CROSS JOIN events e
WHERE e.id IN ('rehearsal', 'graduation')
   OR (e.id = 'trophy' AND s.student_id IN ('1001', '1002', '1005'))
ON CONFLICT (student_id, event_id) DO NOTHING;

-- Some people already checked in to the rehearsal.
UPDATE registrations
SET checked_in_at = now() - interval '2 days',
    checked_in_by = (SELECT id FROM staff WHERE lower(username) = 'sara')
WHERE event_id = 'rehearsal'
  AND student_id IN ('1001', '1002', '1004', '1005', '1006')
  AND checked_in_at IS NULL;

COMMIT;
