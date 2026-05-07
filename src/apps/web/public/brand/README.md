# TradeBot Brand Assets - README

## Overview
This directory contains the complete visual identity system for TradeBot, an AI-powered cryptocurrency trading platform. All assets are production-ready and optimized for web, mobile, and print use.

## Directory Structure

```
brand/
├── logos/                      # Logo variations
│   ├── logo-main.svg          # Primary circular logo (200×200)
│   ├── logo-wordmark.svg      # Horizontal logo with text (400×100)
│   ├── logo-icon.svg          # Square icon version (64×64)
│   ├── favicon-16x16.svg      # Favicon 16px
│   └── favicon-32x32.svg      # Favicon 32px
│
├── icons/                      # UI icon library (24×24)
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
│
├── graphics/                   # Marketing materials
│   ├── hero-banner.svg        # Website hero (1200×400)
│   ├── social-banner.svg      # Social sharing (1200×630)
│   ├── social-post-square.svg # Instagram/Facebook (1080×1080)
│   └── social-story.svg       # Stories format (1080×1920)
│
├── visualizations/             # Data visualization assets
│   ├── chart-theme-dark.svg   # Chart styling example (800×600)
│   ├── neural-network.svg     # AI visualization (800×800)
│   ├── algorithmic-pattern-1.svg  # Generative art (800×800)
│   └── algorithmic-pattern-2.svg  # Voronoi pattern (800×800)
│
├── design-system.css          # Complete CSS design system
├── index.html                 # Brand assets preview page
└── README.md                  # This file
```

## Quick Start

### Using Logos
```html
<!-- Main logo -->
<img src="/brand/logos/logo-main.svg" alt="TradeBot" width="200" height="200">

<!-- Wordmark for headers -->
<img src="/brand/logos/logo-wordmark.svg" alt="TradeBot" width="400" height="100">

<!-- Icon for small spaces -->
<img src="/brand/logos/logo-icon.svg" alt="TradeBot" width="64" height="64">
```

### Using Icons
```html
<!-- Icons use currentColor for flexibility -->
<img src="/brand/icons/icon-chart.svg" alt="Chart" width="24" height="24" style="color: #00D4FF;">
```

### Using Design System
```html
<link rel="stylesheet" href="/brand/design-system.css">

<button class="btn btn-primary">Trade Now</button>
<div class="card">
  <h3 class="card-title">Portfolio</h3>
  <p class="text-secondary">Your trading performance</p>
</div>
```

## Color Palette

### Primary Colors
- **Cyan Blue**: `#00D4FF` - Primary brand color
- **Deep Blue**: `#0066FF` - Secondary accents
- **Success Green**: `#00FF88` - Bullish indicators
- **Alert Red**: `#FF4757` - Bearish indicators

### Backgrounds
- **Dark**: `#0A0E27` - Primary background
- **Secondary**: `#1A1F3A` - Cards and panels
- **Elevated**: `#252B4A` - Elevated surfaces

### Text
- **Primary**: `#FFFFFF` - Main text
- **Secondary**: `#6B7280` - Labels and captions
- **Tertiary**: `#4B5563` - Disabled text

## Typography

### Fonts
- **Primary**: Inter (or Arial fallback)
- **Monospace**: JetBrains Mono (or Courier fallback)

### Scale
- **H1**: 48px / Bold
- **H2**: 36px / Bold
- **H3**: 24px / Bold
- **H4**: 18px / Semi-bold
- **Body**: 16px / Regular
- **Caption**: 14px / Regular
- **Small**: 12px / Regular

## CSS Variables

All design tokens are available as CSS variables:

```css
:root {
  /* Colors */
  --color-primary: #00D4FF;
  --color-success: #00FF88;
  --color-danger: #FF4757;
  
  /* Gradients */
  --gradient-primary: linear-gradient(135deg, #00D4FF 0%, #0066FF 100%);
  
  /* Spacing */
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  
  /* Typography */
  --font-primary: 'Inter', Arial, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
}
```

## Component Examples

### Buttons
```html
<button class="btn btn-primary">Primary Action</button>
<button class="btn btn-success">Buy Signal</button>
<button class="btn btn-danger">Sell Signal</button>
<button class="btn btn-outline">Secondary</button>
<button class="btn btn-ghost">Tertiary</button>
```

### Cards
```html
<div class="card">
  <div class="card-header">
    <h3 class="card-title">Trading Stats</h3>
  </div>
  <div class="card-body">
    <p>Your performance metrics</p>
  </div>
</div>
```

### Badges
```html
<span class="badge badge-success">Active</span>
<span class="badge badge-danger">Stopped</span>
<span class="badge badge-primary">New</span>
```

### Grid Layout
```html
<div class="grid grid-cols-3 gap-lg">
  <div class="card">Column 1</div>
  <div class="card">Column 2</div>
  <div class="card">Column 3</div>
</div>
```

## Usage Guidelines

### Do's ✓
- Use SVG files for scalability
- Maintain color consistency
- Use provided gradients for premium feel
- Ensure sufficient contrast (WCAG AA)
- Use monospace fonts for numerical data
- Keep animations subtle (2-4 seconds)

### Don'ts ✗
- Don't distort or skew logos
- Don't use colors outside the palette
- Don't place logo on busy backgrounds
- Don't use drop shadows on logo
- Don't rotate logo beyond ±5°
- Don't use more than 3 colors per design

## Accessibility

All assets follow WCAG 2.1 AA standards:
- Minimum contrast ratio: 4.5:1 for text
- Interactive elements: 3:1 contrast
- Respects `prefers-reduced-motion`
- All icons have descriptive alt text

## File Formats

All assets are provided as SVG for:
- Infinite scalability
- Small file sizes
- Easy color customization
- Sharp rendering on all displays

## Browser Support

Design system supports:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Integration

### React/Next.js
```jsx
import Image from 'next/image';

export function Logo() {
  return (
    <Image 
      src="/brand/logos/logo-main.svg" 
      alt="TradeBot"
      width={200}
      height={200}
    />
  );
}
```

### Vue
```vue
<template>
  <img src="/brand/logos/logo-main.svg" alt="TradeBot" class="logo">
</template>

<style scoped>
.logo {
  width: 200px;
  height: 200px;
}
</style>
```

### Plain HTML
```html
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="/brand/design-system.css">
  <link rel="icon" type="image/svg+xml" href="/brand/logos/favicon-32x32.svg">
</head>
<body>
  <img src="/brand/logos/logo-wordmark.svg" alt="TradeBot">
</body>
</html>
```

## Preview

View all assets in your browser:
```
open apps/web/public/brand/index.html
```

Or visit: `http://localhost:3000/brand/` when running the dev server.

## Documentation

Complete brand guidelines available at:
- **Full Guidelines**: `/docs/brand-guidelines.md`
- **Design System**: `/apps/web/public/brand/design-system.css`
- **Preview Page**: `/apps/web/public/brand/index.html`

## Version History

- **v1.0** (2026-05-05): Initial release
  - Logo system (3 variations)
  - Icon library (12 icons)
  - Marketing graphics (4 templates)
  - Data visualizations (4 patterns)
  - Complete CSS design system
  - Brand guidelines documentation

## Support

For questions or additional assets:
- Review `/docs/brand-guidelines.md`
- Check design system at `/brand/design-system.css`
- View preview at `/brand/index.html`

## License

All brand assets are proprietary to TradeBot. Unauthorized use is prohibited.

---

**TradeBot** • AI-Powered Trading Platform • 2026
