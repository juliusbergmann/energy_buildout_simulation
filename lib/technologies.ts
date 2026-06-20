export type TechnologyId =
  | "solar"
  | "windOnshore"
  | "hydroRunRiver"
  | "hydroReservoir"
  | "hydroPumped"
  | "fossilGas"
  | "biomass"
  | "wasteOther";

export type ChartSeriesId =
  | "solar"
  | "windOnshore"
  | "hydroRunRiver"
  | "hydroReservoir"
  | "hydroPumped"
  | "hydroPumpedConsumption"
  | "fossilGas"
  | "biomass"
  | "wasteOther";

export type Technology = {
  id: TechnologyId;
  label: string;
  shortLabel: string;
  color: string;
  installedCapacityNames: string[];
  productionNames: string[];
  renewable: boolean;
  adjustable: boolean;
};

export type ChartSeriesDefinition = {
  id: ChartSeriesId;
  technologyId: TechnologyId;
  label: string;
  color: string;
  sourceNames: string[];
  renewable: boolean;
  belowZero?: boolean;
};

export const TECHNOLOGIES: Technology[] = [
  {
    id: "solar",
    label: "Solar AC",
    shortLabel: "Solar",
    color: "#f2a900",
    installedCapacityNames: ["Solar AC", "Solar"],
    productionNames: ["Solar"],
    renewable: true,
    adjustable: true
  },
  {
    id: "windOnshore",
    label: "Wind onshore",
    shortLabel: "Wind",
    color: "#4aa3df",
    installedCapacityNames: ["Wind onshore"],
    productionNames: ["Wind onshore"],
    renewable: true,
    adjustable: true
  },
  {
    id: "hydroRunRiver",
    label: "Hydro run-of-river",
    shortLabel: "Run-of-river",
    color: "#227c9d",
    installedCapacityNames: ["Hydro Run-of-River"],
    productionNames: ["Hydro Run-of-River"],
    renewable: true,
    adjustable: true
  },
  {
    id: "hydroReservoir",
    label: "Hydro reservoir",
    shortLabel: "Reservoir",
    color: "#1b998b",
    installedCapacityNames: ["Hydro water reservoir"],
    productionNames: ["Hydro water reservoir"],
    renewable: true,
    adjustable: true
  },
  {
    id: "hydroPumped",
    label: "Hydro pumped storage",
    shortLabel: "Pumped storage",
    color: "#6c8ae4",
    installedCapacityNames: ["Hydro pumped storage"],
    productionNames: ["Hydro pumped storage", "Hydro pumped storage consumption"],
    renewable: true,
    adjustable: true
  },
  {
    id: "fossilGas",
    label: "Fossil gas",
    shortLabel: "Gas",
    color: "#d95d39",
    installedCapacityNames: ["Fossil gas"],
    productionNames: ["Fossil gas"],
    renewable: false,
    adjustable: true
  },
  {
    id: "biomass",
    label: "Biomass",
    shortLabel: "Biomass",
    color: "#7aa95c",
    installedCapacityNames: ["Biomass"],
    productionNames: ["Biomass"],
    renewable: true,
    adjustable: true
  },
  {
    id: "wasteOther",
    label: "Waste / other small sources",
    shortLabel: "Waste / other",
    color: "#8f6f56",
    installedCapacityNames: ["Waste", "Others", "Other renewables", "Geothermal"],
    productionNames: ["Waste", "Others", "Other renewables", "Geothermal"],
    renewable: false,
    adjustable: true
  }
];

export const CHART_SERIES: ChartSeriesDefinition[] = [
  {
    id: "hydroRunRiver",
    technologyId: "hydroRunRiver",
    label: "Hydro run-of-river",
    color: "#227c9d",
    sourceNames: ["Hydro Run-of-River"],
    renewable: true
  },
  {
    id: "hydroReservoir",
    technologyId: "hydroReservoir",
    label: "Hydro reservoir",
    color: "#1b998b",
    sourceNames: ["Hydro water reservoir"],
    renewable: true
  },
  {
    id: "hydroPumped",
    technologyId: "hydroPumped",
    label: "Pumped storage generation",
    color: "#6c8ae4",
    sourceNames: ["Hydro pumped storage"],
    renewable: true
  },
  {
    id: "biomass",
    technologyId: "biomass",
    label: "Biomass",
    color: "#7aa95c",
    sourceNames: ["Biomass"],
    renewable: true
  },
  {
    id: "wasteOther",
    technologyId: "wasteOther",
    label: "Waste / other",
    color: "#8f6f56",
    sourceNames: ["Waste", "Others", "Other renewables", "Geothermal"],
    renewable: false
  },
  {
    id: "fossilGas",
    technologyId: "fossilGas",
    label: "Fossil gas",
    color: "#d95d39",
    sourceNames: ["Fossil gas"],
    renewable: false
  },
  {
    id: "windOnshore",
    technologyId: "windOnshore",
    label: "Wind onshore",
    color: "#4aa3df",
    sourceNames: ["Wind onshore"],
    renewable: true
  },
  {
    id: "solar",
    technologyId: "solar",
    label: "Solar AC",
    color: "#f2a900",
    sourceNames: ["Solar"],
    renewable: true
  },
  {
    id: "hydroPumpedConsumption",
    technologyId: "hydroPumped",
    label: "Pumping consumption",
    color: "#4056a1",
    sourceNames: ["Hydro pumped storage consumption"],
    renewable: true,
    belowZero: true
  }
];

export function getTechnology(id: TechnologyId) {
  const technology = TECHNOLOGIES.find((item) => item.id === id);

  if (!technology) {
    throw new Error(`Unknown technology: ${id}`);
  }

  return technology;
}
