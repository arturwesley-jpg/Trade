import { createGzip, createBrotliCompress } from 'zlib';
import { pipeline } from 'stream/promises';
import type { FastifyRequest, FastifyReply } from 'fastify';

export interface CompressionOptions {
  threshold?: number; // Minimum size in bytes to compress
  level?: number; // Compression level (1-9)
  brotli?: boolean; // Enable Brotli compression
}

export class CompressionMiddleware {
  private threshold: number;
  private level: number;
  private brotli: boolean;

  constructor(options: CompressionOptions = {}) {
    this.threshold = options.threshold ?? 1024; // 1KB default
    this.level = options.level ?? 6; // Balanced compression
    this.brotli = options.brotli ?? true;
  }

  shouldCompress(request: FastifyRequest, contentLength?: number): string | null {
    // Check if client accepts compression
    const acceptEncoding = request.headers['accept-encoding'] || '';

    // Check content length threshold
    if (contentLength && contentLength < this.threshold) {
      return null;
    }

    // Prefer Brotli if available and enabled
    if (this.brotli && acceptEncoding.includes('br')) {
      return 'br';
    }

    // Fall back to Gzip
    if (acceptEncoding.includes('gzip')) {
      return 'gzip';
    }

    return null;
  }

  compress(data: Buffer, encoding: 'gzip' | 'br'): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const compressor = encoding === 'br'
        ? createBrotliCompress({ params: { [11]: this.level } })
        : createGzip({ level: this.level });

      compressor.on('data', (chunk) => chunks.push(chunk));
      compressor.on('end', () => resolve(Buffer.concat(chunks)));
      compressor.on('error', reject);

      compressor.write(data);
      compressor.end();
    });
  }

  async handler(request: FastifyRequest, reply: FastifyReply, payload: any): Promise<any> {
    // Skip compression for non-compressible content types
    const contentType = reply.getHeader('content-type') as string;
    if (!contentType || !this.isCompressible(contentType)) {
      return payload;
    }

    // Convert payload to buffer
    const buffer = Buffer.isBuffer(payload)
      ? payload
      : Buffer.from(typeof payload === 'string' ? payload : JSON.stringify(payload));

    // Check if compression is needed
    const encoding = this.shouldCompress(request, buffer.length);
    if (!encoding) {
      return payload;
    }

    // Compress the payload
    const compressed = await this.compress(buffer, encoding as 'gzip' | 'br');

    // Set compression headers
    reply.header('Content-Encoding', encoding);
    reply.header('Content-Length', compressed.length);
    reply.header('Vary', 'Accept-Encoding');

    return compressed;
  }

  private isCompressible(contentType: string): boolean {
    const compressibleTypes = [
      'text/',
      'application/json',
      'application/javascript',
      'application/xml',
      'application/x-www-form-urlencoded'
    ];

    return compressibleTypes.some(type => contentType.includes(type));
  }
}

export function createCompressionMiddleware(options?: CompressionOptions) {
  const middleware = new CompressionMiddleware(options);
  return middleware.handler.bind(middleware);
}
