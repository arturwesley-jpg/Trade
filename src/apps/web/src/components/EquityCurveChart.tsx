/**
 * Equity Curve Chart Component
 * Displays portfolio equity over time using lightweight-charts
 */

import { memo, useEffect, useRef } from "react";
import { createChart, ColorType, type IChartApi, type ISeriesApi, type LineData, type AreaSeriesPartialOptions, AreaSeries } from "lightweight-charts";

interface EquityPoint {
  timestamp: number;
  equity: number;
}

interface EquityCurveChartProps {
  data: EquityPoint[];
  height?: number;
}

export const EquityCurveChart = memo(function EquityCurveChart({
  data,
  height = 300
}: EquityCurveChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area", any> | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#94a3b8"
      },
      grid: {
        vertLines: { color: "rgba(148, 163, 184, 0.1)" },
        horzLines: { color: "rgba(148, 163, 184, 0.1)" }
      },
      width: chartContainerRef.current.clientWidth,
      height,
      timeScale: {
        borderColor: "rgba(148, 163, 184, 0.2)",
        timeVisible: true,
        secondsVisible: false
      },
      rightPriceScale: {
        borderColor: "rgba(148, 163, 184, 0.2)"
      },
      crosshair: {
        vertLine: {
          color: "rgba(34, 211, 238, 0.5)",
          width: 1,
          style: 1,
          labelBackgroundColor: "rgba(34, 211, 238, 0.8)"
        },
        horzLine: {
          color: "rgba(34, 211, 238, 0.5)",
          width: 1,
          style: 1,
          labelBackgroundColor: "rgba(34, 211, 238, 0.8)"
        }
      }
    });

    // Create area series
    const series = chart.addSeries(AreaSeries, {
      lineColor: "rgba(34, 211, 238, 0.8)",
      lineWidth: 2,
      priceFormat: {
        type: "price",
        precision: 2,
        minMove: 0.01
      }
    });

    // Apply area-specific options
    series.applyOptions({
      topColor: "rgba(34, 211, 238, 0.4)",
      bottomColor: "rgba(34, 211, 238, 0.05)"
    });

    chartRef.current = chart;
    seriesRef.current = series;

    // Handle resize
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

  // Update data
  useEffect(() => {
    if (!seriesRef.current || data.length === 0) return;

    const chartData: LineData[] = data.map((point) => ({
      time: Math.floor(point.timestamp / 1000) as any,
      value: point.equity
    }));

    seriesRef.current.setData(chartData);

    // Fit content
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [data]);

  return (
    <div className="equity-curve-container">
      <div className="chart-header">
        <h3>Equity Curve</h3>
        <div className="chart-stats">
          {data.length > 0 && (
            <>
              <span className="stat-item">
                <span className="stat-label">Current:</span>
                <span className="stat-value">${data[data.length - 1].equity.toLocaleString()}</span>
              </span>
              {data.length > 1 && (
                <span className="stat-item">
                  <span className="stat-label">Change:</span>
                  <span
                    className="stat-value"
                    style={{
                      color: data[data.length - 1].equity >= data[0].equity ? "var(--positive)" : "var(--negative)"
                    }}
                  >
                    {((data[data.length - 1].equity - data[0].equity) / data[0].equity * 100).toFixed(2)}%
                  </span>
                </span>
              )}
            </>
          )}
        </div>
      </div>
      <div ref={chartContainerRef} className="chart-wrapper" />
    </div>
  );
});
