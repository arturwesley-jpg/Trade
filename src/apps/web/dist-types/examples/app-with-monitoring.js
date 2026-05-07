import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
    return (_jsx(Router, { children: _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(HomePage, {}) }), _jsx(Route, { path: "/trading", element: _jsx(TradingPage, {}) }), _jsx(Route, { path: "/admin/monitoring", element: _jsx(MonitoringDashboard, {}) })] }) }));
}
function HomePage() {
    return _jsx("div", { children: "Home Page" });
}
function TradingPage() {
    return _jsx("div", { children: "Trading Page" });
}
export default App;
