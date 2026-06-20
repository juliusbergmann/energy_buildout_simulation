"use client";

import {
  ArrowDownToLine,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  RotateCcw,
  Zap
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState, type KeyboardEvent, type PointerEvent } from "react";
import { CHART_SERIES, TECHNOLOGIES, type ChartSeriesId, type Technology, type TechnologyId } from "@/lib/technologies";
import type { NormalizedScenarioData, ScenarioResult, ScenarioTargetsByTechnology } from "@/lib/types";
import { runBalanceScenario } from "@/lib/scenario";
import {
  TIME_INTERVALS,
  clampToCurrentTimePeriod,
  createCurrentWeekSelection,
  deriveTimePeriodSelectionFromRange,
  getCurrentUtcYear,
  getIsoWeeksInYear,
  getTimeRange,
  isAfterCurrentTimePeriod,
  moveTimePeriod,
  normalizeTimePeriodSelection,
  updateTimePeriodInterval,
  updateTimePeriodValue,
  updateTimePeriodYear,
  type TimeInterval,
  type TimePeriodSelection
} from "@/lib/time-period";

const MW_PER_GW = 1000;
const TARGET_CHANGE_EPSILON = 0.005;
const MIN_SELECTOR_YEAR = 2020;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit"
});
const tooltipDateFormatter = new Intl.DateTimeFormat("en-GB", {
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit"
});
const monthFormatter = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  timeZone: "UTC"
});
const rangeDateFormatter = new Intl.DateTimeFormat("en-GB", {
  year: "numeric",
  month: "short",
  day: "2-digit",
  timeZone: "UTC"
});

type LoadingState =
  | { status: "idle" | "loading"; message?: string }
  | { status: "ready"; data: NormalizedScenarioData }
  | { status: "error"; message: string };

type TargetViewMode = "simple" | "advanced";
type TargetGroupId = "wind" | "solar" | "hydro" | "dispatch" | "storage" | "other";

type TargetGroup = {
  id: TargetGroupId;
  label: string;
  technologyIds: TechnologyId[];
};

type TimePeriodState = {
  selection: TimePeriodSelection;
  start: string;
  end: string;
};

const TARGET_GROUPS: TargetGroup[] = [
  { id: "wind", label: "Wind", technologyIds: ["windOnshore"] },
  { id: "solar", label: "Solar", technologyIds: ["solar"] },
  { id: "hydro", label: "Hydro", technologyIds: ["hydroRunRiver", "hydroReservoir"] },
  { id: "dispatch", label: "Dispatch", technologyIds: ["fossilGas"] },
  { id: "storage", label: "Storage", technologyIds: ["hydroPumped"] },
  { id: "other", label: "Other", technologyIds: ["biomass", "wasteOther"] }
];

