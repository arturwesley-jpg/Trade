/**
 * Strategy Repository
 * Database operations for strategy management
 */

import type { Pool } from "pg";
import type {
  Strategy,
  StrategyVersion,
  StrategyPerformance,
  StrategyRating,
  CreateStrategyInput,
  UpdateStrategyInput,
  StrategyFilter,
  StrategyMarketplaceListing,
} from "./types.js";

export class StrategyRepository {
  constructor(private readonly pool: Pool) {}

  async create(userId: string, input: CreateStrategyInput): Promise<Strategy> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      const result = await client.query(
        `INSERT INTO strategies (
          user_id, name, description, category, status, visibility,
          tags, parameters, indicators, rules, code, version
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 1)
        RETURNING *`,
        [
          userId,
          input.name,
          input.description,
          input.category,
          "draft",
          input.visibility || "private",
          JSON.stringify(input.tags || []),
          JSON.stringify(input.parameters || []),
          JSON.stringify(input.indicators || []),
          JSON.stringify(input.rules || {}),
          input.code || null,
        ]
      );

      const strategy = this.mapRowToStrategy(result.rows[0]);

      // Create initial version
      await client.query(
        `INSERT INTO strategy_versions (
          strategy_id, version, name, description, parameters, indicators, rules, code, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          strategy.id,
          1,
          strategy.name,
          strategy.description,
          JSON.stringify(strategy.parameters),
          JSON.stringify(strategy.indicators),
          JSON.stringify(strategy.rules),
          strategy.code,
          userId,
        ]
      );

      await client.query("COMMIT");
      return strategy;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async findById(id: string): Promise<Strategy | null> {
    const result = await this.pool.query(
      "SELECT * FROM strategies WHERE id = $1",
      [id]
    );
    return result.rows[0] ? this.mapRowToStrategy(result.rows[0]) : null;
  }

  async findByUserId(userId: string, filter?: StrategyFilter): Promise<Strategy[]> {
    let query = "SELECT * FROM strategies WHERE user_id = $1";
    const params: any[] = [userId];
    let paramIndex = 2;

    if (filter?.category) {
      query += ` AND category = $${paramIndex}`;
      params.push(filter.category);
      paramIndex++;
    }

    if (filter?.status) {
      query += ` AND status = $${paramIndex}`;
      params.push(filter.status);
      paramIndex++;
    }

    if (filter?.visibility) {
      query += ` AND visibility = $${paramIndex}`;
      params.push(filter.visibility);
      paramIndex++;
    }

    if (filter?.search) {
      query += ` AND (name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
      params.push(`%${filter.search}%`);
      paramIndex++;
    }

    if (filter?.tags && filter.tags.length > 0) {
      query += ` AND tags ?| $${paramIndex}`;
      params.push(filter.tags);
      paramIndex++;
    }

    const sortBy = filter?.sortBy || "createdAt";
    const sortOrder = filter?.sortOrder || "desc";
    query += ` ORDER BY ${sortBy} ${sortOrder}`;

    if (filter?.limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(filter.limit);
      paramIndex++;
    }

    if (filter?.offset) {
      query += ` OFFSET $${paramIndex}`;
      params.push(filter.offset);
    }

    const result = await this.pool.query(query, params);
    return result.rows.map((row) => this.mapRowToStrategy(row));
  }

  async update(id: string, userId: string, input: UpdateStrategyInput): Promise<Strategy> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      const current = await this.findById(id);
      if (!current || current.userId !== userId) {
        throw new Error("Strategy not found or unauthorized");
      }

      const updates: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (input.name !== undefined) {
        updates.push(`name = $${paramIndex}`);
        params.push(input.name);
        paramIndex++;
      }

      if (input.description !== undefined) {
        updates.push(`description = $${paramIndex}`);
        params.push(input.description);
        paramIndex++;
      }

      if (input.category !== undefined) {
        updates.push(`category = $${paramIndex}`);
        params.push(input.category);
        paramIndex++;
      }

      if (input.status !== undefined) {
        updates.push(`status = $${paramIndex}`);
        params.push(input.status);
        paramIndex++;
      }

      if (input.visibility !== undefined) {
        updates.push(`visibility = $${paramIndex}`);
        params.push(input.visibility);
        paramIndex++;
      }

