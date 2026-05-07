import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef } from "react";
import { createChart, ColorType, LineSeries } from "lightweight-charts";
export function EquityCurve({ data, height = 300 }) {
    const chartContainerRef = useRef(null);
    const chartRef = useRef(null);
    const seriesRef = useRef(null);
    useEffect(() => {
        if (!chartContainerRef.current)
            return;
        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: "rgba(10, 18, 35, 0.82)" },
                textColor: "#b6c2d2"
            },
            grid: {
                vertLines: { color: "rgba(148, 163, 184, 0.12)" },
                horzLines: { color: "rgba(148, 163, 184, 0.12)" }
            },
            width: chartContainerRef.current.clientWidth,
            height,
            timeScale: {
                timeVisible: true,
                secondsVisible: false,
                borderColor: "rgba(148, 163, 184, 0.22)"
            },
            rightPriceScale: {
                borderColor: "rgba(148, 163, 184, 0.22)"
            },
            crosshair: {
                vertLine: {
                    color: "rgba(45, 212, 191, 0.5)",
                    width: 1,
                    style: 1,
                    labelBackgroundColor: "#2dd4bf"
                },
                horzLine: {
                    color: "rgba(45, 212, 191, 0.5)",
                    width: 1,
                    style: 1,
                    labelBackgroundColor: "#2dd4bf"
                }
            }
        });
        const lineSeries = chart.addSeries(LineSeries, {
            color: "#2dd4bf",
            lineWidth: 3,
            crosshairMarkerVisible: true,
            crosshairMarkerRadius: 6,
            crosshairMarkerBorderColor: "#2dd4bf",
            crosshairMarkerBackgroundColor: "#0a1223",
            lastValueVisible: true,
            priceLineVisible: true
        });
        // Add area fill
        lineSeries.applyOptions({
            lineType: 2, // curved
            priceFormat: {
                type: "price",
                precision: 2,
                minMove: 0.01
            }
        });
        chartRef.current = chart;
        seriesRef.current = lineSeries;
        const handleResize = () => {
            if (chartContainerRef.current && chartRef.current) {
                chartRef.current.applyOptions({
                    width: chartContainerRef.current.clientWidth
                });
            }
        };
        window.addEventListener("resize", handleResize);
        return () => {
            window.removeEventListener("resize", handleResize);
            chart.remove();
        };
    }, [height]);
    useEffect(() => {
        if (seriesRef.current && data.length > 0) {
            seriesRef.current.setData(data);
            chartRef.current?.timeScale().fitContent();
        }
    }, [data]);
    return (_jsxs("div", { className: "equity-curve-container", children: [_jsxs("div", { className: "chart-header", children: [_jsx("span", { className: "eyebrow", children: "Curva de Equity" }), _jsx("h3", { children: "Evolu\u00E7\u00E3o do P&L" })] }), _jsx("div", { ref: chartContainerRef, className: "chart-wrapper" })] }));
}
