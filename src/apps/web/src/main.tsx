import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { AuthProvider } from "./contexts/AuthContext.js";
import { TradingProvider } from "./contexts/TradingContext.js";
import "./styles.css";
import "./styles/admin.css";

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <TradingProvider>
      <App />
    </TradingProvider>
  </AuthProvider>
);
