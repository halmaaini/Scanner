/**
 * Every word the app shows, in one place. To rebrand or reword, edit here.
 * Strings that need a number or a name are small functions.
 *
 * Keeping text out of the components also means another language can be added
 * later by providing a second object of the same shape.
 */

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export const m = {
  brand: {
    /** Small line above the heading on the student pages. */
    eyebrow: "Graduation",
  },

  common: {
    loading: "Loading…",
    retry: "Try again",
    back: "Back",
    signOut: "Sign out",
    dismiss: "Dismiss",
    crashed: {
      title: "Something went wrong",
      body: "Reload the page to carry on. Anything already saved on this device is safe.",
      reload: "Reload",
    },
  },

  login: {
    heading: ["Attendance", "check-in"],
    intro: "Sign in to check people in at events.",
    username: "Username",
    password: "Password",
    submit: "Sign in",
    submitting: "Signing in…",
    wrongCredentials: "Wrong username or password.",
    tooManyAttempts: "Too many attempts. Wait a few minutes and try again.",
    unreachable: "Can't reach the server. Check your connection and try again.",
    accountsNote:
      "Accounts are created by the super admin. Forgot your password? Ask them to reset it.",
    studentLink: "I'm a graduate: view my card",
  },

  auth: {
    /** Asked before signing out with changes that have not reached the server. */
    confirmDiscard: (n: number) =>
      `${n} ${plural(n, "change hasn't", "changes haven't")} been sent yet and will be lost if you sign out. Sign out anyway?`,
    signOutFailed: "Couldn't sign out. Check your connection and try again.",
  },

  scanner: {
    signedInAs: "Signed in as",
    roles: { admin: "admin", super: "super admin" },
    report: "Report",
    event: "Event",
    title: "Scanner",
    /** Shown after the (large) number already checked in. */
    countRest: (expected: number) => `of ${expected} checked in`,
    scanFailed: "Something went wrong. Try again.",
    cameraHint: "Point the camera at the student's QR",
    cameraStarting: "Starting camera…",
    cameraDenied:
      "Camera access is blocked. Allow it in your browser settings, or type the ID below.",
    cameraUnavailable: "No camera found. Type the student ID below.",
    cameraError: "The camera could not start. Type the student ID below.",
    orType: "or type the student ID",
    studentId: "Student ID",
    checkIn: "Check in",
    noOpenEvents: {
      title: "No open events",
      body: "Ask the super admin to open an event. This page updates by itself.",
    },
    loadingRoster: "Loading the student list…",
    noRosterOffline:
      "Connect to the internet once to download the student list.",
    rosterFailed: "Couldn't load the student list.",
    sync: {
      online: "Online",
      offline: "Offline",
      allSynced: "Nothing waiting to sync",
      waiting: (n: number) => `${n} waiting to sync`,
      syncing: "Syncing…",
      syncNow: "Sync now",
      othersWaiting: (n: number) =>
        `${n} ${plural(n, "change", "changes")} from another admin ${plural(n, "is", "are")} waiting on this phone. ${plural(n, "It is", "They are")} sent when that admin signs in.`,
    },
    issues: {
      title: (n: number) =>
        `${n} ${plural(n, "change", "changes")} couldn't be saved`,
      scan: "Check-in",
      undo: "Undo",
      reasons: {
        checked_in: "Recorded",
        already_checked_in: "Already checked in",
        unknown_student: "Student ID not found",
        unknown_event: "Event not found",
        not_registered: "Not registered for this event",
        revoked: "Access revoked",
        invalid: "Could not be read by the server",
        undo_forbidden:
          "Only the person who checked in (or the super admin) can undo",
      },
    },
  },

  results: {
    scanNext: "Scan next",
    undo: "Undo check-in",
    undoing: "Undoing…",
    event: "Event",
    time: "Time",
    reason: "Reason",
    firstScan: "First scan",
    scannedBy: "Scanned by",
    someoneElse: "another admin",
    unknownName: "Unknown ID",
    studentLine: (id: string) => `Student ID ${id}`,
    checkedIn: { title: "Checked in" },
    alreadyCheckedIn: {
      title: "Already checked in",
      note: "Not counted twice. Nothing was changed.",
    },
    revoked: {
      title: "Not allowed",
      reason: "Access revoked",
      note: "Do not admit. Send the student to the registration desk.",
    },
    notRegistered: {
      title: "Not on the list",
      reason: "Not registered for this event",
      note: "Do not admit. Send the student to the registration desk.",
    },
    unknownStudent: {
      title: "ID not found",
      note: "Check the ID and try again.",
    },
    unknownEvent: {
      title: "Event not found",
      note: "This event no longer exists. Go back and choose another.",
    },
    offline: {
      saved: "Offline: saved on this device. It syncs when you're back online.",
      checkedAgainstList:
        "Offline: checked against the saved list. Nothing was recorded.",
      listMayBeOld:
        "Offline: not in the saved list, which may be out of date. Try again when online.",
    },
    undone: (name: string) => `Check-in undone for ${name}.`,
    undoQueued: "Undo saved. It syncs when you're back online.",
    undoFailed: "Couldn't undo. Try again.",
  },

  report: {
    role: "Super admin",
    title: "Attendance",
    scanner: "Scanner",
    loading: "Loading the report…",
    failed: "Couldn't load the report.",
    noEvents: "No events yet.",
    progress: (checkedIn: number, expected: number) =>
      `${checkedIn} / ${expected}`,
    findStudent: "Find a student",
    findPlaceholder: "Name or student ID",
    latest: "Latest check-ins",
    noCheckIns: "No check-ins yet.",
    noMatches: "No students match.",
    firstMatches: (n: number) => `Showing the first ${n} matches.`,
    notYet: "Not yet",
    revoked: "Access revoked",
    exportCsv: "Export CSV",
  },

  lookup: {
    heading: "Find your card",
    intro:
      "Enter your student ID to see your card and which events you have attended.",
    studentId: "Student ID",
    submit: "Show my card",
    staffLink: "Staff sign in",
  },

  card: {
    qrCaption: "Show this QR to the staff at each event",
    qrLabel: (id: string) => `QR code for student ${id}`,
    attendance: "Your attendance",
    noEvents: "You are not registered for any events yet.",
    attendedAt: (when: string) => `Attended, ${when}`,
    notYet: "Not yet attended",
    done: "Done",
    pending: "Pending",
    revoked:
      "Your access has been revoked. Please contact the registration desk.",
    notFound: {
      title: "We couldn't find that ID",
      body: "Check the number and try again.",
    },
    tooMany: "Too many requests. Wait a minute and try again.",
    failed: "Couldn't load your card. Check your connection and try again.",
    refresh: "Refresh",
    offlineCopy: "Offline: showing the last saved copy.",
  },

  notFound: {
    title: "Page not found",
    body: "That page doesn't exist.",
    home: "Go to the start page",
  },
} as const;
