# Lighthouse Audit Guide

## Overview

Lighthouse is an automated tool for improving web app quality. It audits performance, accessibility, SEO, and best practices.

## Prerequisites

### Install Lighthouse

```bash
# Global installation
npm install -g lighthouse

# Or use npx (no installation needed)
npx lighthouse --version
```

### Install Chrome/Chromium

```bash
# Ubuntu/Debian
sudo apt-get install chromium-browser

# macOS
brew install --cask google-chrome
```

## Running Lighthouse Audit

### Basic Audit

```bash
# Audit the web application
lighthouse http://localhost:3000 --output html --output-path ./lighthouse-report.html

# Open the report
xdg-open ./lighthouse-report.html  # Linux
open ./lighthouse-report.html      # macOS
```

### Production Audit

```bash
# Audit production URL
lighthouse https://your-domain.com --output html --output-path ./lighthouse-prod-report.html
```

### CI/CD Integration

```bash
# JSON output for CI/CD
lighthouse http://localhost:3000 \
  --output json \
  --output-path ./lighthouse-report.json \
  --chrome-flags="--headless --no-sandbox"

# Check scores
node -e "
const report = require('./lighthouse-report.json');
const scores = report.categories;
console.log('Performance:', scores.performance.score * 100);
console.log('Accessibility:', scores.accessibility.score * 100);
console.log('Best Practices:', scores['best-practices'].score * 100);
console.log('SEO:', scores.seo.score * 100);

// Fail if any score below threshold
if (scores.performance.score < 0.9 || 
    scores.accessibility.score < 0.9 ||
    scores['best-practices'].score < 0.9) {
  process.exit(1);
}
"
```

## Audit Categories

### 1. Performance (Target: 90+)

**Key Metrics:**
- First Contentful Paint (FCP): < 1.8s
- Largest Contentful Paint (LCP): < 2.5s
- Total Blocking Time (TBT): < 200ms
- Cumulative Layout Shift (CLS): < 0.1
- Speed Index: < 3.4s

**Common Issues:**
- Large JavaScript bundles
- Unoptimized images
- Render-blocking resources
- No caching headers

**Fixes:**
- Code splitting
- Image optimization (WebP, lazy loading)
- Preload critical resources
- Enable compression (gzip/brotli)

### 2. Accessibility (Target: 95+)

**Key Checks:**
- Color contrast ratios
- ARIA attributes
- Keyboard navigation
- Screen reader support
- Form labels

**Common Issues:**
- Low contrast text
- Missing alt text
- No focus indicators
- Missing ARIA labels

**Fixes:**
- Use semantic HTML
- Add ARIA labels
- Ensure keyboard navigation
- Test with screen readers

### 3. Best Practices (Target: 95+)

**Key Checks:**
- HTTPS usage
- No console errors
- Secure dependencies
- Modern image formats
- No deprecated APIs

**Common Issues:**
- Mixed content (HTTP/HTTPS)
- Console errors
- Vulnerable dependencies
- Old image formats

**Fixes:**
- Use HTTPS everywhere
- Fix console errors
- Update dependencies
- Use WebP/AVIF images

### 4. SEO (Target: 95+)

**Key Checks:**
- Meta descriptions
- Valid robots.txt
- Mobile-friendly
- Structured data
- Crawlable links

**Common Issues:**
- Missing meta tags
- No viewport meta tag
- Blocked resources
- No sitemap

**Fixes:**
- Add meta descriptions
- Add viewport meta tag
- Create sitemap.xml
- Add structured data

## Advanced Configuration

### Custom Lighthouse Config

Create `lighthouse-config.js`:

```javascript
module.exports = {
  extends: 'lighthouse:default',
  settings: {
    onlyCategories: ['performance', 'accessibility'],
    skipAudits: ['uses-http2'],
    throttling: {
      rttMs: 40,
      throughputKbps: 10240,
      cpuSlowdownMultiplier: 1,
    },
  },
};
```

Run with config:

```bash
lighthouse http://localhost:3000 --config-path=./lighthouse-config.js
```

### Budget Configuration

Create `budget.json`:

