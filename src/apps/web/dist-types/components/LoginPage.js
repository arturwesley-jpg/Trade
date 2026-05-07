import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useAuth } from "../contexts/AuthContext.js";
export function LoginPage() {
    const [mode, setMode] = useState("login");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { login, register } = useAuth();
    async function handleSubmit(event) {
        event.preventDefault();
        setError("");
        setIsSubmitting(true);
        try {
            if (mode === "login") {
                await login(email, password);
            }
            else {
                await register(email, password, name || undefined);
            }
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Authentication failed");
        }
        finally {
            setIsSubmitting(false);
        }
    }
    return (_jsxs("main", { className: "login-shell", children: [_jsxs("div", { className: "login-background", "aria-hidden": "true", children: [_jsx("span", { className: "orbital one" }), _jsx("span", { className: "orbital two" })] }), _jsxs("div", { className: "login-container", children: [_jsxs("div", { className: "login-brand", children: [_jsx("span", { className: "brand-mark", "aria-hidden": "true" }), _jsx("h1", { children: "Crypto Sentinel" }), _jsx("p", { children: "Central de intelig\u00EAncia para trading cripto" })] }), _jsxs("form", { className: "login-form", onSubmit: handleSubmit, children: [_jsxs("div", { className: "form-tabs", children: [_jsx("button", { type: "button", className: mode === "login" ? "active" : "", onClick: () => {
                                            setMode("login");
                                            setError("");
                                        }, children: "Login" }), _jsx("button", { type: "button", className: mode === "register" ? "active" : "", onClick: () => {
                                            setMode("register");
                                            setError("");
                                        }, children: "Registrar" })] }), error && (_jsx("div", { className: "form-error", role: "alert", children: error })), mode === "register" && (_jsxs("div", { className: "form-field", children: [_jsx("label", { htmlFor: "name", children: "Nome (opcional)" }), _jsx("input", { id: "name", type: "text", value: name, onChange: (e) => setName(e.target.value), placeholder: "Seu nome" })] })), _jsxs("div", { className: "form-field", children: [_jsx("label", { htmlFor: "email", children: "Email" }), _jsx("input", { id: "email", type: "email", value: email, onChange: (e) => setEmail(e.target.value), placeholder: "seu@email.com", required: true, autoComplete: "email" })] }), _jsxs("div", { className: "form-field", children: [_jsx("label", { htmlFor: "password", children: "Senha" }), _jsx("input", { id: "password", type: "password", value: password, onChange: (e) => setPassword(e.target.value), placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022", required: true, autoComplete: mode === "login" ? "current-password" : "new-password", minLength: 6 })] }), _jsx("button", { type: "submit", className: "primary-action", disabled: isSubmitting, "aria-busy": isSubmitting, children: isSubmitting
                                    ? mode === "login"
                                        ? "Entrando..."
                                        : "Registrando..."
                                    : mode === "login"
                                        ? "Entrar"
                                        : "Criar conta" }), _jsx("p", { className: "form-note", children: mode === "login"
                                    ? "Primeira vez? Clique em Registrar acima."
                                    : "Já tem conta? Clique em Login acima." })] }), _jsx("div", { className: "login-footer", children: _jsx("p", { children: "Modo paper-first \u2022 Live trading bloqueado \u2022 Stop loss obrigat\u00F3rio" }) })] })] }));
}
