import { CHART_SERIES } from "./technologies";
import type { CapacityByTechnology, NormalizedScenarioData, ScenarioResult } from "./types";

const QUARTER_HOUR = 0.25;

export function runBalanceScenario(
  data: NormalizedScenarioData,
  scenarioCapacityGw: CapacityByTechnology
): ScenarioResult {
  const seriesMw = Object.fromEntries(
    CHART_SERIES.map((series) => {
      const scale = getScaleFactor(data.baselineCapacityGw[series.technologyId], scenarioCapacityGw[series.technologyId]);
      return [series.id, data.historicalSeriesMw[series.id].map((value) => value * scale)];
    })
  ) as ScenarioResult["seriesMw"];

  const domesticNetSupplyMw = data.timestamps.map((_, index) =>
    CHART_SERIES.reduce((sum, series) => sum + (seriesMw[series.id][index] ?? 0), 0)
  );
  const residualMw = data.loadMw.map((load, index) => load - domesticNetSupplyMw[index]);
  const renewableGenerationMw = data.timestamps.map((_, index) =>
    CHART_SERIES.filter((series) => series.renewable).reduce((sum, series) => {
      const value = seriesMw[series.id][index] ?? 0;
      return sum + Math.max(value, 0);
    }, 0)
  );

  const loadGwh = toGwh(sumEnergy(data.loadMw));
  const generationGwh = toGwh(sumEnergy(domesticNetSupplyMw));
  const renewableGenerationGwh = toGwh(sumEnergy(renewableGenerationMw));
  const deficitGwh = toGwh(sumEnergy(residualMw.map((value) => Math.max(value, 0))));
  const surplusGwh = toGwh(sumEnergy(residualMw.map((value) => Math.max(-value, 0))));
  const peakDeficitMw = Math.max(0, ...residualMw);
  const peakSurplusMw = Math.max(0, ...residualMw.map((value) => -value));

  return {
    timestamps: data.timestamps,
    isoTimes: data.isoTimes,
    seriesMw,
    loadMw: data.loadMw,
    residualMw,
    historicalResidualMw: data.historicalResidualMw,
    historicalCrossBorderMw: data.historicalCrossBorderMw,
    totals: {
      loadGwh,
      generationGwh,
      renewableGenerationGwh,
      renewableShareOfLoad: loadGwh > 0 ? renewableGenerationGwh / loadGwh : 0,
      deficitGwh,
      surplusGwh,
      peakDeficitMw,
      peakSurplusMw
    }
  };
}

export function getScaleFactor(baselineCapacityGw: number, scenarioCapacityGw: number) {
  if (baselineCapacityGw <= 0) {
    return 0;
  }

  return scenarioCapacityGw / baselineCapacityGw;
}

export function sumEnergy(valuesMw: number[]) {
  return valuesMw.reduce((sum, value) => sum + value * QUARTER_HOUR, 0);
}

function toGwh(valueMwh: number) {
  return valueMwh / 1000;
}
