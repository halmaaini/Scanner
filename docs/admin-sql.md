# Admin SQL cookbook

The app scans and reports. Everything else (adding people, revoking, renewing,
opening events, creating admins) is done with SQL, on purpose: it keeps the app
small, and Postgres already does these jobs well.

Every `sql` block below is run by a test against the demo data
(`lib/db/sql/seed-demo.sql`), so these statements are known to work with the
current schema. The example names and IDs (`1001`, `nadia`, `graduation`) are
made up; swap in your own.

**Run one block at a time, and read the sentence above it.** Where a section
gives you several ways to do something, run only the one you need.

## First-time setup (once)

The published site starts with **no accounts and no data**, so nobody can sign
in until you have done this. Do it in order:

1. **Publish the app first.** The database tables are created when the app
   starts, so there is nothing to fill in before that.
2. **Open the Production database** (see [Where to run SQL](#where-to-run-sql)).
   The live site reads Production; the Development database is only the
   workspace's own copy.
3. **Create your super admin** with the block under
   [Create an account](#create-an-account): type your own password where it
   says so, and set `the_role` to `'super'`.
4. **Create the events** ([Events](#events)) and **open** the ones people will
   scan for.
5. **Import your students** ([Import](#import)).
6. **Put them on the event lists** ([Event lists](#event-lists)); a student can
   only check in to an event they are on.
7. **Check that it worked** with this, which counts what is there:

```sql
SELECT (SELECT count(*) FROM staff)         AS accounts,
       (SELECT count(*) FROM events)        AS events,
       (SELECT count(*) FROM students)      AS students,
       (SELECT count(*) FROM registrations) AS on_lists;
```

8. Open the site, sign in as your super admin, and try one scan. Then create
   the other admins ([Staff accounts](#staff-accounts)).

Never load `lib/db/sql/seed-demo.sql` into the published database: it holds
demo accounts with well-known passwords (it refuses to run if real data is
there, but do not rely on that).

## Where to run SQL

- **On Replit:** open the **Database** tool, choose the database (the live site
  uses **Production**; the workspace uses **Development**), and use its **SQL
  runner**. If the runner only accepts one statement at a time, paste the
  statements one by one; a `BEGIN` ... `COMMIT` block (see below) then does not
  protect you, so take a backup first.
- **From a terminal:** `psql "$DATABASE_URL"`, or run a whole file without psql:
  `pnpm --filter @workspace/scripts run sql my-changes.sql`. It prints the
  rows of any `SELECT` and runs the file as a single transaction (if one
  statement fails, none of it happens). In a Replit workspace terminal
  `DATABASE_URL` is the **Development** database, not the live one.

Changes show up on scanners within about half a minute, or as soon as a scanner
is opened or brought back to the front. Nothing needs a restart.

## Ground rules

1. **A student ID is matched exactly.** No spaces, and use plain digits `0-9`
   (the app converts Arabic digits people type, but stored IDs must be plain).
   The database refuses an ID with a space, an Arabic digit, a hidden
   character, or more than 64 characters: an import that stops with
   `students_student_id_check` has one of those in it. Spreadsheets drop
   leading zeros and turn long numbers into `1E+15`: format the ID column as
   **Text** before you save the CSV.
2. **Deactivate, don't delete.** Revoke a student (`is_active = false`) and
   deactivate staff instead of deleting them: deleting a student erases their
   attendance, and staff who checked people in cannot be deleted at all.
3. **Try risky changes inside a transaction** and look before you commit
   (only where the runner keeps one connection for the whole script):

   ```text
   BEGIN;
   -- your statements
   SELECT ...;   -- check the result
   COMMIT;       -- or ROLLBACK; to undo it all
   ```

4. **Take a backup before bulk changes**, and keep it **outside the project
   folder**: it holds names, password hashes and open sessions, and anything in
   the project can end up committed.
   `pg_dump "$DATABASE_URL" > ~/backup-$(date +%F).sql`
   (The same goes for the student CSV below: keep it in your home folder.)

## Events

An event has a short lowercase `id` (letters, digits, `-`, `_`), a name, a
position in menus and reports (`sort_order`), and an open/closed switch.
Scanners only offer **open** events.

Create an event (closed until you open it). It is safe to run again:

```sql
INSERT INTO events (id, name, sort_order, is_open)
VALUES ('dinner', 'Farewell dinner', 4, false)
ON CONFLICT (id) DO NOTHING;
```

Open an event when doors open:

```sql
UPDATE events SET is_open = true WHERE id = 'trophy';
```

Close it afterwards:

```sql
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
`full_name`, keep the file in your home folder, then use psql's `\copy`:

```bash
psql "$DATABASE_URL" -c "\copy students (student_id, full_name) FROM '$HOME/students.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')"
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

After importing new students, put the new ones on every event that everyone
attends, here rehearsal and graduation. Only active students who are on **no**
list yet are added, so anyone you took off an event on purpose stays off:

```sql
INSERT INTO registrations (student_id, event_id)
SELECT s.student_id, e.id
FROM students s
CROSS JOIN events e
WHERE e.id IN ('rehearsal', 'graduation')
  AND s.is_active
  AND NOT EXISTS (SELECT 1 FROM registrations r WHERE r.student_id = s.student_id)
ON CONFLICT DO NOTHING;
```

Take a student off an event. **This also erases their check-in for that
event.**

```sql
DELETE FROM registrations WHERE student_id = '1001' AND event_id = 'dinner';
```

## Staff accounts

Usernames are not case-sensitive. Passwords are hashed by Postgres itself
(`crypt`, always with `gen_salt('bf', 10)` as below), so type the password in
the statement and it is never stored as written. Type it between the quote
marks; if it contains a `'`, write it twice (`''`).

### Create an account

Set the username, the name shown on screen, the role (`'admin'` scans and can
undo their own check-ins; `'super'` also opens the report and can undo anyone's)
and **your own password**. The block refuses to run until the password is changed:

<!-- placeholder-password -->

```sql
DO $$
DECLARE
  the_username text := 'nadia';
  the_name     text := 'Nadia';
  the_role     text := 'admin';
  the_password text := 'type-your-own-password';  -- REPLACE this with a password of your own
BEGIN
  IF the_password = 'type-your-own-password' THEN
    RAISE EXCEPTION 'Type a password of your own in place of type-your-own-password first.';
  END IF;
  INSERT INTO staff (username, password_hash, display_name, role)
  VALUES (the_username, crypt(the_password, gen_salt('bf', 10)), the_name, the_role);
END $$;
```

### Change an account

Reset a password (it refuses to run until the password is changed, as above):

<!-- placeholder-password -->

```sql
DO $$
DECLARE
  the_username text := 'nadia';
  the_password text := 'type-your-own-password';  -- REPLACE this with the new password
BEGIN
  IF the_password = 'type-your-own-password' THEN
    RAISE EXCEPTION 'Type a password of your own in place of type-your-own-password first.';
  END IF;
  UPDATE staff
  SET password_hash = crypt(the_password, gen_salt('bf', 10))
  WHERE lower(username) = lower(the_username);
END $$;
```

Change a display name or role (takes effect on their next request):

```sql
UPDATE staff SET display_name = 'Nadia K.', role = 'super'
WHERE lower(username) = 'nadia';
```

Deactivate someone (signs them out at once, keeps their history):

```sql
UPDATE staff SET is_active = false WHERE lower(username) = 'nadia';
```

Reactivate them:

```sql
UPDATE staff SET is_active = true WHERE lower(username) = 'nadia';
```

Changing a password does not end sessions that are already open. To sign one
person out everywhere:

```sql
DELETE FROM sessions
WHERE (sess::jsonb ->> 'staffId')::int = (SELECT id FROM staff WHERE lower(username) = 'nadia');
```

To sign **everyone** out (each person just signs in again):

```sql
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
