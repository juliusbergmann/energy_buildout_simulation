import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PowerChart } from "@/app/components/simulator-page";
import { CHART_SERIES } from "@/lib/technologies";
import type { ChartSeriesId } from "@/lib/technologies";
import type { ScenarioResult } from "@/lib/types";

function buildScenario(pointCount: number) {
  const timestamps = Array.from({ length: pointCount }, (_, index) => 1_735_689_600 + index * 900);
  const visibleSeries = Object.fromEntries(CHART_SERIES.map((series) => [series.id, true])) as Record<
    ChartSeriesId,
    boolean
  >;
  const seriesMw = Object.fromEntries(
    CHART_SERIES.map((series, seriesIndex) => [
      series.id,
      Array.from({ length: pointCount }, (_, index) =>
        series.belowZero ? -20 - (index % 5) : 100 + seriesIndex * 10 + (index % 11)
      )
    ])
  ) as ScenarioResult["seriesMw"];
  const scenario: ScenarioResult = {
    timestamps,
    isoTimes: timestamps.map((timestamp) => new Date(timestamp * 1000).toISOString()),
    seriesMw,
    loadMw: Array.from({ length: pointCount }, (_, index) => 1_000 + (index % 17)),
    residualMw: Array.from({ length: pointCount }, (_, index) => 200 - (index % 31)),
    historicalResidualMw: Array.from({ length: pointCount }, () => 0),
    historicalCrossBorderMw: Array.from({ length: pointCount }, (_, index) => (index % 2 === 0 ? 50 : -50)),
    totals: {
      loadGwh: 0,
      generationGwh: 0,
      renewableGenerationGwh: 0,
      renewableShareOfLoad: 0,
      deficitGwh: 0,
      surplusGwh: 0,
      peakDeficitMw: 0,
      peakSurplusMw: 0
    }
  };

  return { scenario, visibleSeries };
}

describe("PowerChart", () => {
  it("renders large ranges without overflowing the call stack while calculating bounds", () => {
    const { scenario, visibleSeries } = buildScenario(12_000);

    expect(() => renderToStaticMarkup(createElement(PowerChart, { scenario, visibleSeries }))).not.toThrow();
  });

  it("renders a focusable chart inspection layer for tooltip values", () => {
    const { scenario, visibleSeries } = buildScenario(12);
    const markup = renderToStaticMarkup(createElement(PowerChart, { scenario, visibleSeries }));

    expect(markup).toContain("chart-hit-area");
    expect(markup).toContain("aria-label=\"Inspect chart values\"");
    expect(markup).toContain("tabindex=\"0\"");
  });
});
