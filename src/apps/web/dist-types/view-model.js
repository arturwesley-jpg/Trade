export function buildPaperOrderPayload(symbol, price, idempotencyKey = `${symbol}-${Date.now()}`) {
    return {
        idempotencyKey,
        symbol,
        side: "LONG",
        mode: "paper",
        entryPrice: price,
        stopLossPrice: roundMoney(price * 0.98),
        takeProfitPrice: roundMoney(price * 1.04),
        marginUsdt: 100,
        leverage: 2
    };
}
export function formatSignalDirection(direction) {
    return direction === "WATCH_LONG" ? "Observar LONG" : "Neutro";
}
export function formatSignalStatus(status) {
    if (!status)
        return "Sem status";
    const labels = {
        AGUARDANDO: "Aguardando",
        "SINAL FRACO": "Sinal fraco",
        "PRECO VALIDADO": "Preco validado",
        "SEM SINAL": "Sem sinal",
        "ALERTA ARBITRAGEM": "Arbitragem"
    };
    return labels[status];
}
export function getAccessiblePaperActionLabel(symbol) {
    return `Simular LONG paper para ${symbol}`;
}
export function resolvePageFromHash(hash, allowedIds, fallback = "dashboard") {
    const normalized = hash.replace("#", "");
    return allowedIds.includes(normalized) ? normalized : fallback;
}
export function resolveAppRouteFromHash(hash, hubPageIds) {
    const normalized = hash.replace("#", "");
    if (!normalized)
        return "landing";
    return hubPageIds.includes(normalized) ? normalized : "landing";
}
export function filterCommandItems(items, query) {
    const normalized = query.trim().toLowerCase();
    if (!normalized)
        return items;
    return items.filter((item) => {
        const haystack = [item.label, ...item.keywords].join(" ").toLowerCase();
        return haystack.includes(normalized);
    });
}
export function summarizeMarketContext(ticks, signals) {
    const averageChangePct = ticks.length
        ? roundPercent(ticks.reduce((total, tick) => total + (tick.change24hPct ?? 0), 0) / ticks.length)
        : 0;
    const watchLongCount = signals.filter((signal) => signal.direction === "WATCH_LONG").length;
    const rawScore = 50 + averageChangePct * 10 + watchLongCount * 2;
    const score = clamp(Math.round(rawScore), 0, 100);
    return {
        label: score >= 60 ? "Atenção compradora" : score <= 40 ? "Pressão vendedora" : "Neutro ativo",
        score,
        averageChangePct,
        watchLongCount
    };
}
export function formatCurrency(value) {
    return value.toLocaleString("en-US", {
        currency: "USD",
        maximumFractionDigits: value >= 10_000 ? 0 : 2,
        style: "currency"
    });
}
export function formatPercent(value = 0) {
    const sign = value > 0 ? "+" : "";
    return `${sign}${roundPercent(value).toFixed(2)}%`;
}
export function classForChange(value = 0) {
    if (value > 0)
        return "positive";
    if (value < 0)
        return "negative";
    return "neutral";
}
export function formatWhaleEventType(type) {
    const labels = {
        ACCUMULATION: "Acumulacao",
        DISTRIBUTION: "Distribuicao",
        EXCHANGE_INFLOW: "Entrada em exchange",
        EXCHANGE_OUTFLOW: "Saida de exchange",
        STABLECOIN_FLOW: "Fluxo de stablecoins"
    };
    return labels[type];
}
export function describeWhaleEvent(event) {
    const impact = {
        ACCUMULATION: "possivel acumulacao",
        DISTRIBUTION: "possivel distribuicao",
        EXCHANGE_INFLOW: "possivel pressao de venda",
        EXCHANGE_OUTFLOW: "possivel retirada de oferta",
        STABLECOIN_FLOW: "liquidez em movimento"
    };
    return `${event.symbol} ${impact[event.type]}`;
}
export function formatAlertStatus(status) {
    const labels = {
        ACKED: "ciente",
        OPEN: "ativo",
        RESOLVED: "resolvido"
    };
    return labels[status];
}
function roundMoney(value) {
    return Math.round(value * 100) / 100;
}
function roundPercent(value) {
    return Math.round(value * 100) / 100;
}
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
