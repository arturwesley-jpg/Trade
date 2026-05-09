import { useEffect, useState } from "react";

/**
 * Botão para habilitar/desabilitar o pop‑up de login.
 * Estado é persistido em `localStorage` sob a chave "showLoginPopup".
 * Verde claro indica ON, vermelho claro indica OFF.
 */
export function ToggleLoginButton() {
  const STORAGE_KEY = "showLoginPopup";
  const [enabled, setEnabled] = useState<boolean>(true);

  // Ler valor ao montar
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) setEnabled(stored === "true");
  }, []);

  const toggle = () => {
    const newVal = !enabled;
    setEnabled(newVal);
    localStorage.setItem(STORAGE_KEY, String(newVal));
  };

  const style: React.CSSProperties = {
    backgroundColor: enabled ? "#a2d5a2" : "#f5a5a5",
    border: "none",
    borderRadius: "4px",
    color: "#222",
    padding: "4px 8px",
    cursor: "pointer",
    fontWeight: "bold",
  };

  return (
    <button type="button" onClick={toggle} style={style} title="Toggle login pop‑up">
      {enabled ? "ON" : "OFF"}
    </button>
  );
}
