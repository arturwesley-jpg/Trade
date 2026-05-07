import { z } from 'zod';

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginationResult<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

export class PaginationHelper {
  static validate(params: unknown): PaginationParams {
    return paginationSchema.parse(params);
  }

  static getOffset(page: number, pageSize: number): number {
    return (page - 1) * pageSize;
  }

  static getLimit(pageSize: number): number {
    return pageSize;
  }

  static buildResult<T>(
    data: T[],
    total: number,
    page: number,
    pageSize: number
  ): PaginationResult<T> {
    const totalPages = Math.ceil(total / pageSize);

    return {
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    };
  }

  static buildSqlPagination(params: PaginationParams): {
    limit: number;
    offset: number;
    orderBy: string;
  } {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const sortBy = params.sortBy ?? 'created_at';
    const sortOrder = params.sortOrder ?? 'desc';

    return {
      limit: pageSize,
      offset: this.getOffset(page, pageSize),
      orderBy: `${sortBy} ${sortOrder.toUpperCase()}`
    };
  }

  static buildCursorPagination(params: {
    cursor?: string;
    limit?: number;
  }): {
    cursor: string | null;
    limit: number;
  } {
    return {
      cursor: params.cursor ?? null,
      limit: Math.min(params.limit ?? 20, 100)
    };
  }
}

// Field selection helper (GraphQL-style)
export class FieldSelector {
  static parse(fields?: string): string[] | null {
    if (!fields) return null;
    return fields.split(',').map(f => f.trim()).filter(Boolean);
  }

  static buildSqlSelect(fields: string[] | null, allowedFields: string[]): string {
    if (!fields) return '*';

    const validFields = fields.filter(f => allowedFields.includes(f));
    return validFields.length > 0 ? validFields.join(', ') : '*';
  }

  static filterObject<T extends Record<string, any>>(
    obj: T,
    fields: string[] | null
  ): Partial<T> {
    if (!fields) return obj;

    const result: Partial<T> = {};
    for (const field of fields) {
      if (field in obj) {
        result[field as keyof T] = obj[field];
      }
    }
    return result;
  }
}

// Batch request helper
export interface BatchRequest<T> {
  id: string;
  params: T;
}

export interface BatchResponse<T> {
  id: string;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export class BatchProcessor {
  static async process<TRequest, TResponse>(
    requests: BatchRequest<TRequest>[],
    handler: (params: TRequest) => Promise<TResponse>
  ): Promise<BatchResponse<TResponse>[]> {
    const results = await Promise.allSettled(
      requests.map(async (req) => {
        try {
          const data = await handler(req.params);
          return { id: req.id, data };
        } catch (error) {
          return {
            id: req.id,
            error: {
              code: 'BATCH_ITEM_FAILED',
              message: error instanceof Error ? error.message : 'Unknown error'
            }
          };
        }
      })
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      return {
        id: requests[index].id,
        error: {
          code: 'BATCH_PROCESSING_FAILED',
          message: result.reason?.message ?? 'Processing failed'
        }
      };
    });
  }

  static validateBatchSize(requests: unknown[], maxSize: number = 50): void {
    if (!Array.isArray(requests)) {
      throw new Error('Batch requests must be an array');
    }
    if (requests.length === 0) {
      throw new Error('Batch requests cannot be empty');
    }
    if (requests.length > maxSize) {
      throw new Error(`Batch size exceeds maximum of ${maxSize}`);
    }
  }
}
