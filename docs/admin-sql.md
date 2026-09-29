# Admin SQL cookbook

The app scans and reports. Everything else (adding people, revoking, renewing,
opening events, creating admins) is done with SQL, on purpose: it keeps the app
small, and Postgres already does these jobs well.

Every `sql` block below is run by a test against the demo data
(`lib/db/sql/seed-demo.sql`), so these statements are known to work with the
current schema. The example names and IDs (`1001`, `sara`, `graduation`) are the
demo ones; swap in your own.

## Running SQL

- **On Replit:** open the **Database** tool and use its SQL runner. If it only
  accepts one statement at a time, paste them one by one.
- **From a terminal:** `psql "$DATABASE_URL"`, or run a whole file without psql:
  `pnpm --filter @workspace/scripts run sql my-changes.sql`

Changes show up on scanners within 30 seconds, or as soon as a scanner is
opened or brought back to the front. Nothing needs a restart.

## Ground rules

1. **A student ID is matched exactly.** No spaces, and use plain digits `0-9`
   (the app converts Arabic digits people type, but stored IDs must be plain).
   The database refuses IDs with spaces.
2. **Deactivate, don't delete.** Revoke a student (`is_active = false`) and
   deactivate staff instead of deleting them: deleting a student erases their
   attendance, and staff who checked people in cannot be deleted at all.
3. **Try risky changes inside a transaction** and look before you commit:

   ```text
   BEGIN;
   -- your statements
   SELECT ...;   -- check the result
   COMMIT;       -- or ROLLBACK; to undo it all
   ```

4. **Take a backup before bulk changes:**
   `pg_dump "$DATABASE_URL" > backup-$(date +%F).sql`

## Events

An event has a short lowercase `id` (letters, digits, `-`, `_`), a name, a
position in menus and reports (`sort_order`), and an open/closed switch.
Scanners only offer **open** events.

Create an event (closed until you open it):

```sql
INSERT INTO events (id, name, sort_order, is_open)
VALUES ('dinner', 'Farewell dinner', 4, false);
```

Open an event when doors open, close it afterwards:

```sql
UPDATE events SET is_open = true  WHERE id = 'trophy';
UPDATE events SET is_open = false WHERE id = 'rehearsal';
```

Closing hides the event from scanners; it does not delete anything, and scans
made offline before it closed are still accepted when they sync.

Rename or reorder:

```sql
UPDATE events SET name = 'Graduation ceremony 2026', sort_order = 5
WHERE id = 'graduation';
```

Delete an event you created by mistake. **This also deletes its list and
every check-in for it:**

```sql
DELETE FROM events WHERE id = 'workshop';
```

## Students

### Import

Add students (re-running it updates names, so it is safe to repeat):

```sql
INSERT INTO students (student_id, full_name) VALUES
  ('1011', 'Hanan Said'),
  ('1012', 'خالد المصري'),
  ('1013', 'Tariq Anwar')
ON CONFLICT (student_id) DO UPDATE SET full_name = EXCLUDED.full_name;
```

From a spreadsheet, save it as CSV (UTF-8) with the columns `student_id` and
`full_name`, then use psql's `\copy`:

```bash
psql "$DATABASE_URL" -c "\copy students (student_id, full_name) FROM 'students.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')"
```

No psql? Build the `VALUES` lines in the spreadsheet with a formula such as
`="('"&A2&"', '"&SUBSTITUTE(B2,"'","''")&"'),"` and paste them into the block
above (the last line ends with `;` instead of `,`).