      if (input.tags !== undefined) {
        updates.push(`tags = $${paramIndex}`);
        params.push(JSON.stringify(input.tags));
        paramIndex++;
      }

      if (input.parameters !== undefined) {
        updates.push(`parameters = $${paramIndex}`);
        params.push(JSON.stringify(input.parameters));
        paramIndex++;
      }

      if (input.indicators !== undefined) {
        updates.push(`indicators = $${paramIndex}`);
        params.push(JSON.stringify(input.indicators));
        paramIndex++;
      }

      if (input.rules !== undefined) {
        updates.push(`rules = $${paramIndex}`);
        params.push(JSON.stringify(input.rules));
        paramIndex++;
      }

      if (input.code !== undefined) {
        updates.push(`code = $${paramIndex}`);
        params.push(input.code);
        paramIndex++;
      }

      // Increment version if significant changes
      const shouldVersion =
        input.parameters !== undefined ||
        input.indicators !== undefined ||
        input.rules !== undefined ||
        input.code !== undefined;

      if (shouldVersion) {
        updates.push(`version = version + 1`);
      }

      updates.push(`updated_at = NOW()`);
      params.push(id);

      const result = await client.query(
        `UPDATE strategies SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
        params
      );

      const updated = this.mapRowToStrategy(result.rows[0]);

      // Create new version if needed
      if (shouldVersion) {
        await client.query(
          `INSERT INTO strategy_versions (
            strategy_id, version, name, description, parameters, indicators, rules, code, created_by, commit_message
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            updated.id,
            updated.version,
            updated.name,
            updated.description,
            JSON.stringify(updated.parameters),
            JSON.stringify(updated.indicators),
            JSON.stringify(updated.rules),
            updated.code,
            userId,
            input.commitMessage || `Version ${updated.version}`,
          ]
        );
      }

      await client.query("COMMIT");
      return updated;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async delete(id: string, userId: string): Promise<void> {
    const result = await this.pool.query(
      "DELETE FROM strategies WHERE id = $1 AND user_id = $2",
      [id, userId]
    );

    if (result.rowCount === 0) {
      throw new Error("Strategy not found or unauthorized");
    }
  }

  async getVersions(strategyId: string): Promise<StrategyVersion[]> {
    const result = await this.pool.query(
      `SELECT * FROM strategy_versions WHERE strategy_id = $1 ORDER BY version DESC`,
      [strategyId]
    );

    return result.rows.map((row) => this.mapRowToVersion(row));
  }

  async getVersion(strategyId: string, version: number): Promise<StrategyVersion | null> {
    const result = await this.pool.query(
      `SELECT * FROM strategy_versions WHERE strategy_id = $1 AND version = $2`,
      [strategyId, version]
    );

    return result.rows[0] ? this.mapRowToVersion(result.rows[0]) : null;
  }

  async revertToVersion(strategyId: string, userId: string, version: number): Promise<Strategy> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      const versionData = await this.getVersion(strategyId, version);
      if (!versionData) {
        throw new Error("Version not found");
      }

      const result = await client.query(
        `UPDATE strategies SET
          name = $1, description = $2, parameters = $3, indicators = $4,
          rules = $5, code = $6, version = version + 1, updated_at = NOW()
        WHERE id = $7 AND user_id = $8
        RETURNING *`,
        [
          versionData.name,
          versionData.description,
          JSON.stringify(versionData.parameters),
          JSON.stringify(versionData.indicators),
          JSON.stringify(versionData.rules),
          versionData.code,
          strategyId,
          userId,
        ]
      );

      if (result.rowCount === 0) {
        throw new Error("Strategy not found or unauthorized");
      }

      const updated = this.mapRowToStrategy(result.rows[0]);

      // Create new version entry
      await client.query(
        `INSERT INTO strategy_versions (
          strategy_id, version, name, description, parameters, indicators, rules, code, created_by, commit_message
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          updated.id,
          updated.version,
          updated.name,
          updated.description,
          JSON.stringify(updated.parameters),
          JSON.stringify(updated.indicators),
          JSON.stringify(updated.rules),
          updated.code,
          userId,
          `Reverted to version ${version}`,
        ]
      );

      await client.query("COMMIT");
      return updated;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async savePerformance(performance: StrategyPerformance): Promise<void> {
    await this.pool.query(
      `INSERT INTO strategy_performance (
        strategy_id, version, backtest_results, avg_return, avg_sharpe,
        avg_win_rate, consistency, total_backtests, last_backtest_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (strategy_id, version) DO UPDATE SET
        backtest_results = $3, avg_return = $4, avg_sharpe = $5,
        avg_win_rate = $6, consistency = $7, total_backtests = $8, last_backtest_at = $9`,
      [
        performance.strategyId,
        performance.version,
        JSON.stringify(performance.backtestResults),
        performance.avgReturn,
        performance.avgSharpe,
        performance.avgWinRate,
        performance.consistency,
        performance.totalBacktests,
        performance.lastBacktestAt || new Date(),
      ]
    );
  }

  async getPerformance(strategyId: string, version?: number): Promise<StrategyPerformance | null> {
    const query = version
      ? "SELECT * FROM strategy_performance WHERE strategy_id = $1 AND version = $2"
      : "SELECT * FROM strategy_performance WHERE strategy_id = $1 ORDER BY version DESC LIMIT 1";

    const params = version ? [strategyId, version] : [strategyId];
    const result = await this.pool.query(query, params);

    return result.rows[0] ? this.mapRowToPerformance(result.rows[0]) : null;
  }

  async addRating(strategyId: string, userId: string, rating: number, review?: string): Promise<StrategyRating> {
    const result = await this.pool.query(
      `INSERT INTO strategy_ratings (strategy_id, user_id, rating, review)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (strategy_id, user_id) DO UPDATE SET
         rating = $3, review = $4, created_at = NOW()
       RETURNING *`,
      [strategyId, userId, rating, review]
    );

    return this.mapRowToRating(result.rows[0]);
  }

  async getRatings(strategyId: string): Promise<StrategyRating[]> {
    const result = await this.pool.query(
      "SELECT * FROM strategy_ratings WHERE strategy_id = $1 ORDER BY created_at DESC",
      [strategyId]
    );

    return result.rows.map((row) => this.mapRowToRating(row));
  }

  async getAverageRating(strategyId: string): Promise<{ average: number; count: number }> {
    const result = await this.pool.query(
      "SELECT AVG(rating) as average, COUNT(*) as count FROM strategy_ratings WHERE strategy_id = $1",
      [strategyId]
    );

    return {
      average: parseFloat(result.rows[0].average) || 0,
      count: parseInt(result.rows[0].count) || 0,
    };
  }

  async getMarketplaceListings(filter?: StrategyFilter): Promise<StrategyMarketplaceListing[]> {
    let query = `
      SELECT s.*,
        sp.avg_return, sp.avg_sharpe, sp.avg_win_rate, sp.consistency, sp.total_backtests,
        COALESCE(AVG(sr.rating), 0) as avg_rating,
        COUNT(DISTINCT sr.id) as rating_count,
        COALESCE(sm.downloads, 0) as downloads,
        u.username, u.reputation,
        sm.featured, sm.published_at
      FROM strategies s
      LEFT JOIN strategy_performance sp ON s.id = sp.strategy_id AND s.version = sp.version
      LEFT JOIN strategy_ratings sr ON s.id = sr.strategy_id
      LEFT JOIN strategy_marketplace sm ON s.id = sm.strategy_id
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.visibility = 'public' AND s.status = 'published'
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (filter?.category) {
      query += ` AND s.category = $${paramIndex}`;
      params.push(filter.category);
      paramIndex++;
    }

    if (filter?.search) {
      query += ` AND (s.name ILIKE $${paramIndex} OR s.description ILIKE $${paramIndex})`;
      params.push(`%${filter.search}%`);
      paramIndex++;
    }

    if (filter?.tags && filter.tags.length > 0) {
      query += ` AND s.tags ?| $${paramIndex}`;
      params.push(filter.tags);
      paramIndex++;
    }

    query += ` GROUP BY s.id, sp.avg_return, sp.avg_sharpe, sp.avg_win_rate, sp.consistency, sp.total_backtests, sm.downloads, u.username, u.reputation, sm.featured, sm.published_at`;

    const sortBy = filter?.sortBy || "published_at";
    const sortOrder = filter?.sortOrder || "desc";

    if (sortBy === "performance") {
      query += ` ORDER BY sp.avg_sharpe ${sortOrder}`;
    } else {
      query += ` ORDER BY ${sortBy} ${sortOrder}`;
    }

    if (filter?.limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(filter.limit);
      paramIndex++;
    }

    if (filter?.offset) {
      query += ` OFFSET $${paramIndex}`;
      params.push(filter.offset);
    }

    const result = await this.pool.query(query, params);

    return result.rows.map((row) => ({
      strategyId: row.id,
      strategy: this.mapRowToStrategy(row),
      performance: {
        strategyId: row.id,
        version: row.version,
        backtestResults: [],
        avgReturn: parseFloat(row.avg_return) || 0,
        avgSharpe: parseFloat(row.avg_sharpe) || 0,
        avgWinRate: parseFloat(row.avg_win_rate) || 0,
        consistency: parseFloat(row.consistency) || 0,
        totalBacktests: parseInt(row.total_backtests) || 0,
      },
      ratings: {
        average: parseFloat(row.avg_rating) || 0,
        count: parseInt(row.rating_count) || 0,
      },
      downloads: parseInt(row.downloads) || 0,
      author: {
        id: row.user_id,
        username: row.username,
        reputation: parseInt(row.reputation) || 0,
      },
      featured: row.featured || false,
      publishedAt: row.published_at,
    }));
  }

  async publishToMarketplace(strategyId: string, userId: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      // Update strategy status
      const result = await client.query(
        "UPDATE strategies SET status = 'published', visibility = 'public' WHERE id = $1 AND user_id = $2 RETURNING *",
        [strategyId, userId]
      );

      if (result.rowCount === 0) {
        throw new Error("Strategy not found or unauthorized");
      }

      // Add to marketplace
      await client.query(
        `INSERT INTO strategy_marketplace (strategy_id, downloads, featured, published_at)
         VALUES ($1, 0, false, NOW())
         ON CONFLICT (strategy_id) DO NOTHING`,
        [strategyId]
      );

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async incrementDownloads(strategyId: string): Promise<void> {
    await this.pool.query(
      "UPDATE strategy_marketplace SET downloads = downloads + 1 WHERE strategy_id = $1",
      [strategyId]
    );
  }

  private mapRowToStrategy(row: any): Strategy {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description,
      category: row.category,
      status: row.status,
      visibility: row.visibility,
      version: row.version,
      parentId: row.parent_id,
      tags: typeof row.tags === "string" ? JSON.parse(row.tags) : row.tags,
      parameters: typeof row.parameters === "string" ? JSON.parse(row.parameters) : row.parameters,
      indicators: typeof row.indicators === "string" ? JSON.parse(row.indicators) : row.indicators,
      rules: typeof row.rules === "string" ? JSON.parse(row.rules) : row.rules,
      code: row.code,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapRowToVersion(row: any): StrategyVersion {
    return {
      id: row.id,
      strategyId: row.strategy_id,
      version: row.version,
      name: row.name,
      description: row.description,
      parameters: typeof row.parameters === "string" ? JSON.parse(row.parameters) : row.parameters,
      indicators: typeof row.indicators === "string" ? JSON.parse(row.indicators) : row.indicators,
      rules: typeof row.rules === "string" ? JSON.parse(row.rules) : row.rules,
      code: row.code,
      createdAt: row.created_at,
      createdBy: row.created_by,
      commitMessage: row.commit_message,
    };
  }

  private mapRowToPerformance(row: any): StrategyPerformance {
    return {
      strategyId: row.strategy_id,
      version: row.version,
      backtestResults: typeof row.backtest_results === "string" ? JSON.parse(row.backtest_results) : row.backtest_results,
      avgReturn: parseFloat(row.avg_return),
      avgSharpe: parseFloat(row.avg_sharpe),
      avgWinRate: parseFloat(row.avg_win_rate),
      consistency: parseFloat(row.consistency),
      totalBacktests: parseInt(row.total_backtests),
      lastBacktestAt: row.last_backtest_at,
    };
  }

  private mapRowToRating(row: any): StrategyRating {
    return {
      id: row.id,
      strategyId: row.strategy_id,
      userId: row.user_id,
      rating: row.rating,
      review: row.review,
      createdAt: row.created_at,
    };
  }
}
