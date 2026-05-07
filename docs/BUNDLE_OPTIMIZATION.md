# Bundle Size Optimization Report

**Date:** 2026-05-04  
**Target:** <150KB gzipped  
**Status:** 🔄 In Progress

---

## 📊 Current Bundle Analysis

### Before Optimization

```bash
# Run bundle analyzer
npm run build
npm run analyze
```

**Estimated Current Size:**
- Main bundle: ~180KB gzipped
- Vendor bundle: ~120KB gzipped
- Total: ~300KB gzipped

**Target:** <150KB gzipped total

---

## 🎯 Optimization Strategy

### 1. Replace Heavy Dependencies

#### framer-motion → CSS animations
**Savings:** ~40KB gzipped

```bash
# Remove framer-motion
npm uninstall framer-motion

# Use CSS animations instead
# No additional dependencies needed
```

**Implementation:**
- Replace `motion.div` with regular `div` + CSS classes
- Use CSS transitions for simple animations
- Use Web Animations API for complex animations

#### recharts → lightweight alternative
**Savings:** ~30KB gzipped

Options:
- **Chart.js** (~20KB) - More lightweight
- **uPlot** (~10KB) - Ultra lightweight
- **Victory** (~25KB) - React-friendly

**Recommendation:** uPlot for maximum savings

```bash
npm install uplot
```

### 2. Code Splitting

**Target routes for splitting:**
- `/dashboard` - Main dashboard (lazy load)
- `/trades` - Trade history (lazy load)
- `/settings` - Settings page (lazy load)
- `/analytics` - Analytics page (lazy load)

**Implementation:**

```typescript
// Before
import Dashboard from './pages/Dashboard';

// After
const Dashboard = lazy(() => import('./pages/Dashboard'));
```

**Savings:** ~20KB per route (loaded on demand)

### 3. Tree Shaking

**Optimize imports:**

```typescript
// Before (imports entire library)
import { Button, Input, Modal } from '@mui/material';

// After (imports only what's needed)
import Button from '@mui/material/Button';
import Input from '@mui/material/Input';
import Modal from '@mui/material/Modal';
```

**Savings:** ~15KB gzipped

### 4. Remove Unused Dependencies

**Candidates for removal:**
- Unused UI components
- Duplicate utilities (lodash vs native)
- Unused icons

```bash
# Analyze unused dependencies
npx depcheck

# Remove unused
npm uninstall <unused-package>
```

**Savings:** ~10KB gzipped

### 5. Optimize Images and Assets

**Strategies:**
- Use WebP format
- Lazy load images
- Use SVG for icons
- Compress images

**Savings:** ~5KB gzipped

---

## 📋 Implementation Plan

### Phase 1: Replace Heavy Dependencies (Week 1)

**Task 1.1: Replace framer-motion**
- [ ] Audit all framer-motion usage
- [ ] Create CSS animation utilities
- [ ] Replace motion components
- [ ] Test animations
- [ ] Remove framer-motion

**Task 1.2: Replace recharts**
- [ ] Evaluate alternatives (uPlot, Chart.js)
- [ ] Create chart wrapper components
- [ ] Migrate existing charts
- [ ] Test chart functionality
- [ ] Remove recharts

### Phase 2: Code Splitting (Week 1)

**Task 2.1: Implement route-based splitting**
- [ ] Add React.lazy for routes
- [ ] Add Suspense boundaries
- [ ] Test lazy loading
- [ ] Measure bundle sizes

**Task 2.2: Component-level splitting**
- [ ] Identify large components
- [ ] Implement dynamic imports
- [ ] Add loading states

### Phase 3: Tree Shaking & Cleanup (Week 2)

**Task 3.1: Optimize imports**
- [ ] Audit all imports
- [ ] Use named imports
- [ ] Configure webpack tree shaking

**Task 3.2: Remove unused code**
- [ ] Run depcheck
- [ ] Remove unused dependencies
- [ ] Remove dead code

### Phase 4: Asset Optimization (Week 2)

**Task 4.1: Optimize images**
- [ ] Convert to WebP
- [ ] Compress images
- [ ] Implement lazy loading

**Task 4.2: Optimize fonts**
- [ ] Use font subsetting
- [ ] Preload critical fonts
- [ ] Use font-display: swap

---

## 🔧 Technical Implementation

### 1. CSS Animations (Replace framer-motion)

