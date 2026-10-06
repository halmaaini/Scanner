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

1. **Publish the app first**, and wait until the Replit agent reports that it
   started. The database tables are created when the app starts, so there is
   nothing to fill in before that.
2. **Open the Production database** (see [Where to run SQL](#where-to-run-sql)).
   The live site reads Production. Development is only the workspace's own
   copy: whatever you do there, the live site never sees.
3. **Create your super admin** with the first block under
   [Create an account](#create-an-account) (the database makes up the password
   and shows it to you once). Set the role to `'super'`.
4. **Create the events**, already open ([Events](#events)).
5. **Import your students** ([Import](#import)).
6. **Put them on the event lists** ([Event lists](#event-lists)); a student can
   only check in to an event they are on.
7. **Check that it worked.** This counts what is there, in the database you
   have open:

```sql
SELECT (SELECT count(*) FROM staff)         AS accounts,
       (SELECT count(*) FROM events)        AS events,
       (SELECT count(*) FROM students)      AS students,
       (SELECT count(*) FROM registrations) AS on_lists;
```

And this must come back with **no rows**: it finds accounts that still have
the demo passwords, which would be a well-known way into the live site.

<!-- demo-accounts -->

```sql
SELECT username FROM staff
WHERE password_hash = crypt('boss-demo-pw', password_hash)
   OR password_hash = crypt('sara-demo-pw', password_hash)
   OR password_hash = crypt('omar-demo-pw', password_hash);
```

8. Open the **published** address (the one you share, not the workspace
   preview), sign in as your super admin and try one scan. The scan is real
   attendance: press **Undo** on the result (or see
   [Correcting attendance](#correcting-attendance)). Then create the other
   admins ([Staff accounts](#staff-accounts)).

Never load `lib/db/sql/seed-demo.sql` into the published database: it holds
demo accounts with well-known passwords (it refuses to run if real data is
there, but do not rely on that).

## Where to run SQL

Replit keeps two databases, and what you run only reaches the one you run it in:

| You run it in                                                    | It changes                                                                               |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **Database** tool → **Production** → SQL runner                  | The live site's data. Setup and day-to-day changes go here.                              |
| **Database** tool → **Development** → SQL runner                 | The workspace's own copy, which the workspace preview shows. Good for trying things out. |
| A workspace **terminal** (`psql`, `pnpm ... run sql`, `pg_dump`) | **Development only**: there, `DATABASE_URL` is the Development database.                 |

If the runner only accepts one statement at a time, paste the statements one
by one; a `BEGIN` ... `COMMIT` block (see below) then does not protect you, so
copy the tables first (rule 4). The account blocks are written as single
statements so they run anywhere.

To run a whole file from a terminal without psql (Development or a local
database): `pnpm --filter @workspace/scripts run sql my-changes.sql`. It prints
the rows of any `SELECT` and runs the file as a single transaction (if one
statement fails, none of it happens).

Changes show up on scanners shortly: they re-read the list regularly, and
whenever the app is opened or brought back to the front. Nothing needs a
restart.

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
3. **Look before you change.** Run a `SELECT` with the same `WHERE` first: it
   shows exactly the rows the change would touch. Where the runner keeps one
   connection for the whole script, you can also try a risky change inside a
   transaction and look before you commit:

   ```text
   BEGIN;
   -- your statements
   SELECT ...;   -- check the result
   COMMIT;       -- or ROLLBACK; to undo it all
   ```

4. **Copy the tables before bulk changes.** This puts a copy of the student
   lists next to them, in the same database, so it works in any SQL runner
   (Production included):

   ```sql
   CREATE TABLE backup_students      AS SELECT * FROM students;
   CREATE TABLE backup_registrations AS SELECT * FROM registrations;
   ```

   If a change deletes rows it should not have, this brings them back (rows
   still there are left alone):

   ```sql
   INSERT INTO students      SELECT * FROM backup_students      ON CONFLICT DO NOTHING;
   INSERT INTO registrations SELECT * FROM backup_registrations ON CONFLICT DO NOTHING;
   ```

   When you are happy with the result, remove the copies (they hold names):

   ```sql
   DROP TABLE backup_students, backup_registrations;
   ```

   A copy in the same database does not protect against losing the database
   itself. For a **Development or local** database you can also dump it to a
   file, kept **outside the project folder** (it holds names, password hashes
   and open sessions, and anything in the project can end up committed):
   `pg_dump "$DATABASE_URL" > ~/backup-$(date +%F).sql`. That command reaches
   Development only, so it says nothing about the live site.

## Events

An event has a short lowercase `id` (letters, digits, `-`, `_`; at most 64
characters), a name, a position in menus and reports (`sort_order`), and an
open/closed switch. Scanners only offer **open** events.

For a first setup, create the events you need, already open. It is safe to run
again:

```sql
INSERT INTO events (id, name, sort_order, is_open) VALUES
  ('rehearsal',  'Rehearsal',           1, true),
  ('graduation', 'Graduation ceremony', 2, true),
  ('trophy',     'Trophy handover',     3, true)
ON CONFLICT (id) DO NOTHING;
```

Create one more later (closed until you open it):

```sql
INSERT INTO events (id, name, sort_order, is_open)
VALUES ('dinner', 'Farewell dinner', 4, false)
ON CONFLICT (id) DO NOTHING;
```

Open an event when doors open (if the runner says 0 rows changed, there is no
event with that id):

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

Show the seating plan on student cards for an event (the rehearsal and the
ceremony use the same seats, so switch it on for both). The super admin can
also tick it on the Events page:

```sql
UPDATE events SET has_seating = true WHERE id IN ('rehearsal', 'graduation');
```

Delete an event you created by mistake. **This also deletes its list and
every check-in for it:**

```sql
DELETE FROM events WHERE id = 'workshop';
```

## Students

### Import

Add students (re-running it updates names and majors, so it is safe to repeat).
Leave the major `NULL` when the roster does not supply one. This works in any
SQL runner, Production included:

```sql
INSERT INTO students (student_id, full_name, major) VALUES
  ('1011', 'Hanan Said', 'Engineering'),
  ('1012', 'خالد المصري', NULL),
  ('1013', 'Tariq Anwar', 'Business')
ON CONFLICT (student_id) DO UPDATE
  SET full_name = EXCLUDED.full_name, major = EXCLUDED.major;
```

**From a spreadsheet**, with the ID in column A, the name in column B and the
major in column C, put this formula in a fourth column and copy it down (it
doubles any `'`; use `NULL` instead of `''` for a missing major):

`="('"&A2&"', '"&SUBSTITUTE(B2,"'","''")&"', '"&SUBSTITUTE(C2,"'","''")&"'),"`

Paste the resulting lines in place of the three example lines above, then
**delete the comma at the end of the very last line**. That line ends with the
closing `)`, with no comma and no `;`, and the `ON CONFLICT` lines stay under
it. It is one statement, so it either imports everyone or no one.

If the statement stops with `students_student_id_check`, the message shows the
row that broke the rule (`Failing row contains (...)`): fix that ID (see rule 1)
and run the statement again. If it says "cannot affect row a second time", an
ID appears twice in your list.

If you have a terminal and a **Development or local** database (in a Replit
workspace terminal `psql` reaches Development only, so this does not load the
live site), save the spreadsheet as CSV (UTF-8) with the columns `student_id`,
`full_name` and `major`, keep the file in your home folder, and use psql's
`\copy` (an empty major imports as `NULL`):

```bash
psql "$DATABASE_URL" -c "\copy students (student_id, full_name, major) FROM '$HOME/students.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')"
```

A new student is on **no** event list yet; see [Event lists](#event-lists).

### Seats

Each student has one fixed seat, a row letter and a number (`F` and `7` is
seat F7; row A is next to the stage). It is the same for every event that
shows the seating plan. The hall's rows and seat numbers are in
`lib/attendance/src/hall.ts`; a seat that is not on the plan shows up in the
Seats view as a warning, so a typo is easy to spot. Nobody can share a seat.

Give or change one student's seat (the database refuses a taken seat):

```sql
UPDATE students SET seat_row = 'Q', seat_number = 1 WHERE student_id = '1011';
```

Give many at once, from a spreadsheet or a list. Only the students named change:

```sql
UPDATE students s
SET seat_row = d.seat_row, seat_number = d.seat_number
FROM (VALUES
  ('1012', 'Q', 2),
  ('1013', 'Q', 3)
) AS d (student_id, seat_row, seat_number)
WHERE s.student_id = d.student_id;
```

Swap the seats of two students (change the two IDs). It is done in one step,
because a seat can only have one person at any moment:

```sql
DO $swap$
DECLARE
  a students%ROWTYPE;
  b students%ROWTYPE;
BEGIN
  SELECT * INTO a FROM students WHERE student_id = '1001';
  SELECT * INTO b FROM students WHERE student_id = '1002';
  IF a.student_id IS NULL OR b.student_id IS NULL THEN
    RAISE EXCEPTION 'Both students must exist';
  END IF;
  UPDATE students SET seat_row = NULL, seat_number = NULL
  WHERE student_id IN (a.student_id, b.student_id);
  UPDATE students SET seat_row = b.seat_row, seat_number = b.seat_number
  WHERE student_id = a.student_id;
  UPDATE students SET seat_row = a.seat_row, seat_number = a.seat_number
  WHERE student_id = b.student_id;
END $swap$;
```

Take a seat away from a student:

```sql
UPDATE students SET seat_row = NULL, seat_number = NULL WHERE student_id = '1011';
```

Who still has no seat (active students on an event with a seating plan):

<!-- students-without-seat -->

```sql
SELECT s.student_id, s.full_name
FROM students s
WHERE s.seat_row IS NULL AND s.is_active
  AND EXISTS (
    SELECT 1 FROM registrations r JOIN events e ON e.id = r.event_id
    WHERE r.student_id = s.student_id AND e.has_seating
  )
ORDER BY s.student_id;
```

The seat list, front row first:

```sql
SELECT seat_row, seat_number, student_id, full_name
FROM students
WHERE seat_row IS NOT NULL
ORDER BY seat_row, seat_number;
```

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

Put every active student on **every** event (a first setup where everyone
attends everything; take the few who should not be there off afterwards, see
the end of this section). It does nothing until events and students exist:

```sql
INSERT INTO registrations (student_id, event_id)
SELECT s.student_id, e.id
FROM students s
CROSS JOIN events e
WHERE s.is_active
ON CONFLICT DO NOTHING;
```

Put every active student on one event:

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

After importing new students later, put the new ones on the events everyone
attends (change the two ids to yours). Only active students who are on **no**
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
(`crypt`, always with `gen_salt('bf', 10)` as below); the app checks them but
only ever stores the hash.

### Create an account

Set the username, the name shown on screen and the role (`'admin'` scans and
can undo their own check-ins; `'super'` also opens the report and can undo anyone's check-in). The database
makes up the password and shows it to you **once**, in the result: read it from
there and pass it on. It cannot be shown again; reset the password to get a new
one. It is a single statement, so it works in any SQL runner, and if the
username is taken it stops with an error and creates nothing.

<!-- create-account -->

```sql
WITH new AS (SELECT encode(gen_random_bytes(8), 'hex') AS password),
     created AS (
       INSERT INTO staff (username, password_hash, display_name, role)
       SELECT 'dina', crypt(new.password, gen_salt('bf', 10)), 'Dina', 'admin'
       FROM new
       RETURNING username
     )
SELECT created.username, new.password
FROM created, new;
```

**To choose the password yourself instead,** use this block. It refuses to run
until the example password is replaced. The password is typed into the
statement, so the SQL runner may keep it in its history: use one you use
nowhere else. If it contains a `'`, write it twice (`''`).

<!-- placeholder-password -->

```sql
DO $acct$
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
END $acct$;
```

### Change an account

Reset a password: the database makes up a new one and shows it once, as above.
If the result has **no rows**, there is no account with that username and
nothing was changed:

<!-- reset-password -->

```sql
WITH new AS (SELECT encode(gen_random_bytes(8), 'hex') AS password),
     changed AS (
       UPDATE staff
       SET password_hash = crypt(new.password, gen_salt('bf', 10))
       FROM new
       WHERE lower(staff.username) = lower('dina')
       RETURNING staff.username
     )
SELECT changed.username, new.password
FROM changed, new;
```

To choose the new password yourself (it refuses to run until the password is
changed, as above, and reports an unknown username):

<!-- placeholder-password -->

```sql
DO $acct$
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
  IF NOT FOUND THEN
    RAISE EXCEPTION 'There is no account called %.', the_username;
  END IF;
END $acct$;
```

Change a display name or role (takes effect on their next request):

```sql
UPDATE staff SET display_name = 'Nadia K.', role = 'super'
WHERE lower(username) = lower('nadia');
```

Deactivate someone (signs them out at once, keeps their history):

```sql
UPDATE staff SET is_active = false WHERE lower(username) = lower('nadia');
```

Reactivate them:

```sql
UPDATE staff SET is_active = true WHERE lower(username) = lower('nadia');
```

Changing a password does not end sessions that are already open. To sign one
person out everywhere:

```sql
DELETE FROM sessions
WHERE (sess::jsonb ->> 'staffId')::int = (SELECT id FROM staff WHERE lower(username) = lower('nadia'));
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