A new student is on **no** event list yet; see [Event lists](#event-lists).

### Fix, revoke, renew, remove

Correct a wrong ID (their event lists and check-ins follow automatically):

```sql
UPDATE students SET student_id = '1099' WHERE student_id = '1013';
```

Correct a name:

```sql
UPDATE students SET full_name = 'Hanan Al Said' WHERE student_id = '1011';
```

Revoke access. Scanners show a red "Not allowed", their card shows a notice
instead of a QR code, and they drop out of the counts:

```sql
UPDATE students SET is_active = false WHERE student_id = '1012';
```

Renew (give access back):

```sql
UPDATE students SET is_active = true WHERE student_id = '1012';
```

Remove a student for good, with their attendance history:

```sql
DELETE FROM students WHERE student_id = '1099';
```

## Event lists

A student can only check in to events they are **registered** for. The same
row is the attendance record, so "expected" and "attended" always agree.

Put every active student on an event:

```sql
INSERT INTO registrations (student_id, event_id)
SELECT student_id, 'dinner' FROM students WHERE is_active
ON CONFLICT DO NOTHING;
```

Put chosen students on an event (for example the trophy winners):

```sql
INSERT INTO registrations (student_id, event_id) VALUES
  ('1001', 'trophy'),
  ('1002', 'trophy')
ON CONFLICT DO NOTHING;
```

Register students who attended one event for another:

```sql
INSERT INTO registrations (student_id, event_id)
SELECT student_id, 'trophy'
FROM registrations
WHERE event_id = 'rehearsal' AND checked_in_at IS NOT NULL
ON CONFLICT DO NOTHING;
```

After importing new students, put them on every event that already has a
list-everyone rule, here rehearsal and graduation:

```sql
INSERT INTO registrations (student_id, event_id)
SELECT s.student_id, e.id
FROM students s
CROSS JOIN events e
WHERE e.id IN ('rehearsal', 'graduation')
ON CONFLICT DO NOTHING;
```

Take a student off an event:

```sql
DELETE FROM registrations WHERE student_id = '1001' AND event_id = 'dinner';
```

## Staff accounts

Usernames are not case-sensitive. Passwords are hashed by Postgres itself
(`crypt`), so type the password in the statement and it is never stored as
written. Always use `gen_salt('bf', 10)` as below.

Create an admin (scans and can undo their own check-ins):

```sql
INSERT INTO staff (username, password_hash, display_name, role)
VALUES ('nadia', crypt('a-strong-password', gen_salt('bf', 10)), 'Nadia', 'admin');
```

Create a super admin (also opens the report and can undo anyone's check-in):

```sql
INSERT INTO staff (username, password_hash, display_name, role)
VALUES ('lina', crypt('another-strong-password', gen_salt('bf', 10)), 'Lina', 'super');
```

Reset a password:

```sql
UPDATE staff
SET password_hash = crypt('a-new-password', gen_salt('bf', 10))
WHERE lower(username) = 'nadia';
```

Change a display name or role (takes effect on their next request):

```sql
UPDATE staff SET display_name = 'Nadia K.', role = 'super'
WHERE lower(username) = 'nadia';
```

Deactivate (signs them out at once, keeps their history) and reactivate:

```sql
UPDATE staff SET is_active = false WHERE lower(username) = 'nadia';
UPDATE staff SET is_active = true  WHERE lower(username) = 'nadia';
```

Changing a password does not end sessions that are already open. To sign one
person out everywhere, or everyone:

```sql
DELETE FROM sessions
WHERE (sess::jsonb ->> 'staffId')::int = (SELECT id FROM staff WHERE lower(username) = 'nadia');

DELETE FROM sessions;
```

List accounts (never select `password_hash`):

```sql
SELECT id, username, display_name, role, is_active FROM staff ORDER BY id;
```

## Correcting attendance

Check someone in by hand, as the super admin:

```sql
UPDATE registrations
SET checked_in_at = now(),
    checked_in_by = (SELECT id FROM staff WHERE lower(username) = 'boss')
WHERE student_id = '1007' AND event_id = 'rehearsal' AND checked_in_at IS NULL;
```

Undo one check-in (both columns go back to empty together; the database
insists on that):

```sql
UPDATE registrations
SET checked_in_at = NULL, checked_in_by = NULL
WHERE student_id = '1007' AND event_id = 'rehearsal';
```

Start an event over (clears every check-in for it):

```sql
UPDATE registrations
SET checked_in_at = NULL, checked_in_by = NULL
WHERE event_id = 'graduation';
```

## Reports

Attendance per event, counted the way the app counts it (revoked students are
not expected and not counted):

<!-- attendance-report -->

```sql
SELECT e.name AS event,
       count(*) FILTER (WHERE r.checked_in_at IS NOT NULL) AS checked_in,
       count(*) AS expected
FROM events e
JOIN registrations r ON r.event_id = e.id
JOIN students s ON s.student_id = r.student_id AND s.is_active
GROUP BY e.id, e.name, e.sort_order
ORDER BY e.sort_order, e.id;
```

Who has checked in to an event, and who checked them in:

```sql
SELECT s.student_id, s.full_name, r.checked_in_at, st.display_name AS checked_in_by
FROM registrations r
JOIN students s ON s.student_id = r.student_id
JOIN staff st ON st.id = r.checked_in_by
WHERE r.event_id = 'rehearsal'
ORDER BY r.checked_in_at DESC;
```

Who is still missing from an event:

```sql
SELECT s.student_id, s.full_name
FROM registrations r
JOIN students s ON s.student_id = r.student_id
WHERE r.event_id = 'graduation' AND r.checked_in_at IS NULL AND s.is_active
ORDER BY s.student_id;
```

Students who attended every event they are registered for:

```sql
SELECT s.student_id, s.full_name
FROM students s
JOIN registrations r ON r.student_id = s.student_id
GROUP BY s.student_id, s.full_name
HAVING count(*) = count(r.checked_in_at)
ORDER BY s.student_id;
```

How many scans each staff member made:

```sql
SELECT st.display_name, count(*) AS check_ins
FROM registrations r
JOIN staff st ON st.id = r.checked_in_by
GROUP BY st.display_name
ORDER BY check_ins DESC;
```

Check-ins per hour for an event:

```sql
SELECT date_trunc('hour', checked_in_at) AS hour, count(*) AS check_ins
FROM registrations
WHERE event_id = 'rehearsal' AND checked_in_at IS NOT NULL
GROUP BY 1
ORDER BY 1;
```

Students who are on no event list yet:

```sql
SELECT s.student_id, s.full_name
FROM students s
LEFT JOIN registrations r ON r.student_id = s.student_id
WHERE r.student_id IS NULL
ORDER BY s.student_id;
```
