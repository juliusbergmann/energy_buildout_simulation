import type { ChartSeriesId, TechnologyId } from "./technologies";

export type SeriesValues = Record<string, number[]>;

export type CapacityByTechnology = Record<TechnologyId, number>;

export type NormalizedScenarioData = {
  start: string;
  end: string;
  periodYear: number;
  capacityYear: string;
  timestamps: number[];
  isoTimes: string[];
  loadMw: number[];
  historicalResidualMw: number[];
  historicalCrossBorderMw: number[];
  baselineCapacityGw: CapacityByTechnology;
  historicalSeriesMw: Record<ChartSeriesId, number[]>;
  sourceUpdatedAt: string | null;
  sourceDeprecated: boolean;
};

export type ScenarioResult = {
  timestamps: number[];
  isoTimes: string[];
  seriesMw: Record<ChartSeriesId, number[]>;
  loadMw: number[];
  residualMw: number[];
  historicalResidualMw: number[];
  historicalCrossBorderMw: number[];
  totals: {
    loadGwh: number;
    generationGwh: number;
    renewableGenerationGwh: number;
    renewableShareOfLoad: number;
    deficitGwh: number;
    surplusGwh: number;
    peakDeficitMw: number;
    peakSurplusMw: number;
  };
};