```json
{
  "resourceSizes": [
    {
      "resourceType": "script",
      "budget": 150
    },
    {
      "resourceType": "image",
      "budget": 200
    },
    {
      "resourceType": "total",
      "budget": 500
    }
  ],
  "resourceCounts": [
    {
      "resourceType": "third-party",
      "budget": 10
    }
  ]
}
```

Run with budget:

```bash
lighthouse http://localhost:3000 --budget-path=./budget.json
```

## Interpreting Results

### Score Ranges

- **90-100**: Good (Green)
- **50-89**: Needs Improvement (Orange)
- **0-49**: Poor (Red)

### Priority Fixes

1. **Red items**: Critical issues, fix immediately
2. **Orange items**: Important, fix soon
3. **Green items**: Maintain current state

### Example Report Analysis

```
Performance: 85 (Orange)
├─ First Contentful Paint: 2.1s (Needs improvement)
├─ Largest Contentful Paint: 3.2s (Poor)
├─ Total Blocking Time: 450ms (Poor)
└─ Cumulative Layout Shift: 0.05 (Good)

Recommendations:
1. Reduce JavaScript bundle size (40KB savings)
2. Optimize images (60KB savings)
3. Eliminate render-blocking resources
4. Preload critical fonts
```

## Continuous Monitoring

### GitHub Actions

```yaml
name: Lighthouse CI

on: [pull_request]

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
      
      - name: Start server
        run: npm start &
        
      - name: Wait for server
        run: npx wait-on http://localhost:3000
      
      - name: Run Lighthouse
        run: |
          npm install -g @lhci/cli
          lhci autorun
```

### Lighthouse CI Configuration

Create `.lighthouserc.json`:

```json
{
  "ci": {
    "collect": {
      "url": ["http://localhost:3000"],
      "numberOfRuns": 3
    },
    "assert": {
      "preset": "lighthouse:recommended",
      "assertions": {
        "categories:performance": ["error", {"minScore": 0.9}],
        "categories:accessibility": ["error", {"minScore": 0.95}],
        "categories:best-practices": ["error", {"minScore": 0.95}],
        "categories:seo": ["error", {"minScore": 0.95}]
      }
    },
    "upload": {
      "target": "temporary-public-storage"
    }
  }
}
```

## Troubleshooting

### Chrome Not Found

```bash
# Set Chrome path
export CHROME_PATH=/usr/bin/chromium-browser
lighthouse http://localhost:3000
```

### Port Already in Use

```bash
# Use different port
lighthouse http://localhost:3001
```

### Timeout Issues

```bash
# Increase timeout
lighthouse http://localhost:3000 --max-wait-for-load=60000
```

### Headless Mode Issues

```bash
# Run without headless
lighthouse http://localhost:3000 --chrome-flags="--no-sandbox"
```

## Best Practices

1. **Run multiple times**: Scores vary, run 3-5 times and average
2. **Test on real devices**: Mobile performance differs
3. **Test different networks**: Simulate 3G/4G
4. **Monitor trends**: Track scores over time
5. **Fix high-impact issues first**: Focus on red items
6. **Automate in CI/CD**: Catch regressions early

## Resources

- [Lighthouse Documentation](https://developers.google.com/web/tools/lighthouse)
- [Web Vitals](https://web.dev/vitals/)
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)
- [Performance Budget Calculator](https://www.performancebudget.io/)

## Expected Results for Trading Bot

### Target Scores

- **Performance**: 90+ (optimized bundle, code splitting)
- **Accessibility**: 95+ (semantic HTML, ARIA labels)
- **Best Practices**: 95+ (HTTPS, no errors, secure deps)
- **SEO**: 90+ (meta tags, sitemap, mobile-friendly)

### Key Optimizations Applied

1. ✅ Bundle size < 150KB (code splitting, tree shaking)
2. ✅ Image optimization (WebP, lazy loading)
3. ✅ Caching headers (service worker, CDN)
4. ✅ Compression (gzip/brotli)
5. ✅ Critical CSS inlined
6. ✅ Fonts preloaded
7. ✅ Accessibility compliant (WCAG 2.1 AA)

### Manual Testing Required

After automated audit, manually verify:
- Screen reader navigation
- Keyboard-only navigation
- Color contrast in all themes
- Mobile responsiveness
- Touch target sizes
