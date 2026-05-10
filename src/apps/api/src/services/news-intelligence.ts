type NewsSentiment = "BULLISH" | "BEARISH" | "NEUTRAL";

export interface NewsItem {
  title: string;
  link: string;
  source: string;
  publishedAt: string;
  sentiment: NewsSentiment;
  score: number;
}

export interface NewsIntelligenceSnapshot {
  generatedAt: string;
  channelCount: number;
  totalArticles: number;
  sentiment: NewsSentiment;
  confidence: number;
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
  averageScore: number;
  topSignals: string[];
  items: NewsItem[];
}

const FEEDS: Array<{ source: string; url: string }> = [
  { source: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/" },
  { source: "Cointelegraph", url: "https://cointelegraph.com/rss" },
  { source: "Decrypt", url: "https://decrypt.co/feed" },
  { source: "The Block", url: "https://www.theblock.co/rss.xml" },
  { source: "Bitcoin Magazine", url: "https://bitcoinmagazine.com/.rss/full/" },
  { source: "BeInCrypto", url: "https://beincrypto.com/feed/" },
  { source: "NewsBTC", url: "https://www.newsbtc.com/feed/" },
  { source: "CryptoSlate", url: "https://cryptoslate.com/feed/" },
  { source: "AMBCrypto", url: "https://ambcrypto.com/feed/" },
  { source: "U.Today", url: "https://u.today/rss" },
  { source: "Blockworks", url: "https://blockworks.co/feed/" },
  { source: "Messari", url: "https://messari.io/rss" }
];

const BULLISH_TERMS = [
  "surge", "rally", "breakout", "bullish", "institutional buying", "adoption", "approval", "inflow", "accumulation",
  "all-time high", "ath", "upgrade", "partnership", "etf inflow", "record high", "momentum", "recovery", "gain"
];

const BEARISH_TERMS = [
  "crash", "dump", "selloff", "bearish", "outflow", "liquidation", "hack", "exploit", "ban", "lawsuit",
  "regulatory pressure", "fear", "recession", "drop", "decline", "warning", "risk-off", "bankruptcy", "insolvency"
];

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .trim();
}

function pickTag(content: string, tag: string): string {
  const match = content.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? decodeXml(match[1]) : "";
}

function toIsoDate(raw: string): string {
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? new Date().toISOString() : new Date(parsed).toISOString();
}

function scoreHeadline(text: string): { score: number; sentiment: NewsSentiment } {
  const normalized = text.toLowerCase();
  let score = 0;
  for (const term of BULLISH_TERMS) {
    if (normalized.includes(term)) score += 12;
  }
  for (const term of BEARISH_TERMS) {
    if (normalized.includes(term)) score -= 12;
  }

  const clamped = Math.max(-100, Math.min(100, score));
  if (clamped >= 15) return { score: clamped, sentiment: "BULLISH" };
  if (clamped <= -15) return { score: clamped, sentiment: "BEARISH" };
  return { score: clamped, sentiment: "NEUTRAL" };
}

function parseRssFeed(xml: string, source: string, limitPerFeed: number): NewsItem[] {
  const items = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
  return items.slice(0, limitPerFeed).map((entry) => {
    const title = pickTag(entry, "title");
    const link = pickTag(entry, "link");
    const publishedRaw = pickTag(entry, "pubDate") || pickTag(entry, "published") || pickTag(entry, "updated");
    const { score, sentiment } = scoreHeadline(title);

    return {
      title: title || `${source} update`,
      link,
      source,
      publishedAt: toIsoDate(publishedRaw),
      sentiment,
      score
    };
  });
}

export async function fetchNewsIntelligence(limit = 40): Promise<NewsIntelligenceSnapshot> {
  const perFeed = Math.max(2, Math.ceil(limit / FEEDS.length));

  const feedResults = await Promise.all(
    FEEDS.map(async (feed) => {
      try {
        const response = await fetch(feed.url, { headers: { "User-Agent": "TradeBot/1.0" } });
        if (!response.ok) return [];
        const xml = await response.text();
        return parseRssFeed(xml, feed.source, perFeed);
      } catch {
        return [];
      }
    })
  );

  const merged = feedResults.flat();
  const dedup = new Map<string, NewsItem>();
  for (const item of merged) {
    const key = item.link || `${item.source}:${item.title}`;
    if (!dedup.has(key)) dedup.set(key, item);
  }

  const items = Array.from(dedup.values())
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .slice(0, limit);

  const bullishCount = items.filter((x) => x.sentiment === "BULLISH").length;
  const bearishCount = items.filter((x) => x.sentiment === "BEARISH").length;
  const neutralCount = items.filter((x) => x.sentiment === "NEUTRAL").length;
  const averageScore = items.length ? items.reduce((sum, x) => sum + x.score, 0) / items.length : 0;
  const sentiment: NewsSentiment =
    averageScore >= 10 ? "BULLISH" : averageScore <= -10 ? "BEARISH" : "NEUTRAL";
  const confidence = Math.min(100, Math.round((Math.abs(averageScore) + items.length) * 1.6));

  const topSignals = items
    .filter((x) => Math.abs(x.score) >= 20)
    .slice(0, 5)
    .map((x) => `${x.source}: ${x.title}`);

  return {
    generatedAt: new Date().toISOString(),
    channelCount: FEEDS.length,
    totalArticles: items.length,
    sentiment,
    confidence,
    bullishCount,
    bearishCount,
    neutralCount,
    averageScore: Number(averageScore.toFixed(2)),
    topSignals,
    items
  };
}
