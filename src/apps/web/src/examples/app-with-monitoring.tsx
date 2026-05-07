/**
 * Example: Integrating Monitoring into Frontend App
 */

import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { usePerformanceMonitor } from '../hooks/usePerformanceMonitor';
import { setupFrontendErrorTracking } from '@trade/shared';
import { MonitoringDashboard } from '../components/MonitoringDashboard';

// Setup error tracking once at app initialization
setupFrontendErrorTracking();

function App() {
  // Track Web Vitals and performance metrics
  usePerformanceMonitor({
    trackWebVitals: true,
    trackNavigation: true,
    trackResources: true
  });

  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/trading" element={<TradingPage />} />
        <Route path="/admin/monitoring" element={<MonitoringDashboard />} />
      </Routes>
    </Router>
  );
}

function HomePage() {
  return <div>Home Page</div>;
}

function TradingPage() {
  return <div>Trading Page</div>;
}

export default App;
