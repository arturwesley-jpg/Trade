import { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense, memo, type CSSProperties } from "react";
import { useClerk, useUser } from "@clerk/clerk-react";
import type { AlertEvent, MarketTick, PaperSummary, Position, ProviderStatusSnapshot, SentimentSnapshot, TradingSignal, WhaleEvent } from "./shared-types.js";
import {
  fetchAlerts,
  fetchHealth,
  fetchMarketTicks,
  fetchPaperSummary,
  fetchPositions,
  fetchProviderStatuses,
  fetchSentimentSnapshot,
  fetchSignals,
  fetchWhaleEvents,
  openPaperOrder,
  type Health
} from "./api.js";
import {
  buildPaperOrderPayload,
  classForChange,
  describeWhaleEvent,
  formatCurrency,
  formatAlertStatus,
  formatPercent,
  formatSignalDirection,
  formatSignalStatus,
  formatWhaleEventType,
  getAccessiblePaperActionLabel,
  filterCommandItems,
  resolveAppRouteFromHash,
  summarizeMarketContext
} from "./view-model.js";
import { useWebSocket, type WebSocketStatus } from "./websocket-client.js";
import { apiBaseUrl } from "./api.js";
import { ErrorBoundary } from "./components/ErrorBoundary.js";
import { ToastContainer, useToast } from "./components/Toast.js";
import { LoginPage } from "./components/LoginPage.js";
import { useTrading } from "./contexts/TradingContext.js";
import { MarketDataWebSocket } from "./services/websocket.js";

// Lazy load Analytics and Admin pages for better performance
const AnalyticsPage = lazy(() => import("./components/AnalyticsPage.js").then(m => ({ default: m.AnalyticsPage })));
const AdminPage = lazy(() => import("./pages/AdminPage.js").then(m => ({ default: m.AdminPage })));

type LoadState<T> = {
  data: T;
  message?: string;
  status: "loading" | "success" | "error";
  updatedAt?: string;
};

type PageId = "dashboard" | "mercado" | "sinais" | "baleias" | "bot" | "alertas" | "risco" | "analytics" | "admin";
type AppRoute = "landing" | PageId;

