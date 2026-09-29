import { Redirect, Route, Router, Switch } from "wouter";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Splash } from "@/components/Splash";
import { UpdatePrompt } from "@/components/UpdatePrompt";
import { CardPage } from "@/features/card/CardPage";
import { LookupPage } from "@/features/card/LookupPage";
import { LoginPage } from "@/features/auth/LoginPage";
import { RequireStaff } from "@/features/auth/StaffContext";
import { useStaff } from "@/features/auth/useStaff";
import { NotFoundPage } from "@/features/NotFoundPage";
import { ReportPage } from "@/features/report/ReportPage";
import { ScannerPage } from "@/features/scanner/ScannerPage";

/** "/" sends staff to the scanner and everyone else to the student page. */
function Home() {
  const state = useStaff();
  if (state.status === "loading") return <Splash />;
  return (
    <Redirect to={state.status === "signedIn" ? "/scan" : "/card"} replace />
  );
}

// Vite's BASE_URL ends in a slash; wouter wants none. "/" becomes "".
const base = import.meta.env.BASE_URL.replace(/\/$/, "");

export function App() {
  return (
    <ErrorBoundary>
      <UpdatePrompt />
      <Router base={base}>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/login" component={LoginPage} />
          <Route path="/scan">
            <RequireStaff>
              <ScannerPage />
            </RequireStaff>
          </Route>
          <Route path="/report">
            <RequireStaff permission="view_report">
              <ReportPage />
            </RequireStaff>
          </Route>
          <Route path="/card" component={LookupPage} />
          <Route path="/card/:studentId">
            {(params) => <CardPage studentId={params.studentId} />}
          </Route>
          <Route component={NotFoundPage} />
        </Switch>
      </Router>
    </ErrorBoundary>
  );
}