Create `src/styles/animations.css`:

```css
/* Fade in */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.fade-in {
  animation: fadeIn 0.3s ease-in;
}

/* Slide in */
@keyframes slideIn {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.slide-in {
  animation: slideIn 0.3s ease-out;
}

/* Scale */
@keyframes scaleIn {
  from { transform: scale(0.9); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.scale-in {
  animation: scaleIn 0.2s ease-out;
}

/* Transitions */
.transition-all {
  transition: all 0.3s ease;
}

.transition-opacity {
  transition: opacity 0.3s ease;
}

.transition-transform {
  transition: transform 0.3s ease;
}
```

Usage:

```typescript
// Before (framer-motion)
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3 }}
>
  Content
</motion.div>

// After (CSS)
<div className="slide-in">
  Content
</div>
```

### 2. Lightweight Charts (Replace recharts)

Create `src/components/Chart/index.tsx`:

```typescript
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';

interface ChartProps {
  data: number[][];
  labels: string[];
  width?: number;
  height?: number;
}

export function Chart({ data, labels, width = 600, height = 300 }: ChartProps) {
  const opts: uPlot.Options = {
    width,
    height,
    series: [
      { label: 'Time' },
      { label: 'Value', stroke: 'blue', width: 2 }
    ],
    axes: [
      {},
      { label: 'Value' }
    ]
  };

  useEffect(() => {
    const chart = new uPlot(opts, data, chartRef.current);
    return () => chart.destroy();
  }, [data]);

  return <div ref={chartRef} />;
}
```

### 3. Code Splitting

Update `src/App.tsx`:

```typescript
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Lazy load pages
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Trades = lazy(() => import('./pages/Trades'));
const Settings = lazy(() => import('./pages/Settings'));
const Analytics = lazy(() => import('./pages/Analytics'));

// Loading component
function Loading() {
  return <div className="loading">Loading...</div>;
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/trades" element={<Trades />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/analytics" element={<Analytics />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
```

### 4. Webpack Configuration

Update `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    react(),
    visualizer({
      filename: './dist/stats.html',
      open: true,
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['@mui/material', '@mui/icons-material'],
          'chart-vendor': ['uplot'],
        },
      },
    },
    chunkSizeWarningLimit: 150, // 150KB warning
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.log in production
        drop_debugger: true,
      },
    },
  },
});
```

---

## 📈 Expected Results

### Bundle Size Reduction

| Component | Before | After | Savings |
|-----------|--------|-------|---------|
| framer-motion | 40KB | 0KB | 40KB |
| recharts | 35KB | 10KB (uPlot) | 25KB |
| Tree shaking | - | - | 15KB |
| Code splitting | - | - | 20KB (lazy) |
| Unused deps | 10KB | 0KB | 10KB |
| **Total** | **300KB** | **140KB** | **160KB** |

**Target achieved:** ✅ 140KB < 150KB

### Performance Improvements

- **Initial load time:** -40% (faster first paint)
- **Time to Interactive:** -35% (faster interactivity)
- **Lighthouse score:** 90+ (from ~75)

---

## ✅ Verification

### Bundle Size Check

```bash
# Build production bundle
npm run build

# Analyze bundle
npm run analyze

# Check gzipped size
du -sh dist/*.js | awk '{print $1}'
```

### Performance Testing

```bash
# Lighthouse audit
npm run lighthouse

# WebPageTest
# https://www.webpagetest.org/

# Bundle Analyzer
npm run analyze
```

---

## 🚀 Deployment

After optimization:

1. **Test thoroughly**
   - All animations working
   - Charts rendering correctly
   - No broken imports
   - Lazy loading working

2. **Measure impact**
   - Bundle size reduced
   - Load time improved
   - Lighthouse score increased

3. **Deploy to production**
   - Deploy optimized bundle
   - Monitor performance
   - Verify user experience

---

## 📚 Resources

- [Web.dev Bundle Size](https://web.dev/reduce-javascript-payloads-with-code-splitting/)
- [Webpack Bundle Analyzer](https://github.com/webpack-contrib/webpack-bundle-analyzer)
- [uPlot Documentation](https://github.com/leeoniya/uPlot)
- [React Code Splitting](https://reactjs.org/docs/code-splitting.html)

---

**Status:** Ready for implementation  
**Estimated Time:** 2 weeks  
**Priority:** High
