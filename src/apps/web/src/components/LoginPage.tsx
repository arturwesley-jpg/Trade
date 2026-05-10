import { SignIn } from "@clerk/clerk-react";

export function LoginPage() {
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

        <div className="login-form">
          <SignIn
            fallbackRedirectUrl="/#dashboard"
            forceRedirectUrl="/#dashboard"
            signUpForceRedirectUrl="/#dashboard"
          />
        </div>

        <div className="login-footer">
          <p>Modo paper-first • Live trading bloqueado • Stop loss obrigatório</p>
        </div>
      </div>
    </main>
  );
}
