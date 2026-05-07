/**
 * Message Formatters
 * Formats data for Telegram messages with proper markdown
 */

import type { Position, Trade } from "@trade/shared";

export function formatPrice(price: number): string {
  return `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatPnL(pnl: number): string {
  const sign = pnl >= 0 ? "+" : "";
  const emoji = pnl >= 0 ? "🟢" : "🔴";
  return `${emoji} ${sign}${pnl.toFixed(2)} USDT`;
}

export function formatPercentage(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function formatPosition(position: Position): string {
  const emoji = position.side === "LONG" ? "📈" : "📉";
  return (
    `${emoji} *${position.symbol}* ${position.side}\n` +
    `Status: \`${position.status}\`\n` +
    `Entry: ${formatPrice(position.entryPrice)}\n` +
    `Leverage: ${position.leverage}x\n` +
    `Margin: ${position.marginUsdt.toFixed(2)} USDT\n` +
    `PnL: ${formatPnL(position.pnlUsdt)}\n` +
    `Opened: ${formatDate(position.openedAt)}`
  );
}

export function formatTrade(trade: Trade): string {
  const emoji = trade.side === "LONG" ? "📈" : "📉";
  const closedAt = trade.closedAt ?? trade.openedAt;
  const duration = calculateDuration(trade.openedAt, closedAt);

  return (
    `${emoji} *${trade.symbol}* ${trade.side}\n` +
    `Entry: ${formatPrice(trade.entryPrice)}\n` +
    `Exit: ${formatPrice(trade.exitPrice)}\n` +
    `PnL: ${formatPnL(trade.pnlUsdt)}\n` +
    `Duration: ${duration}\n` +
    `Closed: ${formatDate(closedAt)}`
  );
}

export function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function calculateDuration(start: string, end: string): string {
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  const durationMs = endTime - startTime;

  const hours = Math.floor(durationMs / (1000 * 60 * 60));
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

export function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}
