import type { Staff } from "@workspace/api-zod";
import "express-session";

declare module "express-session" {
  interface SessionData {
    /** Set at login; the account itself is re-read on every request. */
    staffId?: number;
  }
}

declare global {
  namespace Express {
    interface Request {
      /** Set by `requireStaff` on staff routes. */
      staff?: Staff;
    }
  }
}
