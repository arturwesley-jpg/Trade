import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { adminApi } from "./services/api";
import "./styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !!localStorage.getItem("adminToken");
  });

  const handleLogin = async (email: string, password: string) => {
    await adminApi.login(email, password);
    setIsAuthenticated(true);
  };

  return (
    <QueryClientProvider client={queryClient}>
      {isAuthenticated ? <DashboardPage /> : <LoginPage onLogin={handleLogin} />}
    </QueryClientProvider>
  );
}

export default App;
