import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import { App } from "./App.js";
import { TradingProvider } from "./contexts/TradingContext.js";
import "./styles.css";
import "./styles/admin.css";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const CLERK_PUBLISHABLE_KEY =
  PUBLISHABLE_KEY ?? "pk_test_cHJvZm91bmQtcmVpbmRlZXItMzIuY2xlcmsuYWNjb3VudHMuZGV2JA";

createRoot(document.getElementById("root")!).render(
  <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} afterSignOutUrl="/">
    <TradingProvider>
      <App />
    </TradingProvider>
  </ClerkProvider>
);
