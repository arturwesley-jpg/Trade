/**
 * Notification Templates
 * Pre-defined templates for common notification types
 */

export interface TemplateVariable {
  name: string;
  description: string;
  required: boolean;
  type: "string" | "number" | "boolean" | "date";
}

export interface NotificationTemplateDefinition {
  id: string;
  name: string;
  description: string;
  category: "signal" | "alert" | "trade" | "price" | "system";
  channels: string[];
  variables: TemplateVariable[];
  subject?: string;
  body: string;
  htmlBody?: string;
  priority: "low" | "normal" | "high" | "critical";
}

export const templates: Record<string, NotificationTemplateDefinition> = {
  SIGNAL_GENERATED: {
    id: "signal_generated",
    name: "Signal Generated",
    description: "Notification when a new trading signal is generated",
    category: "signal",
    channels: ["email", "telegram", "push", "in-app"],
    priority: "high",
    subject: "New {{signalType}} Signal: {{symbol}}",
    body: `🎯 New {{signalType}} Signal Detected

Symbol: {{symbol}}
Price: ${{price}}
Signal Strength: {{strength}}/100
Timeframe: {{timeframe}}
Indicators: {{indicators}}

Recommendation: {{recommendation}}

{{#if stopLoss}}Stop Loss: ${{stopLoss}}{{/if}}
{{#if takeProfit}}Take Profit: ${{takeProfit}}{{/if}}

Generated at: {{timestamp}}`,
    htmlBody: `<div style="font-family: Arial, sans-serif;">
  <h2 style="color: #10b981;">🎯 New {{signalType}} Signal Detected</h2>
  <table style="width: 100%; border-collapse: collapse;">
    <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Symbol:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">{{symbol}}</td></tr>
    <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Price:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">\${{price}}</td></tr>
    <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Signal Strength:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">{{strength}}/100</td></tr>
    <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Timeframe:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">{{timeframe}}</td></tr>
  </table>
  <p style="margin-top: 16px;"><strong>Recommendation:</strong> {{recommendation}}</p>
</div>`,
    variables: [
      { name: "signalType", description: "Type of signal (BUY/SELL)", required: true, type: "string" },
      { name: "symbol", description: "Trading symbol", required: true, type: "string" },
      { name: "price", description: "Current price", required: true, type: "number" },
      { name: "strength", description: "Signal strength (0-100)", required: true, type: "number" },
      { name: "timeframe", description: "Signal timeframe", required: true, type: "string" },
      { name: "indicators", description: "Indicators used", required: true, type: "string" },
      { name: "recommendation", description: "Trading recommendation", required: true, type: "string" },
      { name: "stopLoss", description: "Stop loss price", required: false, type: "number" },
      { name: "takeProfit", description: "Take profit price", required: false, type: "number" },
      { name: "timestamp", description: "Signal timestamp", required: true, type: "date" }
    ]
  },

  ALERT_TRIGGERED: {
    id: "alert_triggered",
    name: "Alert Triggered",
    description: "Notification when a price alert is triggered",
    category: "alert",
    channels: ["email", "telegram", "sms", "push", "in-app"],
    priority: "critical",
    subject: "Alert Triggered: {{symbol}} {{condition}}",
    body: `🚨 Price Alert Triggered

Symbol: {{symbol}}
Current Price: ${{currentPrice}}
Alert Condition: {{condition}}
Target Price: ${{targetPrice}}

{{message}}

Triggered at: {{timestamp}}`,
    htmlBody: `<div style="font-family: Arial, sans-serif; background: #fef2f2; padding: 16px; border-left: 4px solid #ef4444;">
  <h2 style="color: #dc2626;">🚨 Price Alert Triggered</h2>
  <p><strong>Symbol:</strong> {{symbol}}</p>
  <p><strong>Current Price:</strong> \${{currentPrice}}</p>
  <p><strong>Alert Condition:</strong> {{condition}}</p>
  <p><strong>Target Price:</strong> \${{targetPrice}}</p>
  <p style="margin-top: 16px;">{{message}}</p>
</div>`,
    variables: [
      { name: "symbol", description: "Trading symbol", required: true, type: "string" },
      { name: "currentPrice", description: "Current price", required: true, type: "number" },
      { name: "condition", description: "Alert condition", required: true, type: "string" },
      { name: "targetPrice", description: "Target price", required: true, type: "number" },
      { name: "message", description: "Alert message", required: true, type: "string" },
      { name: "timestamp", description: "Trigger timestamp", required: true, type: "date" }
    ]
  },

  TRADE_EXECUTED: {
    id: "trade_executed",
    name: "Trade Executed",
    description: "Notification when a trade is executed",
    category: "trade",
    channels: ["email", "telegram", "push", "in-app"],
    priority: "high",
    subject: "Trade Executed: {{side}} {{symbol}}",
    body: `✅ Trade Executed Successfully

Order ID: {{orderId}}
Symbol: {{symbol}}
Side: {{side}}
Quantity: {{quantity}}
Price: ${{price}}
Total: ${{total}}

Status: {{status}}
Executed at: {{timestamp}}`,
    htmlBody: `<div style="font-family: Arial, sans-serif; background: #f0fdf4; padding: 16px; border-left: 4px solid #10b981;">
  <h2 style="color: #059669;">✅ Trade Executed Successfully</h2>
  <table style="width: 100%; border-collapse: collapse;">
    <tr><td style="padding: 8px;"><strong>Order ID:</strong></td><td style="padding: 8px;">{{orderId}}</td></tr>
    <tr><td style="padding: 8px;"><strong>Symbol:</strong></td><td style="padding: 8px;">{{symbol}}</td></tr>
    <tr><td style="padding: 8px;"><strong>Side:</strong></td><td style="padding: 8px;">{{side}}</td></tr>
    <tr><td style="padding: 8px;"><strong>Quantity:</strong></td><td style="padding: 8px;">{{quantity}}</td></tr>
    <tr><td style="padding: 8px;"><strong>Price:</strong></td><td style="padding: 8px;">\${{price}}</td></tr>
    <tr><td style="padding: 8px;"><strong>Total:</strong></td><td style="padding: 8px;">\${{total}}</td></tr>
  </table>
</div>`,
    variables: [
      { name: "orderId", description: "Order ID", required: true, type: "string" },
      { name: "symbol", description: "Trading symbol", required: true, type: "string" },
      { name: "side", description: "Order side (BUY/SELL)", required: true, type: "string" },
      { name: "quantity", description: "Order quantity", required: true, type: "number" },
      { name: "price", description: "Execution price", required: true, type: "number" },
      { name: "total", description: "Total value", required: true, type: "number" },
      { name: "status", description: "Order status", required: true, type: "string" },
      { name: "timestamp", description: "Execution timestamp", required: true, type: "date" }
    ]
  },

  PRICE_ALERT: {
    id: "price_alert",
    name: "Price Alert",
    description: "Simple price movement notification",
    category: "price",
    channels: ["telegram", "sms", "push", "in-app"],
    priority: "normal",
    subject: "{{symbol}} Price Update",
    body: `📊 Price Update: {{symbol}}

Current Price: ${{price}}
Change: {{change}}% ({{changeDirection}})
24h High: ${{high24h}}
24h Low: ${{low24h}}
Volume: {{volume}}

Updated at: {{timestamp}}`,
    variables: [
      { name: "symbol", description: "Trading symbol", required: true, type: "string" },
      { name: "price", description: "Current price", required: true, type: "number" },
      { name: "change", description: "Price change percentage", required: true, type: "number" },
      { name: "changeDirection", description: "UP/DOWN", required: true, type: "string" },
      { name: "high24h", description: "24h high", required: true, type: "number" },
      { name: "low24h", description: "24h low", required: true, type: "number" },
      { name: "volume", description: "Trading volume", required: true, type: "string" },
      { name: "timestamp", description: "Update timestamp", required: true, type: "date" }
    ]
  },

  SYSTEM_NOTIFICATION: {
    id: "system_notification",
    name: "System Notification",
    description: "General system notifications",
    category: "system",
    channels: ["email", "in-app"],
    priority: "low",
    subject: "{{title}}",
    body: `{{message}}

{{#if actionUrl}}
Action Required: {{actionUrl}}
{{/if}}

Sent at: {{timestamp}}`,
    variables: [
      { name: "title", description: "Notification title", required: true, type: "string" },
      { name: "message", description: "Notification message", required: true, type: "string" },
      { name: "actionUrl", description: "Action URL", required: false, type: "string" },
      { name: "timestamp", description: "Notification timestamp", required: true, type: "date" }
    ]
  }
};