export function SimulatorPage() {
  const [timePeriod, setTimePeriod] = useState<TimePeriodState>(createCurrentWeekTimePeriodState);
  const { selection: timeSelection, start, end } = timePeriod;
  const [loadingState, setLoadingState] = useState<LoadingState>({ status: "idle" });
  const [scenarioTargets, setScenarioTargets] = useState<ScenarioTargetsByTechnology | null>(null);
  const [visibleSeries, setVisibleSeries] = useState<Record<ChartSeriesId, boolean>>(
    Object.fromEntries(CHART_SERIES.map((series) => [series.id, true])) as Record<ChartSeriesId, boolean>
  );
  const [copied, setCopied] = useState(false);
  const [targetViewMode, setTargetViewMode] = useState<TargetViewMode>("simple");
  const [expandedGroups, setExpandedGroups] = useState<Record<TargetGroupId, boolean>>(
    () => Object.fromEntries(TARGET_GROUPS.map((group) => [group.id, false])) as Record<TargetGroupId, boolean>
  );
  const [expandedRows, setExpandedRows] = useState<Partial<Record<TechnologyId, boolean>>>({});

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlStart = params.get("start");
    const urlEnd = params.get("end");
    const defaultTimePeriod = createCurrentWeekTimePeriodState();
    const nextStart = urlStart && DATE_PATTERN.test(urlStart) ? urlStart : defaultTimePeriod.start;
    const nextEnd =
      urlEnd && DATE_PATTERN.test(urlEnd)
        ? urlEnd
        : urlStart && DATE_PATTERN.test(urlStart)
          ? urlStart
          : defaultTimePeriod.end;

    if (urlStart || urlEnd) {
      setTimePeriod(createTimePeriodStateFromRange(nextStart, nextEnd));
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoadingState({ status: "loading", message: "Loading Energy-Charts data" });

    fetch(`/api/scenario-data?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`, {
      signal: controller.signal
    })
      .then(async (response) => {
        return readScenarioDataResponse(response);
      })
      .then((data) => {
        setLoadingState({ status: "ready", data });
        setScenarioTargets(readScenarioTargetsFromUrl(data));
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
    if (!scenarioTargets) {
      return;
    }

    const params = new URLSearchParams();
    params.set("start", start);
    params.set("end", end);

    for (const technology of TECHNOLOGIES) {
      params.set(getScenarioParamName(technology), String(round(scenarioTargets[technology.id], 3)));
    }

    window.history.replaceState(null, "", `?${params.toString()}`);
  }, [scenarioTargets, start, end]);

  const data = loadingState.status === "ready" ? loadingState.data : null;
  const scenario = useMemo(() => {
    if (!data || !scenarioTargets) {
      return null;
    }

    return runBalanceScenario(data, scenarioTargets);
  }, [scenarioTargets, data]);

  const resetScenarioTargets = useCallback(() => {
    if (data) {
      setScenarioTargets(buildBaselineScenarioTargets(data));
    }
  }, [data]);

  const updateScenarioTarget = useCallback((technologyId: TechnologyId, value: number) => {
    setScenarioTargets((current) => {
      if (!current) {
        return current;
      }

      if (!Number.isFinite(value)) {
        return current;
      }

      return {
        ...current,
        [technologyId]: Math.max(0, round(value, 3))
      };
    });
  }, []);

  const toggleTargetGroup = useCallback((groupId: TargetGroupId) => {
    setExpandedGroups((current) => ({
      ...current,
      [groupId]: !current[groupId]
    }));
  }, []);

  const toggleTargetRow = useCallback((technologyId: TechnologyId) => {
    setExpandedRows((current) => ({
      ...current,
      [technologyId]: !current[technologyId]
    }));
  }, []);

  const applyAnnualPolicyPreset = useCallback((preset: NormalizedScenarioData["policyPresets"][number]) => {
    setScenarioTargets((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        ...preset.annualGenerationTwh
      };
    });
  }, []);

  const updateTimeSelection = useCallback((selection: TimePeriodSelection) => {
    setTimePeriod(createTimePeriodState(normalizeTimePeriodSelection(selection)));
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

        <div className="toolbar-actions">
          <button className="icon-button" type="button" onClick={resetScenarioTargets} title="Reset scenario targets">
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

      <TimePeriodSelector selection={timeSelection} start={start} end={end} onSelectionChange={updateTimeSelection} />

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
          <span>Fetching quarter-hour profiles, full-year generation, and installed capacity.</span>
        </section>
      ) : null}

      {data && scenario && scenarioTargets ? (
        <>
          <section className="workbench">
            <aside className="control-panel" aria-label="Generation scenario controls">
              <div className="control-block">
                <div className="control-block-heading">
                  <span>Preset</span>
                </div>
                <div className="preset-controls" aria-label="Scenario presets">
                  <button type="button" onClick={resetScenarioTargets}>
                    <span>Historical</span>
                    <small>Baseline</small>
                  </button>
                  {data.policyPresets.map((preset) => (
                    <button key={preset.id} type="button" onClick={() => applyAnnualPolicyPreset(preset)}>
                      <span>{preset.label}</span>
                      <small>{preset.description}</small>
                    </button>
                  ))}
                </div>
              </div>

              <div className="control-block">
                <div className="control-block-heading">
                  <span>Manual targets</span>
                  <div className="mode-switch" aria-label="Target detail level">
                    <button
                      type="button"
                      className={targetViewMode === "simple" ? "active" : ""}
                      aria-pressed={targetViewMode === "simple"}
                      onClick={() => setTargetViewMode("simple")}
                    >
                      Simple
                    </button>
                    <button
                      type="button"
                      className={targetViewMode === "advanced" ? "active" : ""}
                      aria-pressed={targetViewMode === "advanced"}
                      onClick={() => setTargetViewMode("advanced")}
                    >
                      Advanced
                    </button>
                  </div>
                </div>

                <div className="capacity-list target-groups">
                  {TARGET_GROUPS.map((group) => {
                    const technologies = group.technologyIds.map(getTechnologyDefinition);
                    const isGroupExpanded = targetViewMode === "advanced" || expandedGroups[group.id];
                    const visibleTechnologies = isGroupExpanded
                      ? technologies
                      : technologies.filter((technology) => isTechnologyTargetChanged(data, scenarioTargets, technology));
                    const summary = getTargetGroupSummary(data, scenarioTargets, group);
                    const headerContent = (
                      <>
                        <span className="target-group-main">
                          <span className="target-group-title-line">
                            <span className="target-group-name">{group.label}</span>
                            <span className={`target-status-pill ${summary.changedCount > 0 ? "is-changed" : ""}`}>
                              {summary.statusLabel}
                            </span>
                          </span>
                          <span className="target-group-source">{summary.sourceLabel}</span>
                        </span>
                        <span className="target-group-metrics">
                          <strong>{summary.targetLabel}</strong>
                          <span>{summary.baselineLabel}</span>
                        </span>
                      </>
                    );

                    return (
                      <section className="target-group" key={group.id}>
                        {targetViewMode === "simple" ? (
                          <button
                            type="button"
                            className="target-group-header"
                            aria-expanded={isGroupExpanded}
                            onClick={() => toggleTargetGroup(group.id)}
                          >
                            {headerContent}
                            {isGroupExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </button>
                        ) : (
                          <div className="target-group-header is-static">
                            {headerContent}
                            <ChevronDown size={16} />
                          </div>
                        )}

                        {visibleTechnologies.length > 0 ? (
                          <div className="target-group-rows">
                            {visibleTechnologies.map((technology) => (
                              <TargetTechnologyRow
                                key={technology.id}
                                data={data}
                                technology={technology}
                                value={scenarioTargets[technology.id]}
                                isChanged={isTechnologyTargetChanged(data, scenarioTargets, technology)}
                                isExpanded={Boolean(expandedRows[technology.id])}
                                onToggleExpanded={() => toggleTargetRow(technology.id)}
                                onUpdate={updateScenarioTarget}
                              />
                            ))}
                          </div>
                        ) : null}
                      </section>
                    );
                  })}
                </div>
              </div>
            </aside>

            <section className="chart-panel" aria-label="15-minute generation and load chart">
              <div className="chart-heading">
                <div>
                  <h2>15-minute system profile</h2>
                  <p>
                    {start} to {end} · load fixed · domestic generation scaled
                  </p>
                </div>
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
              </div>
            </section>
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

function createCurrentWeekTimePeriodState() {
  return createTimePeriodState(createCurrentWeekSelection());
}

function createTimePeriodState(selection: TimePeriodSelection): TimePeriodState {
  const normalizedSelection = clampToCurrentTimePeriod(normalizeTimePeriodSelection(selection));
  const range = getTimeRange(normalizedSelection);

  return {
    selection: normalizedSelection,
    start: range.start,
    end: range.end
  };
}

function createTimePeriodStateFromRange(start: string, end: string): TimePeriodState {
  const selection = deriveTimePeriodSelectionFromRange(start, end);

  if (isAfterCurrentTimePeriod(selection)) {
    return createTimePeriodState(selection);
  }

  return {
    selection,
    start,
    end
  };
}

function TargetTechnologyRow({
  data,
  technology,
  value,
  isChanged,
  isExpanded,
  onToggleExpanded,
  onUpdate
}: {
  data: NormalizedScenarioData;
  technology: Technology;
  value: number;
  isChanged: boolean;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onUpdate: (technologyId: TechnologyId, value: number) => void;
}) {
  const baseline = getTechnologyBaseline(data, technology);
  const unit = getTechnologyUnit(technology);
  const max = Math.max(1, baseline * 3, value * 1.25);
  const step = technology.controlMode === "capacityGw" ? "0.01" : "0.1";
  const detailsId = `target-details-${technology.id}`;

  return (
    <div className={`capacity-row target-row ${isChanged ? "is-changed" : ""}`}>
      <button
        type="button"
        className="target-row-summary"
        aria-expanded={isExpanded}
        aria-controls={detailsId}
        onClick={onToggleExpanded}
      >
        <span className="series-swatch" style={{ backgroundColor: technology.color }} />
        <span className="target-row-labels">
          <span className="target-row-name">{technology.label}</span>
          <span className="target-row-subline">{getTechnologyRatioLabel(value, baseline)}</span>
        </span>
        {isChanged ? <span className="change-pill">changed</span> : null}
        <span className="target-row-value">
          <strong>{formatNumber(value)}</strong>
          <span>{unit}</span>
        </span>
        {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
      </button>

      {isExpanded ? (
        <div className="target-row-details" id={detailsId}>
          <div className="target-input-line">
            <label htmlFor={`target-${technology.id}`}>Target</label>
            <div className="number-with-unit">
              <input
                id={`target-${technology.id}`}
                type="number"
                min="0"
                step={step}
                value={value}
                onChange={(event) => onUpdate(technology.id, Number(event.target.value))}
              />
              <span className="unit">{unit}</span>
            </div>
          </div>
          <input
            aria-label={`${technology.label} ${unit} slider`}
            type="range"
            min="0"
            max={max}
            step={step}
            value={value}
            onChange={(event) => onUpdate(technology.id, Number(event.target.value))}
          />
          <div className="capacity-footnote">
            <span>
              {formatNumber(baseline)} {unit} baseline
            </span>
            <span>{baseline > 0 ? `${formatNumber(value / baseline)}x` : "no profile baseline"}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function TimePeriodSelector({
  selection,
  start,
  end,
  onSelectionChange
}: {
  selection: TimePeriodSelection;
  start: string;
  end: string;
  onSelectionChange: (selection: TimePeriodSelection) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const yearOptions = buildYearOptions(selection.year);
  const periodLabel = getPeriodControlLabel(selection);
  const rangeLabel = formatRangeLabel(start, end);
  const previousYearSelection = updateTimePeriodYear(selection, selection.year - 1);
  const nextYearSelection = updateTimePeriodYear(selection, selection.year + 1);
  const previousPeriodSelection = moveTimePeriod(selection, -1);
  const nextPeriodSelection = moveTimePeriod(selection, 1);

  return (
    <section className={`time-selector ${expanded ? "is-expanded" : "is-collapsed"}`} aria-label="Date selection">
      <button
        className="time-selector-header"
        type="button"
        aria-expanded={expanded}
        aria-controls="time-selector-body"
        onClick={() => setExpanded((current) => !current)}
      >
        <CalendarDays size={20} />
        <span className="time-selector-title">
          <span>Date selection</span>
          <small>{rangeLabel}</small>
        </span>
        {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>

      {expanded ? (
        <div className="time-selector-body" id="time-selector-body">
          <div className="time-selector-row">
            <label htmlFor="time-interval">Interval</label>
            <select
              id="time-interval"
              value={selection.interval}
              onChange={(event) =>
                onSelectionChange(updateTimePeriodInterval(selection, event.target.value as TimeInterval))
              }
            >
              {TIME_INTERVALS.map((interval) => (
                <option key={interval.id} value={interval.id}>
                  {interval.label}
                </option>
              ))}
            </select>
          </div>

          <div className="time-selector-row">
            <label htmlFor="time-year">Year</label>
            <select
              id="time-year"
              value={selection.year}
              onChange={(event) => onSelectionChange(updateTimePeriodYear(selection, Number(event.target.value)))}
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <PeriodStepper
              previousLabel="Previous year"
              nextLabel="Next year"
              nextDisabled={isAfterCurrentTimePeriod(nextYearSelection)}
              onPrevious={() => onSelectionChange(previousYearSelection)}
              onNext={() => onSelectionChange(nextYearSelection)}
            />
          </div>

          {selection.interval !== "year" ? (
            <div className="time-selector-row">
              <label htmlFor="time-period">{periodLabel}</label>
              {selection.interval === "day" ? (
                <input
                  id="time-period"
                  type="date"
                  value={selection.day}
                  min={`${selection.year}-01-01`}
                  max={`${selection.year}-12-31`}
                  onChange={(event) => onSelectionChange(updateTimePeriodValue(selection, event.target.value))}
                />
              ) : (
                <select
                  id="time-period"
                  value={selection.interval === "week" ? selection.week : selection.month}
                  onChange={(event) => onSelectionChange(updateTimePeriodValue(selection, Number(event.target.value)))}
                >
                  {getPeriodOptions(selection).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              )}
              <PeriodStepper
                previousLabel={`Previous ${selection.interval}`}
                nextLabel={`Next ${selection.interval}`}
                nextDisabled={isAfterCurrentTimePeriod(nextPeriodSelection)}
                onPrevious={() => onSelectionChange(previousPeriodSelection)}
                onNext={() => onSelectionChange(nextPeriodSelection)}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function PeriodStepper({
  previousLabel,
  nextLabel,
  nextDisabled = false,
  onPrevious,
  onNext
}: {
  previousLabel: string;
  nextLabel: string;
  nextDisabled?: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <div className="period-stepper">
      <button className="round-icon-button" type="button" onClick={onPrevious} title={previousLabel} aria-label={previousLabel}>
        <ChevronLeft size={20} />
      </button>
      <button
        className="round-icon-button"
        type="button"
        onClick={onNext}
        title={nextLabel}
        aria-label={nextLabel}
        disabled={nextDisabled}
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
}

export function PowerChart({
  scenario,
  visibleSeries
}: {
  scenario: ScenarioResult;
  visibleSeries: Record<ChartSeriesId, boolean>;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const width = 1200;
  const height = 480;
  const padding = { top: 28, right: 48, bottom: 44, left: 64 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const xFor = (index: number) =>
    padding.left + (scenario.timestamps.length <= 1 ? 0 : (index / (scenario.timestamps.length - 1)) * plotWidth);

  const stacks = buildStacks(scenario, visibleSeries);
  let maxY = 1000;
  let minY = -1000;
  const includeChartValues = (values: number[]) => {
    for (const value of values) {
      maxY = Math.max(maxY, value);
      minY = Math.min(minY, value);
    }
  };

  includeChartValues(scenario.loadMw);

  for (const series of stacks.positive) {
    includeChartValues(series.upper);
  }

  for (const series of stacks.negative) {
    includeChartValues(series.lower);
  }

  const yFor = (value: number) => padding.top + ((maxY - value) / (maxY - minY)) * plotHeight;
  const zeroY = yFor(0);
  const xTicks = getTickIndexes(scenario.timestamps.length, 7);
  const yTicks = getYAxisTicks(minY, maxY, 5);
  const updateActivePoint = useCallback(
    (event: PointerEvent<SVGRectElement>) => {
      if (scenario.timestamps.length === 0) {
        return;
      }

      const bounds = event.currentTarget.getBoundingClientRect();
      const relativeX = clamp(event.clientX - bounds.left, 0, bounds.width);
      const index = Math.round((relativeX / Math.max(1, bounds.width)) * (scenario.timestamps.length - 1));

      setActiveIndex(clamp(index, 0, scenario.timestamps.length - 1));
    },
    [scenario.timestamps.length]
  );
  const handleTooltipKeyDown = useCallback(
    (event: KeyboardEvent<SVGRectElement>) => {
      if (scenario.timestamps.length === 0) {
        return;
      }

      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        const step = event.key === "ArrowRight" ? 1 : -1;
        event.preventDefault();
        setActiveIndex((current) => clamp((current ?? 0) + step, 0, scenario.timestamps.length - 1));
      } else if (event.key === "Home") {
        event.preventDefault();
        setActiveIndex(0);
      } else if (event.key === "End") {
        event.preventDefault();
        setActiveIndex(scenario.timestamps.length - 1);
      } else if (event.key === "Escape") {
        setActiveIndex(null);
      }
    },
    [scenario.timestamps.length]
  );

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

        {xTicks.map((index) => (
          <g key={index}>
            <line x1={xFor(index)} x2={xFor(index)} y1={padding.top} y2={height - padding.bottom} className="x-guide" />
            <text x={xFor(index)} y={height - 16} textAnchor="middle" className="axis-label">
              {dateFormatter.format(new Date(scenario.timestamps[index] * 1000))}
            </text>
          </g>
        ))}

        {activeIndex !== null ? (
          <ChartTooltip
            index={activeIndex}
            scenario={scenario}
            visibleSeries={visibleSeries}
            x={xFor(activeIndex)}
            y={yFor(scenario.loadMw[activeIndex] ?? 0)}
            yFor={yFor}
            padding={padding}
            chartWidth={width}
            chartHeight={height}
          />
        ) : null}

        <rect
          className="chart-hit-area"
          x={padding.left}
          y={padding.top}
          width={plotWidth}
          height={plotHeight}
          tabIndex={0}
          aria-label="Inspect chart values"
          onFocus={() => setActiveIndex((current) => current ?? 0)}
          onBlur={() => setActiveIndex(null)}
          onKeyDown={handleTooltipKeyDown}
          onPointerDown={updateActivePoint}
          onPointerEnter={updateActivePoint}
          onPointerMove={updateActivePoint}
          onPointerLeave={() => setActiveIndex(null)}
        />
      </svg>
    </div>
  );
}

function ChartTooltip({
  index,
  scenario,
  visibleSeries,
  x,
  y,
  yFor,
  padding,
  chartWidth,
  chartHeight
}: {
  index: number;
  scenario: ScenarioResult;
  visibleSeries: Record<ChartSeriesId, boolean>;
  x: number;
  y: number;
  yFor: (value: number) => number;
  padding: { top: number; right: number; bottom: number; left: number };
  chartWidth: number;
  chartHeight: number;
}) {
  const rowHeight = 20;
  const tooltipWidth = 318;
  const seriesRows = CHART_SERIES.filter((series) => visibleSeries[series.id]).map((series) => ({
    label: series.label,
    color: series.color,
    value: scenario.seriesMw[series.id][index] ?? 0
  }));
  const lineRows = [
    { label: "Load", color: "#111827", value: scenario.loadMw[index] ?? 0 }
  ];
  const visibleNetSupplyMw = seriesRows.reduce((total, row) => total + row.value, 0);
  const firstDividerY = 42;
  const seriesStartY = 64;
  const totalDividerY = seriesStartY + seriesRows.length * rowHeight + 8;
  const totalY = totalDividerY + 24;
  const lineDividerY = totalY + 16;
  const lineStartY = lineDividerY + 18;
  const tooltipHeight = lineStartY + lineRows.length * rowHeight;
  const tooltipX = clamp(
    x + tooltipWidth + 18 > chartWidth - padding.right ? x - tooltipWidth - 18 : x + 18,
    padding.left + 8,
    chartWidth - padding.right - tooltipWidth - 8
  );
  const maxTooltipY = Math.max(padding.top + 8, chartHeight - padding.bottom - tooltipHeight - 8);
  const tooltipY = clamp(y - 24, padding.top + 8, maxTooltipY);

  return (
    <g className="chart-tooltip" pointerEvents="none">
      <line x1={x} x2={x} y1={padding.top} y2={chartHeight - padding.bottom} className="tooltip-guide" />
      {lineRows.map((row) => (
        <circle key={row.label} cx={x} cy={yFor(row.value)} r="4.5" fill={row.color} className="tooltip-point" />
      ))}
      <g transform={`translate(${tooltipX} ${tooltipY})`}>
        <rect width={tooltipWidth} height={tooltipHeight} rx="6" className="tooltip-box" />
        <text x="14" y="27" className="tooltip-title">
          {tooltipDateFormatter.format(new Date((scenario.timestamps[index] ?? 0) * 1000))}
        </text>
        <line x1="14" x2={tooltipWidth - 14} y1={firstDividerY} y2={firstDividerY} className="tooltip-rule" />

        {seriesRows.map((row, rowIndex) => (
          <g key={row.label} transform={`translate(0 ${seriesStartY + rowIndex * rowHeight})`}>
            <circle cx="18" cy="-4" r="4" fill={row.color} />
            <text x="30" y="0" className="tooltip-label">
              {row.label}
            </text>
            <text x={tooltipWidth - 14} y="0" textAnchor="end" className="tooltip-value">
              {formatMw(row.value)}
            </text>
          </g>
        ))}

        <line x1="14" x2={tooltipWidth - 14} y1={totalDividerY} y2={totalDividerY} className="tooltip-rule" />
        <text x="14" y={totalY} className="tooltip-label">
          Visible net supply
        </text>
        <text x={tooltipWidth - 14} y={totalY} textAnchor="end" className="tooltip-value">
          {formatMw(visibleNetSupplyMw)}
        </text>

        <line x1="14" x2={tooltipWidth - 14} y1={lineDividerY} y2={lineDividerY} className="tooltip-rule" />
        {lineRows.map((row, rowIndex) => (
          <g key={row.label} transform={`translate(0 ${lineStartY + rowIndex * rowHeight})`}>
            <circle cx="18" cy="-4" r="4" fill={row.color} />
            <text x="30" y="0" className="tooltip-label">
              {row.label}
            </text>
            <text x={tooltipWidth - 14} y="0" textAnchor="end" className="tooltip-value">
              {formatMw(row.value)}
            </text>
          </g>
        ))}
      </g>
    </g>
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
    ...CHART_SERIES.map((series) => `${series.id}_mw`)
  ];
  const rows = scenario.timestamps.map((_, index) => [
    scenario.isoTimes[index],
    scenario.loadMw[index],
    ...CHART_SERIES.map((series) => scenario.seriesMw[series.id][index] ?? 0)
  ]);

  return [headers, ...rows].map((row) => row.join(",")).join("\n");
}

function readScenarioTargetsFromUrl(data: NormalizedScenarioData) {
  return readScenarioTargetsFromSearchParams(data, window.location.search);
}

export function readScenarioTargetsFromSearchParams(data: NormalizedScenarioData, search: string) {
  const params = new URLSearchParams(search);
  const values = buildBaselineScenarioTargets(data);

  for (const technology of TECHNOLOGIES) {
    const rawValue =
      params.get(getScenarioParamName(technology)) ??
      (technology.controlMode === "capacityGw" ? params.get(technology.id) : null);

    if (rawValue === null) {
      continue;
    }

    const value = Number(rawValue);

    if (Number.isFinite(value) && value >= 0) {
      values[technology.id] = value;
    }
  }

  return values;
}

export async function readScenarioDataResponse(response: Response): Promise<NormalizedScenarioData> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType && !contentType.toLowerCase().includes("application/json")) {
    throw new Error("Scenario data response was not JSON.");
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    throw new Error("Scenario data response was not valid JSON.");
  }

  if (!response.ok) {
    throw new Error(getScenarioDataErrorMessage(payload));
  }

  return payload as NormalizedScenarioData;
}

function getScenarioDataErrorMessage(payload: unknown) {
  if (payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string") {
    return payload.error;
  }

  return "Scenario data request failed.";
}

function buildBaselineScenarioTargets(data: NormalizedScenarioData): ScenarioTargetsByTechnology {
  return Object.fromEntries(
    TECHNOLOGIES.map((technology) => [technology.id, getTechnologyBaseline(data, technology)])
  ) as ScenarioTargetsByTechnology;
}

function getTechnologyBaseline(data: NormalizedScenarioData, technology: Technology) {
  return technology.controlMode === "capacityGw"
    ? data.baselineCapacityGw[technology.id]
    : data.baselineAnnualGenerationTwh[technology.id];
}

function getTechnologyUnit(technology: Technology) {
  return technology.controlMode === "capacityGw" ? "GW" : "TWh/yr";
}

function getTechnologyDefinition(technologyId: TechnologyId) {
  const technology = TECHNOLOGIES.find((item) => item.id === technologyId);

  if (!technology) {
    throw new Error(`Unknown technology: ${technologyId}`);
  }

  return technology;
}

function isTechnologyTargetChanged(
  data: NormalizedScenarioData,
  scenarioTargets: ScenarioTargetsByTechnology,
  technology: Technology
) {
  return Math.abs(scenarioTargets[technology.id] - getTechnologyBaseline(data, technology)) > TARGET_CHANGE_EPSILON;
}

function getTargetGroupSummary(
  data: NormalizedScenarioData,
  scenarioTargets: ScenarioTargetsByTechnology,
  group: TargetGroup
) {
  const technologies = group.technologyIds.map(getTechnologyDefinition);
  const unit = getTechnologyUnit(technologies[0]);
  const targetTotal = technologies.reduce((sum, technology) => sum + scenarioTargets[technology.id], 0);
  const baselineTotal = technologies.reduce((sum, technology) => sum + getTechnologyBaseline(data, technology), 0);
  const changedCount = technologies.filter((technology) => isTechnologyTargetChanged(data, scenarioTargets, technology)).length;

  return {
    changedCount,
    targetLabel: `${formatNumber(targetTotal)} ${unit}`,
    baselineLabel: `${formatNumber(baselineTotal)} ${unit} baseline`,
    sourceLabel: getTargetGroupSourceLabel(data, technologies[0]),
    statusLabel: changedCount === 0 ? "baseline" : technologies.length === 1 ? "changed" : `${changedCount} changed`
  };
}

function getTargetGroupSourceLabel(data: NormalizedScenarioData, technology: Technology) {
  const baselineSource =
    technology.controlMode === "capacityGw"
      ? `${data.periodYear} Energy-Charts installed capacity`
      : `full-year ${data.periodYear} Energy-Charts generation`;

  return `Target: scenario values · Baseline: ${baselineSource}`;
}

function getTechnologyRatioLabel(value: number, baseline: number) {
  if (baseline <= 0) {
    return "no profile baseline";
  }

  return `${formatNumber(value / baseline)}x baseline`;
}

function getScenarioParamName(technology: Technology) {
  const suffix = technology.controlMode === "capacityGw" ? "Gw" : "Twh";

  return `${technology.id}${suffix}`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: value < 10 ? 2 : 1
  }).format(value);
}

function formatCompactMw(value: number) {
  if (Math.abs(value) >= MW_PER_GW) {
    return `${formatNumber(value / MW_PER_GW)} GW`;
  }

  return `${formatNumber(value)} MW`;
}

function formatMw(value: number) {
  return `${formatNumber(value)} MW`;
}

function round(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function buildYearOptions(selectedYear: number) {
  const startYear = Math.min(MIN_SELECTOR_YEAR, selectedYear);
  const endYear = Math.max(getCurrentUtcYear(), selectedYear);

  return Array.from({ length: endYear - startYear + 1 }, (_, index) => endYear - index);
}

function getPeriodControlLabel(selection: TimePeriodSelection) {
  if (selection.interval === "day") {
    return `Day in ${selection.year}`;
  }

  if (selection.interval === "week") {
    return `Week in ${selection.year}`;
  }

  return `Month in ${selection.year}`;
}

function getPeriodOptions(selection: TimePeriodSelection) {
  if (selection.interval === "week") {
    return Array.from({ length: getIsoWeeksInYear(selection.year) }, (_, index) => ({
      value: index + 1,
      label: `Week ${index + 1}`
    }));
  }

  return Array.from({ length: 12 }, (_, index) => ({
    value: index + 1,
    label: monthFormatter.format(new Date(Date.UTC(selection.year, index, 1)))
  }));
}

function formatRangeLabel(start: string, end: string) {
  const formattedStart = rangeDateFormatter.format(new Date(`${start}T00:00:00Z`));
  const formattedEnd = rangeDateFormatter.format(new Date(`${end}T00:00:00Z`));

  return start === end ? formattedStart : `${formattedStart} to ${formattedEnd}`;
}
