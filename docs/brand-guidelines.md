# Brand Guidelines - TradeBot

## Overview
TradeBot is an AI-powered cryptocurrency trading platform that combines cutting-edge technology with professional trading tools. Our visual identity reflects intelligence, precision, and trustworthiness while maintaining a modern, approachable aesthetic.

---

## Logo

### Primary Logo
- **File**: `logos/logo-main.svg`
- **Usage**: Main brand representation, marketing materials, website header
- **Description**: Circular design featuring candlestick pattern with AI neural network overlay and upward trend arrow
- **Minimum size**: 64px × 64px
- **Clear space**: Maintain 20px minimum padding around logo

### Wordmark Logo
- **File**: `logos/logo-wordmark.svg`
- **Usage**: Horizontal layouts, email signatures, documentation headers
- **Description**: Icon + "TRADEBOT" text with tagline
- **Minimum size**: 200px width

### Icon Logo
- **File**: `logos/logo-icon.svg`
- **Usage**: Favicon, app icons, social media avatars, small UI elements
- **Description**: Simplified square icon with candlestick pattern
- **Sizes**: 16px, 32px, 64px, 128px, 256px, 512px

---

## Color Palette

### Primary Colors

#### Cyan Blue
- **Hex**: `#00D4FF`
- **RGB**: `0, 212, 255`
- **Usage**: Primary brand color, CTAs, links, highlights
- **Meaning**: Technology, innovation, trust

#### Deep Blue
- **Hex**: `#0066FF`
- **RGB**: `0, 102, 255`
- **Usage**: Secondary accents, gradients with cyan
- **Meaning**: Stability, professionalism

#### Success Green
- **Hex**: `#00FF88`
- **RGB**: `0, 255, 136`
- **Usage**: Bullish indicators, positive trends, success states
- **Meaning**: Growth, profit, positive signals

#### Alert Red
- **Hex**: `#FF4757`
- **RGB**: `255, 71, 87`
- **Usage**: Bearish indicators, warnings, negative trends
- **Meaning**: Caution, loss, negative signals

### Neutral Colors

#### Dark Background
- **Hex**: `#0A0E27`
- **RGB**: `10, 14, 39`
- **Usage**: Primary background, dark mode

#### Secondary Background
- **Hex**: `#1A1F3A`
- **RGB**: `26, 31, 58`
- **Usage**: Cards, panels, elevated surfaces

#### Text Gray
- **Hex**: `#6B7280`
- **RGB**: `107, 114, 128`
- **Usage**: Secondary text, labels, captions

#### White
- **Hex**: `#FFFFFF`
- **RGB**: `255, 255, 255`
- **Usage**: Primary text on dark backgrounds, light mode backgrounds

### Gradients

#### Primary Gradient
```css
background: linear-gradient(135deg, #00D4FF 0%, #0066FF 100%);
```
- **Usage**: Buttons, headers, hero sections, logo

#### Success Gradient
```css
background: linear-gradient(135deg, #00FF88 0%, #00D4FF 100%);
```
- **Usage**: Positive metrics, success indicators

#### Background Gradient
```css
background: linear-gradient(135deg, #0A0E27 0%, #1A1F3A 100%);
```
- **Usage**: Page backgrounds, large sections

---

## Typography

### Primary Font: **Inter** (or Arial/Helvetica as fallback)
- **Headings**: Bold (700), sizes 48px, 36px, 24px, 18px
- **Body**: Regular (400), size 16px, line-height 1.6
- **Captions**: Regular (400), size 14px, 12px
- **Buttons**: Semi-bold (600), size 16px, 14px

### Monospace Font: **JetBrains Mono** (or Courier as fallback)
- **Usage**: Code, numbers, data values, timestamps
- **Weight**: Regular (400), Medium (500)
- **Sizes**: 14px, 12px

### Font Hierarchy
```
H1: 48px / Bold / #FFFFFF
H2: 36px / Bold / #FFFFFF
H3: 24px / Bold / #FFFFFF
H4: 18px / Semi-bold / #FFFFFF
Body: 16px / Regular / #FFFFFF
Caption: 14px / Regular / #6B7280
Small: 12px / Regular / #6B7280
```

