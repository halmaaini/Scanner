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
rows H–R (81 seats). Stage Right stays one line.

Open questions:

- Does Line 2 follow straight after Line 1 (one long walk, same route), or do
  the two lines walk in at the same time?
- Is the split fixed by seat (always A1–G4 / H1 onwards), even if seats are
  reassigned later?
