import { describe, expect, it } from "vitest";
import { runBalanceScenario, getScaleFactor, sumEnergy } from "@/lib/scenario";
import type { NormalizedScenarioData, ScenarioTargetsByTechnology } from "@/lib/types";

const baseData: NormalizedScenarioData = {
  start: "2025-01-01",
  end: "2025-01-01",
  periodYear: 2025,
  capacityYear: "2025",
  timestamps: [1, 2, 3, 4],
  isoTimes: [
    "2025-01-01T00:00:00.000Z",
    "2025-01-01T00:15:00.000Z",
    "2025-01-01T00:30:00.000Z",
    "2025-01-01T00:45:00.000Z"
  ],
  loadMw: [100, 100, 100, 100],
  historicalResidualMw: [20, 20, 20, 20],
  historicalCrossBorderMw: [10, 10, 10, 10],
  baselineCapacityGw: {
    solar: 10,
    windOnshore: 5,
    hydroRunRiver: 5,
    hydroReservoir: 2,
    hydroPumped: 4,
    fossilGas: 4,
    biomass: 1,
    wasteOther: 1
  },
  baselineAnnualGenerationTwh: {
    solar: 1,
    windOnshore: 2,
    hydroRunRiver: 3,
    hydroReservoir: 4,
    hydroPumped: 5,
    fossilGas: 6,
    biomass: 7,
    wasteOther: 8
  },
  annualGenerationBaselineLabel: "full-year 2025 Energy-Charts generation",
  policyPresets: [],
  historicalSeriesMw: {
    solar: [10, 20, 30, 40],
    windOnshore: [20, 20, 20, 20],
    hydroRunRiver: [10, 10, 10, 10],
    hydroReservoir: [5, 5, 5, 5],
    hydroPumped: [0, 0, 0, 0],
    hydroPumpedConsumption: [-5, -5, -5, -5],
    fossilGas: [20, 10, 0, 0],
    biomass: [10, 10, 10, 10],
    wasteOther: [5, 5, 5, 5]
  },
  sourceUpdatedAt: "2026-06-20T00:00:00.000Z",
  sourceDeprecated: false
};

describe("runBalanceScenario", () => {
  it("scales annual-generation technologies by full-year TWh ratio and leaves load fixed", () => {
    const scenario = runBalanceScenario(baseData, {
      ...buildBaselineTargets(baseData),
      solar: 2
    });

    expect(scenario.seriesMw.solar).toEqual([20, 40, 60, 80]);
    expect(scenario.loadMw).toEqual([100, 100, 100, 100]);
  });

  it("keeps fossil gas capacity-based", () => {
    const scenario = runBalanceScenario(baseData, {
      ...buildBaselineTargets(baseData),
      fossilGas: 8
    });

    expect(scenario.seriesMw.fossilGas).toEqual([40, 20, 0, 0]);
    expect(scenario.seriesMw.solar).toEqual([10, 20, 30, 40]);
  });

  it("calculates residual as fixed load minus simulated domestic net supply", () => {
    const scenario = runBalanceScenario(baseData, buildBaselineTargets(baseData));

    expect(scenario.residualMw).toEqual([25, 25, 25, 15]);
  });

  it("calculates energy totals from 15-minute MW values", () => {
    const scenario = runBalanceScenario(baseData, buildBaselineTargets(baseData));

    expect(sumEnergy([100, 100, 100, 100])).toBe(100);
    expect(scenario.totals.loadGwh).toBe(0.1);
    expect(scenario.totals.deficitGwh).toBe(0.0225);
  });

  it("keeps zero-baseline technologies at zero instead of dividing by zero", () => {
    expect(getScaleFactor(0, 10)).toBe(0);
  });

  it("calculates peak values for large ranges without overflowing the call stack", () => {
    const pointCount = 130_000;
    const timestamps = Array.from({ length: pointCount }, (_, index) => 1_735_689_600 + index * 900);
    const makeValues = (value: number) => Array.from({ length: pointCount }, () => value);
    const largeData: NormalizedScenarioData = {
      ...baseData,
      timestamps,
      isoTimes: timestamps.map((timestamp) => new Date(timestamp * 1000).toISOString()),
      loadMw: makeValues(100),
      historicalResidualMw: makeValues(20),
      historicalCrossBorderMw: makeValues(10),
      historicalSeriesMw: Object.fromEntries(
        Object.entries(baseData.historicalSeriesMw).map(([seriesId]) => [
          seriesId,
          makeValues(seriesId === "hydroPumpedConsumption" ? -5 : 5)
        ])
      ) as NormalizedScenarioData["historicalSeriesMw"]
    };

    expect(() => runBalanceScenario(largeData, buildBaselineTargets(largeData))).not.toThrow(RangeError);
  });
});

function buildBaselineTargets(data: NormalizedScenarioData): ScenarioTargetsByTechnology {
  return {
    ...data.baselineAnnualGenerationTwh,
    hydroPumped: data.baselineCapacityGw.hydroPumped,
    fossilGas: data.baselineCapacityGw.fossilGas
  };
}