---

## Icon System

### Icon Library
All icons are located in `icons/` directory and follow a consistent 24×24px grid system.

#### Available Icons:
- `icon-portfolio.svg` - Portfolio management
- `icon-trend-up.svg` - Bullish trends
- `icon-trend-down.svg` - Bearish trends
- `icon-bot.svg` - AI/automation features
- `icon-alert.svg` - Notifications
- `icon-chart.svg` - Analytics
- `icon-wallet.svg` - Wallet/funds
- `icon-signal.svg` - Trading signals
- `icon-dashboard.svg` - Dashboard view
- `icon-backtest.svg` - Backtesting
- `icon-settings.svg` - Configuration
- `icon-strategy.svg` - Trading strategies

### Icon Guidelines
- **Stroke width**: 2px
- **Style**: Outline/line icons
- **Color**: Use `currentColor` for flexibility
- **Size**: 24×24px base, scale proportionally
- **Padding**: 2px internal padding from edges

---

## Visual Language

### Design Principles

1. **Data-Driven Aesthetics**
   - Emphasize charts, graphs, and data visualizations
   - Use algorithmic patterns and geometric shapes
   - Incorporate candlestick patterns as visual motifs

2. **Professional Yet Approachable**
   - Clean, modern interface design
   - Sophisticated color palette
   - Clear information hierarchy

3. **Technology-Forward**
   - Neural network visualizations
   - Animated data flows
   - Futuristic but functional design

4. **Trust and Reliability**
   - Consistent visual system
   - Professional typography
   - Clear, honest communication

### Visual Elements

