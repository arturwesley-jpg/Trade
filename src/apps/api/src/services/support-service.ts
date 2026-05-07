/**
 * Support Service
 * Manages customer support tickets, FAQ, knowledge base, and live chat
 */

import type { Pool } from "pg";
import { logger } from "@trade/shared";

export interface SupportTicket {
  id: string;
  userId: string;
  subject: string;
  description: string;
  category: "technical" | "billing" | "feature" | "bug";
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "in_progress" | "waiting" | "resolved" | "closed";
  assignedTo?: string;
  messages: TicketMessage[];
  attachments?: TicketAttachment[];
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  closedAt?: string;
  firstResponseAt?: string;
  slaBreached?: boolean;
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  userId: string;
  userType: "customer" | "agent" | "system";
  content: string;
  attachments?: TicketAttachment[];
  isInternal?: boolean;
  createdAt: string;
}

export interface TicketAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
  uploadedAt: string;
}

export interface FAQArticle {
  id: string;
  categoryId: string;
  title: string;
  content: string;
  slug: string;
  tags: string[];
  helpfulCount: number;
  notHelpfulCount: number;
  viewCount: number;
  status: "draft" | "published" | "archived";
  relatedArticles?: string[];
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export interface FAQCategory {
  id: string;
  name: string;
  description: string;
  slug: string;
  icon?: string;
  order: number;
  articleCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChatSession {
  id: string;
  userId: string;
  agentId?: string;
  status: "waiting" | "active" | "ended";
  messages: ChatMessage[];
  startedAt: string;
  endedAt?: string;
  assignedAt?: string;
  rating?: number;
  feedback?: string;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  senderId: string;
  senderType: "customer" | "agent" | "bot";
  content: string;
  attachments?: TicketAttachment[];
  createdAt: string;
  readAt?: string;
}

export interface CannedResponse {
  id: string;
  title: string;
  content: string;
  category: string;
  shortcut?: string;
  usageCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface SupportStatistics {
  totalTickets: number;
  openTickets: number;
  inProgressTickets: number;
  resolvedTickets: number;
  closedTickets: number;
  averageResponseTime: number;
  averageResolutionTime: number;
  satisfactionScore: number;
  slaCompliance: number;
  ticketsByCategory: Record<string, number>;
  ticketsByPriority: Record<string, number>;
}

export interface CreateTicketRequest {
  subject: string;
  description: string;
  category: "technical" | "billing" | "feature" | "bug";
  priority?: "low" | "medium" | "high" | "urgent";
  attachments?: TicketAttachment[];
}

export interface UpdateTicketRequest {
  subject?: string;
  description?: string;
  category?: "technical" | "billing" | "feature" | "bug";
  priority?: "low" | "medium" | "high" | "urgent";
  status?: "open" | "in_progress" | "waiting" | "resolved" | "closed";
  assignedTo?: string;
  tags?: string[];
}

export interface AddMessageRequest {
  content: string;
  attachments?: TicketAttachment[];
  isInternal?: boolean;
}

export class SupportService {
  constructor(private readonly pool: Pool) {}

  /**
   * Create a new support ticket
   */
  async createTicket(userId: string, request: CreateTicketRequest): Promise<SupportTicket> {
    const id = this.generateId("ticket");
    const now = new Date().toISOString();

    const priority = request.priority || this.determinePriority(request.category);

    const ticket: SupportTicket = {
      id,
      userId,
      subject: request.subject,
      description: request.description,
      category: request.category,
      priority,
      status: "open",
      messages: [],
      attachments: request.attachments || [],
      tags: [],
      createdAt: now,
      updatedAt: now,
    };

    await this.pool.query(
      `INSERT INTO support_tickets (id, user_id, subject, description, category, priority, status, attachments, tags, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        ticket.id,
        ticket.userId,
        ticket.subject,
        ticket.description,
        ticket.category,
        ticket.priority,
        ticket.status,
        JSON.stringify(ticket.attachments),
        JSON.stringify(ticket.tags),
        ticket.createdAt,
        ticket.updatedAt,
      ]
    );

    // Create initial system message
    await this.addSystemMessage(ticket.id, "Ticket created. Our support team will respond shortly.");

    logger.info("Support ticket created", { ticketId: id, userId, category: ticket.category });

    return ticket;
  }

  /**
   * Get ticket by ID
   */
  async getTicket(ticketId: string, userId?: string): Promise<SupportTicket | null> {
    const query = userId
      ? `SELECT * FROM support_tickets WHERE id = $1 AND user_id = $2`
      : `SELECT * FROM support_tickets WHERE id = $1`;

    const params = userId ? [ticketId, userId] : [ticketId];
    const result = await this.pool.query(query, params);

    if (result.rows.length === 0) {
      return null;
    }

    const ticket = this.mapTicketRow(result.rows[0]);

    // Load messages
    ticket.messages = await this.getTicketMessages(ticketId);

    return ticket;
  }

  /**
   * Get tickets by user ID
   */
  async getTicketsByUserId(
    userId: string,
    options?: {
      status?: string;
      category?: string;
      page?: number;
      pageSize?: number;
    }
  ): Promise<{ tickets: SupportTicket[]; total: number }> {
    const page = options?.page || 1;
    const pageSize = options?.pageSize || 20;
    const offset = (page - 1) * pageSize;

    let whereClause = "WHERE user_id = $1";
    const params: any[] = [userId];
    let paramIndex = 2;

    if (options?.status) {
      whereClause += ` AND status = $${paramIndex++}`;
      params.push(options.status);
    }

    if (options?.category) {
      whereClause += ` AND category = $${paramIndex++}`;
      params.push(options.category);
    }

    const countResult = await this.pool.query(
      `SELECT COUNT(*) FROM support_tickets ${whereClause}`,
      params
    );

    const total = parseInt(countResult.rows[0].count);

    params.push(pageSize, offset);

    const result = await this.pool.query(
      `SELECT * FROM support_tickets ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      params
    );

    const tickets = result.rows.map(this.mapTicketRow);

    // Load message counts for each ticket
    for (const ticket of tickets) {
      const messageCount = await this.pool.query(
        `SELECT COUNT(*) FROM ticket_messages WHERE ticket_id = $1`,
        [ticket.id]
      );
      ticket.messages = Array(parseInt(messageCount.rows[0].count)).fill(null) as any;
    }

    return { tickets, total };
  }

  /**
   * Update ticket
   */
  async updateTicket(
    ticketId: string,
    request: UpdateTicketRequest,
    userId?: string
  ): Promise<SupportTicket | null> {
    const existing = await this.getTicket(ticketId, userId);
    if (!existing) {
      return null;
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (request.subject !== undefined) {
      updates.push(`subject = $${paramIndex++}`);
      values.push(request.subject);
    }
    if (request.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(request.description);
    }
    if (request.category !== undefined) {
      updates.push(`category = $${paramIndex++}`);
      values.push(request.category);
    }
    if (request.priority !== undefined) {
      updates.push(`priority = $${paramIndex++}`);
      values.push(request.priority);
    }
    if (request.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(request.status);

      // Track resolution/closure times
      if (request.status === "resolved" && !existing.resolvedAt) {
        updates.push(`resolved_at = $${paramIndex++}`);
        values.push(new Date().toISOString());
      }
      if (request.status === "closed" && !existing.closedAt) {
        updates.push(`closed_at = $${paramIndex++}`);
        values.push(new Date().toISOString());
      }
    }
    if (request.assignedTo !== undefined) {
      updates.push(`assigned_to = $${paramIndex++}`);
      values.push(request.assignedTo);
    }
    if (request.tags !== undefined) {
      updates.push(`tags = $${paramIndex++}`);
      values.push(JSON.stringify(request.tags));
    }

    updates.push(`updated_at = $${paramIndex++}`);
    values.push(new Date().toISOString());

    values.push(ticketId);

    await this.pool.query(
      `UPDATE support_tickets SET ${updates.join(", ")} WHERE id = $${paramIndex++}`,
      values
    );

    logger.info("Support ticket updated", { ticketId, updates: Object.keys(request) });

    return this.getTicket(ticketId, userId);
  }

  /**
   * Add message to ticket
   */
  async addMessage(
    ticketId: string,
    userId: string,
    request: AddMessageRequest,
    userType: "customer" | "agent" | "system" = "customer"
  ): Promise<TicketMessage> {
    const id = this.generateId("msg");
    const now = new Date().toISOString();

    const message: TicketMessage = {
      id,
      ticketId,
      userId,
      userType,
      content: request.content,
      attachments: request.attachments || [],
      isInternal: request.isInternal || false,
      createdAt: now,
    };

    await this.pool.query(
      `INSERT INTO ticket_messages (id, ticket_id, user_id, user_type, content, attachments, is_internal, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        message.id,
        message.ticketId,
        message.userId,
        message.userType,
        message.content,
        JSON.stringify(message.attachments),
        message.isInternal,
        message.createdAt,
      ]
    );

    // Update ticket's updated_at timestamp
    await this.pool.query(
      `UPDATE support_tickets SET updated_at = $1 WHERE id = $2`,
      [now, ticketId]
    );

    // Track first response time for agent messages
    if (userType === "agent") {
      await this.pool.query(
        `UPDATE support_tickets SET first_response_at = $1
         WHERE id = $2 AND first_response_at IS NULL`,
        [now, ticketId]
      );
    }

    logger.info("Message added to ticket", { ticketId, messageId: id, userType });

    return message;
  }

  /**
   * Get ticket messages
   */
  async getTicketMessages(ticketId: string): Promise<TicketMessage[]> {
    const result = await this.pool.query(
      `SELECT * FROM ticket_messages
       WHERE ticket_id = $1
       ORDER BY created_at ASC`,
      [ticketId]
    );

    return result.rows.map(this.mapMessageRow);
  }

  /**
   * Search knowledge base
   */
  async searchKnowledgeBase(query: string, limit: number = 10): Promise<FAQArticle[]> {
    const result = await this.pool.query(
      `SELECT * FROM faq_articles
       WHERE status = 'published'
       AND (
         title ILIKE $1
         OR content ILIKE $1
         OR $2 = ANY(tags)
       )
       ORDER BY view_count DESC, helpful_count DESC
       LIMIT $3`,
      [`%${query}%`, query, limit]
    );

    return result.rows.map(this.mapFAQRow);
  }

  /**
   * Get FAQ article by ID or slug
   */
  async getFAQArticle(idOrSlug: string): Promise<FAQArticle | null> {
    const result = await this.pool.query(
      `SELECT * FROM faq_articles
       WHERE (id = $1 OR slug = $1) AND status = 'published'`,
      [idOrSlug]
    );

    if (result.rows.length === 0) {
      return null;
    }

    // Increment view count
    await this.pool.query(
      `UPDATE faq_articles SET view_count = view_count + 1 WHERE id = $1`,
      [result.rows[0].id]
    );

    return this.mapFAQRow(result.rows[0]);
  }

  /**
   * Get FAQ categories
   */
  async getFAQCategories(): Promise<FAQCategory[]> {
    const result = await this.pool.query(
      `SELECT c.*, COUNT(a.id) as article_count
       FROM faq_categories c
       LEFT JOIN faq_articles a ON a.category_id = c.id AND a.status = 'published'
       GROUP BY c.id
       ORDER BY c.order ASC`
    );

    return result.rows.map(this.mapCategoryRow);
  }

  /**
   * Get articles by category
   */
  async getArticlesByCategory(categoryId: string): Promise<FAQArticle[]> {
    const result = await this.pool.query(
      `SELECT * FROM faq_articles
       WHERE category_id = $1 AND status = 'published'
       ORDER BY helpful_count DESC, view_count DESC`,
      [categoryId]
    );

    return result.rows.map(this.mapFAQRow);
  }

  /**
   * Vote on FAQ article
   */
  async voteFAQArticle(articleId: string, helpful: boolean): Promise<void> {
    const field = helpful ? "helpful_count" : "not_helpful_count";

    await this.pool.query(
      `UPDATE faq_articles SET ${field} = ${field} + 1 WHERE id = $1`,
      [articleId]
    );

    logger.info("FAQ article voted", { articleId, helpful });
  }

  /**
   * Get related articles
   */
  async getRelatedArticles(articleId: string, limit: number = 5): Promise<FAQArticle[]> {
    const article = await this.getFAQArticle(articleId);
    if (!article) {
      return [];
    }

    const result = await this.pool.query(
      `SELECT * FROM faq_articles
       WHERE id != $1
       AND status = 'published'
       AND (
         category_id = $2
         OR tags && $3
       )
       ORDER BY helpful_count DESC, view_count DESC
       LIMIT $4`,
      [articleId, article.categoryId, article.tags, limit]
    );

    return result.rows.map(this.mapFAQRow);
  }

  /**
   * Create chat session
   */
  async createChatSession(userId: string): Promise<ChatSession> {
    const id = this.generateId("chat");
    const now = new Date().toISOString();

    const session: ChatSession = {
      id,
      userId,
      status: "waiting",
      messages: [],
      startedAt: now,
    };

    await this.pool.query(
      `INSERT INTO chat_sessions (id, user_id, status, started_at)
       VALUES ($1, $2, $3, $4)`,
      [session.id, session.userId, session.status, session.startedAt]
    );

    // Add welcome message
    await this.addChatMessage(session.id, "system", "bot", "Hello! How can we help you today?");

    logger.info("Chat session created", { sessionId: id, userId });

    return session;
  }

  /**
   * Get chat session
   */
  async getChatSession(sessionId: string): Promise<ChatSession | null> {
    const result = await this.pool.query(
      `SELECT * FROM chat_sessions WHERE id = $1`,
      [sessionId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const session = this.mapChatSessionRow(result.rows[0]);

    // Load messages
    session.messages = await this.getChatMessages(sessionId);

    return session;
  }

  /**
   * Add chat message
   */
  async addChatMessage(
    sessionId: string,
    senderId: string,
    senderType: "customer" | "agent" | "bot",
    content: string,
    attachments?: TicketAttachment[]
  ): Promise<ChatMessage> {
    const id = this.generateId("chatmsg");
    const now = new Date().toISOString();

    const message: ChatMessage = {
      id,
      sessionId,
      senderId,
      senderType,
      content,
      attachments,
      createdAt: now,
    };

    await this.pool.query(
      `INSERT INTO chat_messages (id, session_id, sender_id, sender_type, content, attachments, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        message.id,
        message.sessionId,
        message.senderId,
        message.senderType,
        message.content,
        JSON.stringify(message.attachments || []),
        message.createdAt,
      ]
    );

    return message;
  }

  /**
   * Get chat messages
   */
  async getChatMessages(sessionId: string): Promise<ChatMessage[]> {
    const result = await this.pool.query(
      `SELECT * FROM chat_messages
       WHERE session_id = $1
       ORDER BY created_at ASC`,
      [sessionId]
    );

    return result.rows.map(this.mapChatMessageRow);
  }

  /**
   * Assign chat to agent
   */
  async assignChatToAgent(sessionId: string, agentId: string): Promise<void> {
    const now = new Date().toISOString();

    await this.pool.query(
      `UPDATE chat_sessions SET agent_id = $1, status = 'active', assigned_at = $2
       WHERE id = $3`,
      [agentId, now, sessionId]
    );

    logger.info("Chat assigned to agent", { sessionId, agentId });
  }

  /**
   * End chat session
   */
  async endChatSession(sessionId: string, rating?: number, feedback?: string): Promise<void> {
    const now = new Date().toISOString();

    await this.pool.query(
      `UPDATE chat_sessions SET status = 'ended', ended_at = $1, rating = $2, feedback = $3
       WHERE id = $4`,
      [now, rating, feedback, sessionId]
    );

    logger.info("Chat session ended", { sessionId, rating });
  }

  /**
   * Get canned responses
   */
  async getCannedResponses(category?: string): Promise<CannedResponse[]> {
    const query = category
      ? `SELECT * FROM canned_responses WHERE category = $1 ORDER BY usage_count DESC`
      : `SELECT * FROM canned_responses ORDER BY usage_count DESC`;

    const params = category ? [category] : [];
    const result = await this.pool.query(query, params);

    return result.rows.map(this.mapCannedResponseRow);
  }

  /**
   * Use canned response
   */
  async useCannedResponse(responseId: string): Promise<CannedResponse | null> {
    await this.pool.query(
      `UPDATE canned_responses SET usage_count = usage_count + 1 WHERE id = $1`,
      [responseId]
    );

    const result = await this.pool.query(
      `SELECT * FROM canned_responses WHERE id = $1`,
      [responseId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapCannedResponseRow(result.rows[0]);
  }

  /**
   * Get support statistics
   */
  async getSupportStatistics(userId?: string): Promise<SupportStatistics> {
    const whereClause = userId ? "WHERE user_id = $1" : "";
    const params = userId ? [userId] : [];

    const statusResult = await this.pool.query(
      `SELECT status, COUNT(*) as count FROM support_tickets ${whereClause} GROUP BY status`,
      params
    );

    const categoryResult = await this.pool.query(
      `SELECT category, COUNT(*) as count FROM support_tickets ${whereClause} GROUP BY category`,
      params
    );

    const priorityResult = await this.pool.query(
      `SELECT priority, COUNT(*) as count FROM support_tickets ${whereClause} GROUP BY priority`,
      params
    );

    const timingResult = await this.pool.query(
      `SELECT
         AVG(EXTRACT(EPOCH FROM (first_response_at - created_at))) as avg_response_time,
         AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))) as avg_resolution_time
       FROM support_tickets
       ${whereClause}
       AND first_response_at IS NOT NULL`,
      params
    );

    const stats: SupportStatistics = {
      totalTickets: 0,
      openTickets: 0,
      inProgressTickets: 0,
      resolvedTickets: 0,
      closedTickets: 0,
      averageResponseTime: parseFloat(timingResult.rows[0]?.avg_response_time || "0"),
      averageResolutionTime: parseFloat(timingResult.rows[0]?.avg_resolution_time || "0"),
      satisfactionScore: 0,
      slaCompliance: 0,
      ticketsByCategory: {},
      ticketsByPriority: {},
    };

    for (const row of statusResult.rows) {
      const count = parseInt(row.count);
      stats.totalTickets += count;
      if (row.status === "open") stats.openTickets = count;
      if (row.status === "in_progress") stats.inProgressTickets = count;
      if (row.status === "resolved") stats.resolvedTickets = count;
      if (row.status === "closed") stats.closedTickets = count;
    }

    for (const row of categoryResult.rows) {
      stats.ticketsByCategory[row.category] = parseInt(row.count);
    }

    for (const row of priorityResult.rows) {
      stats.ticketsByPriority[row.priority] = parseInt(row.count);
    }

    return stats;
  }

  /**
   * Add system message to ticket
   */
  private async addSystemMessage(ticketId: string, content: string): Promise<void> {
    await this.addMessage(ticketId, "system", { content }, "system");
  }

  /**
   * Determine priority based on category
   */
  private determinePriority(category: string): "low" | "medium" | "high" | "urgent" {
    switch (category) {
      case "bug":
        return "high";
      case "billing":
        return "medium";
      case "technical":
        return "medium";
      case "feature":
        return "low";
      default:
        return "medium";
    }
  }

  private mapTicketRow(row: any): SupportTicket {
    return {
      id: row.id,
      userId: row.user_id,
      subject: row.subject,
      description: row.description,
      category: row.category,
      priority: row.priority,
      status: row.status,
      assignedTo: row.assigned_to,
      messages: [],
      attachments: row.attachments || [],
      tags: row.tags || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      resolvedAt: row.resolved_at,
      closedAt: row.closed_at,
      firstResponseAt: row.first_response_at,
      slaBreached: row.sla_breached,
    };
  }

  private mapMessageRow(row: any): TicketMessage {
    return {
      id: row.id,
      ticketId: row.ticket_id,
      userId: row.user_id,
      userType: row.user_type,
      content: row.content,
      attachments: row.attachments || [],
      isInternal: row.is_internal,
      createdAt: row.created_at,
    };
  }

  private mapFAQRow(row: any): FAQArticle {
    return {
      id: row.id,
      categoryId: row.category_id,
      title: row.title,
      content: row.content,
      slug: row.slug,
      tags: row.tags || [],
      helpfulCount: row.helpful_count || 0,
      notHelpfulCount: row.not_helpful_count || 0,
      viewCount: row.view_count || 0,
      status: row.status,
      relatedArticles: row.related_articles || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      publishedAt: row.published_at,
    };
  }

  private mapCategoryRow(row: any): FAQCategory {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      slug: row.slug,
      icon: row.icon,
      order: row.order,
      articleCount: parseInt(row.article_count || "0"),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapChatSessionRow(row: any): ChatSession {
    return {
      id: row.id,
      userId: row.user_id,
      agentId: row.agent_id,
      status: row.status,
      messages: [],
      startedAt: row.started_at,
      endedAt: row.ended_at,
      assignedAt: row.assigned_at,
      rating: row.rating,
      feedback: row.feedback,
    };
  }

  private mapChatMessageRow(row: any): ChatMessage {
    return {
      id: row.id,
      sessionId: row.session_id,
      senderId: row.sender_id,
      senderType: row.sender_type,
      content: row.content,
      attachments: row.attachments || [],
      createdAt: row.created_at,
      readAt: row.read_at,
    };
  }

  private mapCannedResponseRow(row: any): CannedResponse {
    return {
      id: row.id,
      title: row.title,
      content: row.content,
      category: row.category,
      shortcut: row.shortcut,
      usageCount: row.usage_count || 0,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