export { templates };

/**
 * Get template by ID
 */
export function getTemplate(id: string): NotificationTemplateDefinition | undefined {
  return templates[id.toUpperCase()];
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: string): NotificationTemplateDefinition[] {
  return Object.values(templates).filter(t => t.category === category);
}

/**
 * Get templates by channel
 */
export function getTemplatesByChannel(channel: string): NotificationTemplateDefinition[] {
  return Object.values(templates).filter(t => t.channels.includes(channel));
}

/**
 * Render template with data
 */
export function renderTemplate(template: string, data: Record<string, any>): string {
  let rendered = template;

  // Replace simple variables {{variable}}
  rendered = rendered.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return data[key] !== undefined ? String(data[key]) : match;
  });

  // Handle conditional blocks {{#if variable}}...{{/if}}
  rendered = rendered.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, key, content) => {
    return data[key] ? content : "";
  });

  return rendered;
}

/**
 * Validate template data
 */
export function validateTemplateData(
  template: NotificationTemplateDefinition,
  data: Record<string, any>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const variable of template.variables) {
    if (variable.required && data[variable.name] === undefined) {
      errors.push(`Missing required variable: ${variable.name}`);
    }

    if (data[variable.name] !== undefined) {
      const actualType = typeof data[variable.name];
      const expectedType = variable.type === "date" ? "string" : variable.type;

      if (actualType !== expectedType) {
        errors.push(
          `Invalid type for ${variable.name}: expected ${expectedType}, got ${actualType}`
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}