import "@fontsource-variable/fraunces/wght.css";
import "@fontsource-variable/instrument-sans/wght.css";
import "./index.css";

import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { setRequestTimeout } from "@workspace/api-client-react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { REQUEST_TIMEOUT_MS } from "./config";
import { persistOptions, queryClient } from "./lib/queryClient";

setRequestTimeout(REQUEST_TIMEOUT_MS);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={persistOptions}
    >
      <App />
    </PersistQueryClientProvider>
  </StrictMode>,
);
