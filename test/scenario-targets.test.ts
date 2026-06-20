import { describe, expect, it } from "vitest";
import { readScenarioTargetsFromSearchParams } from "@/app/components/simulator-page";
import type { NormalizedScenarioData } from "@/lib/types";

const data: NormalizedScenarioData = {
  start: "2025-01-01",
  end: "2025-01-07",
  periodYear: 2025,
  capacityYear: "2025",
  timestamps: [],
  isoTimes: [],
  loadMw: [],
  historicalResidualMw: [],
  historicalCrossBorderMw: [],
  baselineCapacityGw: {
    solar: 1,
    windOnshore: 2,
    hydroRunRiver: 3,
    hydroReservoir: 4,
    hydroPumped: 5,
    fossilGas: 6,
    biomass: 7,
    wasteOther: 8
  },
  baselineAnnualGenerationTwh: {
    solar: 10,
    windOnshore: 20,
    hydroRunRiver: 30,
    hydroReservoir: 40,
    hydroPumped: 50,
    fossilGas: 60,
    biomass: 70,
    wasteOther: 80
  },
  policyPresets: [],
  historicalSeriesMw: {
    solar: [],
    windOnshore: [],
    hydroRunRiver: [],
    hydroReservoir: [],
    hydroPumped: [],
    hydroPumpedConsumption: [],
    fossilGas: [],
    biomass: [],
    wasteOther: []
  },
  sourceUpdatedAt: null,
  sourceDeprecated: false
};

describe("readScenarioTargetsFromSearchParams", () => {
  it("keeps baseline targets when URL parameters are missing", () => {
    const targets = readScenarioTargetsFromSearchParams(data, "");

    expect(targets.solar).toBe(10);
    expect(targets.windOnshore).toBe(20);
    expect(targets.hydroPumped).toBe(5);
    expect(targets.fossilGas).toBe(6);
  });

  it("reads unit-qualified params and only allows legacy params for GW controls", () => {
    const targets = readScenarioTargetsFromSearchParams(data, "?solar=1&solarTwh=12&fossilGasGw=9&hydroPumped=7");

    expect(targets.solar).toBe(12);
    expect(targets.windOnshore).toBe(20);
    expect(targets.fossilGas).toBe(9);
    expect(targets.hydroPumped).toBe(7);
  });
});
