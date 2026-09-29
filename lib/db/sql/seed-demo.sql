-- DEMO DATA, for trying the app on a development database.
--
-- NEVER run this on the real database: it creates accounts with well-known
-- passwords. Safe to run more than once (it skips what already exists).
--
--   pnpm --filter @workspace/scripts run sql lib/db/sql/seed-demo.sql
--
-- Sign in as   boss / boss-demo-pw   (super admin)
--              sara / sara-demo-pw   (admin)
--              omar / omar-demo-pw   (admin)

BEGIN;

INSERT INTO staff (username, password_hash, display_name, role) VALUES
  ('boss', crypt('boss-demo-pw', gen_salt('bf', 10)), 'Hala', 'super'),
  ('sara', crypt('sara-demo-pw', gen_salt('bf', 10)), 'Sara', 'admin'),
  ('omar', crypt('omar-demo-pw', gen_salt('bf', 10)), 'Omar', 'admin')
ON CONFLICT ((lower(username))) DO NOTHING;

INSERT INTO events (id, name, sort_order, is_open) VALUES
  ('rehearsal',  'Rehearsal',           1, true),
  ('graduation', 'Graduation ceremony', 2, true),
  ('trophy',     'Trophy handover',     3, false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO students (student_id, full_name, is_active) VALUES
  ('1001', 'Layla Hassan',        true),
  ('1002', 'Yusuf Ibrahim',       true),
  ('1003', 'Karim Nasser',        false),  -- access revoked
  ('1004', 'Nour Saleh',          true),
  ('1005', 'أحمد الفاطمي',        true),
  ('1006', 'Mariam Khalil',       true),
  ('1007', 'Omar Haddad',         true),
  ('1008', 'فاطمة الزهراء',       true),
  ('1009', 'Sami Aziz',           true),
  ('1010', 'Dina Farouk',         true)
ON CONFLICT (student_id) DO NOTHING;

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
