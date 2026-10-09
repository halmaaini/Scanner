# The procession

How the graduates walk in and take their seats. This is the agreed description
of the real procession; the card's animation, the student instructions and any
later graphics are built from it. Change it here first, then in the code.

Where each rule lives in code:

| Rule                                     | Code                                                          |
| ---------------------------------------- | ------------------------------------------------------------- |
| The hall: rows, seats, sides, pool       | `lib/attendance/src/hall.ts`                                  |
| Marching order, neighbours               | `lib/attendance/src/hall.ts` (`marchOrder`, `neighbourSeats`) |
| Routes, timing, place in the line        | `artifacts/web/src/features/seating/procession.ts`            |
| Durations (20 s, 3 s close-up, 2 s toss) | `artifacts/web/src/config.ts` (`PROCESSION`)                  |

## How it works today

1. Two lines, **Stage Left** and **Stage Right**. Each graduate is in the line
   of the side their seat is on (seats 1–9 left, 10–18 right in a full row).
2. Both lines start together, from behind the stage.
3. Route: up the outer edge of the student floor on their side, across the
   top, down the middle aisle (around the pool), then along their row.
4. Order: front row first (A, then B, …). In each row the first one in walks
   to the far end, so nobody passes anyone already seated.
5. Only active students with a seat walk; an empty seat is skipped and the
   line closes up.
6. "Your place in the line" is the student's position in their line by this
   order.

## Agreed changes, not built yet

These are logged for later. The animation stays as it is until they are built.

### 1. Stage Left splits into two lines behind the stage

There is not enough room behind the stage for one long Stage Left line, so it
forms as two lines:

- **Line 1**: from seat **A1** up to seat **G4**.
- **Line 2**: from seat **H1** to the last person on Stage Left.

On today's plan Line 1 covers rows A–G of Stage Left (45 seats) and Line 2
rows H–R (81 seats).

Answers (owner):

- Line 2 walks in **after** Line 1, one after the other (one continuous walk,
  same route).
- The split is fixed by seat (A1–G4, then H1 onwards). For now this holds even
  if seats are reassigned; revisit if the seating changes.

### 2. Stage Right also forms as two lines

Stage Right forms as two lines too. The owner will explain how they are split
(there is a particular arrangement); details to follow.

The problem it solves: graduates enter each row from the middle aisle. On
Stage Left the aisle end is the highest number (seat 9), so the far end is
seat 1 and a line in seat order (1, 2, 3, …) fills the row without anyone
passing anyone. On Stage Right the aisle end is the lowest number (seat 10)
and the far end is seat 18, so a line in seat order would put seat 10 in front:
they would sit first, at the aisle, and block the rest of the row. Today's
animation assumes the Stage Right line stands in reverse order (A18 first);
the real arrangement replaces that.

**The trick (owner):** behind the stage, Stage Right is flipped row by row:
each row starts with its **highest** seat number. The line goes row A first,
then B, and so on, and within each row from the far end towards the aisle:
A18, A17, …, A10, then B18, …, B10, and so on. In the narrow rows (D–K) the same
holds: highest number first (F9, F8, F7, F6, F5). This is the order the
animation already uses, so it matches; "Your place in the line" counts this
order too.

Split (owner: the same as Stage Left, rows A–G then H onwards):

- **Line 1**: rows A–G, flipped: from **A18** to **G5** (46 seats on today's
  plan).
- **Line 2**: rows H–R, flipped: from **H8** to the last person on Stage Right
  (**R10** on a full hall; 80 seats on today's plan).
- As on Stage Left, Line 2 follows straight after Line 1, and the split is by
  seat.

### 3. Certificate handover (after everyone is seated)

Names are called in seat order, row by row, **across the whole row**: A1, A2,
…, A18, then B1, …, B18, and so on to the back. For each graduate:

1. **Leave the seat** and go backstage, always from the **left** side this time
   (both Stage Left and Stage Right graduates).
2. **Called one by one**: walk across the stage from left to right as the name
   is called, and receive the certificate.
3. **Leave the stage** by the backstage **right** side.
4. **Come back** round the right-hand side of the hall and re-enter the seating
   area at its **upper right corner**.
5. **Back to the seat**:
   - **Stage Left** (SL) crosses the top and comes down the middle, past the
     pool, and enters the row from the aisle end.
   - **Stage Right** (SR) comes down the right-hand side and enters the row
     from the outer end.

Observation: the return order fills each row from the far end without anyone
passing anyone. SL comes back A1, A2, …, A9 into the aisle end, so A1 (first
back) walks to the far end, seat 1. SR comes back A10, A11, …, A18 into the
outer end, so A10 (first back) walks to the far end, seat 10.

Open questions:

- Leaving the seats: does the Stage Right half of a row (A10–A18) also leave by
  the left, walking across the front of the hall, or by its own side and round
  to the left backstage?
- When does each row get up: the whole row together when the row before it has
  been called, or a few rows queue backstage at the same time?
- Do they always return to the same seat? (Assumed yes.)
- Step 4: is the walk back from the stage's right exit to the upper right
  corner outside the student floor (between the floor and the audience)?
