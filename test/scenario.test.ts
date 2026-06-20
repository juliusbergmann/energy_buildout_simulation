import { describe, expect, it } from "vitest";
import { runBalanceScenario, getScaleFactor, sumEnergy } from "@/lib/scenario";
import type { NormalizedScenarioData } from "@/lib/types";

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
  it("scales generation profiles by capacity ratio and leaves load fixed", () => {
    const scenario = runBalanceScenario(baseData, {
      ...baseData.baselineCapacityGw,
      solar: 20
    });

    expect(scenario.seriesMw.solar).toEqual([20, 40, 60, 80]);
    expect(scenario.loadMw).toEqual([100, 100, 100, 100]);
  });

  it("calculates residual as fixed load minus simulated domestic net supply", () => {
    const scenario = runBalanceScenario(baseData, baseData.baselineCapacityGw);

    expect(scenario.residualMw).toEqual([25, 25, 25, 15]);
  });

  it("calculates energy totals from 15-minute MW values", () => {
    const scenario = runBalanceScenario(baseData, baseData.baselineCapacityGw);

    expect(sumEnergy([100, 100, 100, 100])).toBe(100);
    expect(scenario.totals.loadGwh).toBe(0.1);
    expect(scenario.totals.deficitGwh).toBe(0.0225);
  });

  it("keeps zero-baseline technologies at zero instead of dividing by zero", () => {
    expect(getScaleFactor(0, 10)).toBe(0);
  });
});
