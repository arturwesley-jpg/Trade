export class MarketDataWebSocket {
    ws = null;
    url;
    reconnectAttempts = 0;
    maxReconnectAttempts = 5;
    reconnectTimeoutId = null;
    state = "disconnected";
    shouldReconnect = false;
    onCandle;
    onError;
    onStateChange;
    constructor(options) {
        this.url = options.url;
        this.onCandle = options.onCandle;
        this.onError = options.onError;
        this.onStateChange = options.onStateChange;
    }
    connect() {
        if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
            return;
        }
        this.shouldReconnect = true;
        this.setState("connecting");
        try {
            this.ws = new WebSocket(this.url);
            this.ws.onopen = () => {
                console.log("[MarketDataWebSocket] Connected to", this.url);
                this.reconnectAttempts = 0;
                this.setState("connected");
            };
            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    if (message.type === "candle" && message.data) {
                        this.onCandle?.(message.data);
                    }
                }
                catch (error) {
                    const parseError = error instanceof Error ? error : new Error("Failed to parse candle data");
                    console.error("[MarketDataWebSocket] Parse error:", parseError);
                    this.onError?.(parseError);
                }
            };
            this.ws.onerror = (event) => {
                const error = new Error("WebSocket error occurred");
                console.error("[MarketDataWebSocket] Error:", event);
                this.setState("error");
                this.onError?.(error);
            };
            this.ws.onclose = (event) => {
                console.log("[MarketDataWebSocket] Closed:", event.code, event.reason);
                this.ws = null;
                if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.scheduleReconnect();
                }
                else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                    console.error("[MarketDataWebSocket] Max reconnection attempts reached");
                    this.setState("error");
                    this.onError?.(new Error("Max reconnection attempts reached"));
                }
                else {
                    this.setState("disconnected");
                }
            };
        }
        catch (error) {
            const connectionError = error instanceof Error ? error : new Error("Failed to create WebSocket");
            console.error("[MarketDataWebSocket] Connection error:", connectionError);
            this.setState("error");
            this.onError?.(connectionError);
        }
    }
    disconnect() {
        this.shouldReconnect = false;
        if (this.reconnectTimeoutId !== null) {
            clearTimeout(this.reconnectTimeoutId);
            this.reconnectTimeoutId = null;
        }
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.reconnectAttempts = 0;
        this.setState("disconnected");
    }
    getState() {
        return this.state;
    }
    setState(newState) {
        if (this.state !== newState) {
            this.state = newState;
            this.onStateChange?.(newState);
        }
    }
    scheduleReconnect() {
        this.setState("reconnecting");
        this.reconnectAttempts++;
        // Exponential backoff: 1s, 2s, 4s, 8s, 16s (capped at 30s)
        const baseDelay = 1000;
        const exponentialDelay = baseDelay * Math.pow(2, this.reconnectAttempts - 1);
        const delay = Math.min(exponentialDelay, 30000);
        console.log(`[MarketDataWebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.reconnectTimeoutId = window.setTimeout(() => {
            this.reconnectTimeoutId = null;
            this.connect();
        }, delay);
    }
}
