export interface NewsItem {
  title: string;
  link: string;
  publishedAt: string;
  source: string;
  description?: string;
}

export interface RSSNewsProviderOptions {
  feeds?: string[];
  timeoutMs?: number;
  maxItemsPerFeed?: number;
}

export class RSSNewsProvider {
  private readonly feeds: string[];
  private readonly timeoutMs: number;
  private readonly maxItemsPerFeed: number;

  constructor(options: RSSNewsProviderOptions = {}) {
    this.feeds = options.feeds ?? [
      "https://cointelegraph.com/rss",
      "https://www.coindesk.com/arc/outboundfeeds/rss/"
    ];
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.maxItemsPerFeed = options.maxItemsPerFeed ?? 10;
  }

  async fetchNews(): Promise<NewsItem[]> {
    const results = await Promise.allSettled(
      this.feeds.map((feed) => this.fetchFeed(feed))
    );

    const allItems: NewsItem[] = [];
    for (const result of results) {
      if (result.status === "fulfilled") {
        allItems.push(...result.value);
      }
    }

    return allItems
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .slice(0, 20);
  }

  private async fetchFeed(feedUrl: string): Promise<NewsItem[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(feedUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; TradingBot/1.0)"
        },
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`RSS feed error: ${response.status} ${response.statusText}`);
      }

      const xml = await response.text();
      return this.parseRSS(xml, feedUrl);
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseRSS(xml: string, feedUrl: string): NewsItem[] {
    const items: NewsItem[] = [];
    const source = this.extractSourceName(feedUrl);

    const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);

    for (const match of itemMatches) {
      const itemXml = match[1];

      const title = this.extractTag(itemXml, "title");
      const link = this.extractTag(itemXml, "link");
      const pubDate = this.extractTag(itemXml, "pubDate") || this.extractTag(itemXml, "published");
      const description = this.extractTag(itemXml, "description");

      if (title && link) {
        items.push({
          title: this.cleanText(title),
          link: this.cleanText(link),
          publishedAt: pubDate ? this.normalizeDate(pubDate) : new Date().toISOString(),
          source,
          description: description ? this.cleanText(description) : undefined
        });
      }

      if (items.length >= this.maxItemsPerFeed) {
        break;
      }
    }

    return items;
  }

  private extractTag(xml: string, tagName: string): string | null {
    const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\/${tagName}>`, "i");
    const match = xml.match(regex);
    return match ? match[1] : null;
  }

  private cleanText(text: string): string {
    return text
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/<[^>]+>/g, "")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }

  private normalizeDate(dateStr: string): string {
    try {
      return new Date(dateStr).toISOString();
    } catch {
      return new Date().toISOString();
    }
  }

  private extractSourceName(feedUrl: string): string {
    if (feedUrl.includes("cointelegraph")) return "CoinTelegraph";
    if (feedUrl.includes("coindesk")) return "CoinDesk";
    return "RSS Feed";
  }
}
