import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Component } from "react";
export class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary caught an error:", error, errorInfo);
    }
    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }
            return (_jsx("div", { className: "error-boundary-fallback", children: _jsxs("div", { className: "error-content", children: [_jsx("span", { className: "error-icon", children: "\u26A0\uFE0F" }), _jsx("h2", { children: "Algo deu errado" }), _jsx("p", { children: "Ocorreu um erro inesperado. Por favor, recarregue a p\u00E1gina." }), this.state.error && (_jsxs("details", { className: "error-details", children: [_jsx("summary", { children: "Detalhes t\u00E9cnicos" }), _jsx("pre", { children: this.state.error.message }), _jsx("pre", { children: this.state.error.stack })] })), _jsx("button", { onClick: () => window.location.reload(), className: "error-reload-btn", type: "button", children: "Recarregar P\u00E1gina" })] }) }));
        }
        return this.props.children;
    }
}
