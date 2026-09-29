import "@fontsource-variable/fraunces/wght.css";
import "@fontsource-variable/instrument-sans/wght.css";
import "./index.css";

import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { persistOptions, queryClient } from "./lib/queryClient";

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