const pages: Array<{ id: PageId; label: string; keywords: string[] }> = [
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
  health: { data: null as Health | null, status: "loading" as const },
  alerts: { data: [] as AlertEvent[], status: "loading" as const },
  paperSummary: { data: null as PaperSummary | null, status: "loading" as const },
  positions: { data: [] as Position[], status: "loading" as const },
  signals: { data: [] as TradingSignal[], status: "loading" as const },
  sentiment: { data: null as SentimentSnapshot | null, status: "loading" as const },
  providerStatuses: { data: [] as ProviderStatusSnapshot[], status: "loading" as const },
  whales: { data: [] as WhaleEvent[], status: "loading" as const },
  ticks: { data: [] as MarketTick[], status: "loading" as const }
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
    page: "mercado" as PageId
  },
  {
    label: "Baleias",
    title: "Fluxo de grandes carteiras",
    text: "Acompanhe entradas em exchange, acumulacao, stablecoins e sinais de pressao antes do movimento.",
    page: "baleias" as PageId
  },
  {
    label: "Bot IA",
    title: "Tecnica, noticia e comportamento",
    text: "O motor cruza 10 indicadores com narrativas de mercado para orientar treino em modo paper.",
    page: "bot" as PageId
  },
  {
    label: "Alertas",
    title: "Regras para chamar atencao",
    text: "Whales, risco, confluencia tecnica e sentimento extremo ficam organizados em uma central auditavel.",
    page: "alertas" as PageId
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
  const [activeRoute, setActiveRoute] = useState<AppRoute>(() => appRouteFromHash());
  const [demoAccess, setDemoAccess] = useState<boolean>(() => sessionStorage.getItem("demoAccess") === "1");
  const { isLoaded, isSignedIn } = useUser();

  useEffect(() => {
    const handleLocationChange = () => setActiveRoute(appRouteFromHash());
    window.addEventListener("hashchange", handleLocationChange);
    window.addEventListener("popstate", handleLocationChange);
    return () => {
      window.removeEventListener("hashchange", handleLocationChange);
      window.removeEventListener("popstate", handleLocationChange);
    };
  }, []);

  function navigateToRoute(route: AppRoute) {
    setActiveRoute(route);
    const target = route === "landing" ? `${window.location.pathname}${window.location.search}` : `#${route}`;
    window.history.pushState(null, "", target);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (!isLoaded) {
    return (
      <main className="app-shell">
        <BackgroundField />
        <div className="page-view">
          <p className="empty">Carregando...</p>
        </div>
      </main>
    );
  }

  if (!isSignedIn && !demoAccess) {
    return <LoginPage onEnterDemo={() => {
      sessionStorage.setItem("demoAccess", "1");
      setDemoAccess(true);
    }} />;
  }

  if (activeRoute === "landing") {
    return <LandingPage onEnter={() => navigateToRoute("dashboard")} onNavigate={navigateToRoute} />;
  }

  return <TradingHub activePage={activeRoute} onNavigate={navigateToRoute} />;
}

const TradingHub = memo(function TradingHub({
  activePage,
  onNavigate
}: {
  activePage: PageId;
  onNavigate: (route: AppRoute) => void;
}) {
  const [alerts, setAlerts] = useState<LoadState<AlertEvent[]>>(initialState.alerts);
  const [health, setHealth] = useState<LoadState<Health | null>>(initialState.health);
  const [paperSummary, setPaperSummary] = useState<LoadState<PaperSummary | null>>(initialState.paperSummary);
  const [ticks, setTicks] = useState<LoadState<MarketTick[]>>(initialState.ticks);
  const [signals, setSignals] = useState<LoadState<TradingSignal[]>>(initialState.signals);
  const [sentiment, setSentiment] = useState<LoadState<SentimentSnapshot | null>>(initialState.sentiment);
  const [providerStatuses, setProviderStatuses] = useState<LoadState<ProviderStatusSnapshot[]>>(initialState.providerStatuses);
  const [whales, setWhales] = useState<LoadState<WhaleEvent[]>>(initialState.whales);
  const [positions, setPositions] = useState<LoadState<Position[]>>(initialState.positions);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [isPollingPaused, setIsPollingPaused] = useState(false);
  const [submittingSymbol, setSubmittingSymbol] = useState<string | null>(null);
  const [wsStatus, setWsStatus] = useState<WebSocketStatus>("connecting");
  const [notice, setNotice] = useState({
    kind: "status" as "status" | "alert",
    text: "Modo paper ativo: nenhuma ordem real sera enviada."
  });
  const refreshId = useRef(0);
  const toast = useToast();
  const trading = useTrading();
  const marketDataWsRef = useRef<MarketDataWebSocket | null>(null);

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
        const statusMap: Record<typeof state, WebSocketStatus> = {
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
  useWebSocket({
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

    const [
      healthResult,
      ticksResult,
      signalsResult,
      providerStatusesResult,
      positionsResult,
      alertsResult,
      sentimentResult,
      whalesResult,
      paperSummaryResult
    ] = await Promise.allSettled([
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

    if (refreshId.current !== requestId) return;
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
    if (isPollingPaused) return;
    const interval = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(interval);
  }, [isPollingPaused, refresh]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
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

  async function simulateLong(symbol: string, price: number) {
    setSubmittingSymbol(symbol);
    try {
      await openPaperOrder(buildPaperOrderPayload(symbol, price));
      setNotice({
        kind: "status",
        text: `Posicao paper simulada aberta para ${symbol}. Checagem de risco aprovada.`
      });
      toast.success(`Posição paper aberta: ${symbol} @ ${formatCurrency(price)}`);
      await refresh();
    } catch (error) {
      setNotice({
        kind: "alert",
        text: `Simulacao bloqueada pela checagem de risco: ${getErrorMessage(error)}`
      });
      toast.error(`Erro: ${getErrorMessage(error)}`);
    } finally {
      setSubmittingSymbol(null);
    }
  }

  return (
    <main className="app-shell">
      <ErrorBoundary>
        <BackgroundField />
        <TopNav
          activePage={activePage}
          health={health}
          isPollingPaused={isPollingPaused}
          onNavigate={onNavigate}
          onOpenCommand={() => setIsCommandOpen(true)}
          onTogglePolling={() => setIsPollingPaused((value) => !value)}
          wsStatus={wsStatus}
        />

        <CommandPalette
          activePage={activePage}
          isOpen={isCommandOpen}
          onClose={() => setIsCommandOpen(false)}
          onNavigate={(page) => onNavigate(page)}
        />

        {activePage === "dashboard" ? (
          <DashboardPage
            alerts={alerts}
            health={health}
            marketContext={marketContext}
            notice={notice}
            onSimulate={simulateLong}
            onNavigate={onNavigate}
            paperSummary={paperSummary}
            positions={positions}
            primaryTick={primaryTick}
            providerStatuses={providerStatuses}
            signals={signals}
            sentiment={sentiment}
            submittingSymbol={submittingSymbol}
            ticks={ticks}
            whales={whales}
          />
        ) : null}

        {activePage === "analytics" ? (
          <Suspense fallback={<div className="page-view"><p className="empty">Carregando Analytics...</p></div>}>
            <AnalyticsPage positions={positions.data} paperSummary={paperSummary.data} />
          </Suspense>
        ) : null}

        {activePage === "admin" ? (
          <Suspense fallback={<div className="page-view"><p className="empty">Carregando Admin...</p></div>}>
            <AdminPage />
          </Suspense>
        ) : null}

        {activePage === "mercado" ? (
          <MarketPage
            marketContext={marketContext}
            onSimulate={simulateLong}
            submittingSymbol={submittingSymbol}
            ticks={ticks}
          />
        ) : null}

        {activePage === "sinais" ? <SignalsPage signals={signals} /> : null}
        {activePage === "baleias" ? <WhalesPage whales={whales} /> : null}
        {activePage === "bot" ? <BotPage sentiment={sentiment} signals={signals} /> : null}
        {activePage === "alertas" ? <AlertsPage alerts={alerts} whales={whales} /> : null}
        {activePage === "risco" ? <RiskRoadmapPage paperSummary={paperSummary} positions={positions} /> : null}

        <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
      </ErrorBoundary>
    </main>
  );
});

function LandingPage({
  onEnter,
  onNavigate
}: {
  onEnter: () => void;
  onNavigate: (route: AppRoute) => void;
}) {
  function scrollToLandingSection(sectionId: string) {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <main className="landing-shell">
      <BackgroundField />
      <nav className="landing-nav" aria-label="Navegacao da landing page">
        <button className="landing-brand" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} type="button">
          <span className="brand-mark" aria-hidden="true" />
          Crypto Sentinel
        </button>
        <div className="landing-nav-links">
          <button onClick={() => scrollToLandingSection("landing-sentimento")} type="button">
            Sentimento
          </button>
          <button onClick={() => scrollToLandingSection("landing-modulos")} type="button">
            Baleias
          </button>
          <button onClick={() => scrollToLandingSection("landing-bot")} type="button">
            Bot IA
          </button>
          <button onClick={() => scrollToLandingSection("landing-seguranca")} type="button">
            Seguranca
          </button>
        </div>
        <button className="landing-nav-cta" onClick={onEnter} type="button">
          Entrar
        </button>
      </nav>

      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-hero-copy">
          <h1 id="landing-title">Leia o mercado cripto antes do movimento</h1>
          <p>
            Uma central de inteligencia para acompanhar sinais tecnicos, sentimento, noticias e movimentos de grandes
            carteiras antes de treinar decisoes no modo paper.
          </p>
          <div className="landing-actions">
            <button className="landing-enter" onClick={onEnter} type="button">
              ENTRAR
            </button>
            <button className="landing-secondary" onClick={() => scrollToLandingSection("landing-modulos")} type="button">
              Ver modulos
            </button>
          </div>
          <div className="landing-proof-line" aria-label="Provas de seguranca">
            <span>Paper-first</span>
            <span>Live bloqueado</span>
            <span>Stop obrigatorio</span>
          </div>
        </div>

        <div className="landing-cockpit" aria-label="Previa visual do hub de solucoes">
          <div className="cockpit-orbit" aria-hidden="true" />
          <div className="cockpit-header">
            <span>Sentimento</span>
            <strong>64/100</strong>
          </div>
          <div className="cockpit-wave" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="cockpit-grid">
            <article>
              <span>Whale flow</span>
              <strong>$18.4M</strong>
              <small>pressao em exchange</small>
            </article>
            <article>
              <span>Bot IA</span>
              <strong>10 sinais</strong>
              <small>tecnica + noticias</small>
            </article>
            <article>
              <span>Risco</span>
              <strong>bloqueado</strong>
              <small>sem ordem real</small>
            </article>
          </div>
        </div>
      </section>

      <section className="landing-story" id="landing-sentimento" aria-labelledby="landing-problem-title">
        <div>
          <h2 id="landing-problem-title">Mercado rapido demais para sinais espalhados</h2>
          <p>
            Preco, noticia, medo, euforia, volume e baleias mudam em ritmos diferentes. O Crypto Sentinel organiza esse
            contexto em uma jornada unica antes de qualquer simulacao.
          </p>
        </div>
        <div className="landing-story-rail">
          <span>01 Mercado</span>
          <span>02 Sentimento</span>
          <span>03 Confluencia</span>
          <span>04 Paper</span>
        </div>
      </section>

      <section className="landing-modules" id="landing-modulos" aria-labelledby="landing-modules-title">
        <div className="landing-section-heading">
          <h2 id="landing-modules-title">Hub de solucoes conectado</h2>
          <p>Cada modulo abre uma area do cockpit ja criada para navegar sem perder contexto.</p>
        </div>
        <div className="landing-module-grid">
          {landingModules.map((module) => (
            <article className="landing-module" key={module.label}>
              <span>{module.label}</span>
              <h3>{module.title}</h3>
              <p>{module.text}</p>
              <button onClick={() => onNavigate(module.page)} type="button">
                Abrir {module.label}
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-engine" id="landing-bot" aria-labelledby="landing-engine-title">
        <div>
          <h2 id="landing-engine-title">Motor IA com os 10 indicadores principais</h2>
          <p>
            RSI, MACD, medias, Bollinger, volume, estocastico, ADX, OBV, ATR e suporte/resistencia entram como sinais
            informativos para treino, nao como promessa de execucao automatica.
          </p>
          <button className="landing-secondary solid" onClick={() => onNavigate("sinais")} type="button">
            Ver sinais
          </button>
        </div>
        <div className="landing-indicators">
          {indicatorEngine.map((indicator) => (
            <span key={indicator.label}>
              <strong>{indicator.label}</strong>
              {indicator.state}
            </span>
          ))}
        </div>
      </section>

      <section className="landing-testimonials" aria-labelledby="landing-testimonials-title">
        <div className="landing-section-heading compact">
          <h2 id="landing-testimonials-title">Depoimentos de treino beta</h2>
          <p>Feedback anonimo e conservador, focado em clareza operacional e modo treinamento.</p>
        </div>
        <div className="landing-testimonial-grid">
          {landingTestimonials.map((testimonial) => (
            <figure className="landing-testimonial" key={testimonial.quote}>
              <blockquote>{testimonial.quote}</blockquote>
              <figcaption>
                <strong>{testimonial.name}</strong>
                <span>{testimonial.role}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="landing-safety" id="landing-seguranca" aria-labelledby="landing-safety-title">
        <div>
          <h2 id="landing-safety-title">Projetado para treinar primeiro, operar depois</h2>
          <p>
            O produto evita atalhos perigosos: sinais sao informativos, live trading fica bloqueado e o roadmap exige
            persistencia, auditoria, idempotencia e validacao paper antes de qualquer pre-live.
          </p>
        </div>
        <div className="landing-safety-grid">
          {trustProofs.map((proof) => (
            <article key={proof.label}>
              <span>{proof.label}</span>
              <strong>{proof.value}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-final" aria-labelledby="landing-final-title">
        <h2 id="landing-final-title">Entre no hub e comece pelo modo treinamento</h2>
        <p>Ferramenta auxiliar para leitura de mercado. Nao e recomendacao financeira e nao garante resultados.</p>
        <button className="landing-enter" onClick={onEnter} type="button">
          ENTRAR
        </button>
      </section>
    </main>
  );
}

function DashboardPage({
  alerts,
  health,
  marketContext,
  notice,
  onSimulate,
  onNavigate,
  paperSummary,
  positions,
  primaryTick,
  providerStatuses,
  signals,
  sentiment,
  submittingSymbol,
  ticks,
  whales
}: {
  alerts: LoadState<AlertEvent[]>;
  health: LoadState<Health | null>;
  marketContext: ReturnType<typeof summarizeMarketContext>;
  notice: { kind: "status" | "alert"; text: string };
  onSimulate: (symbol: string, price: number) => Promise<void>;
  onNavigate: (route: AppRoute) => void;
  paperSummary: LoadState<PaperSummary | null>;
  positions: LoadState<Position[]>;
  primaryTick?: MarketTick;
  providerStatuses: LoadState<ProviderStatusSnapshot[]>;
  signals: LoadState<TradingSignal[]>;
  sentiment: LoadState<SentimentSnapshot | null>;
  submittingSymbol: string | null;
  ticks: LoadState<MarketTick[]>;
  whales: LoadState<WhaleEvent[]>;
}) {
  return (
    <>
      <section className="hero-cockpit" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="system-label">Trade Lab / Modo Paper</p>
          <h1 id="hero-title">Sentimento da tarde antes do proximo movimento</h1>
          <p className="lead">
            Acompanhe mercado, baleias, grandes carteiras, noticias e comportamento humano em um cockpit futuristico. O
            bot cruza 10 indicadores tecnicos para treinar decisoes sem expor capital real.
          </p>
          <div className="hero-actions">
            <button
              aria-busy={submittingSymbol === primaryTick?.symbol}
              aria-label={primaryTick ? getAccessiblePaperActionLabel(primaryTick.symbol) : "Simular LONG paper indisponivel"}
              className="primary-action"
              disabled={!primaryTick || submittingSymbol === primaryTick.symbol}
              onClick={() => primaryTick && void onSimulate(primaryTick.symbol, primaryTick.price)}
            >
              {submittingSymbol === primaryTick?.symbol ? "Simulando..." : "Simular primeira entrada"}
            </button>
            <button className="secondary-action" onClick={() => onNavigate("sinais")} type="button">
              Ver sinais
            </button>
          </div>
          <p className="safety-note">Ambiente paper-first. Sinais informativos. Nenhuma ordem real e enviada.</p>
        </div>

        <div className="hero-dashboard">
          <StatusRail health={health} marketContext={marketContext} paperSummary={paperSummary.data} positions={positions.data} />
          <section className="market-grid" id="market" aria-label="Mercado monitorado">
            {ticks.status === "loading" ? (
              <>
                <p className="sr-only" role="status">
                  Carregando mercado monitorado...
                </p>
                <SkeletonCards count={2} />
              </>
            ) : null}
            {ticks.status === "error" ? <PanelError title="Mercado indisponivel" message={ticks.message} /> : null}
            {ticks.status === "success" && ticks.data.length === 0 ? <EmptyPanel text="Nenhum ticker recebido da API." /> : null}
            {ticks.data.map((tick) => (
              <MarketTile
                key={tick.symbol}
                isSubmitting={submittingSymbol === tick.symbol}
                onSimulate={() => void onSimulate(tick.symbol, tick.price)}
                tick={tick}
              />
            ))}
          </section>
        </div>
      </section>

      <TrustBand />

      <section className={`notice ${notice.kind}`} role={notice.kind === "alert" ? "alert" : "status"} aria-live="polite">
        {notice.text}
      </section>

      <IntelligenceStrip />

      <section className="insight-grid" aria-label="Inteligencia de mercado">
        <SentimentPanel sentiment={sentiment} summary={marketContext} />
        <WhaleRadar whales={whales} />
        <NewsBehaviorPanel alerts={alerts} sentiment={sentiment} />
        <BotEngine />
      </section>

      <section className="operations-grid">
        <SignalsPanel signals={signals} />
        <ProviderStatusPanel providerStatuses={providerStatuses} />
        <PositionsPanel positions={positions} />
        <RiskPanel />
      </section>

      <SafetyExplainer />

      <FinalCta primaryTick={primaryTick} submittingSymbol={submittingSymbol} onSimulate={onSimulate} />
    </>
  );
}

function TopNav({
  activePage,
  health,
  isPollingPaused,
  onNavigate,
  onOpenCommand,
  onTogglePolling,
  wsStatus
}: {
  activePage: PageId;
  health: LoadState<Health | null>;
  isPollingPaused: boolean;
  onNavigate: (route: AppRoute) => void;
  onOpenCommand: () => void;
  onTogglePolling: () => void;
  wsStatus: WebSocketStatus;
}) {
  const { user } = useUser();
  const { signOut } = useClerk();

  return (
    <nav className="top-nav" aria-label="Navegacao principal">
      <button className="brand brand-button" onClick={() => onNavigate("landing")} type="button" aria-label="Voltar para a landing Crypto Sentinel">
        <span className="brand-mark" aria-hidden="true" />
        Crypto Sentinel
      </button>
      <div className="nav-links">
        {pages.map((page) => (
          <button
            aria-current={activePage === page.id ? "page" : undefined}
            className="nav-page"
            key={page.id}
            onClick={() => onNavigate(page.id)}
            type="button"
          >
            {page.label}
          </button>
        ))}
      </div>
      <div className="nav-status" aria-label="Status do sistema">
        <span className="status-pill good">Modo paper</span>
        <span className="status-pill danger">Operacao real bloqueada</span>
        <span className="api-state">API {health.data?.status ?? health.status}</span>
        <span className={`ws-state ${wsStatus === "connected" ? "ws-connected" : "ws-disconnected"}`}>
          WS {wsStatus === "connected" ? "conectado" : wsStatus === "connecting" ? "conectando..." : "desconectado"}
        </span>
        {user && <span className="user-badge">{user.fullName || user.primaryEmailAddress?.emailAddress || user.id}</span>}
        <button className="ghost-button command-trigger" onClick={onOpenCommand} type="button">
          Ctrl K
        </button>
        <button className="ghost-button" onClick={onTogglePolling} type="button">
          {isPollingPaused ? "Retomar updates" : "Pausar updates"}
        </button>
        <button className="ghost-button" onClick={() => void signOut()} type="button">
          Sair
        </button>
      </div>
    </nav>
  );
}

function CommandPalette({
  activePage,
  isOpen,
  onClose,
  onNavigate
}: {
  activePage: PageId;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (page: PageId) => void;
}) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => filterCommandItems(pages, query), [query]);

  useEffect(() => {
    if (!isOpen) setQuery("");
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="command-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-label="Paleta de comando"
        aria-modal="true"
        className="command-palette"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="command-input-row">
          <span aria-hidden="true">/</span>
          <input
            autoFocus
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar pagina, alerta, whale, bot..."
            type="search"
            value={query}
          />
          <kbd>Esc</kbd>
        </div>
        <div className="command-results">
          {results.map((page) => (
            <button
              aria-current={activePage === page.id ? "page" : undefined}
              className="command-item"
              key={page.id}
              onClick={() => {
                onNavigate(page.id);
                onClose();
              }}
              type="button"
            >
              <span>{page.label}</span>
              <small>{page.keywords.join(" / ")}</small>
            </button>
          ))}
          {results.length === 0 ? <p className="empty">Nenhum comando encontrado.</p> : null}
        </div>
      </section>
    </div>
  );
}

function PageHeader({
  eyebrow,
  title,
  description
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="page-header">
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  );
}

function MarketPage({
  marketContext,
  onSimulate,
  submittingSymbol,
  ticks
}: {
  marketContext: ReturnType<typeof summarizeMarketContext>;
  onSimulate: (symbol: string, price: number) => Promise<void>;
  submittingSymbol: string | null;
  ticks: LoadState<MarketTick[]>;
}) {
  return (
    <section className="page-view">
      <PageHeader
        eyebrow="Mercado"
        title="Painel de leitura BTC e ETH"
        description="Acompanhe tickers, variacao, fonte e score agregado antes de abrir qualquer simulacao paper."
      />
      <section className="market-grid page-market-grid" aria-label="Mercado monitorado">
        {ticks.status === "loading" ? <SkeletonCards count={2} /> : null}
        {ticks.status === "error" ? <PanelError title="Mercado indisponivel" message={ticks.message} /> : null}
        {ticks.data.map((tick) => (
          <MarketTile
            key={tick.symbol}
            isSubmitting={submittingSymbol === tick.symbol}
            onSimulate={() => void onSimulate(tick.symbol, tick.price)}
            tick={tick}
          />
        ))}
      </section>
      <div className="page-grid two">
        <SentimentPanel summary={marketContext} />
        <section className="panel table-panel" aria-labelledby="market-feed-title">
          <div className="panel-heading">
            <span className="eyebrow">Feed de mercado</span>
            <h2 id="market-feed-title">Ultimos snapshots</h2>
          </div>
          <table>
            <thead>
              <tr>
                <th>Ativo</th>
                <th>Preco</th>
                <th>24h</th>
                <th>Fonte</th>
              </tr>
            </thead>
            <tbody>
              {ticks.data.map((tick) => (
                <tr key={tick.symbol}>
                  <td>{tick.symbol}</td>
                  <td>{formatCurrency(tick.price)}</td>
                  <td className={classForChange(tick.change24hPct)}>{formatPercent(tick.change24hPct)}</td>
                  <td>{tick.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </section>
  );
}

function SignalsPage({ signals }: { signals: LoadState<TradingSignal[]> }) {
  return (
    <section className="page-view">
      <PageHeader
        eyebrow="Sinais"
        title="Sinais informativos e confluencia tecnica"
        description="Acompanhe direcao, confianca e racional. Nenhum sinal desta tela representa instrucao de execucao real."
      />
      <div className="page-grid two">
        <SignalsPanel signals={signals} />
        <BotEngine />
      </div>
      <section className="panel">
        <div className="panel-heading">
          <span className="eyebrow">Checklist tecnico</span>
          <h2>10 indicadores do motor IA</h2>
        </div>
        <div className="indicator-grid wide">
          {indicatorEngine.map((indicator) => (
            <span className="indicator-chip" key={indicator.label}>
              <strong>{indicator.label}</strong>
              {indicator.state}
            </span>
          ))}
        </div>
      </section>
    </section>
  );
}

function WhalesPage({ whales }: { whales: LoadState<WhaleEvent[]> }) {
  return (
    <section className="page-view">
      <PageHeader
        eyebrow="Baleias"
        title="Baleias, grandes carteiras e fluxo para exchanges"
        description="Separe acumulacao, liquidez aguardando entrada e possivel pressao de venda antes de confiar em um movimento."
      />
      <div className="page-grid two">
        <WhaleRadar whales={whales} />
        <NewsBehaviorPanel />
      </div>
      <section className="panel table-panel">
        <div className="panel-heading">
          <span className="eyebrow">Eventos monitorados</span>
          <h2>Fila de whale events</h2>
        </div>
        <table>
          <thead>
            <tr>
              <th>Evento</th>
              <th>Valor</th>
              <th>Leitura</th>
            </tr>
          </thead>
          <tbody>
            {whales.data.map((event) => (
              <tr key={event.id}>
                <td>{formatWhaleEventType(event.type)}</td>
                <td>{formatCurrency(event.valueUsd)}</td>
                <td>{describeWhaleEvent(event)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </section>
  );
}

function BotPage({ sentiment, signals }: { sentiment: LoadState<SentimentSnapshot | null>; signals: LoadState<TradingSignal[]> }) {
  return (
    <section className="page-view">
      <PageHeader
        eyebrow="Bot IA"
        title="Motor tecnico-comportamental em modo paper"
        description="O bot combina tecnica, noticia, sentimento e comportamento humano para orientar treino. Execucao real permanece bloqueada."
      />
      <div className="page-grid two">
        <BotEngine sentiment={sentiment} />
        <SignalsPanel signals={signals} />
      </div>
      <IntelligenceStrip />
    </section>
  );
}

function AlertsPage({ alerts, whales }: { alerts: LoadState<AlertEvent[]>; whales: LoadState<WhaleEvent[]> }) {
  return (
    <section className="page-view">
      <PageHeader
        eyebrow="Alertas"
        title="Central de alertas para whales, noticias e risco"
        description="Regras operacionais para chamar atencao sem automatizar ordens reais."
      />
      <section className="alert-grid">
        {alerts.status === "error" ? <PanelError title="Alertas indisponiveis" message={alerts.message} /> : null}
        {alerts.status === "loading" ? <p className="empty">Carregando alertas...</p> : null}
        {alerts.status === "success" && alerts.data.length === 0 ? <EmptyPanel text="Nenhum alerta aberto." /> : null}
        {alerts.data.map((alert) => (
          <article className="panel alert-card" key={alert.id}>
            <span className={`status-pill ${alert.status === "OPEN" ? "good" : "planned"}`}>{formatAlertStatus(alert.status)}</span>
            <h2>{alert.title}</h2>
            <p>{alert.message}</p>
          </article>
        ))}
      </section>
      <div className="page-grid two">
        <NewsBehaviorPanel />
        <WhaleRadar whales={whales} />
      </div>
    </section>
  );
}

function RiskRoadmapPage({ paperSummary, positions }: { paperSummary: LoadState<PaperSummary | null>; positions: LoadState<Position[]> }) {
  return (
    <section className="page-view">
      <PageHeader
        eyebrow="Risco e backend"
        title="Roadmap seguro ate dados reais e pre-live"
        description="A evolucao do backend prioriza persistencia, auditoria, idempotencia e validacao paper antes de qualquer execucao real."
      />
      <div className="page-grid two">
        <RiskPanel />
        <PositionsPanel positions={positions} />
      </div>
      <PaperSummaryPanel paperSummary={paperSummary} />
      <SafetyExplainer />
      <section className="panel roadmap-panel">
        <div className="panel-heading">
          <span className="eyebrow">Backend roadmap</span>
          <h2>Fases recomendadas</h2>
        </div>
        <ol>
          {backendPhases.map((phase) => (
            <li key={phase}>{phase}</li>
          ))}
        </ol>
      </section>
    </section>
  );
}

function IntelligenceStrip() {
  return (
    <section className="intelligence-strip" aria-label="Blocos de inteligencia do produto">
      {intelligenceBlocks.map((block) => (
        <article className={`intel-card ${block.tone}`} key={block.label}>
          <span>{block.label}</span>
          <strong>{block.value}</strong>
        </article>
      ))}
    </section>
  );
}

function TrustBand() {
  return (
    <section className="trust-band" aria-label="Provas de seguranca do MVP">
      {trustProofs.map((proof) => (
        <article key={proof.label}>
          <span>{proof.label}</span>
          <strong>{proof.value}</strong>
        </article>
      ))}
    </section>
  );
}

function StatusRail({
  health,
  marketContext,
  paperSummary,
  positions
}: {
  health: LoadState<Health | null>;
  marketContext: ReturnType<typeof summarizeMarketContext>;
  paperSummary: PaperSummary | null;
  positions: Position[];
}) {
  return (
    <aside className="status-rail" aria-label="Resumo operacional">
      <div>
        <span>Status API</span>
        <strong>{health.data?.status ?? "carregando"}</strong>
        <small>Operacao real: {health.data?.liveTradingEnabled ? "habilitada" : "bloqueada"}</small>
      </div>
      <div>
        <span>Sentimento da tarde</span>
        <strong>{marketContext.score}/100</strong>
        <small>{marketContext.label}</small>
      </div>
      <div>
        <span>Posicoes paper</span>
        <strong>{paperSummary?.openPositions ?? positions.length}</strong>
        <small>{paperSummary ? `${paperSummary.closedTrades} trades fechados` : "Repositorio em memoria"}</small>
      </div>
    </aside>
  );
}

function MarketTile({
  isSubmitting,
  onSimulate,
  tick
}: {
  isSubmitting: boolean;
  onSimulate: () => void;
  tick: MarketTick;
}) {
  const changeClass = classForChange(tick.change24hPct);

  return (
    <article className="market-tile">
      <div className="tile-header">
        <div>
          <span className="eyebrow">Ticker</span>
          <h2>{tick.symbol}</h2>
        </div>
        <span className="source-badge">{tick.source}</span>
      </div>
      <strong className="market-price">{formatCurrency(tick.price)}</strong>
      <div className="market-meta">
        <span className={changeClass}>{formatPercent(tick.change24hPct)}</span>
        <span>24h</span>
      </div>
      <Sparkline change={tick.change24hPct ?? 0} />
      <button
        aria-busy={isSubmitting}
        aria-label={getAccessiblePaperActionLabel(tick.symbol)}
        className="primary-action compact"
        disabled={isSubmitting}
        onClick={onSimulate}
      >
        {isSubmitting ? "Simulando..." : "Simular LONG paper"}
      </button>
    </article>
  );
}

function Sparkline({ change }: { change: number }) {
  const trend = change >= 0 ? [32, 28, 30, 22, 24, 16, 18] : [14, 16, 13, 20, 23, 28, 31];
  const points = trend.map((y, index) => `${index * 22},${y}`).join(" ");
  return (
    <svg className="sparkline" role="img" aria-label={`Tendencia ${change >= 0 ? "positiva" : "negativa"}`} viewBox="0 0 132 44">
      <polyline points={points} />
    </svg>
  );
}

function SentimentPanel({
  sentiment,
  summary
}: {
  sentiment?: LoadState<SentimentSnapshot | null>;
  summary: ReturnType<typeof summarizeMarketContext>;
}) {
  const score = sentiment?.data?.score ?? summary.score;
  const label = sentiment?.data?.label ?? summary.label;

  return (
    <article className="panel sentiment-panel">
      <div className="panel-heading">
        <span className="eyebrow">Sentimento da tarde</span>
        <h2>{label}</h2>
      </div>
      <div
        aria-label="Score de sentimento do mercado"
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={score}
        className="sentiment-meter"
        role="meter"
        style={{ "--score": `${score}%` } as CSSProperties}
      >
        <span>{score}</span>
      </div>
      <dl className="metric-list">
        <div>
          <dt>Media 24h</dt>
          <dd>{formatPercent(summary.averageChangePct)}</dd>
        </div>
        <div>
          <dt>Sinais LONG em observacao</dt>
          <dd>{summary.watchLongCount}</dd>
        </div>
      </dl>
      <p className="panel-note">
        {sentiment?.data
          ? `Fonte ${sentiment.data.source}, atualizado pela API.`
          : "Score calculado por variacao media e sinais informativos ativos."}
      </p>
    </article>
  );
}

function WhaleRadar({ whales }: { whales?: LoadState<WhaleEvent[]> }) {
  const rows = whales?.data ?? [];

  return (
    <article className="panel" id="whales">
      <div className="panel-heading">
        <span className="eyebrow">Baleias e grandes carteiras</span>
        <h2>Fluxos de acumulacao e pressao</h2>
      </div>
      <div className="radar-orbit" aria-hidden="true">
        <span />
      </div>
      <div className="data-rows">
        {whales?.status === "error" ? <PanelError title="Baleias indisponiveis" message={whales.message} /> : null}
        {whales?.status === "loading" ? <p className="empty">Carregando whale events...</p> : null}
        {rows.length === 0 && whales?.status === "success" ? <p className="empty">Nenhum evento on-chain recebido.</p> : null}
        {rows.map((event) => (
          <div className="data-row" key={event.id}>
            <span>{formatWhaleEventType(event.type)}</span>
            <strong>{formatCurrency(event.valueUsd)}</strong>
            <small>{describeWhaleEvent(event)}</small>
          </div>
        ))}
      </div>
    </article>
  );
}

function BotEngine({ sentiment }: { sentiment?: LoadState<SentimentSnapshot | null> }) {
  return (
    <article className="panel bot-panel" id="bot">
      <div className="panel-heading">
        <span className="eyebrow">Bot IA: noticias, sentimento e tecnica</span>
        <h2>Motor tecnico-comportamental</h2>
      </div>
      <p>
        Cruza noticias, sentimento social, medo/euforia, liquidez e 10 indicadores tecnicos. No MVP, o bot orienta
        treino em modo paper e nao executa ordens reais.
      </p>
      {sentiment?.data ? <p className="panel-note">Fear/greed atual: {sentiment.data.score}/100 ({sentiment.data.label}).</p> : null}
      <div className="indicator-grid">
        {indicatorEngine.map((indicator) => (
          <span className="indicator-chip" key={indicator.label}>
            <strong>{indicator.label}</strong>
            {indicator.state}
          </span>
        ))}
      </div>
    </article>
  );
}

function NewsBehaviorPanel({
  alerts,
  sentiment
}: {
  alerts?: LoadState<AlertEvent[]>;
  sentiment?: LoadState<SentimentSnapshot | null>;
}) {
  const alertRows = alerts?.data ?? [];

  return (
    <article className="panel news-panel" id="news">
      <div className="panel-heading">
        <span className="eyebrow">Noticias e comportamento humano</span>
        <h2>Narrativas, medo e euforia</h2>
      </div>
      <p>
        A camada narrativa evita olhar apenas para candle: noticia, medo, euforia e liquidez entram como contexto para
        o score final.
      </p>
      <div className="data-rows">
        {sentiment?.data ? (
          <div className="data-row stacked">
            <span>Fear/greed</span>
            <strong>{sentiment.data.score}/100</strong>
            <small>{sentiment.data.label}</small>
          </div>
        ) : null}
        {alertRows.length
          ? alertRows.slice(0, 3).map((alert) => (
              <div className="data-row stacked" key={alert.id}>
                <span>{alert.type}</span>
                <strong>{alert.title}</strong>
                <small>{alert.message}</small>
              </div>
            ))
          : newsRows.map((row) => (
              <div className="data-row stacked" key={row.source}>
                <span>{row.source}</span>
                <strong>{row.signal}</strong>
                <small>{row.state}</small>
              </div>
            ))}
      </div>
    </article>
  );
}

function SignalsPanel({ signals }: { signals: LoadState<TradingSignal[]> }) {
  return (
    <section className="panel table-panel" id="signals" aria-labelledby="signals-title">
      <div className="panel-heading">
        <span className="eyebrow">Sinais informativos</span>
        <h2 id="signals-title">Leitura atual</h2>
      </div>
      {signals.status === "error" ? <PanelError title="Sinais indisponiveis" message={signals.message} /> : null}
      {signals.status === "loading" ? <p className="empty">Carregando sinais...</p> : null}
      {signals.status === "success" && signals.data.length === 0 ? <p className="empty">Nenhum sinal informativo.</p> : null}
      {signals.data.length ? (
        <table>
          <thead>
            <tr>
              <th>Ativo</th>
              <th>Status</th>
              <th>Confianca</th>
              <th>Spread</th>
              <th>Fontes</th>
              <th>Racional</th>
            </tr>
          </thead>
          <tbody>
            {signals.data.map((signal) => (
              <tr key={signal.id}>
                <td>{signal.symbol}</td>
                <td>{formatSignalStatus(signal.status) || formatSignalDirection(signal.direction)}</td>
                <td>{signal.confidence}</td>
                <td>{signal.spreadPct !== undefined ? `${signal.spreadPct.toFixed(3)}%` : "-"}</td>
                <td>{signal.sources?.join(", ") || "-"}</td>
                <td>{signal.reason ?? signal.rationale}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}

function ProviderStatusPanel({ providerStatuses }: { providerStatuses: LoadState<ProviderStatusSnapshot[]> }) {
  return (
    <section className="panel table-panel" aria-labelledby="providers-title">
      <div className="panel-heading">
        <span className="eyebrow">Saude das fontes</span>
        <h2 id="providers-title">Consenso e failover</h2>
      </div>
      {providerStatuses.status === "error" ? <PanelError title="Providers indisponiveis" message={providerStatuses.message} /> : null}
      {providerStatuses.status === "loading" ? <p className="empty">Carregando providers...</p> : null}
      {providerStatuses.status === "success" && providerStatuses.data.length === 0 ? <p className="empty">Nenhum status de provider recebido.</p> : null}
      {providerStatuses.data.length ? (
        <table>
          <thead>
            <tr>
              <th>Ativo</th>
              <th>Provider</th>
              <th>Qualidade</th>
              <th>Dispersao</th>
              <th>Health</th>
            </tr>
          </thead>
          <tbody>
            {providerStatuses.data.map((status) => {
              const healthyCount = Object.values(status.providers).filter((provider) => provider.healthy && !provider.stale).length;
              const totalCount = Object.keys(status.providers).length;
              return (
                <tr key={status.symbol}>
                  <td>{status.symbol}</td>
                  <td>{status.recommendedProvider ?? "-"}</td>
                  <td>{status.dataQualityScore.toFixed(1)}</td>
                  <td>{status.disagreementScore.toFixed(2)}%</td>
                  <td>{healthyCount}/{totalCount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}

function PositionsPanel({ positions }: { positions: LoadState<Position[]> }) {
  return (
    <section className="panel table-panel" aria-labelledby="positions-title">
      <div className="panel-heading">
        <span className="eyebrow">Posicoes paper simuladas</span>
        <h2 id="positions-title">Exposicao aberta</h2>
      </div>
      {positions.status === "error" ? <PanelError title="Posicoes indisponiveis" message={positions.message} /> : null}
      {positions.status === "loading" ? <p className="empty">Carregando posicoes...</p> : null}
      {positions.status === "success" && positions.data.length === 0 ? <p className="empty">Nenhuma posicao paper aberta.</p> : null}
      {positions.data.length ? (
        <table>
          <thead>
            <tr>
              <th>Ativo</th>
              <th>Lado</th>
              <th>Status</th>
              <th>Entrada</th>
              <th>Margem</th>
              <th>Alav.</th>
            </tr>
          </thead>
          <tbody>
            {positions.data.map((position) => (
              <tr key={position.id}>
                <td>{position.symbol}</td>
                <td>{position.side}</td>
                <td>{position.status}</td>
                <td>{formatCurrency(position.entryPrice)}</td>
                <td>{formatCurrency(position.marginUsdt)}</td>
                <td>{position.leverage}x</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}

function RiskPanel() {
  return (
    <aside className="panel risk-panel" aria-labelledby="risk-title">
      <div className="panel-heading">
        <span className="eyebrow">Checagem de risco</span>
        <h2 id="risk-title">Circuit breakers ativos</h2>
      </div>
      <ul>
        {riskRules.map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
      </ul>
    </aside>
  );
}

function PaperSummaryPanel({ paperSummary }: { paperSummary: LoadState<PaperSummary | null> }) {
  return (
    <section className="trust-band" aria-label="Resumo de paper trading">
      <article>
        <span>Posicoes abertas</span>
        <strong>{paperSummary.data?.openPositions ?? 0}</strong>
      </article>
      <article>
        <span>Trades fechados</span>
        <strong>{paperSummary.data?.closedTrades ?? 0}</strong>
      </article>
      <article>
        <span>PnL realizado</span>
        <strong>{formatCurrency(paperSummary.data?.realizedPnlUsdt ?? 0)}</strong>
      </article>
      <article>
        <span>Win rate</span>
        <strong>{formatPercent(paperSummary.data?.winRatePct ?? 0)}</strong>
      </article>
    </section>
  );
}

function SafetyExplainer() {
  return (
    <section className="safety-explainer" aria-label="Avisos e limites do produto">
      <article>
        <span className="eyebrow">O que esta bloqueado?</span>
        <h2>Execucao real continua fora do MVP</h2>
        <p>
          Nenhum fluxo da pagina envia ordem real. A API atual aceita somente modo paper, com stop loss obrigatorio e
          limites de risco antes de criar uma posicao simulada.
        </p>
      </article>
      <article>
        <span className="eyebrow">Depois da simulacao</span>
        <h2>Validar antes de operar capital</h2>
        <p>
          Criptoativos podem perder valor rapidamente. Operacao real exige endpoints oficiais, armazenamento duravel,
          chaves criptografadas, reconciliacao e pelo menos 100 trades paper auditados por 30 dias.
        </p>
      </article>
    </section>
  );
}

function FinalCta({
  onSimulate,
  primaryTick,
  submittingSymbol
}: {
  onSimulate: (symbol: string, price: number) => Promise<void>;
  primaryTick?: MarketTick;
  submittingSymbol: string | null;
}) {
  return (
    <section className="final-cta" aria-labelledby="final-cta-title">
      <div>
        <span className="eyebrow">Proximo passo</span>
        <h2 id="final-cta-title">Teste a leitura completa em modo paper</h2>
        <p>
          Use o cockpit para acompanhar mercado, baleias, noticias e sinais tecnicos antes de decidir. A execucao real
          permanece bloqueada por seguranca.
        </p>
      </div>
      <button
        aria-busy={submittingSymbol === primaryTick?.symbol}
        aria-label={primaryTick ? getAccessiblePaperActionLabel(primaryTick.symbol) : "Simular LONG paper indisponivel"}
        className="primary-action"
        disabled={!primaryTick || submittingSymbol === primaryTick.symbol}
        onClick={() => primaryTick && void onSimulate(primaryTick.symbol, primaryTick.price)}
        type="button"
      >
        {submittingSymbol === primaryTick?.symbol ? "Simulando..." : "Testar em paper"}
      </button>
    </section>
  );
}

function SkeletonCards({ count }: { count: number }) {
  return Array.from({ length: count }, (_, index) => (
    <article className="market-tile skeleton" key={index} aria-hidden="true">
      <span />
      <span />
      <span />
    </article>
  ));
}

function EmptyPanel({ text }: { text: string }) {
  return <article className="panel empty-panel">{text}</article>;
}

function PanelError({ message, title }: { message?: string; title: string }) {
  return (
    <article className="panel-error" role="alert">
      <strong>{title}</strong>
      <span>{message ?? "Tente novamente em instantes."}</span>
    </article>
  );
}

function BackgroundField() {
  return (
    <div className="background-field" aria-hidden="true">
      <span className="orbital one" />
      <span className="orbital two" />
      <span className="data-particle a" />
      <span className="data-particle b" />
      <span className="data-particle c" />
    </div>
  );
}

function applyResult<T>(
  result: PromiseSettledResult<T>,
  setter: (state: LoadState<T>) => void,
  fallback: T,
  updatedAt: string
) {
  if (result.status === "fulfilled") {
    setter({ data: result.value, status: "success", updatedAt });
  } else {
    setter({ data: fallback, message: getErrorMessage(result.reason), status: "error", updatedAt });
  }
}

function getErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "Falha inesperada";
}

function appRouteFromHash(): AppRoute {
  return resolveAppRouteFromHash(
    window.location.hash,
    pages.map((page) => page.id)
  );
}
