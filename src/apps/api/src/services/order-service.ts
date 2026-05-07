/**
 * Order Service
 * Provides CRUD operations for paper trading orders with database persistence
 */

import type { PaperTradingEngine } from "@trade/trading-core";
import type { OpenPaperOrderRequest, Position, OrderIntent } from "@trade/shared";

export interface CreateOrderRequest {
  userId: string;
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  price?: number;
}

export interface PaperOrder {
  id: string;
  userId: string;
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  status: "pending" | "filled" | "cancelled";
  type: "market" | "limit";
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderService {
  createOrder(request: CreateOrderRequest): Promise<PaperOrder>;
  getOrders(userId: string): Promise<PaperOrder[]>;
  getOrder(userId: string, orderId: string): Promise<PaperOrder | null>;
  cancelOrder(userId: string, orderId: string): Promise<void>;
  getPositions(userId: string): Promise<Position[]>;
  getPosition(userId: string, positionId: string): Promise<Position | null>;
  closePosition(userId: string, positionId: string, exitPrice: number): Promise<void>;
}

export class OrderServiceImpl implements OrderService {
  private orders: Map<string, PaperOrder[]> = new Map();
  private positions: Map<string, Position[]> = new Map();

  constructor(private paperEngine: PaperTradingEngine) {}

  async createOrder(request: CreateOrderRequest): Promise<PaperOrder> {
    const openRequest: OpenPaperOrderRequest = {
      userId: request.userId,
      symbol: request.symbol,
      side: request.side === "buy" ? "LONG" : "SHORT",
      quantity: request.quantity,
      entryPrice: request.price || 0,
      timestamp: new Date()
    };

    const result = await this.paperEngine.open(openRequest);
    const position = result.position;

    // Convert position to order format
    const order: PaperOrder = {
      id: position.id,
      userId: request.userId,
      symbol: request.symbol,
      side: request.side,
      quantity: request.quantity,
      price: position.entryPrice,
      status: "filled",
      type: "market",
      createdAt: new Date(position.entryTime),
      updatedAt: new Date(position.entryTime)
    };

    // Store in memory
    const userOrders = this.orders.get(request.userId) || [];
    userOrders.push(order);
    this.orders.set(request.userId, userOrders);

    // Store position
    const userPositions = this.positions.get(request.userId) || [];
    userPositions.push(position);
    this.positions.set(request.userId, userPositions);

    return order;
  }

  async getOrders(userId: string): Promise<PaperOrder[]> {
    return this.orders.get(userId) || [];
  }

  async getOrder(userId: string, orderId: string): Promise<PaperOrder | null> {
    const userOrders = this.orders.get(userId) || [];
    return userOrders.find(o => o.id === orderId) || null;
  }

  async cancelOrder(userId: string, orderId: string): Promise<void> {
    const userOrders = this.orders.get(userId) || [];
    const orderIndex = userOrders.findIndex(o => o.id === orderId);

    if (orderIndex === -1) {
      throw new Error("Order not found");
    }

    const order = userOrders[orderIndex];
    if (order.status === "filled") {
      throw new Error("Cannot cancel filled order");
    }

    order.status = "cancelled";
    order.updatedAt = new Date();
  }

  async getPositions(userId: string): Promise<Position[]> {
    return this.positions.get(userId) || [];
  }

  async getPosition(userId: string, positionId: string): Promise<Position | null> {
    const userPositions = this.positions.get(userId) || [];
    return userPositions.find(p => p.id === positionId) || null;
  }

  async closePosition(userId: string, positionId: string, exitPrice: number): Promise<void> {
    const position = await this.getPosition(userId, positionId);

    if (!position) {
      throw new Error("Position not found");
    }

    await this.paperEngine.close(positionId, exitPrice);

    // Update position in memory
    const userPositions = this.positions.get(userId) || [];
    const positionIndex = userPositions.findIndex(p => p.id === positionId);

    if (positionIndex !== -1) {
      userPositions[positionIndex] = {
        ...position,
        exitPrice,
        exitTime: new Date().toISOString(),
        status: "closed"
      };
    }
  }
}
