const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType, PageBreak } = require('docx');
const fs = require('fs');

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 24 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, font: "Arial", color: "2E75B6" },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: "Arial", color: "2E75B6" },
        paragraph: { spacing: { before: 180, after: 100 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, font: "Arial", color: "2E75B6" },
        paragraph: { spacing: { before: 140, after: 80 }, outlineLevel: 2 } },
      { id: "Code", name: "Code", basedOn: "Normal", next: "Normal",
        run: { font: "Courier New", size: 20 },
        paragraph: { spacing: { before: 80, after: 80 } } },
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
      }
    },
    children: [
      // Title Page
      new Paragraph({
        children: [new TextRun({ text: "Trade Platform", size: 48, bold: true, color: "2E75B6" })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 2880, after: 240 }
      }),
      new Paragraph({
        children: [new TextRun({ text: "API Reference Documentation", size: 36, bold: true })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 1440 }
      }),
      new Paragraph({
        children: [new TextRun({ text: "Version 1.0.0", size: 24 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 }
      }),
      new Paragraph({
        children: [new TextRun({ text: "Last Updated: May 5, 2026", size: 24 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 }
      }),
      new Paragraph({
        children: [new TextRun({ text: "Base URL: https://tradeb-5l5q.onrender.com", size: 22, italics: true })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 2880 }
      }),
      
      new Paragraph({ children: [new PageBreak()] }),
      
      // Table of Contents
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("Table of Contents")]
      }),
      new Paragraph({ children: [new TextRun("1. Authentication")] }),
      new Paragraph({ children: [new TextRun("2. Market Data Endpoints")] }),
      new Paragraph({ children: [new TextRun("3. Signal Management")] }),
      new Paragraph({ children: [new TextRun("4. Trading Operations")] }),
      new Paragraph({ children: [new TextRun("5. Backtesting")] }),
      new Paragraph({ children: [new TextRun("6. Notifications & Alerts")] }),
      new Paragraph({ children: [new TextRun("7. Monitoring & Metrics")] }),
      new Paragraph({ children: [new TextRun("8. WebSocket API")] }),
      new Paragraph({ children: [new TextRun("9. Error Codes")] }),
      new Paragraph({ children: [new TextRun("10. Rate Limits")] }),
      
      new Paragraph({ children: [new PageBreak()] }),
      
      // 1. Authentication
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("1. Authentication")]
      }),
      
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("Overview")]
      }),
      new Paragraph({
        children: [new TextRun("The Trade platform uses JWT (JSON Web Token) based authentication with access and refresh tokens.")]
      }),
      
      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun("Token Lifecycle")]
      }),
      new Paragraph({ children: [new TextRun("Access Token: 15 minutes validity", { bold: true })] }),
      new Paragraph({ children: [new TextRun("Refresh Token: 7 days validity", { bold: true })] }),
      new Paragraph({ children: [new TextRun("Storage: Secure HTTP-only cookies", { bold: true })] }),
      
      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun("POST /api/auth/register")]
      }),
      new Paragraph({ children: [new TextRun("Register a new user account.")] }),
      
      new Paragraph({ children: [new TextRun("Request Body:", { bold: true })] }),
      new Paragraph({
        style: "Code",
        children: [new TextRun('{\n  "email": "user@example.com",\n  "password": "SecurePassword123!",\n  "username": "trader_pro"\n}')]
      }),
      
      new Paragraph({ children: [new TextRun("Response (201 Created):", { bold: true })] }),
      new Paragraph({
        style: "Code",
        children: [new TextRun('{\n  "user": {\n    "id": "uuid-v4",\n    "email": "user@example.com",\n    "username": "trader_pro",\n    "role": "user"\n  },\n  "tokens": {\n    "accessToken": "eyJhbGci...",\n    "refreshToken": "eyJhbGci...",\n    "expiresIn": 900\n  }\n}')]
      }),
      
      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun("Validation Rules")]
      }),
      new Paragraph({ children: [new TextRun("Email: Valid email format, unique")] }),
      new Paragraph({ children: [new TextRun("Password: Minimum 8 characters, must contain uppercase, lowercase, number, special character")] }),
      new Paragraph({ children: [new TextRun("Username: 3-30 characters, alphanumeric with underscores")] }),
      
      new Paragraph({ children: [new PageBreak()] }),
      
      // 2. Market Data Endpoints
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("2. Market Data Endpoints")]
      }),
      
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("GET /api/market/tickers")]
      }),
      new Paragraph({ children: [new TextRun("Retrieve current market tickers for multiple symbols.")] }),
      
      new Paragraph({ children: [new TextRun("Query Parameters:", { bold: true })] }),
      new Paragraph({ children: [new TextRun("symbols (optional): Comma-separated list of symbols")] }),
      
      new Paragraph({ children: [new TextRun("Example Request:", { bold: true })] }),
      new Paragraph({
        style: "Code",
        children: [new TextRun("GET /api/market/tickers?symbols=BTC-USDT,ETH-USDT")]
      }),
      
      new Paragraph({ children: [new TextRun("Response (200 OK):", { bold: true })] }),
      new Paragraph({
        style: "Code",
        children: [new TextRun('{\n  "data": [{\n    "symbol": "BTC-USDT",\n    "price": 100000.00,\n    "volume": 1000000.00,\n    "provider": "binance",\n    "bid": 99990.00,\n    "ask": 100010.00\n  }],\n  "source": "cache"\n}')]
      }),
      
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("GET /api/market/candles/:symbol")]
      }),
      new Paragraph({ children: [new TextRun("Retrieve OHLCV (Open, High, Low, Close, Volume) candle data.")] }),
      
      new Paragraph({ children: [new TextRun("Query Parameters:", { bold: true })] }),
      new Paragraph({ children: [new TextRun("interval: Candle interval (1m, 5m, 15m, 1h, 4h, 1d) - default: 1h")] }),
      new Paragraph({ children: [new TextRun("limit: Number of candles (1-1000) - default: 100")] }),
      
      new Paragraph({ children: [new PageBreak()] }),
      
      // 3. Signal Management
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("3. Signal Management")]
      }),
      
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("GET /api/signals")]
      }),
      new Paragraph({ children: [new TextRun("List trading signals with filtering options.")] }),
      
      new Paragraph({ children: [new TextRun("Headers:", { bold: true })] }),
      new Paragraph({
        style: "Code",
        children: [new TextRun("Authorization: Bearer {accessToken}")]
      }),
      
      new Paragraph({ children: [new TextRun("Query Parameters:", { bold: true })] }),
      new Paragraph({ children: [new TextRun("symbol (optional): Filter by trading pair")] }),
      new Paragraph({ children: [new TextRun("limit: Number of signals (1-100) - default: 10")] }),
      new Paragraph({ children: [new TextRun("active (optional): Filter by active status (true/false)")] }),
      
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("POST /api/signals/generate")]
      }),
      new Paragraph({ children: [new TextRun("Generate a new trading signal based on market data.")] }),
      
      new Paragraph({ children: [new TextRun("Request Body:", { bold: true })] }),
      new Paragraph({
        style: "Code",
        children: [new TextRun('{\n  "symbol": "BTC-USDT",\n  "interval": "1h",\n  "lookback": 100\n}')]
      }),
      
      new Paragraph({ children: [new PageBreak()] }),
      
      // 4. Error Codes Table
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("9. Error Codes")]
      }),
      
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [3120, 2340, 3900],
        rows: [
          new TableRow({
            children: [
              new TableCell({
                borders,
                width: { size: 3120, type: WidthType.DXA },
                shading: { fill: "2E75B6", type: ShadingType.CLEAR },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "Code", bold: true, color: "FFFFFF" })] })]
              }),
              new TableCell({
                borders,
                width: { size: 2340, type: WidthType.DXA },
                shading: { fill: "2E75B6", type: ShadingType.CLEAR },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "HTTP Status", bold: true, color: "FFFFFF" })] })]
              }),
              new TableCell({
                borders,
                width: { size: 3900, type: WidthType.DXA },
                shading: { fill: "2E75B6", type: ShadingType.CLEAR },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: "Description", bold: true, color: "FFFFFF" })] })]
              })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({
                borders,
                width: { size: 3120, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun("INVALID_REQUEST")] })]
              }),
              new TableCell({
                borders,
                width: { size: 2340, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun("400")] })]
              }),
              new TableCell({
                borders,
                width: { size: 3900, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun("Request validation failed")] })]
              })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({
                borders,
                width: { size: 3120, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun("UNAUTHORIZED")] })]
              }),
              new TableCell({
                borders,
                width: { size: 2340, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun("401")] })]
              }),
              new TableCell({
                borders,
                width: { size: 3900, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun("Authentication required")] })]
              })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({
                borders,
                width: { size: 3120, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun("NOT_FOUND")] })]
              }),
              new TableCell({
                borders,
                width: { size: 2340, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun("404")] })]
              }),
              new TableCell({
                borders,
                width: { size: 3900, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun("Resource not found")] })]
              })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({
                borders,
                width: { size: 3120, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun("RATE_LIMIT_EXCEEDED")] })]
              }),
              new TableCell({
                borders,
                width: { size: 2340, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun("429")] })]
              }),
              new TableCell({
                borders,
                width: { size: 3900, type: WidthType.DXA },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun("Too many requests")] })]
              })
            ]
          })
        ]
      }),
      
      new Paragraph({ children: [new PageBreak()] }),
      
      // 10. Rate Limits
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("10. Rate Limits")]
      }),
      
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("API Endpoints")]
      }),
      new Paragraph({ children: [new TextRun("General: 100 requests per minute", { bold: true })] }),
      new Paragraph({ children: [new TextRun("Authentication: 10 requests per minute", { bold: true })] }),
      new Paragraph({ children: [new TextRun("Market Data: 200 requests per minute", { bold: true })] }),
      new Paragraph({ children: [new TextRun("Trading: 50 requests per minute", { bold: true })] }),
      
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("WebSocket")]
      }),
      new Paragraph({ children: [new TextRun("Connections: 5 per user")] }),
      new Paragraph({ children: [new TextRun("Messages: 100 per minute per connection")] }),
      
      new Paragraph({ children: [new PageBreak()] }),
      
      // Support Section
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("Support")]
      }),
      new Paragraph({ children: [new TextRun("For API support and questions:")] }),
      new Paragraph({ children: [new TextRun("Documentation: https://github.com/arturwesley-jpg/TradeB")] }),
      new Paragraph({ children: [new TextRun("Issues: https://github.com/arturwesley-jpg/TradeB/issues")] }),
      new Paragraph({ children: [new TextRun("Email: support@tradingbot.com")] }),
      
      new Paragraph({ spacing: { before: 480 } }),
      new Paragraph({
        children: [new TextRun("Document Version: 1.0.0", { italics: true })],
        alignment: AlignmentType.CENTER
      }),
      new Paragraph({
        children: [new TextRun("Last Updated: May 5, 2026", { italics: true })],
        alignment: AlignmentType.CENTER
      }),
      new Paragraph({
        children: [new TextRun("Copyright Trade Platform 2026", { italics: true })],
        alignment: AlignmentType.CENTER
      })
    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("API_Reference.docx", buffer);
  console.log("API Reference document created successfully");
});
