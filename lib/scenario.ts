import { CHART_SERIES, getTechnology, type TechnologyId } from "./technologies";
import type { NormalizedScenarioData, ScenarioResult, ScenarioTargetsByTechnology } from "./types";

const QUARTER_HOUR = 0.25;

export function runBalanceScenario(
  data: NormalizedScenarioData,
  scenarioTargets: ScenarioTargetsByTechnology
): ScenarioResult {
  const seriesMw = Object.fromEntries(
    CHART_SERIES.map((series) => {
      const scale = getTechnologyScaleFactor(data, series.technologyId, scenarioTargets[series.technologyId]);
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
  let peakDeficitMw = 0;
  let peakSurplusMw = 0;

  for (const value of residualMw) {
    peakDeficitMw = Math.max(peakDeficitMw, value);
    peakSurplusMw = Math.max(peakSurplusMw, -value);
  }

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

export function getScaleFactor(baselineValue: number, scenarioValue: number) {
  if (baselineValue <= 0) {
    return 0;
  }

  return scenarioValue / baselineValue;
}

function getTechnologyScaleFactor(
  data: NormalizedScenarioData,
  technologyId: TechnologyId,
  scenarioTarget: number
) {
  const technology = getTechnology(technologyId);
  const baseline =
    technology.controlMode === "capacityGw"
      ? data.baselineCapacityGw[technologyId]
      : data.baselineAnnualGenerationTwh[technologyId];

  return getScaleFactor(baseline, scenarioTarget);
}

export function sumEnergy(valuesMw: number[]) {
  return valuesMw.reduce((sum, value) => sum + value * QUARTER_HOUR, 0);
}

function toGwh(valueMwh: number) {
  return valueMwh / 1000;
}
