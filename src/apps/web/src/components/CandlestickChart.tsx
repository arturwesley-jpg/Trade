import { useEffect, useRef, memo } from "react";
import { createChart, ColorType, CandlestickSeries, type IChartApi, type CandlestickData } from "lightweight-charts";

export interface CandlestickChartProps {
  data: CandlestickData[];
  symbol: string;
  height?: number;
}

export const CandlestickChart = memo(function CandlestickChart({ data, symbol, height = 400 }: CandlestickChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<any>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

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
          color: "rgba(34, 211, 238, 0.5)",
          width: 1,
          style: 1,
          labelBackgroundColor: "#22d3ee"
        },
        horzLine: {
          color: "rgba(34, 211, 238, 0.5)",
          width: 1,
          style: 1,
          labelBackgroundColor: "#22d3ee"
        }
      }
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444"
    });

    chartRef.current = chart;
    seriesRef.current = candlestickSeries;

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

  return (
    <div className="candlestick-chart-container">
      <div className="chart-header">
        <span className="eyebrow">Gráfico de Candles</span>
        <h3>{symbol}</h3>
      </div>
      <div ref={chartContainerRef} className="chart-wrapper" />
    </div>
  );
});
