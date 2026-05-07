import { useState } from "react";
import { useAuth } from "../contexts/AuthContext.js";

export function LoginPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, register } = useAuth();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(email, password, name || undefined);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-shell">
      <div className="login-background" aria-hidden="true">
        <span className="orbital one" />
        <span className="orbital two" />
      </div>

      <div className="login-container">
        <div className="login-brand">
          <span className="brand-mark" aria-hidden="true" />
          <h1>Crypto Sentinel</h1>
          <p>Central de inteligência para trading cripto</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-tabs">
            <button
              type="button"
              className={mode === "login" ? "active" : ""}
              onClick={() => {
                setMode("login");
                setError("");
              }}
            >
              Login
            </button>
            <button
              type="button"
              className={mode === "register" ? "active" : ""}
              onClick={() => {
                setMode("register");
                setError("");
              }}
            >
              Registrar
            </button>
          </div>

          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}

          {mode === "register" && (
            <div className="form-field">
              <label htmlFor="name">Nome (opcional)</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
              />
            </div>
          )}

          <div className="form-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="form-field">
            <label htmlFor="password">Senha</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={6}
            />
          </div>

          <button
            type="submit"
            className="primary-action"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
          >
            {isSubmitting
              ? mode === "login"
                ? "Entrando..."
                : "Registrando..."
              : mode === "login"
                ? "Entrar"
                : "Criar conta"}
          </button>

          <p className="form-note">
            {mode === "login"
              ? "Primeira vez? Clique em Registrar acima."
              : "Já tem conta? Clique em Login acima."}
          </p>
        </form>

        <div className="login-footer">
          <p>Modo paper-first • Live trading bloqueado • Stop loss obrigatório</p>
        </div>
      </div>
    </main>
  );
}