#### Candlestick Patterns
- Primary visual motif representing trading
- Use green (#00FF88) for bullish candles
- Use red (#FF4757) for bearish candles
- Include wicks (thin lines) and bodies (rectangles)

#### Neural Networks
- Represent AI capabilities
- Use connected nodes and layers
- Animate data flow with subtle motion
- Color code: input (cyan), hidden (blue), output (green/red)

#### Geometric Patterns
- Fibonacci spirals
- Grid systems
- Triangular patterns (ascending/descending)
- Wave patterns (market cycles)

#### Glow Effects
- Subtle radial gradients for depth
- Use sparingly on key elements
- Opacity: 0.2-0.4 for backgrounds, 0.6-0.8 for highlights

---

## Chart Themes

### Dark Theme (Primary)
- **Background**: `#0A0E27` to `#1A1F3A` gradient
- **Grid lines**: `#00D4FF` at 10% opacity
- **Bullish candles**: `#00FF88`
- **Bearish candles**: `#FF4757`
- **Moving averages**: `#00D4FF` (fast), `#0066FF` (slow)
- **Volume bars**: Match candle colors at 50% opacity

### Chart Components
- **Candlesticks**: 2px wicks, 16px body width
- **Grid**: 1px lines, subtle opacity
- **Indicators**: 2px line width, dashed for secondary
- **Labels**: 12px monospace font, `#6B7280`
- **Tooltips**: Dark background with cyan border

---

## Marketing Graphics

### Social Media Templates

#### Banner Dimensions
- **Twitter/X Header**: 1500×500px
- **LinkedIn Banner**: 1584×396px
- **Facebook Cover**: 820×312px
- **Generic Social**: 1200×630px (provided)

#### Post Dimensions
- **Square**: 1080×1080px
- **Story**: 1080×1920px
- **Landscape**: 1200×630px

### Design Elements for Marketing
- Use hero banner template (`graphics/hero-banner.svg`)
- Include logo in top-left or center
- Feature key statistics or benefits
- Use primary gradient for CTAs
- Maintain 10% safe margin on all sides

---

## Usage Guidelines

### Do's ✓
- Use provided SVG files for scalability
- Maintain color consistency across platforms
- Use gradients for premium feel
- Include sufficient white space
- Ensure text contrast meets WCAG AA standards
- Use monospace fonts for numerical data
- Animate subtly (2-4 second loops)

### Don'ts ✗
- Don't distort or skew the logo
- Don't use colors outside the palette
- Don't place logo on busy backgrounds
- Don't use drop shadows on logo
- Don't rotate logo beyond ±5 degrees
- Don't use more than 3 colors in one design
- Don't use Comic Sans or decorative fonts

---

## Accessibility

### Color Contrast
- **Text on dark background**: Use white (#FFFFFF) or cyan (#00D4FF)
- **Minimum contrast ratio**: 4.5:1 for normal text, 3:1 for large text
- **Interactive elements**: Ensure 3:1 contrast with surroundings

### Alternative Text
- All logos: "TradeBot - AI-Powered Trading Platform"
- Icons: Descriptive text matching function
- Charts: Provide data table alternatives

### Motion
- Respect `prefers-reduced-motion` media query
- Keep animations under 5 seconds
- Provide pause controls for continuous animations

---

## File Organization

```
apps/web/public/brand/
├── logos/
│   ├── logo-main.svg          # Primary circular logo
│   ├── logo-wordmark.svg      # Horizontal logo with text
│   └── logo-icon.svg          # Square icon version
├── icons/
│   ├── icon-portfolio.svg
│   ├── icon-trend-up.svg
│   ├── icon-trend-down.svg
│   ├── icon-bot.svg
│   ├── icon-alert.svg
│   ├── icon-chart.svg
│   ├── icon-wallet.svg
│   ├── icon-signal.svg
│   ├── icon-dashboard.svg
│   ├── icon-backtest.svg
│   ├── icon-settings.svg
│   └── icon-strategy.svg
├── graphics/
│   ├── social-banner.svg      # 1200×630 social media banner
│   └── hero-banner.svg        # 1200×400 website hero
└── visualizations/
    ├── algorithmic-pattern-1.svg  # Generative art pattern
    ├── chart-theme-dark.svg       # Chart styling example
    └── neural-network.svg         # AI visualization
```

---

## Implementation Examples

### CSS Variables
```css
:root {
  /* Colors */
  --color-primary: #00D4FF;
  --color-secondary: #0066FF;
  --color-success: #00FF88;
  --color-danger: #FF4757;
  --color-bg-dark: #0A0E27;
  --color-bg-secondary: #1A1F3A;
  --color-text-primary: #FFFFFF;
  --color-text-secondary: #6B7280;

  /* Gradients */
  --gradient-primary: linear-gradient(135deg, #00D4FF 0%, #0066FF 100%);
  --gradient-success: linear-gradient(135deg, #00FF88 0%, #00D4FF 100%);
  --gradient-bg: linear-gradient(135deg, #0A0E27 0%, #1A1F3A 100%);

  /* Typography */
  --font-primary: 'Inter', Arial, sans-serif;
  --font-mono: 'JetBrains Mono', 'Courier New', monospace;

  /* Spacing */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;

  /* Border Radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-full: 9999px;
}
```

### Button Component
```css
.btn-primary {
  background: var(--gradient-primary);
  color: var(--color-text-primary);
  font-family: var(--font-primary);
  font-weight: 600;
  font-size: 16px;
  padding: 12px 24px;
  border-radius: var(--radius-full);
  border: none;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(0, 212, 255, 0.3);
}
```

### Card Component
```css
.card {
  background: var(--color-bg-secondary);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  border: 1px solid rgba(0, 212, 255, 0.1);
  transition: border-color 0.2s;
}

.card:hover {
  border-color: rgba(0, 212, 255, 0.3);
}
```

---

## Version History
- **v1.0** (2026-05-05): Initial brand guidelines created
  - Logo system established
  - Color palette defined
  - Icon library created
  - Marketing templates designed
  - Chart themes developed

---

## Contact & Support
For questions about brand usage or to request additional assets, contact the design team.

**Brand Assets Repository**: `/apps/web/public/brand/`

---

*These guidelines ensure consistent, professional representation of the TradeBot brand across all touchpoints.*
