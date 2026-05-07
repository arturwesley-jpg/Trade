import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense, memo } from "react";
import { fetchAlerts, fetchHealth, fetchMarketTicks, fetchPaperSummary, fetchPositions, fetchProviderStatuses, fetchSentimentSnapshot, fetchSignals, fetchWhaleEvents, openPaperOrder } from "./api.js";
import { buildPaperOrderPayload, classForChange, describeWhaleEvent, formatCurrency, formatAlertStatus, formatPercent, formatSignalDirection, formatSignalStatus, formatWhaleEventType, getAccessiblePaperActionLabel, filterCommandItems, resolveAppRouteFromHash, summarizeMarketContext } from "./view-model.js";
import { useWebSocket } from "./websocket-client.js";
import { apiBaseUrl } from "./api.js";
import { ErrorBoundary } from "./components/ErrorBoundary.js";
import { ToastContainer, useToast } from "./components/Toast.js";
import { useAuth } from "./contexts/AuthContext.js";
import { LoginPage } from "./components/LoginPage.js";
import { useTrading } from "./contexts/TradingContext.js";
import { MarketDataWebSocket } from "./services/websocket.js";
// Lazy load Analytics and Admin pages for better performance
const AnalyticsPage = lazy(() => import("./components/AnalyticsPage.js").then(m => ({ default: m.AnalyticsPage })));
const AdminPage = lazy(() => import("./pages/AdminPage.js").then(m => ({ default: m.AdminPage })));
const pages = [
    { id: "dashboard", label: "Dashboard", keywords: ["cockpit", "home", "inicio"] },
    { id: "analytics", label: "Analytics", keywords: ["graficos", "performance", "metricas", "charts"] },
    { id: "mercado", label: "Mercado", keywords: ["btc", "eth", "ticker", "preco"] },
    { id: "sinais", label: "Sinais", keywords: ["indicadores", "long", "confianca"] },
    { id: "baleias", label: "Baleias", keywords: ["whales", "carteiras", "fluxo"] },
    { id: "bot", label: "Bot IA", keywords: ["noticias", "sentimento", "tecnica"] },
    { id: "alertas", label: "Alertas", keywords: ["regras", "notificacoes", "telegram"] },
    { id: "risco", label: "Risco", keywords: ["roadmap", "backend", "pre-live"] },
    { id: "admin", label: "Admin", keywords: ["admin", "system", "health", "monitoring"] }
];
const initialState = {
    health: { data: null, status: "loading" },
    alerts: { data: [], status: "loading" },
    paperSummary: { data: null, status: "loading" },
    positions: { data: [], status: "loading" },
    signals: { data: [], status: "loading" },
    sentiment: { data: null, status: "loading" },
    providerStatuses: { data: [], status: "loading" },
    whales: { data: [], status: "loading" },
    ticks: { data: [], status: "loading" }
};
const indicatorEngine = [
    { label: "RSI", state: "forca relativa" },
    { label: "MACD", state: "cruzamento" },
    { label: "Medias 50/200", state: "tendencia" },
    { label: "Bandas de Bollinger", state: "volatilidade" },
    { label: "Volume", state: "confirmacao" },
    { label: "Estocastico", state: "momento" },
    { label: "ADX", state: "forca" },
    { label: "OBV", state: "fluxo" },
    { label: "ATR", state: "risco/volatilidade" },
    { label: "Suporte/Resistencia", state: "nivel" }
];
const riskRules = [
    "Operacao real bloqueada no MVP",
    "Stop loss obrigatorio",
    "Maximo 4x em paper",
    "Sinais informativos, sem execucao automatica"
];
const trustProofs = [
    { label: "Modo paper", value: "simulacao segura" },
    { label: "Sem ordem real", value: "live bloqueado" },
    { label: "Stop obrigatorio", value: "risco validado" },
    { label: "Pre-live", value: "100 trades auditados" }
];
const intelligenceBlocks = [
    { label: "Sentimento do mercado", value: "score agregado", tone: "cyan" },
    { label: "Fluxo de whales", value: "inflow/outflow", tone: "amber" },
    { label: "Grandes carteiras", value: "acumulacao", tone: "teal" },
    { label: "Alertas de noticias", value: "impacto narrativo", tone: "violet" },
    { label: "Sinal tecnico do bot", value: "10 indicadores", tone: "cyan" },
    { label: "Comportamento humano", value: "medo/euforia", tone: "amber" }
];
const newsRows = [
    { source: "Noticias macro", signal: "impacto medio", state: "aguardando confirmacao tecnica" },
    { source: "Social sentiment", signal: "neutro ativo", state: "sem euforia extrema" },
    { source: "Narrativa BTC", signal: "liquidez em foco", state: "monitorar ruptura de nivel" }
];
const landingModules = [
    {
        label: "Sentimento",
        title: "Humor do mercado em um unico score",
        text: "Agrupe variacao, noticias, medo/euforia e contexto social antes de olhar apenas para o candle.",
        page: "mercado"
    },
    {
        label: "Baleias",
        title: "Fluxo de grandes carteiras",
        text: "Acompanhe entradas em exchange, acumulacao, stablecoins e sinais de pressao antes do movimento.",
        page: "baleias"
    },
    {
        label: "Bot IA",
        title: "Tecnica, noticia e comportamento",
        text: "O motor cruza 10 indicadores com narrativas de mercado para orientar treino em modo paper.",
        page: "bot"
    },
    {
        label: "Alertas",
        title: "Regras para chamar atencao",
        text: "Whales, risco, confluencia tecnica e sentimento extremo ficam organizados em uma central auditavel.",
        page: "alertas"
    }
];
const landingTestimonials = [
    {
        quote: "O painel colocou sentimento, noticias e sinais tecnicos no mesmo fluxo. Ficou mais facil treinar sem agir no impulso.",
        name: "Usuario beta",
        role: "Modo treinamento"
    },
    {
        quote: "A separacao entre sinal informativo e ordem real deixa claro quando estou estudando o mercado, nao apostando no escuro.",
        name: "Operador cripto",
        role: "Paper trading"
    },
    {
        quote: "O radar de baleias ajuda a enxergar liquidez e pressao de venda antes de validar qualquer hipotese tecnica.",
        name: "Analista independente",
        role: "Whale tracking"
    }
];
const backendPhases = [
    "Contratos compartilhados e erros padronizados",
    "Persistencia duravel para paper trading",
    "Worker alimentando market data real/simulado",
    "Indicadores tecnicos e scoring por simbolo",
    "Sentimento, noticias, whales e alertas",
    "Checklist pre-live antes de qualquer ordem real"
];
export function App() {
    const [activeRoute, setActiveRoute] = useState(() => appRouteFromHash());
    const { isAuthenticated, isLoading } = useAuth();
    useEffect(() => {
        const handleLocationChange = () => setActiveRoute(appRouteFromHash());
        window.addEventListener("hashchange", handleLocationChange);
        window.addEventListener("popstate", handleLocationChange);
        return () => {
            window.removeEventListener("hashchange", handleLocationChange);
            window.removeEventListener("popstate", handleLocationChange);
        };
    }, []);
    function navigateToRoute(route) {
        setActiveRoute(route);
        const target = route === "landing" ? `${window.location.pathname}${window.location.search}` : `#${route}`;
        window.history.pushState(null, "", target);
        window.scrollTo({ top: 0, behavior: "smooth" });
    }
    if (isLoading) {
        return (_jsxs("main", { className: "app-shell", children: [_jsx(BackgroundField, {}), _jsx("div", { className: "page-view", children: _jsx("p", { className: "empty", children: "Carregando..." }) })] }));
    }
    if (!isAuthenticated) {
        return _jsx(LoginPage, {});
    }
    if (activeRoute === "landing") {
        return _jsx(LandingPage, { onEnter: () => navigateToRoute("dashboard"), onNavigate: navigateToRoute });
    }
    return _jsx(TradingHub, { activePage: activeRoute, onNavigate: navigateToRoute });
}
const TradingHub = memo(function TradingHub({ activePage, onNavigate }) {
    const [alerts, setAlerts] = useState(initialState.alerts);
    const [health, setHealth] = useState(initialState.health);
    const [paperSummary, setPaperSummary] = useState(initialState.paperSummary);
    const [ticks, setTicks] = useState(initialState.ticks);
    const [signals, setSignals] = useState(initialState.signals);
    const [sentiment, setSentiment] = useState(initialState.sentiment);
    const [providerStatuses, setProviderStatuses] = useState(initialState.providerStatuses);
    const [whales, setWhales] = useState(initialState.whales);
    const [positions, setPositions] = useState(initialState.positions);
    const [isCommandOpen, setIsCommandOpen] = useState(false);
    const [isPollingPaused, setIsPollingPaused] = useState(false);
    const [submittingSymbol, setSubmittingSymbol] = useState(null);
    const [wsStatus, setWsStatus] = useState("connecting");
    const [notice, setNotice] = useState({
        kind: "status",
        text: "Modo paper ativo: nenhuma ordem real sera enviada."
    });
    const refreshId = useRef(0);
    const toast = useToast();
    const trading = useTrading();
    const marketDataWsRef = useRef(null);
    // WebSocket connection for market data
    useEffect(() => {
        const wsUrl = apiBaseUrl.replace(/^http/, "ws") + "/market-data";
        const marketDataWs = new MarketDataWebSocket({
            url: wsUrl,
            onCandle: (candle) => {
                trading.addCandle(candle);
            },
            onError: (error) => {
                console.error("[TradingHub] Market data WebSocket error:", error);
                toast.error(`WebSocket error: ${error.message}`);
            },
            onStateChange: (state) => {
                const statusMap = {
                    disconnected: "disconnected",
                    connecting: "connecting",
                    connected: "connected",
                    reconnecting: "connecting",
                    error: "disconnected"
                };
                setWsStatus(statusMap[state]);
            }
        });
        marketDataWs.connect();
        marketDataWsRef.current = marketDataWs;
        return () => {
            marketDataWs.disconnect();
            marketDataWsRef.current = null;
        };
    }, [trading, toast]);
    // Legacy WebSocket for signals and positions
    const wsUrl = apiBaseUrl.replace(/^http/, "ws") + "/ws";
    const { status: websocketStatus, isConnected } = useWebSocket({
        url: wsUrl,
        onMarketTick: (tick) => {
            setTicks((prev) => {
                const filtered = prev.data.filter((t) => t.symbol !== tick.symbol);
                return {
                    ...prev,
                    data: [tick, ...filtered],
                    status: "success",
                    updatedAt: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
                };
            });
        },
        onSignalUpdate: (signal) => {
            setSignals((prev) => {
                const filtered = prev.data.filter((s) => s.symbol !== signal.symbol);
                return {
                    ...prev,
                    data: [signal, ...filtered],
                    status: "success",
                    updatedAt: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
                };
            });
        },
        onPositionUpdate: (position) => {
            setPositions((prev) => {
                const filtered = prev.data.filter((p) => p.id !== position.id);
                return {
                    ...prev,
                    data: [position, ...filtered],
                    status: "success",
                    updatedAt: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
                };
            });
        },
        onConnectionChange: (status) => {
            setWsStatus(status);
        }
    });
    const refresh = useCallback(async () => {
        const requestId = refreshId.current + 1;
        refreshId.current = requestId;
        const [healthResult, ticksResult, signalsResult, providerStatusesResult, positionsResult, alertsResult, sentimentResult, whalesResult, paperSummaryResult] = await Promise.allSettled([
            fetchHealth(),
            fetchMarketTicks(),
            fetchSignals(),
            fetchProviderStatuses(),
            fetchPositions(),
            fetchAlerts(),
            fetchSentimentSnapshot(),
            fetchWhaleEvents(),
            fetchPaperSummary()
        ]);
        if (refreshId.current !== requestId)
            return;
        const updatedAt = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        applyResult(healthResult, setHealth, null, updatedAt);
        applyResult(ticksResult, setTicks, [], updatedAt);
        applyResult(signalsResult, setSignals, [], updatedAt);
        applyResult(providerStatusesResult, setProviderStatuses, [], updatedAt);
        applyResult(positionsResult, setPositions, [], updatedAt);
        applyResult(alertsResult, setAlerts, [], updatedAt);
        applyResult(sentimentResult, setSentiment, null, updatedAt);
        applyResult(whalesResult, setWhales, [], updatedAt);
        applyResult(paperSummaryResult, setPaperSummary, null, updatedAt);
    }, []);
    useEffect(() => {
        void refresh();
    }, [refresh]);
    useEffect(() => {
        if (isPollingPaused)
            return;
        const interval = window.setInterval(() => void refresh(), 5000);
        return () => window.clearInterval(interval);
    }, [isPollingPaused, refresh]);
    useEffect(() => {
        function handleKeyDown(event) {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
                event.preventDefault();
                setIsCommandOpen((value) => !value);
            }
            if (event.key === "Escape") {
                setIsCommandOpen(false);
            }
        }
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);
    const marketContext = useMemo(() => summarizeMarketContext(ticks.data, signals.data), [signals.data, ticks.data]);
    const primaryTick = ticks.data[0];
    async function simulateLong(symbol, price) {
        setSubmittingSymbol(symbol);
        try {
            await openPaperOrder(buildPaperOrderPayload(symbol, price));
            setNotice({
                kind: "status",
                text: `Posicao paper simulada aberta para ${symbol}. Checagem de risco aprovada.`
            });
            toast.success(`Posição paper aberta: ${symbol} @ ${formatCurrency(price)}`);
            await refresh();
        }
        catch (error) {
            setNotice({
                kind: "alert",
                text: `Simulacao bloqueada pela checagem de risco: ${getErrorMessage(error)}`
            });
            toast.error(`Erro: ${getErrorMessage(error)}`);
        }
        finally {
            setSubmittingSymbol(null);
        }
    }
    return (_jsx("main", { className: "app-shell", children: _jsxs(ErrorBoundary, { children: [_jsx(BackgroundField, {}), _jsx(TopNav, { activePage: activePage, health: health, isPollingPaused: isPollingPaused, onNavigate: onNavigate, onOpenCommand: () => setIsCommandOpen(true), onTogglePolling: () => setIsPollingPaused((value) => !value), wsStatus: wsStatus }), _jsx(CommandPalette, { activePage: activePage, isOpen: isCommandOpen, onClose: () => setIsCommandOpen(false), onNavigate: (page) => onNavigate(page) }), activePage === "dashboard" ? (_jsx(DashboardPage, { alerts: alerts, health: health, marketContext: marketContext, notice: notice, onSimulate: simulateLong, onNavigate: onNavigate, paperSummary: paperSummary, positions: positions, primaryTick: primaryTick, providerStatuses: providerStatuses, signals: signals, sentiment: sentiment, submittingSymbol: submittingSymbol, ticks: ticks, whales: whales })) : null, activePage === "analytics" ? (_jsx(Suspense, { fallback: _jsx("div", { className: "page-view", children: _jsx("p", { className: "empty", children: "Carregando Analytics..." }) }), children: _jsx(AnalyticsPage, { positions: positions.data, paperSummary: paperSummary.data }) })) : null, activePage === "admin" ? (_jsx(Suspense, { fallback: _jsx("div", { className: "page-view", children: _jsx("p", { className: "empty", children: "Carregando Admin..." }) }), children: _jsx(AdminPage, {}) })) : null, activePage === "mercado" ? (_jsx(MarketPage, { marketContext: marketContext, onSimulate: simulateLong, submittingSymbol: submittingSymbol, ticks: ticks })) : null, activePage === "sinais" ? _jsx(SignalsPage, { signals: signals }) : null, activePage === "baleias" ? _jsx(WhalesPage, { whales: whales }) : null, activePage === "bot" ? _jsx(BotPage, { sentiment: sentiment, signals: signals }) : null, activePage === "alertas" ? _jsx(AlertsPage, { alerts: alerts, whales: whales }) : null, activePage === "risco" ? _jsx(RiskRoadmapPage, { paperSummary: paperSummary, positions: positions }) : null, _jsx(ToastContainer, { toasts: toast.toasts, onRemove: toast.removeToast })] }) }));
});
function LandingPage({ onEnter, onNavigate }) {
    function scrollToLandingSection(sectionId) {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    return (_jsxs("main", { className: "landing-shell", children: [_jsx(BackgroundField, {}), _jsxs("nav", { className: "landing-nav", "aria-label": "Navegacao da landing page", children: [_jsxs("button", { className: "landing-brand", onClick: () => window.scrollTo({ top: 0, behavior: "smooth" }), type: "button", children: [_jsx("span", { className: "brand-mark", "aria-hidden": "true" }), "Crypto Sentinel"] }), _jsxs("div", { className: "landing-nav-links", children: [_jsx("button", { onClick: () => scrollToLandingSection("landing-sentimento"), type: "button", children: "Sentimento" }), _jsx("button", { onClick: () => scrollToLandingSection("landing-modulos"), type: "button", children: "Baleias" }), _jsx("button", { onClick: () => scrollToLandingSection("landing-bot"), type: "button", children: "Bot IA" }), _jsx("button", { onClick: () => scrollToLandingSection("landing-seguranca"), type: "button", children: "Seguranca" })] }), _jsx("button", { className: "landing-nav-cta", onClick: onEnter, type: "button", children: "Entrar" })] }), _jsxs("section", { className: "landing-hero", "aria-labelledby": "landing-title", children: [_jsxs("div", { className: "landing-hero-copy", children: [_jsx("h1", { id: "landing-title", children: "Leia o mercado cripto antes do movimento" }), _jsx("p", { children: "Uma central de inteligencia para acompanhar sinais tecnicos, sentimento, noticias e movimentos de grandes carteiras antes de treinar decisoes no modo paper." }), _jsxs("div", { className: "landing-actions", children: [_jsx("button", { className: "landing-enter", onClick: onEnter, type: "button", children: "ENTRAR" }), _jsx("button", { className: "landing-secondary", onClick: () => scrollToLandingSection("landing-modulos"), type: "button", children: "Ver modulos" })] }), _jsxs("div", { className: "landing-proof-line", "aria-label": "Provas de seguranca", children: [_jsx("span", { children: "Paper-first" }), _jsx("span", { children: "Live bloqueado" }), _jsx("span", { children: "Stop obrigatorio" })] })] }), _jsxs("div", { className: "landing-cockpit", "aria-label": "Previa visual do hub de solucoes", children: [_jsx("div", { className: "cockpit-orbit", "aria-hidden": "true" }), _jsxs("div", { className: "cockpit-header", children: [_jsx("span", { children: "Sentimento" }), _jsx("strong", { children: "64/100" })] }), _jsxs("div", { className: "cockpit-wave", "aria-hidden": "true", children: [_jsx("span", {}), _jsx("span", {}), _jsx("span", {}), _jsx("span", {})] }), _jsxs("div", { className: "cockpit-grid", children: [_jsxs("article", { children: [_jsx("span", { children: "Whale flow" }), _jsx("strong", { children: "$18.4M" }), _jsx("small", { children: "pressao em exchange" })] }), _jsxs("article", { children: [_jsx("span", { children: "Bot IA" }), _jsx("strong", { children: "10 sinais" }), _jsx("small", { children: "tecnica + noticias" })] }), _jsxs("article", { children: [_jsx("span", { children: "Risco" }), _jsx("strong", { children: "bloqueado" }), _jsx("small", { children: "sem ordem real" })] })] })] })] }), _jsxs("section", { className: "landing-story", id: "landing-sentimento", "aria-labelledby": "landing-problem-title", children: [_jsxs("div", { children: [_jsx("h2", { id: "landing-problem-title", children: "Mercado rapido demais para sinais espalhados" }), _jsx("p", { children: "Preco, noticia, medo, euforia, volume e baleias mudam em ritmos diferentes. O Crypto Sentinel organiza esse contexto em uma jornada unica antes de qualquer simulacao." })] }), _jsxs("div", { className: "landing-story-rail", children: [_jsx("span", { children: "01 Mercado" }), _jsx("span", { children: "02 Sentimento" }), _jsx("span", { children: "03 Confluencia" }), _jsx("span", { children: "04 Paper" })] })] }), _jsxs("section", { className: "landing-modules", id: "landing-modulos", "aria-labelledby": "landing-modules-title", children: [_jsxs("div", { className: "landing-section-heading", children: [_jsx("h2", { id: "landing-modules-title", children: "Hub de solucoes conectado" }), _jsx("p", { children: "Cada modulo abre uma area do cockpit ja criada para navegar sem perder contexto." })] }), _jsx("div", { className: "landing-module-grid", children: landingModules.map((module) => (_jsxs("article", { className: "landing-module", children: [_jsx("span", { children: module.label }), _jsx("h3", { children: module.title }), _jsx("p", { children: module.text }), _jsxs("button", { onClick: () => onNavigate(module.page), type: "button", children: ["Abrir ", module.label] })] }, module.label))) })] }), _jsxs("section", { className: "landing-engine", id: "landing-bot", "aria-labelledby": "landing-engine-title", children: [_jsxs("div", { children: [_jsx("h2", { id: "landing-engine-title", children: "Motor IA com os 10 indicadores principais" }), _jsx("p", { children: "RSI, MACD, medias, Bollinger, volume, estocastico, ADX, OBV, ATR e suporte/resistencia entram como sinais informativos para treino, nao como promessa de execucao automatica." }), _jsx("button", { className: "landing-secondary solid", onClick: () => onNavigate("sinais"), type: "button", children: "Ver sinais" })] }), _jsx("div", { className: "landing-indicators", children: indicatorEngine.map((indicator) => (_jsxs("span", { children: [_jsx("strong", { children: indicator.label }), indicator.state] }, indicator.label))) })] }), _jsxs("section", { className: "landing-testimonials", "aria-labelledby": "landing-testimonials-title", children: [_jsxs("div", { className: "landing-section-heading compact", children: [_jsx("h2", { id: "landing-testimonials-title", children: "Depoimentos de treino beta" }), _jsx("p", { children: "Feedback anonimo e conservador, focado em clareza operacional e modo treinamento." })] }), _jsx("div", { className: "landing-testimonial-grid", children: landingTestimonials.map((testimonial) => (_jsxs("figure", { className: "landing-testimonial", children: [_jsx("blockquote", { children: testimonial.quote }), _jsxs("figcaption", { children: [_jsx("strong", { children: testimonial.name }), _jsx("span", { children: testimonial.role })] })] }, testimonial.quote))) })] }), _jsxs("section", { className: "landing-safety", id: "landing-seguranca", "aria-labelledby": "landing-safety-title", children: [_jsxs("div", { children: [_jsx("h2", { id: "landing-safety-title", children: "Projetado para treinar primeiro, operar depois" }), _jsx("p", { children: "O produto evita atalhos perigosos: sinais sao informativos, live trading fica bloqueado e o roadmap exige persistencia, auditoria, idempotencia e validacao paper antes de qualquer pre-live." })] }), _jsx("div", { className: "landing-safety-grid", children: trustProofs.map((proof) => (_jsxs("article", { children: [_jsx("span", { children: proof.label }), _jsx("strong", { children: proof.value })] }, proof.label))) })] }), _jsxs("section", { className: "landing-final", "aria-labelledby": "landing-final-title", children: [_jsx("h2", { id: "landing-final-title", children: "Entre no hub e comece pelo modo treinamento" }), _jsx("p", { children: "Ferramenta auxiliar para leitura de mercado. Nao e recomendacao financeira e nao garante resultados." }), _jsx("button", { className: "landing-enter", onClick: onEnter, type: "button", children: "ENTRAR" })] })] }));
}
function DashboardPage({ alerts, health, marketContext, notice, onSimulate, onNavigate, paperSummary, positions, primaryTick, providerStatuses, signals, sentiment, submittingSymbol, ticks, whales }) {
    return (_jsxs(_Fragment, { children: [_jsxs("section", { className: "hero-cockpit", "aria-labelledby": "hero-title", children: [_jsxs("div", { className: "hero-copy", children: [_jsx("p", { className: "system-label", children: "Trade Lab / Modo Paper" }), _jsx("h1", { id: "hero-title", children: "Sentimento da tarde antes do proximo movimento" }), _jsx("p", { className: "lead", children: "Acompanhe mercado, baleias, grandes carteiras, noticias e comportamento humano em um cockpit futuristico. O bot cruza 10 indicadores tecnicos para treinar decisoes sem expor capital real." }), _jsxs("div", { className: "hero-actions", children: [_jsx("button", { "aria-busy": submittingSymbol === primaryTick?.symbol, "aria-label": primaryTick ? getAccessiblePaperActionLabel(primaryTick.symbol) : "Simular LONG paper indisponivel", className: "primary-action", disabled: !primaryTick || submittingSymbol === primaryTick.symbol, onClick: () => primaryTick && void onSimulate(primaryTick.symbol, primaryTick.price), children: submittingSymbol === primaryTick?.symbol ? "Simulando..." : "Simular primeira entrada" }), _jsx("button", { className: "secondary-action", onClick: () => onNavigate("sinais"), type: "button", children: "Ver sinais" })] }), _jsx("p", { className: "safety-note", children: "Ambiente paper-first. Sinais informativos. Nenhuma ordem real e enviada." })] }), _jsxs("div", { className: "hero-dashboard", children: [_jsx(StatusRail, { health: health, marketContext: marketContext, paperSummary: paperSummary.data, positions: positions.data }), _jsxs("section", { className: "market-grid", id: "market", "aria-label": "Mercado monitorado", children: [ticks.status === "loading" ? (_jsxs(_Fragment, { children: [_jsx("p", { className: "sr-only", role: "status", children: "Carregando mercado monitorado..." }), _jsx(SkeletonCards, { count: 2 })] })) : null, ticks.status === "error" ? _jsx(PanelError, { title: "Mercado indisponivel", message: ticks.message }) : null, ticks.status === "success" && ticks.data.length === 0 ? _jsx(EmptyPanel, { text: "Nenhum ticker recebido da API." }) : null, ticks.data.map((tick) => (_jsx(MarketTile, { isSubmitting: submittingSymbol === tick.symbol, onSimulate: () => void onSimulate(tick.symbol, tick.price), tick: tick }, tick.symbol)))] })] })] }), _jsx(TrustBand, {}), _jsx("section", { className: `notice ${notice.kind}`, role: notice.kind === "alert" ? "alert" : "status", "aria-live": "polite", children: notice.text }), _jsx(IntelligenceStrip, {}), _jsxs("section", { className: "insight-grid", "aria-label": "Inteligencia de mercado", children: [_jsx(SentimentPanel, { sentiment: sentiment, summary: marketContext }), _jsx(WhaleRadar, { whales: whales }), _jsx(NewsBehaviorPanel, { alerts: alerts, sentiment: sentiment }), _jsx(BotEngine, {})] }), _jsxs("section", { className: "operations-grid", children: [_jsx(SignalsPanel, { signals: signals }), _jsx(ProviderStatusPanel, { providerStatuses: providerStatuses }), _jsx(PositionsPanel, { positions: positions }), _jsx(RiskPanel, {})] }), _jsx(SafetyExplainer, {}), _jsx(FinalCta, { primaryTick: primaryTick, submittingSymbol: submittingSymbol, onSimulate: onSimulate })] }));
}
function TopNav({ activePage, health, isPollingPaused, onNavigate, onOpenCommand, onTogglePolling, wsStatus }) {
    const { user, logout } = useAuth();
    return (_jsxs("nav", { className: "top-nav", "aria-label": "Navegacao principal", children: [_jsxs("button", { className: "brand brand-button", onClick: () => onNavigate("landing"), type: "button", "aria-label": "Voltar para a landing Crypto Sentinel", children: [_jsx("span", { className: "brand-mark", "aria-hidden": "true" }), "Crypto Sentinel"] }), _jsx("div", { className: "nav-links", children: pages.map((page) => (_jsx("button", { "aria-current": activePage === page.id ? "page" : undefined, className: "nav-page", onClick: () => onNavigate(page.id), type: "button", children: page.label }, page.id))) }), _jsxs("div", { className: "nav-status", "aria-label": "Status do sistema", children: [_jsx("span", { className: "status-pill good", children: "Modo paper" }), _jsx("span", { className: "status-pill danger", children: "Operacao real bloqueada" }), _jsxs("span", { className: "api-state", children: ["API ", health.data?.status ?? health.status] }), _jsxs("span", { className: `ws-state ${wsStatus === "connected" ? "ws-connected" : "ws-disconnected"}`, children: ["WS ", wsStatus === "connected" ? "conectado" : wsStatus === "connecting" ? "conectando..." : "desconectado"] }), user && _jsx("span", { className: "user-badge", children: user.name || user.email }), _jsx("button", { className: "ghost-button command-trigger", onClick: onOpenCommand, type: "button", children: "Ctrl K" }), _jsx("button", { className: "ghost-button", onClick: onTogglePolling, type: "button", children: isPollingPaused ? "Retomar updates" : "Pausar updates" }), _jsx("button", { className: "ghost-button", onClick: () => void logout(), type: "button", children: "Sair" })] })] }));
}
function CommandPalette({ activePage, isOpen, onClose, onNavigate }) {
    const [query, setQuery] = useState("");
    const results = useMemo(() => filterCommandItems(pages, query), [query]);
    useEffect(() => {
        if (!isOpen)
            setQuery("");
    }, [isOpen]);
    if (!isOpen)
        return null;
    return (_jsx("div", { className: "command-backdrop", role: "presentation", onMouseDown: onClose, children: _jsxs("section", { "aria-label": "Paleta de comando", "aria-modal": "true", className: "command-palette", onMouseDown: (event) => event.stopPropagation(), role: "dialog", children: [_jsxs("div", { className: "command-input-row", children: [_jsx("span", { "aria-hidden": "true", children: "/" }), _jsx("input", { autoFocus: true, onChange: (event) => setQuery(event.target.value), placeholder: "Buscar pagina, alerta, whale, bot...", type: "search", value: query }), _jsx("kbd", { children: "Esc" })] }), _jsxs("div", { className: "command-results", children: [results.map((page) => (_jsxs("button", { "aria-current": activePage === page.id ? "page" : undefined, className: "command-item", onClick: () => {
                                onNavigate(page.id);
                                onClose();
                            }, type: "button", children: [_jsx("span", { children: page.label }), _jsx("small", { children: page.keywords.join(" / ") })] }, page.id))), results.length === 0 ? _jsx("p", { className: "empty", children: "Nenhum comando encontrado." }) : null] })] }) }));
}
function PageHeader({ eyebrow, title, description }) {
    return (_jsxs("header", { className: "page-header", children: [_jsx("span", { className: "eyebrow", children: eyebrow }), _jsx("h1", { children: title }), _jsx("p", { children: description })] }));
}
function MarketPage({ marketContext, onSimulate, submittingSymbol, ticks }) {
    return (_jsxs("section", { className: "page-view", children: [_jsx(PageHeader, { eyebrow: "Mercado", title: "Painel de leitura BTC e ETH", description: "Acompanhe tickers, variacao, fonte e score agregado antes de abrir qualquer simulacao paper." }), _jsxs("section", { className: "market-grid page-market-grid", "aria-label": "Mercado monitorado", children: [ticks.status === "loading" ? _jsx(SkeletonCards, { count: 2 }) : null, ticks.status === "error" ? _jsx(PanelError, { title: "Mercado indisponivel", message: ticks.message }) : null, ticks.data.map((tick) => (_jsx(MarketTile, { isSubmitting: submittingSymbol === tick.symbol, onSimulate: () => void onSimulate(tick.symbol, tick.price), tick: tick }, tick.symbol)))] }), _jsxs("div", { className: "page-grid two", children: [_jsx(SentimentPanel, { summary: marketContext }), _jsxs("section", { className: "panel table-panel", "aria-labelledby": "market-feed-title", children: [_jsxs("div", { className: "panel-heading", children: [_jsx("span", { className: "eyebrow", children: "Feed de mercado" }), _jsx("h2", { id: "market-feed-title", children: "Ultimos snapshots" })] }), _jsxs("table", { children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Ativo" }), _jsx("th", { children: "Preco" }), _jsx("th", { children: "24h" }), _jsx("th", { children: "Fonte" })] }) }), _jsx("tbody", { children: ticks.data.map((tick) => (_jsxs("tr", { children: [_jsx("td", { children: tick.symbol }), _jsx("td", { children: formatCurrency(tick.price) }), _jsx("td", { className: classForChange(tick.change24hPct), children: formatPercent(tick.change24hPct) }), _jsx("td", { children: tick.source })] }, tick.symbol))) })] })] })] })] }));
}
function SignalsPage({ signals }) {
    return (_jsxs("section", { className: "page-view", children: [_jsx(PageHeader, { eyebrow: "Sinais", title: "Sinais informativos e confluencia tecnica", description: "Acompanhe direcao, confianca e racional. Nenhum sinal desta tela representa instrucao de execucao real." }), _jsxs("div", { className: "page-grid two", children: [_jsx(SignalsPanel, { signals: signals }), _jsx(BotEngine, {})] }), _jsxs("section", { className: "panel", children: [_jsxs("div", { className: "panel-heading", children: [_jsx("span", { className: "eyebrow", children: "Checklist tecnico" }), _jsx("h2", { children: "10 indicadores do motor IA" })] }), _jsx("div", { className: "indicator-grid wide", children: indicatorEngine.map((indicator) => (_jsxs("span", { className: "indicator-chip", children: [_jsx("strong", { children: indicator.label }), indicator.state] }, indicator.label))) })] })] }));
}
function WhalesPage({ whales }) {
    return (_jsxs("section", { className: "page-view", children: [_jsx(PageHeader, { eyebrow: "Baleias", title: "Baleias, grandes carteiras e fluxo para exchanges", description: "Separe acumulacao, liquidez aguardando entrada e possivel pressao de venda antes de confiar em um movimento." }), _jsxs("div", { className: "page-grid two", children: [_jsx(WhaleRadar, { whales: whales }), _jsx(NewsBehaviorPanel, {})] }), _jsxs("section", { className: "panel table-panel", children: [_jsxs("div", { className: "panel-heading", children: [_jsx("span", { className: "eyebrow", children: "Eventos monitorados" }), _jsx("h2", { children: "Fila de whale events" })] }), _jsxs("table", { children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Evento" }), _jsx("th", { children: "Valor" }), _jsx("th", { children: "Leitura" })] }) }), _jsx("tbody", { children: whales.data.map((event) => (_jsxs("tr", { children: [_jsx("td", { children: formatWhaleEventType(event.type) }), _jsx("td", { children: formatCurrency(event.valueUsd) }), _jsx("td", { children: describeWhaleEvent(event) })] }, event.id))) })] })] })] }));
}
function BotPage({ sentiment, signals }) {
    return (_jsxs("section", { className: "page-view", children: [_jsx(PageHeader, { eyebrow: "Bot IA", title: "Motor tecnico-comportamental em modo paper", description: "O bot combina tecnica, noticia, sentimento e comportamento humano para orientar treino. Execucao real permanece bloqueada." }), _jsxs("div", { className: "page-grid two", children: [_jsx(BotEngine, { sentiment: sentiment }), _jsx(SignalsPanel, { signals: signals })] }), _jsx(IntelligenceStrip, {})] }));
}
function AlertsPage({ alerts, whales }) {
    return (_jsxs("section", { className: "page-view", children: [_jsx(PageHeader, { eyebrow: "Alertas", title: "Central de alertas para whales, noticias e risco", description: "Regras operacionais para chamar atencao sem automatizar ordens reais." }), _jsxs("section", { className: "alert-grid", children: [alerts.status === "error" ? _jsx(PanelError, { title: "Alertas indisponiveis", message: alerts.message }) : null, alerts.status === "loading" ? _jsx("p", { className: "empty", children: "Carregando alertas..." }) : null, alerts.status === "success" && alerts.data.length === 0 ? _jsx(EmptyPanel, { text: "Nenhum alerta aberto." }) : null, alerts.data.map((alert) => (_jsxs("article", { className: "panel alert-card", children: [_jsx("span", { className: `status-pill ${alert.status === "OPEN" ? "good" : "planned"}`, children: formatAlertStatus(alert.status) }), _jsx("h2", { children: alert.title }), _jsx("p", { children: alert.message })] }, alert.id)))] }), _jsxs("div", { className: "page-grid two", children: [_jsx(NewsBehaviorPanel, {}), _jsx(WhaleRadar, { whales: whales })] })] }));
}
function RiskRoadmapPage({ paperSummary, positions }) {
    return (_jsxs("section", { className: "page-view", children: [_jsx(PageHeader, { eyebrow: "Risco e backend", title: "Roadmap seguro ate dados reais e pre-live", description: "A evolucao do backend prioriza persistencia, auditoria, idempotencia e validacao paper antes de qualquer execucao real." }), _jsxs("div", { className: "page-grid two", children: [_jsx(RiskPanel, {}), _jsx(PositionsPanel, { positions: positions })] }), _jsx(PaperSummaryPanel, { paperSummary: paperSummary }), _jsx(SafetyExplainer, {}), _jsxs("section", { className: "panel roadmap-panel", children: [_jsxs("div", { className: "panel-heading", children: [_jsx("span", { className: "eyebrow", children: "Backend roadmap" }), _jsx("h2", { children: "Fases recomendadas" })] }), _jsx("ol", { children: backendPhases.map((phase) => (_jsx("li", { children: phase }, phase))) })] })] }));
}
function IntelligenceStrip() {
    return (_jsx("section", { className: "intelligence-strip", "aria-label": "Blocos de inteligencia do produto", children: intelligenceBlocks.map((block) => (_jsxs("article", { className: `intel-card ${block.tone}`, children: [_jsx("span", { children: block.label }), _jsx("strong", { children: block.value })] }, block.label))) }));
}
function TrustBand() {
    return (_jsx("section", { className: "trust-band", "aria-label": "Provas de seguranca do MVP", children: trustProofs.map((proof) => (_jsxs("article", { children: [_jsx("span", { children: proof.label }), _jsx("strong", { children: proof.value })] }, proof.label))) }));
}
function StatusRail({ health, marketContext, paperSummary, positions }) {
    return (_jsxs("aside", { className: "status-rail", "aria-label": "Resumo operacional", children: [_jsxs("div", { children: [_jsx("span", { children: "Status API" }), _jsx("strong", { children: health.data?.status ?? "carregando" }), _jsxs("small", { children: ["Operacao real: ", health.data?.liveTradingEnabled ? "habilitada" : "bloqueada"] })] }), _jsxs("div", { children: [_jsx("span", { children: "Sentimento da tarde" }), _jsxs("strong", { children: [marketContext.score, "/100"] }), _jsx("small", { children: marketContext.label })] }), _jsxs("div", { children: [_jsx("span", { children: "Posicoes paper" }), _jsx("strong", { children: paperSummary?.openPositions ?? positions.length }), _jsx("small", { children: paperSummary ? `${paperSummary.closedTrades} trades fechados` : "Repositorio em memoria" })] })] }));
}
function MarketTile({ isSubmitting, onSimulate, tick }) {
    const changeClass = classForChange(tick.change24hPct);
    return (_jsxs("article", { className: "market-tile", children: [_jsxs("div", { className: "tile-header", children: [_jsxs("div", { children: [_jsx("span", { className: "eyebrow", children: "Ticker" }), _jsx("h2", { children: tick.symbol })] }), _jsx("span", { className: "source-badge", children: tick.source })] }), _jsx("strong", { className: "market-price", children: formatCurrency(tick.price) }), _jsxs("div", { className: "market-meta", children: [_jsx("span", { className: changeClass, children: formatPercent(tick.change24hPct) }), _jsx("span", { children: "24h" })] }), _jsx(Sparkline, { change: tick.change24hPct ?? 0 }), _jsx("button", { "aria-busy": isSubmitting, "aria-label": getAccessiblePaperActionLabel(tick.symbol), className: "primary-action compact", disabled: isSubmitting, onClick: onSimulate, children: isSubmitting ? "Simulando..." : "Simular LONG paper" })] }));
}
function Sparkline({ change }) {
    const trend = change >= 0 ? [32, 28, 30, 22, 24, 16, 18] : [14, 16, 13, 20, 23, 28, 31];
    const points = trend.map((y, index) => `${index * 22},${y}`).join(" ");
    return (_jsx("svg", { className: "sparkline", role: "img", "aria-label": `Tendencia ${change >= 0 ? "positiva" : "negativa"}`, viewBox: "0 0 132 44", children: _jsx("polyline", { points: points }) }));
}
function SentimentPanel({ sentiment, summary }) {
    const score = sentiment?.data?.score ?? summary.score;
    const label = sentiment?.data?.label ?? summary.label;
    return (_jsxs("article", { className: "panel sentiment-panel", children: [_jsxs("div", { className: "panel-heading", children: [_jsx("span", { className: "eyebrow", children: "Sentimento da tarde" }), _jsx("h2", { children: label })] }), _jsx("div", { "aria-label": "Score de sentimento do mercado", "aria-valuemax": 100, "aria-valuemin": 0, "aria-valuenow": score, className: "sentiment-meter", role: "meter", style: { "--score": `${score}%` }, children: _jsx("span", { children: score }) }), _jsxs("dl", { className: "metric-list", children: [_jsxs("div", { children: [_jsx("dt", { children: "Media 24h" }), _jsx("dd", { children: formatPercent(summary.averageChangePct) })] }), _jsxs("div", { children: [_jsx("dt", { children: "Sinais LONG em observacao" }), _jsx("dd", { children: summary.watchLongCount })] })] }), _jsx("p", { className: "panel-note", children: sentiment?.data
                    ? `Fonte ${sentiment.data.source}, atualizado pela API.`
                    : "Score calculado por variacao media e sinais informativos ativos." })] }));
}
function WhaleRadar({ whales }) {
    const rows = whales?.data ?? [];
    return (_jsxs("article", { className: "panel", id: "whales", children: [_jsxs("div", { className: "panel-heading", children: [_jsx("span", { className: "eyebrow", children: "Baleias e grandes carteiras" }), _jsx("h2", { children: "Fluxos de acumulacao e pressao" })] }), _jsx("div", { className: "radar-orbit", "aria-hidden": "true", children: _jsx("span", {}) }), _jsxs("div", { className: "data-rows", children: [whales?.status === "error" ? _jsx(PanelError, { title: "Baleias indisponiveis", message: whales.message }) : null, whales?.status === "loading" ? _jsx("p", { className: "empty", children: "Carregando whale events..." }) : null, rows.length === 0 && whales?.status === "success" ? _jsx("p", { className: "empty", children: "Nenhum evento on-chain recebido." }) : null, rows.map((event) => (_jsxs("div", { className: "data-row", children: [_jsx("span", { children: formatWhaleEventType(event.type) }), _jsx("strong", { children: formatCurrency(event.valueUsd) }), _jsx("small", { children: describeWhaleEvent(event) })] }, event.id)))] })] }));
}
function BotEngine({ sentiment }) {
    return (_jsxs("article", { className: "panel bot-panel", id: "bot", children: [_jsxs("div", { className: "panel-heading", children: [_jsx("span", { className: "eyebrow", children: "Bot IA: noticias, sentimento e tecnica" }), _jsx("h2", { children: "Motor tecnico-comportamental" })] }), _jsx("p", { children: "Cruza noticias, sentimento social, medo/euforia, liquidez e 10 indicadores tecnicos. No MVP, o bot orienta treino em modo paper e nao executa ordens reais." }), sentiment?.data ? _jsxs("p", { className: "panel-note", children: ["Fear/greed atual: ", sentiment.data.score, "/100 (", sentiment.data.label, ")."] }) : null, _jsx("div", { className: "indicator-grid", children: indicatorEngine.map((indicator) => (_jsxs("span", { className: "indicator-chip", children: [_jsx("strong", { children: indicator.label }), indicator.state] }, indicator.label))) })] }));
}
function NewsBehaviorPanel({ alerts, sentiment }) {
    const alertRows = alerts?.data ?? [];
    return (_jsxs("article", { className: "panel news-panel", id: "news", children: [_jsxs("div", { className: "panel-heading", children: [_jsx("span", { className: "eyebrow", children: "Noticias e comportamento humano" }), _jsx("h2", { children: "Narrativas, medo e euforia" })] }), _jsx("p", { children: "A camada narrativa evita olhar apenas para candle: noticia, medo, euforia e liquidez entram como contexto para o score final." }), _jsxs("div", { className: "data-rows", children: [sentiment?.data ? (_jsxs("div", { className: "data-row stacked", children: [_jsx("span", { children: "Fear/greed" }), _jsxs("strong", { children: [sentiment.data.score, "/100"] }), _jsx("small", { children: sentiment.data.label })] })) : null, alertRows.length
                        ? alertRows.slice(0, 3).map((alert) => (_jsxs("div", { className: "data-row stacked", children: [_jsx("span", { children: alert.type }), _jsx("strong", { children: alert.title }), _jsx("small", { children: alert.message })] }, alert.id)))
                        : newsRows.map((row) => (_jsxs("div", { className: "data-row stacked", children: [_jsx("span", { children: row.source }), _jsx("strong", { children: row.signal }), _jsx("small", { children: row.state })] }, row.source)))] })] }));
}
function SignalsPanel({ signals }) {
    return (_jsxs("section", { className: "panel table-panel", id: "signals", "aria-labelledby": "signals-title", children: [_jsxs("div", { className: "panel-heading", children: [_jsx("span", { className: "eyebrow", children: "Sinais informativos" }), _jsx("h2", { id: "signals-title", children: "Leitura atual" })] }), signals.status === "error" ? _jsx(PanelError, { title: "Sinais indisponiveis", message: signals.message }) : null, signals.status === "loading" ? _jsx("p", { className: "empty", children: "Carregando sinais..." }) : null, signals.status === "success" && signals.data.length === 0 ? _jsx("p", { className: "empty", children: "Nenhum sinal informativo." }) : null, signals.data.length ? (_jsxs("table", { children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Ativo" }), _jsx("th", { children: "Status" }), _jsx("th", { children: "Confianca" }), _jsx("th", { children: "Spread" }), _jsx("th", { children: "Fontes" }), _jsx("th", { children: "Racional" })] }) }), _jsx("tbody", { children: signals.data.map((signal) => (_jsxs("tr", { children: [_jsx("td", { children: signal.symbol }), _jsx("td", { children: formatSignalStatus(signal.status) || formatSignalDirection(signal.direction) }), _jsx("td", { children: signal.confidence }), _jsx("td", { children: signal.spreadPct !== undefined ? `${signal.spreadPct.toFixed(3)}%` : "-" }), _jsx("td", { children: signal.sources?.join(", ") || "-" }), _jsx("td", { children: signal.reason ?? signal.rationale })] }, signal.id))) })] })) : null] }));
}
function ProviderStatusPanel({ providerStatuses }) {
    return (_jsxs("section", { className: "panel table-panel", "aria-labelledby": "providers-title", children: [_jsxs("div", { className: "panel-heading", children: [_jsx("span", { className: "eyebrow", children: "Saude das fontes" }), _jsx("h2", { id: "providers-title", children: "Consenso e failover" })] }), providerStatuses.status === "error" ? _jsx(PanelError, { title: "Providers indisponiveis", message: providerStatuses.message }) : null, providerStatuses.status === "loading" ? _jsx("p", { className: "empty", children: "Carregando providers..." }) : null, providerStatuses.status === "success" && providerStatuses.data.length === 0 ? _jsx("p", { className: "empty", children: "Nenhum status de provider recebido." }) : null, providerStatuses.data.length ? (_jsxs("table", { children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Ativo" }), _jsx("th", { children: "Provider" }), _jsx("th", { children: "Qualidade" }), _jsx("th", { children: "Dispersao" }), _jsx("th", { children: "Health" })] }) }), _jsx("tbody", { children: providerStatuses.data.map((status) => {
                            const healthyCount = Object.values(status.providers).filter((provider) => provider.healthy && !provider.stale).length;
                            const totalCount = Object.keys(status.providers).length;
                            return (_jsxs("tr", { children: [_jsx("td", { children: status.symbol }), _jsx("td", { children: status.recommendedProvider ?? "-" }), _jsx("td", { children: status.dataQualityScore.toFixed(1) }), _jsxs("td", { children: [status.disagreementScore.toFixed(2), "%"] }), _jsxs("td", { children: [healthyCount, "/", totalCount] })] }, status.symbol));
                        }) })] })) : null] }));
}
function PositionsPanel({ positions }) {
    return (_jsxs("section", { className: "panel table-panel", "aria-labelledby": "positions-title", children: [_jsxs("div", { className: "panel-heading", children: [_jsx("span", { className: "eyebrow", children: "Posicoes paper simuladas" }), _jsx("h2", { id: "positions-title", children: "Exposicao aberta" })] }), positions.status === "error" ? _jsx(PanelError, { title: "Posicoes indisponiveis", message: positions.message }) : null, positions.status === "loading" ? _jsx("p", { className: "empty", children: "Carregando posicoes..." }) : null, positions.status === "success" && positions.data.length === 0 ? _jsx("p", { className: "empty", children: "Nenhuma posicao paper aberta." }) : null, positions.data.length ? (_jsxs("table", { children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Ativo" }), _jsx("th", { children: "Lado" }), _jsx("th", { children: "Status" }), _jsx("th", { children: "Entrada" }), _jsx("th", { children: "Margem" }), _jsx("th", { children: "Alav." })] }) }), _jsx("tbody", { children: positions.data.map((position) => (_jsxs("tr", { children: [_jsx("td", { children: position.symbol }), _jsx("td", { children: position.side }), _jsx("td", { children: position.status }), _jsx("td", { children: formatCurrency(position.entryPrice) }), _jsx("td", { children: formatCurrency(position.marginUsdt) }), _jsxs("td", { children: [position.leverage, "x"] })] }, position.id))) })] })) : null] }));
}
function RiskPanel() {
    return (_jsxs("aside", { className: "panel risk-panel", "aria-labelledby": "risk-title", children: [_jsxs("div", { className: "panel-heading", children: [_jsx("span", { className: "eyebrow", children: "Checagem de risco" }), _jsx("h2", { id: "risk-title", children: "Circuit breakers ativos" })] }), _jsx("ul", { children: riskRules.map((rule) => (_jsx("li", { children: rule }, rule))) })] }));
}
function PaperSummaryPanel({ paperSummary }) {
    return (_jsxs("section", { className: "trust-band", "aria-label": "Resumo de paper trading", children: [_jsxs("article", { children: [_jsx("span", { children: "Posicoes abertas" }), _jsx("strong", { children: paperSummary.data?.openPositions ?? 0 })] }), _jsxs("article", { children: [_jsx("span", { children: "Trades fechados" }), _jsx("strong", { children: paperSummary.data?.closedTrades ?? 0 })] }), _jsxs("article", { children: [_jsx("span", { children: "PnL realizado" }), _jsx("strong", { children: formatCurrency(paperSummary.data?.realizedPnlUsdt ?? 0) })] }), _jsxs("article", { children: [_jsx("span", { children: "Win rate" }), _jsx("strong", { children: formatPercent(paperSummary.data?.winRatePct ?? 0) })] })] }));
}
function SafetyExplainer() {
    return (_jsxs("section", { className: "safety-explainer", "aria-label": "Avisos e limites do produto", children: [_jsxs("article", { children: [_jsx("span", { className: "eyebrow", children: "O que esta bloqueado?" }), _jsx("h2", { children: "Execucao real continua fora do MVP" }), _jsx("p", { children: "Nenhum fluxo da pagina envia ordem real. A API atual aceita somente modo paper, com stop loss obrigatorio e limites de risco antes de criar uma posicao simulada." })] }), _jsxs("article", { children: [_jsx("span", { className: "eyebrow", children: "Depois da simulacao" }), _jsx("h2", { children: "Validar antes de operar capital" }), _jsx("p", { children: "Criptoativos podem perder valor rapidamente. Operacao real exige endpoints oficiais, armazenamento duravel, chaves criptografadas, reconciliacao e pelo menos 100 trades paper auditados por 30 dias." })] })] }));
}
function FinalCta({ onSimulate, primaryTick, submittingSymbol }) {
    return (_jsxs("section", { className: "final-cta", "aria-labelledby": "final-cta-title", children: [_jsxs("div", { children: [_jsx("span", { className: "eyebrow", children: "Proximo passo" }), _jsx("h2", { id: "final-cta-title", children: "Teste a leitura completa em modo paper" }), _jsx("p", { children: "Use o cockpit para acompanhar mercado, baleias, noticias e sinais tecnicos antes de decidir. A execucao real permanece bloqueada por seguranca." })] }), _jsx("button", { "aria-busy": submittingSymbol === primaryTick?.symbol, "aria-label": primaryTick ? getAccessiblePaperActionLabel(primaryTick.symbol) : "Simular LONG paper indisponivel", className: "primary-action", disabled: !primaryTick || submittingSymbol === primaryTick.symbol, onClick: () => primaryTick && void onSimulate(primaryTick.symbol, primaryTick.price), type: "button", children: submittingSymbol === primaryTick?.symbol ? "Simulando..." : "Testar em paper" })] }));
}
function SkeletonCards({ count }) {
    return Array.from({ length: count }, (_, index) => (_jsxs("article", { className: "market-tile skeleton", "aria-hidden": "true", children: [_jsx("span", {}), _jsx("span", {}), _jsx("span", {})] }, index)));
}
function EmptyPanel({ text }) {
    return _jsx("article", { className: "panel empty-panel", children: text });
}
function PanelError({ message, title }) {
    return (_jsxs("article", { className: "panel-error", role: "alert", children: [_jsx("strong", { children: title }), _jsx("span", { children: message ?? "Tente novamente em instantes." })] }));
}
function BackgroundField() {
    return (_jsxs("div", { className: "background-field", "aria-hidden": "true", children: [_jsx("span", { className: "orbital one" }), _jsx("span", { className: "orbital two" }), _jsx("span", { className: "data-particle a" }), _jsx("span", { className: "data-particle b" }), _jsx("span", { className: "data-particle c" })] }));
}
function applyResult(result, setter, fallback, updatedAt) {
    if (result.status === "fulfilled") {
        setter({ data: result.value, status: "success", updatedAt });
    }
    else {
        setter({ data: fallback, message: getErrorMessage(result.reason), status: "error", updatedAt });
    }
}
function getErrorMessage(error) {
    if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
        return error.message;
    }
    return "Falha inesperada";
}
function appRouteFromHash() {
    return resolveAppRouteFromHash(window.location.hash, pages.map((page) => page.id));
}
