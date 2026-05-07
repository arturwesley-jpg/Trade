import type { Position } from "@trade/shared";
import type { PaperExecutor } from "./paper-executor.js";
import type { TradingRepository } from "./repository.js";

export interface PositionMonitorConfig {
  enabled?: boolean;
}

export interface AutoCloseEvent {
  positionId: string;
  symbol: string;
  reason: "STOP_LOSS" | "TAKE_PROFIT";
  triggerPrice: number;
  exitPrice: number;
  pnlUsdt: number;
  timestamp: string;
}

export class PositionMonitor {
  private readonly enabled: boolean;

  constructor(
    private readonly repo: TradingRepository,
    private readonly executor: PaperExecutor,
    config: PositionMonitorConfig = {}
  ) {
    this.enabled = config.enabled ?? true;
  }

  async checkPositions(currentPrices: Map<string, number>): Promise<AutoCloseEvent[]> {
    if (!this.enabled) return [];

    const events: AutoCloseEvent[] = [];
    const positions = this.getOpenPositions();

    for (const position of positions) {
      const currentPrice = currentPrices.get(position.symbol);
      if (currentPrice === undefined) continue;

      const closeEvent = this.shouldClose(position, currentPrice);
      if (!closeEvent) continue;

      try {
        const closedPosition = await this.executor.close(position.id, currentPrice);

        const event: AutoCloseEvent = {
          positionId: position.id,
          symbol: position.symbol,
          reason: closeEvent.reason,
          triggerPrice: closeEvent.triggerPrice,
          exitPrice: currentPrice,
          pnlUsdt: closedPosition.pnlUsdt,
          timestamp: new Date().toISOString()
        };

        events.push(event);
        console.log(JSON.stringify({
          event: "position_auto_closed",
          ...event
        }));
      } catch (error) {
        console.error(JSON.stringify({
          event: "position_auto_close_failed",
          positionId: position.id,
          symbol: position.symbol,
          reason: closeEvent.reason,
          error: error instanceof Error ? error.message : String(error)
        }));
      }
    }

    return events;
  }

  private getOpenPositions(): Position[] {
    const repoWithSnapshot = this.repo as TradingRepository & { positions?: () => Position[] };
    if (!repoWithSnapshot.positions) return [];
    return repoWithSnapshot.positions().filter((pos) => pos.status === "OPEN");
  }

  private shouldClose(
    position: Position,
    currentPrice: number
  ): { reason: "STOP_LOSS" | "TAKE_PROFIT"; triggerPrice: number } | null {
    if (position.side === "LONG") {
      if (position.stopLossPrice !== undefined && currentPrice <= position.stopLossPrice) {
        return { reason: "STOP_LOSS", triggerPrice: position.stopLossPrice };
      }
      if (position.takeProfitPrice !== undefined && currentPrice >= position.takeProfitPrice) {
        return { reason: "TAKE_PROFIT", triggerPrice: position.takeProfitPrice };
      }
    } else {
      if (position.stopLossPrice !== undefined && currentPrice >= position.stopLossPrice) {
        return { reason: "STOP_LOSS", triggerPrice: position.stopLossPrice };
      }
      if (position.takeProfitPrice !== undefined && currentPrice <= position.takeProfitPrice) {
        return { reason: "TAKE_PROFIT", triggerPrice: position.takeProfitPrice };
      }
    }

    return null;
  }
}
