import type { Staff } from "@workspace/api-client-react";
import { can, type Permission } from "@workspace/attendance";
import { createContext, useContext, type ReactNode } from "react";
import { Redirect } from "wouter";
import { Splash } from "@/components/Splash";
import { useSyncLoop } from "@/offline/hooks";
import { useStaff } from "./useStaff";

const StaffContext = createContext<Staff | null>(null);

/** The signed-in staff member. Only for screens inside <RequireStaff>. */
export function useCurrentStaff(): Staff {
  const staff = useContext(StaffContext);
  if (!staff) throw new Error("useCurrentStaff() used outside <RequireStaff>");
  return staff;
}

/** Keeps sending this person's waiting changes, whichever screen they are on. */
function SyncLoop({ staffId }: { staffId: number }) {
  useSyncLoop(staffId);
  return null;
}

interface RequireStaffProps {
  /** Send staff without this permission back to the scanner. */
  permission?: Permission;
  children: ReactNode;
}

export function RequireStaff({ permission, children }: RequireStaffProps) {
  const state = useStaff();

  if (state.status === "loading") return <Splash />;
  if (state.status === "signedOut") return <Redirect to="/login" replace />;
  if (permission && !can(state.staff.role, permission)) {
    return <Redirect to="/scan" replace />;
  }

  return (
    <StaffContext.Provider value={state.staff}>
      <SyncLoop staffId={state.staff.id} />
      {children}
    </StaffContext.Provider>
  );
}
