"use client";

import {
  ArrowDownToLine,
  CalendarDays,
  Copy,
  RotateCcw,
  SlidersHorizontal,
  Table2,
  Zap
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CHART_SERIES, TECHNOLOGIES, type ChartSeriesId, type TechnologyId } from "@/lib/technologies";
import type { CapacityByTechnology, NormalizedScenarioData, ScenarioResult } from "@/lib/types";
import { runBalanceScenario } from "@/lib/scenario";

const DEFAULT_START = "2025-01-01";
const DEFAULT_END = "2025-01-07";
const MW_PER_GW = 1000;

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit"
});

type LoadingState =
  | { status: "idle" | "loading"; message?: string }
  | { status: "ready"; data: NormalizedScenarioData }
  | { status: "error"; message: string };

export function SimulatorPage() {
  const [start, setStart] = useState(DEFAULT_START);
  const [end, setEnd] = useState(DEFAULT_END);
  const [loadingState, setLoadingState] = useState<LoadingState>({ status: "idle" });
  const [capacityGw, setCapacityGw] = useState<CapacityByTechnology | null>(null);
  const [visibleSeries, setVisibleSeries] = useState<Record<ChartSeriesId, boolean>>(
    Object.fromEntries(CHART_SERIES.map((series) => [series.id, true])) as Record<ChartSeriesId, boolean>
  );
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlStart = params.get("start");
    const urlEnd = params.get("end");

    if (urlStart) {
      setStart(urlStart);
    }

    if (urlEnd) {
      setEnd(urlEnd);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoadingState({ status: "loading", message: "Loading Energy-Charts data" });

    fetch(`/api/scenario-data?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`, {
      signal: controller.signal
    })
      .then(async (response) => {
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error ?? "Scenario data request failed.");
        }

        return payload as NormalizedScenarioData;
      })
      .then((data) => {
        setLoadingState({ status: "ready", data });
        setCapacityGw(readCapacityFromUrl(data.baselineCapacityGw));
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setLoadingState({
          status: "error",
          message: error instanceof Error ? error.message : "Unable to load scenario data."
        });
      });

    return () => controller.abort();
  }, [start, end]);

  useEffect(() => {
    if (!capacityGw) {
      return;
    }

    const params = new URLSearchParams();
    params.set("start", start);
    params.set("end", end);

    for (const technology of TECHNOLOGIES) {
      params.set(technology.id, String(round(capacityGw[technology.id], 3)));
    }

    window.history.replaceState(null, "", `?${params.toString()}`);
  }, [capacityGw, start, end]);

  const data = loadingState.status === "ready" ? loadingState.data : null;
  const scenario = useMemo(() => {
    if (!data || !capacityGw) {
      return null;
    }

    return runBalanceScenario(data, capacityGw);
  }, [capacityGw, data]);

  const resetCapacity = useCallback(() => {
    if (data) {
      setCapacityGw(data.baselineCapacityGw);
    }
  }, [data]);

  const updateCapacity = useCallback((technologyId: TechnologyId, value: number) => {
    setCapacityGw((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        [technologyId]: Math.max(0, round(value, 3))
      };
    });
  }, []);

  const copyShareUrl = useCallback(async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }, []);

  const downloadCsv = useCallback(() => {
    if (!scenario) {
      return;
    }

    const csv = buildCsv(scenario);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `austria-electricity-scenario-${start}-${end}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [end, scenario, start]);

  return (
    <main className="app-shell">
      <section className="toolbar" aria-label="Scenario controls">
        <div className="brand-lockup">
          <span className="brand-mark">
            <Zap size={18} strokeWidth={2.5} />
          </span>
          <div>
            <p className="eyebrow">Austria</p>
            <h1>Electricity buildout simulator</h1>
          </div>
        </div>

        <div className="date-controls">
          <label>
            <CalendarDays size={16} />
            <span>Start</span>
            <input type="date" value={start} onChange={(event) => setStart(event.target.value)} />
          </label>
          <label>
            <CalendarDays size={16} />
            <span>End</span>
            <input type="date" value={end} onChange={(event) => setEnd(event.target.value)} />
          </label>
        </div>

        <div className="toolbar-actions">
          <button className="icon-button" type="button" onClick={resetCapacity} title="Reset capacities">
            <RotateCcw size={18} />
          </button>
          <button className="icon-button" type="button" onClick={copyShareUrl} title="Copy scenario URL">
            <Copy size={18} />
          </button>
          <button className="icon-button" type="button" onClick={downloadCsv} title="Download 15-minute CSV">
            <ArrowDownToLine size={18} />
          </button>
        </div>
      </section>

      {copied ? <div className="toast">Scenario URL copied</div> : null}

      {loadingState.status === "error" ? (
        <section className="status-panel error" role="alert">
          <strong>Energy-Charts data could not be loaded.</strong>
          <span>{loadingState.message}</span>
        </section>
      ) : null}

      {loadingState.status === "loading" || loadingState.status === "idle" ? (
        <section className="status-panel">
          <strong>{loadingState.message ?? "Preparing simulator"}</strong>
          <span>Fetching quarter-hour profiles and installed capacity.</span>
        </section>
      ) : null}

      {data && scenario && capacityGw ? (
        <>
          <section className="summary-band" aria-label="Scenario summary">
            <Metric label="Load" value={`${formatNumber(scenario.totals.loadGwh)} GWh`} />
            <Metric label="Generation" value={`${formatNumber(scenario.totals.generationGwh)} GWh`} />
            <Metric label="Renewable share" value={`${formatPercent(scenario.totals.renewableShareOfLoad)}`} />
            <Metric label="Import need" value={`${formatNumber(scenario.totals.deficitGwh)} GWh`} tone="amber" />
            <Metric label="Surplus potential" value={`${formatNumber(scenario.totals.surplusGwh)} GWh`} tone="green" />
            <Metric label="Peak deficit" value={`${formatNumber(scenario.totals.peakDeficitMw)} MW`} tone="red" />
          </section>

          <section className="workbench">
            <aside className="control-panel" aria-label="Generation capacity controls">
              <div className="panel-heading">
                <SlidersHorizontal size={18} />
                <div>
                  <h2>Generation unit power</h2>
                  <p>Baseline {data.capacityYear} installed capacity, scaled as historical profiles.</p>
                </div>
              </div>

              <div className="capacity-list">
                {TECHNOLOGIES.map((technology) => {
                  const value = capacityGw[technology.id];
                  const baseline = data.baselineCapacityGw[technology.id];
                  const max = Math.max(1, baseline * 3, value * 1.25);

                  return (
                    <div className="capacity-row" key={technology.id}>
                      <div className="capacity-row-top">
                        <span className="series-swatch" style={{ backgroundColor: technology.color }} />
                        <label htmlFor={`capacity-${technology.id}`}>{technology.label}</label>
                        <input
                          id={`capacity-${technology.id}`}
                          type="number"
                          min="0"
                          step="0.01"
                          value={value}
                          onChange={(event) => updateCapacity(technology.id, Number(event.target.value))}
                        />
                        <span className="unit">GW</span>
                      </div>
                      <input
                        aria-label={`${technology.label} capacity slider`}
                        type="range"
                        min="0"
                        max={max}
                        step="0.01"
                        value={value}
                        onChange={(event) => updateCapacity(technology.id, Number(event.target.value))}
                      />
                      <div className="capacity-footnote">
                        <span>{formatNumber(baseline)} GW baseline</span>
                        <span>{baseline > 0 ? `${formatNumber(value / baseline)}x` : "no profile baseline"}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </aside>

            <section className="chart-panel" aria-label="15-minute generation and load chart">
              <div className="chart-heading">
                <div>
                  <h2>15-minute system profile</h2>
                  <p>
                    {start} to {end} · load fixed · domestic generation scaled · cross-border trading as reference
                  </p>
                </div>
                <button type="button" className="text-button" onClick={downloadCsv}>
                  <Table2 size={16} />
                  CSV
                </button>
              </div>

              <PowerChart scenario={scenario} visibleSeries={visibleSeries} />

              <div className="legend-grid" aria-label="Chart legend">
                {CHART_SERIES.map((series) => (
                  <label key={series.id} className="legend-item">
                    <input
                      type="checkbox"
                      checked={visibleSeries[series.id]}
                      onChange={(event) =>
                        setVisibleSeries((current) => ({
                          ...current,
                          [series.id]: event.target.checked
                        }))
                      }
                    />
                    <span className="series-swatch" style={{ backgroundColor: series.color }} />
                    <span>{series.label}</span>
                  </label>
                ))}
                <span className="legend-line load">Load</span>
                <span className="legend-line residual">Simulated residual</span>
                <span className="legend-line trading">Historical cross-border</span>
              </div>
            </section>
          </section>

          <section className="data-section" aria-label="15-minute data table">
            <div className="section-heading">
              <h2>15-minute data</h2>
              <span>{scenario.timestamps.length} intervals</span>
            </div>
            <ScenarioTable scenario={scenario} />
          </section>

          <footer className="source-footer">
            Source: Energy-Charts.info, licensed under CC BY 4.0 unless stated otherwise. Installed capacity last update:{" "}
            {data.sourceUpdatedAt ? new Date(data.sourceUpdatedAt).toLocaleDateString("en-GB") : "not provided"}.
          </footer>
        </>
      ) : null}
    </main>
  );
}

function Metric({
  label,
  value,
  tone = "neutral"
}: {
  label: string;
  value: string;
  tone?: "neutral" | "green" | "amber" | "red";
}) {
  return (
    <div className={`metric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PowerChart({
  scenario,
  visibleSeries
}: {
  scenario: ScenarioResult;
  visibleSeries: Record<ChartSeriesId, boolean>;
}) {
  const width = 1200;
  const height = 480;
  const padding = { top: 28, right: 48, bottom: 44, left: 64 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const xFor = (index: number) =>
    padding.left + (scenario.timestamps.length <= 1 ? 0 : (index / (scenario.timestamps.length - 1)) * plotWidth);

  const stacks = buildStacks(scenario, visibleSeries);
  const lineValues = [
    ...scenario.loadMw,
    ...scenario.residualMw,
    ...scenario.historicalCrossBorderMw,
    ...stacks.positive.flatMap((series) => series.upper),
    ...stacks.negative.flatMap((series) => series.lower)
  ];
  const maxY = Math.max(1000, ...lineValues);
  const minY = Math.min(-1000, ...lineValues);
  const yFor = (value: number) => padding.top + ((maxY - value) / (maxY - minY)) * plotHeight;
  const zeroY = yFor(0);
  const xTicks = getTickIndexes(scenario.timestamps.length, 7);
  const yTicks = getYAxisTicks(minY, maxY, 5);

  return (
    <div className="chart-scroll">
      <svg className="power-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Stacked electricity profile chart">
        <rect x="0" y="0" width={width} height={height} rx="0" fill="#ffffff" />

        {yTicks.map((tick) => (
          <g key={tick}>
            <line x1={padding.left} x2={width - padding.right} y1={yFor(tick)} y2={yFor(tick)} className="grid-line" />
            <text x={padding.left - 12} y={yFor(tick) + 4} textAnchor="end" className="axis-label">
              {formatCompactMw(tick)}
            </text>
          </g>
        ))}

        <line x1={padding.left} x2={width - padding.right} y1={zeroY} y2={zeroY} className="zero-line" />

        {stacks.positive.map((series) => (
          <path key={series.id} d={areaPath(series.upper, series.lower, xFor, yFor)} fill={series.color} opacity="0.78" />
        ))}
        {stacks.negative.map((series) => (
          <path key={series.id} d={areaPath(series.upper, series.lower, xFor, yFor)} fill={series.color} opacity="0.72" />
        ))}

        <path d={linePath(scenario.loadMw, xFor, yFor)} className="load-line" />
        <path d={linePath(scenario.residualMw, xFor, yFor)} className="residual-line" />
        <path d={linePath(scenario.historicalCrossBorderMw, xFor, yFor)} className="trading-line" />

        {xTicks.map((index) => (
          <g key={index}>
            <line x1={xFor(index)} x2={xFor(index)} y1={padding.top} y2={height - padding.bottom} className="x-guide" />
            <text x={xFor(index)} y={height - 16} textAnchor="middle" className="axis-label">
              {dateFormatter.format(new Date(scenario.timestamps[index] * 1000))}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function ScenarioTable({ scenario }: { scenario: ScenarioResult }) {
  const rows = scenario.timestamps.slice(0, 192);

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>Load MW</th>
            <th>Residual MW</th>
            <th>Cross-border ref MW</th>
            {CHART_SERIES.map((series) => (
              <th key={series.id}>{series.label} MW</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((timestamp, index) => (
            <tr key={timestamp}>
              <td>{new Date(timestamp * 1000).toLocaleString("en-GB")}</td>
              <td>{formatNumber(scenario.loadMw[index])}</td>
              <td>{formatNumber(scenario.residualMw[index])}</td>
              <td>{formatNumber(scenario.historicalCrossBorderMw[index])}</td>
              {CHART_SERIES.map((series) => (
                <td key={series.id}>{formatNumber(scenario.seriesMw[series.id][index] ?? 0)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {scenario.timestamps.length > rows.length ? (
        <p className="table-note">Showing the first {rows.length} intervals. Download CSV for the full selection.</p>
      ) : null}
    </div>
  );
}

function buildStacks(scenario: ScenarioResult, visibleSeries: Record<ChartSeriesId, boolean>) {
  const length = scenario.timestamps.length;
  const positiveBase = Array.from({ length }, () => 0);
  const negativeBase = Array.from({ length }, () => 0);
  const positive: Array<{ id: ChartSeriesId; color: string; lower: number[]; upper: number[] }> = [];
  const negative: Array<{ id: ChartSeriesId; color: string; lower: number[]; upper: number[] }> = [];

  for (const series of CHART_SERIES) {
    if (!visibleSeries[series.id]) {
      continue;
    }

    const values = scenario.seriesMw[series.id];
    const hasNegative = values.some((value) => value < 0);
    const base = hasNegative || series.belowZero ? negativeBase : positiveBase;
    const lower = [...base];

    for (let index = 0; index < length; index += 1) {
      base[index] += values[index] ?? 0;
    }

    const stack = {
      id: series.id,
      color: series.color,
      lower,
      upper: [...base]
    };

    if (hasNegative || series.belowZero) {
      negative.push(stack);
    } else {
      positive.push(stack);
    }
  }

  return { positive, negative };
}

function areaPath(
  upper: number[],
  lower: number[],
  xFor: (index: number) => number,
  yFor: (value: number) => number
) {
  const upperPath = upper.map((value, index) => `${index === 0 ? "M" : "L"} ${xFor(index)} ${yFor(value)}`).join(" ");
  const lowerPath = lower
    .map((value, index) => `L ${xFor(lower.length - 1 - index)} ${yFor(lower[lower.length - 1 - index])}`)
    .join(" ");

  return `${upperPath} ${lowerPath} Z`;
}

function linePath(values: number[], xFor: (index: number) => number, yFor: (value: number) => number) {
  return values.map((value, index) => `${index === 0 ? "M" : "L"} ${xFor(index)} ${yFor(value)}`).join(" ");
}

function getTickIndexes(length: number, count: number) {
  if (length <= 1) {
    return [0];
  }

  return Array.from({ length: count }, (_, index) => Math.round((index / (count - 1)) * (length - 1)));
}

function getYAxisTicks(minY: number, maxY: number, count: number) {
  const span = maxY - minY;
  const rawStep = span / Math.max(1, count - 1);
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const niceStep = Math.ceil(rawStep / magnitude) * magnitude;
  const start = Math.floor(minY / niceStep) * niceStep;

  return Array.from({ length: count }, (_, index) => start + index * niceStep);
}

function buildCsv(scenario: ScenarioResult) {
  const headers = [
    "iso_time",
    "load_mw",
    "simulated_residual_mw",
    "historical_cross_border_mw",
    ...CHART_SERIES.map((series) => `${series.id}_mw`)
  ];
  const rows = scenario.timestamps.map((_, index) => [
    scenario.isoTimes[index],
    scenario.loadMw[index],
    scenario.residualMw[index],
    scenario.historicalCrossBorderMw[index],
    ...CHART_SERIES.map((series) => scenario.seriesMw[series.id][index] ?? 0)
  ]);

  return [headers, ...rows].map((row) => row.join(",")).join("\n");
}

function readCapacityFromUrl(defaults: CapacityByTechnology) {
  const params = new URLSearchParams(window.location.search);
  const values = { ...defaults };

  for (const technology of TECHNOLOGIES) {
    const value = Number(params.get(technology.id));

    if (Number.isFinite(value) && value >= 0) {
      values[technology.id] = value;
    }
  }

  return values;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: value < 10 ? 2 : 1
  }).format(value);
}

function formatPercent(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "percent",
    maximumFractionDigits: 1
  }).format(value);
}

function formatCompactMw(value: number) {
  if (Math.abs(value) >= MW_PER_GW) {
    return `${formatNumber(value / MW_PER_GW)} GW`;
  }

  return `${formatNumber(value)} MW`;
}

function round(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
