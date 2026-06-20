# Energy System Modelling Research For An Austria Renewable Electricity Webpage

Date: 2026-06-20

Purpose: define a reproducible, understandable modelling path for a webpage where users can explore how much electricity Austria could generate in future years if renewable buildout follows current plans, and how that result changes as the model becomes more realistic.

## 1. Short Answer

Start with a transparent 15-minute historical replay model, then move to better dispatch, then to spatial/grid-aware modelling, then to optimization. The project should not begin as a full energy system model, but it should also not stop at annual totals. It should begin with a clean, auditable time-series calculation that users can replay and inspect:

```text
future_generation_15min[t] =
  historical_generation_15min[t]
  scaled_to_planned_buildout_by_technology
```

The annual totals are still useful as a check:

```text
generation_TWh =
  sum(generation_MWh_15min[t]) / 1_000_000
```

The first public version should clearly distinguish:

- Annual balance: Austria can generate as much renewable electricity over a year as it consumes.
- Hourly matching: renewable supply meets demand in every hour without imports, fossil backup, storage discharge, demand response, or curtailment.
- 15-minute matching: the same question at the settlement/data resolution the first implementation should use.

Those are very different claims. Austria's policy target is primarily an annual national balance target, not a proof that every hour is covered by domestic renewables.

## 2. Austria Policy Baseline

The central legal source is Austria's Renewables Expansion Act, the EAG. The consolidated legal text on RIS states that new, expanded, and revitalized renewable electricity plants should be supported so that from 2030 total electricity consumption is covered 100% from domestic renewable sources on a national balance basis. It also states that, relative to 2020 production, annual renewable electricity generation should increase by 27 TWh by 2030, split into:

| Technology | EAG additional annual generation by 2030 vs 2020 |
|---|---:|
| Photovoltaics | 11 TWh |
| Wind | 10 TWh |
| Hydropower | 5 TWh |
| Biomass | 1 TWh |
| Total | 27 TWh |

Source: [RIS consolidated EAG, section 4](https://www.ris.bka.gv.at/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=20011619), especially the lines around section 4.

Austria's final updated NECP for 2021-2030, updated on 2024-12-03, is the better source for the current planning baseline because it reflects increased electricity demand. It keeps the 2030 100% renewable electricity target, but states that the EAG +27 TWh path is not enough under the WAM scenario. The WAM scenario needs +35 TWh renewable electricity compared with 2020:

| Technology | NECP WAM additional annual generation by 2030 vs 2020 |
|---|---:|
| Photovoltaics | 17 TWh |
| Wind | 12 TWh |
| Hydropower | 5 TWh |
| Biomass | 1 TWh |
| Total | 35 TWh |

The NECP table gives a 2030 WAM renewable electricity generation level of about 91 TWh and electricity demand of about 89 TWh. It also references feasible 2030 renewable electricity potential of about 32-46 TWh relative to 2020. Source: [Austria final updated NECP, English machine translation, pages around 79-80](https://webgate.ec.europa.eu/circabc-ewpp/d/d/workspace/SpacesStore/a9cc4c4d-479b-44e2-a610-bde40e24394f/details).

The European Commission's NECP page is useful for version control because it lists the final updated NECP, earlier drafts, assessments, and annexes for Austria. Source: [European Commission NECP page](https://energy.ec.europa.eu/strategy/energy-union/national-energy-and-climate-plans_en).

## 3. What The Webpage Should Answer

The first user-facing question:

```text
If Austria builds renewables according to plan, how much electricity is generated per year?
```

The next questions, in increasing difficulty:

- Does annual renewable generation cover annual demand?
- Which technology contributes how much?
- How sensitive is the result to capacity factors, weather years, demand growth, and project delays?
- In which hours is Austria short or long on electricity?
- How much storage, flexible demand, imports, exports, or dispatchable backup is needed?
- How much curtailment happens when PV and wind are high?
- What does the system cost, and what emissions remain?
- Which grid or regional constraints matter?

## 4. Minimum Concepts Users Need To Understand

Use a small glossary in the app, but keep it attached to numbers, not as a static textbook.

| Concept | User-friendly explanation | Why it matters |
|---|---|---|
| Installed capacity | Maximum possible output of plants, in GW or MW. | Solar and wind capacity is not the same as yearly generation. |
| Capacity factor | Average output divided by maximum output. | Converts GW into TWh/year. |
| Generation | Electricity actually produced, usually in GWh or TWh. | This is the headline result. |
| Demand/load | Electricity consumed at a moment or over a year. | Future demand rises with EVs, heat pumps, electrification, hydrogen, and industry. |
| Annual balance | Yearly generation equals yearly demand. | Easier target, but can hide hourly shortages. |
| Hourly balance | Supply equals demand in every hour. | Needs storage, imports, flexible demand, hydro dispatch, or backup. |
| Residual load | Demand minus variable renewables. | Shows when the system needs flexibility. |
| Curtailment | Renewable electricity that could be produced but is not used. | High renewables can create surplus hours. |
| Storage | Moves electricity from surplus hours to deficit hours. | Batteries handle hours; pumped hydro and reservoirs handle longer periods; hydrogen can handle seasonal gaps. |
| Imports/exports | Cross-border exchange. | Austria is strongly connected to neighbours, so a pure island model is misleading. |
| Dispatch | Which plants run in each hour. | Needed once hourly demand and weather are modelled. |
| Capacity expansion | Which plants/storage/grid should be built. | Needed for optimization and cost-minimal scenarios. |

## 5. Reproducibility Principles

This project should be built like a small scientific model, not like an opaque calculator.

1. Every scenario should have a named version, input file, and timestamp.
2. All assumptions should be visible in the UI and downloadable as JSON/CSV.
3. The calculation should be deterministic: same inputs, same result.
4. Do not overwrite baseline data. Add new data releases as versions.
5. Separate raw data, cleaned data, assumptions, model code, and results.
6. Use units everywhere. Store internal energy in MWh or GWh, then display TWh.
7. Show uncertainty as ranges where source data is weak.
8. Include "annual balance" and "hourly balance" as separate result cards.
9. Prefer open data and open-source code. When licensing prevents redistribution, store only metadata and import instructions.
10. Include validation checks against official historical totals before trusting future results.

This matches the openmod/open-energy literature: transparency, open data, open code, clear licensing, and traceable data processing are not decoration; they are what makes energy modelling credible. Useful references include Pfenninger et al. on opening energy models, Open Power System Data on reproducible data pipelines, and the Open Energy Modelling Initiative source lists.

Sources:

- [Opening the black box of energy modelling](https://arxiv.org/abs/1707.08164)
- [Open Power System Data - Frictionless data for electricity system modelling](https://arxiv.org/abs/1812.10405)
- [Open Energy Modelling Initiative overview](https://en.wikipedia.org/wiki/Open_Energy_Modelling_Initiative)
- [Open energy system models overview](https://en.wikipedia.org/wiki/Open_energy_system_models)

## 6. Data Sources To Use

### Austria Policy And Targets

| Source | Use | Notes |
|---|---|---|
| RIS EAG | Legal 2030 renewable electricity target and +27 TWh split. | Stable legal baseline. |
| Austria NECP 2024 | Current official scenario framing, WAM/WEM projections, 2030 demand/generation, policy measures. | Use this as the current planning baseline. |
| OeNIP, integrated Austrian network infrastructure plan | Grid, hydrogen, gas, electricity infrastructure planning context. | Needed for advanced grid and sector coupling stages. |
| E-Control | Official electricity statistics, market, balances, plant stock. | Use for historical validation and annual/monthly data. |
| Statistik Austria | National energy balances, renewables, final energy, economy/population. | Good for national accounting and sector demand. |
| APG | Transmission system, grid, transparency, load, balancing, network development. | Needed for grid and hourly system realism. |
| ENTSO-E Transparency Platform | Load, generation, cross-border flows, generation by type. | Requires API token for automated use. |
| Eurostat SHARES | Renewable energy accounting under EU methodology. | Useful for comparing official renewable share definitions. |

Relevant browsed sources:

- [RIS consolidated EAG](https://www.ris.bka.gv.at/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=20011619)
- [Austria final updated NECP 2024](https://webgate.ec.europa.eu/circabc-ewpp/d/d/workspace/SpacesStore/a9cc4c4d-479b-44e2-a610-bde40e24394f/details)
- [European Commission NECP list](https://energy.ec.europa.eu/strategy/energy-union/national-energy-and-climate-plans_en)
- [E-Control electricity statistics page](https://www.e-control.at/statistik/e-statistik)

### Weather And Renewable Profiles

| Source | Use | Notes |
|---|---|---|
| PVGIS, JRC | PV production profiles and irradiation for locations in Austria. | Good for user-friendly PV calculator and regional PV profiles. |
| Renewables.ninja | Hourly wind/PV output estimates. | Easy for prototypes; check license before redistribution. |
| ERA5 / Copernicus Climate Data Store | Weather reanalysis for wind, solar, hydro inflows, temperature-driven demand. | Best for reproducible scientific weather-year modelling. |
| Global Wind Atlas | Wind potential screening. | Better for potential maps than hourly dispatch. |
| NASA POWER | Simple meteorological inputs. | Good fallback for educational calculators. |

Sources:

- [Renewables.ninja overview](https://en.wikipedia.org/wiki/Renewables.ninja)
- [Open energy system databases overview](https://en.wikipedia.org/wiki/Open_energy_system_databases)

### Technology Costs And Parameters

| Source | Use | Notes |
|---|---|---|
| Danish Energy Agency technology catalogues | CAPEX, OPEX, lifetimes, efficiencies. | Strong source for Europe. |
| JRC technology reports | European technology assumptions. | Good for EU consistency. |
| IEA / IRENA reports | Global trends and cost benchmarks. | Useful but sometimes less granular. |
| NREL ATB | Detailed cost assumptions, especially for power technologies. | US-focused but transparent and useful for ranges. |
| Lazard LCOE | Market communication benchmark. | Good for sanity checks, not enough as a model input source alone. |

### Existing Open Models And Frameworks

| Tool/model | Best use in this project | Strength | Weakness |
|---|---|---|---|
| PyPSA | Hourly dispatch, capacity expansion, storage, grid, sector coupling. | Very strong for European electricity and sector-coupled systems. | Requires Python modelling skill and careful data setup. |
| PyPSA-Eur | Austria in European grid context. | Automated open data pipeline and Europe-wide topology. | More complex than needed for the first app. |
| Calliope | Scenario modelling with high spatial/temporal resolution. | Clean, flexible framework; good for reproducible scenarios. | Less directly tied to European grid datasets than PyPSA-Eur. |
| oemof | Modular energy system modelling in Python. | Good for custom electricity/heat/mobility models. | More framework-like; needs architecture decisions. |
| OSeMOSYS | Long-term national planning and policy capacity expansion. | Transparent, widely used for national planning. | Less natural for detailed hourly grid/dispatch unless extended. |
| MESSAGEix / TIMES | Integrated assessment and long-term energy economy. | Mature for policy pathways. | Heavy setup; can be overkill for a public webpage. |
| EnergyPLAN | National smart energy systems and sector coupling. | Great for educational national scenarios. | Less programmable for custom web integration than Python frameworks. |
| Dispa-SET | Unit commitment and dispatch, Europe focus. | Strong dispatch detail. | GAMS dependency in many workflows. |
| Balmorel | Market-based energy system model. | Good for electricity/CHP markets. | GAMS and steeper onboarding. |
| GenX / Switch / GridPath | Power system planning, mostly US-origin but general methods. | Good capacity expansion references. | Less Austria/Europe-ready than PyPSA-Eur. |

Sources:

- [PyPSA-Eur paper](https://arxiv.org/abs/1806.01613)
- [Synergies of sector coupling and transmission reinforcement](https://arxiv.org/abs/1801.05290)
- [oemof paper](https://arxiv.org/abs/1808.08070)
- [Open energy system models overview](https://en.wikipedia.org/wiki/Open_energy_system_models)

## 7. Recommended Technical Direction

For this Austria webpage, the best path is:

1. Build a custom 15-minute historical replay model first.
2. Keep assumptions and data files structured as if they will later feed PyPSA.
3. Use Python or a reproducible data pipeline for 15-minute preprocessing and TypeScript/React for the UI.
4. When moving to optimization, use PyPSA first unless a later requirement strongly suggests Calliope or OSeMOSYS.

Why PyPSA is the likely long-term fit:

- It already models wind, solar, hydro, thermal plants, storage, networks, and sector coupling.
- PyPSA-Eur already targets the European transmission system.
- The academic ecosystem is strong.
- It is Python-based, making it easier to integrate with data pipelines and web backends.
- It supports the project direction from "15-minute historical replay" to "rule-based dispatch" to "European grid-aware optimization."

Do not start the first webpage by exposing PyPSA directly. Start with a small transparent model and use PyPSA later as the advanced engine.

## 8. Architecture Proposal

### Data Layout

```text
data/
  raw/
    econtrol/
    necp/
    entsoe/
    weather/
  processed/
    austria_generation_15min.csv
    austria_load_15min.csv
    austria_storage_dispatch_15min.csv
    austria_capacity_history.csv
    renewable_profiles_15min.csv
  assumptions/
    baseline_2020_eag.json
    baseline_2030_necp_wam.json
    technology_parameters.json
  scenarios/
    eag_2030.json
    necp_wam_2030.json
    delayed_wind.json
    high_electrification.json
  results/
    scenario_runs/
```

### Scenario JSON Shape

```json
{
  "id": "necp_wam_2030",
  "name": "NECP WAM 2030",
  "base_year": 2020,
  "target_year": 2030,
  "annual_demand_twh": 89,
  "additional_generation_twh": {
    "pv": 17,
    "wind": 12,
    "hydro": 5,
    "biomass": 1
  },
  "notes": [
    "Based on Austria final updated NECP 2024 WAM scenario.",
    "15-minute historical replay. Does not include imports, exports, grid constraints, optimization, costs, emissions, or sector coupling."
  ],
  "sources": [
    "https://webgate.ec.europa.eu/circabc-ewpp/d/d/workspace/SpacesStore/a9cc4c4d-479b-44e2-a610-bde40e24394f/details"
  ]
}
```

### Calculation Modules

```text
model/
  replay_15min.ts or .py
  profile_scaling.ts or .py
  capacity_factor.ts or .py
  storage_replay.ts or .py
  residual_load.ts or .py
  storage.py
  validation.py
```

### Frontend Views

- Scenario selector.
- Buildout sliders by PV, wind, hydro, biomass.
- Historical year selector.
- 15-minute stacked generation chart.
- Demand vs generation card.
- Technology contribution table.
- Assumption panel with sources.
- Download scenario and result CSV/JSON.
- Residual load chart, storage state-of-charge chart, curtailment chart, and worst-deficit interval table.

## 9. Project Stages

### Phase 0 - Sourcebook

Difficulty: low to medium.

Goal: create a trusted source and data baseline.

Implementation:

- Store EAG +27 TWh path.
- Store NECP WAM +35 TWh path.
- Store 2020 renewable generation baseline from NECP, about 56 TWh.
- Store 2030 NECP WAM renewable generation, about 91 TWh.
- Store 2030 NECP WAM demand, about 89 TWh.
- Identify the best available 15-minute historical data source for Austrian load and generation by technology.
- Decide the first ten-year historical window. Prefer the last 10 complete calendar years with complete 15-minute data.
- Add source metadata.
- Add validation notes and known limitations.

Outputs:

- One Markdown methodology page.
- One source registry.
- One baseline scenario JSON file.
- One simple CSV for policy target pathways.

User experience:

- Users see exactly where the numbers come from.
- No public simulation yet.

### Phase 1 - 15-Minute Historical Replay

Difficulty: medium.

Goal: show what Austria's electricity system would have looked like over the last 10 years if today's historical weather/load patterns were replayed with planned renewable buildout, using 15-minute time steps.

Implementation:

- Inputs: 15-minute historical load and generation by technology for the last 10 complete years.
- Use UTC internally and display Europe/Vienna time to avoid daylight-saving ambiguity.
- Scale historical PV, wind, hydro, and biomass generation profiles to match selected buildout plans.
- Use suggested buildout plans as scenario presets, especially EAG 2030 and NECP WAM 2030.
- Model Austria as an island: no imports and no exports.
- Use only existing storage technologies, scaled in the same spirit as the rest of the system.
- Use only existing pumped hydro dispatch patterns, scaled.
- Show 15-minute generation, demand, surplus, deficit, curtailment, storage state of charge, and unserved energy.
- Aggregate results to day, month, year, and full 10-year summary views.

Model depth:

- 15-minute time series.
- Historical pattern replay, not optimization.
- Scaled existing storage only.
- Scaled existing pumped hydro dispatch only.
- No imports/exports.
- No grid bottlenecks.
- No costs.
- No emissions.
- No sector coupling.

This is the first public modelling product. It gives users timing insight immediately without requiring a full dispatch optimization model.

### Phase 2 - Storage Dispatch Calibration

Difficulty: medium to high.

Goal: make the Phase 1 storage and pumped hydro treatment more defensible while still avoiding optimization.

Implementation:

- Split storage into reservoir hydro, pumped hydro, and other existing storage if data allows.
- Derive historical 15-minute charge/discharge patterns.
- Scale historical storage power and energy limits.
- Add transparent rules for when storage charges and discharges, based on historical patterns and simple surplus/deficit logic.
- Keep the model deterministic and rule-based.

New concepts:

- State of charge.
- Storage energy capacity vs storage power capacity.
- Pumping losses.
- Existing dispatch pattern vs optimized dispatch.

Validation:

- Replay historical years with no future scaling and compare modelled storage behavior with observed aggregate behavior.

### Phase 3 - User Scenario Lab

Difficulty: medium.

Goal: let users change assumptions while keeping the time-series model understandable.

Implementation:

- User-adjustable PV, wind, hydro, biomass buildout.
- User-adjustable demand growth.
- User-adjustable storage scaling.
- Compare multiple scenarios side by side over the same 10 historical years.
- Download scenario JSON and result CSV.

New concepts:

- Scenario reproducibility.
- Sensitivity.
- Buildout delay.
- Winter residual load.

This phase turns the model from a fixed visualization into an exploratory tool.

### Phase 4 - Historical Data Quality And Validation Layer

Difficulty: medium.

Goal: make the historical foundation credible enough that users can trust the visualized results.

Implementation:

- Add source-by-source completeness checks.
- Flag missing or interpolated 15-minute intervals.
- Compare annual/monthly totals against E-Control, Statistik Austria, APG, and ENTSO-E where possible.
- Add per-technology validation cards.
- Store raw, cleaned, and processed data versions separately.

Outputs:

- Data quality dashboard.
- Reproducibility report.
- Validation tolerances.

New concepts:

- Missing data.
- Source conflicts.
- Time-zone conversion.
- Historical normalization.

### Phase 5 - Rule-Based Flexibility Model

Difficulty: high.

Goal: go beyond scaled historical storage dispatch while still avoiding cost optimization.

Implementation:

- Add simple deterministic dispatch rules:
  1. Must-run renewables.
  2. Use surplus to charge storage.
  3. Discharge storage in deficit hours.
  4. Dispatch flexible hydro and biomass within energy/power limits.
  5. Curtail remaining surplus.
  6. Count remaining deficit as unserved energy.
- Continue to exclude imports/exports, grid bottlenecks, optimization, costs, emissions, and sector coupling unless the project explicitly moves to later phases.

This can be heuristic, but it must be clearly labelled as a rule-based dispatch model.

### Phase 6 - Grid And Cross-Border Context

Difficulty: very high.

Goal: relax the island-model assumption.

Implementation:

- Add imports and exports.
- Add interconnector capacities.
- Add neighbouring-country context.
- Later, add internal Austrian grid zones if needed.

New concepts:

- Cross-border balancing.
- Import dependency.
- Export surplus.
- Grid constraints.

This phase is intentionally outside the first implementation boundary.

### Phase 7 - Optimization Engine

Difficulty: very high.

Goal: find cost-minimal combinations of generation, storage, imports, and dispatch under constraints.

Implementation:

- Use PyPSA, Calliope, or oemof.
- Decision variables: build capacities, dispatch, storage charge/discharge, imports/exports, curtailment.
- Constraints: hourly balance, generation availability, storage state of charge, emissions cap, technology potentials, import/export limits.
- Objective: minimize total annualized system cost.

Likely framework:

- PyPSA for Austria electricity plus European interconnection.

Outputs:

- Optimal buildout.
- Hourly dispatch.
- Storage needs.
- Grid/cross-border dependency.
- Shadow prices/marginal costs.

This phase likely uses PyPSA, Calliope, or oemof. It should not be mixed into the first public version.

### Phase 8 - Sector-Coupled Transition Platform

Difficulty: expert.

Goal: include electricity, heat, mobility, hydrogen, industry, gas, and seasonal flexibility.

Implementation:

- EV charging and smart charging.
- Heat pumps and district heating.
- Thermal storage.
- Electrolysers and hydrogen storage.
- Industrial electrification.
- Renewable gas/biomethane constraints.
- Gas-to-power backup or hydrogen turbines.

New concepts:

- Sector coupling.
- Seasonal fuels.
- Electrification pathways.

Likely framework:

- PyPSA-Eur / PyPSA-Eur-Sec style model, or a tailored PyPSA Austria model.

This is no longer just an electricity generation webpage. It becomes an energy transition modelling platform.

## 10. Technical Depth Scenarios

### Scenario A - 15-Minute Historical Replay

Timeline: weeks.

Best for: first release.

Inputs:

- 10 years of historical 15-minute Austrian load and generation data.
- EAG and NECP WAM buildout scenarios.
- Historical renewable generation profiles scaled to future buildout.
- Existing storage and existing pumped hydro dispatch, scaled.

Outputs:

- 15-minute supply/demand visualization.
- Annual, monthly, daily, and 15-minute surplus/deficit.
- Storage state of charge.
- Curtailment.
- Unserved energy.
- Source-backed assumptions and downloadable scenario files.

Pros:

- Shows timing and seasonality immediately.
- Makes the annual balance vs real-time balance distinction visible.
- Avoids the complexity of optimization.
- Can be precomputed and served quickly in the browser.

Cons:

- Depends heavily on the quality and completeness of historical 15-minute data.
- Scaled historical dispatch is not the same as economically optimal future dispatch.
- Excludes imports/exports and grid constraints by design.

### Scenario B - Rule-Based Flexibility Simulator

Timeline: weeks to months.

Best for: serious public dashboard.

Inputs:

- Phase 1 data.
- Rule-based storage dispatch.
- Rule-based flexible hydro/biomass dispatch.
- User-adjustable storage scaling.

Outputs:

- 15-minute supply/demand.
- Residual load.
- Storage state of charge.
- Curtailment.
- Deficit intervals.
- Flexibility contribution.

Pros:

- More realistic than simply scaling historical dispatch.
- Still explainable.
- Can run precomputed scenarios in a webpage.

Cons:

- Rules must be documented carefully.
- Still not a cost-minimizing model.
- Can imply operational behavior that might not match real market dispatch.

### Scenario C - Austria Island Stress Test

Timeline: months.

Best for: understanding resilience without imports/exports.

Inputs:

- Multiple buildout levels.
- Multiple historical weather/load years.
- Existing and scaled storage assumptions.
- No cross-border exchange.

Outputs:

- Worst deficit periods.
- Longest deficit runs.
- Surplus and curtailment clusters.
- Storage exhaustion periods.
- Required backup energy if no imports are allowed.

Pros:

- Very clear public message.
- Shows how different historical years stress the system.
- Still respects the no-grid/no-import boundary.

Cons:

- Austria is not actually an island.
- Results must be framed as a stress test, not as expected market operation.

### Scenario D - Austria Optimization Model

Timeline: months.

Best for: policy-grade scenario comparison.

Inputs:

- Technology costs.
- Potentials.
- 15-minute or hourly profiles.
- Demand scenarios.
- Storage options.
- Import/export limits.
- Emissions constraints.

Outputs:

- Cost-minimal buildout and dispatch.
- System cost.
- Capacity needs.
- Curtailment and storage.
- Robust scenario comparison.

Pros:

- Answers "what should be built?" rather than only "what happens if this is built?"
- Can compare policy pathways.

Cons:

- Harder to explain.
- Requires solver infrastructure.
- Needs careful validation and documentation.

### Scenario E - European Grid-Aware Model

Timeline: many months.

Best for: robust analysis where Austria is not treated as an island.

Inputs:

- Austria plus neighbouring countries.
- Interconnectors and European market context.
- Weather correlation across Europe.
- Cross-border flows.

Outputs:

- Austria imports/exports under different European buildouts.
- Grid dependency.
- Regional flexibility value.

Pros:

- More realistic for Austria.
- Captures cross-border smoothing and market interactions.

Cons:

- Data and computation complexity rise a lot.
- The public UI must simplify results carefully.

### Scenario F - Full Sector-Coupled Transition Platform

Timeline: year-scale.

Best for: research platform.

Inputs:

- Electricity, heat, mobility, industry, hydrogen.
- Multiple weather years.
- Spatial regions.
- Technology learning and policy constraints.

Outputs:

- Full decarbonization pathways.
- Infrastructure needs.
- Cost/emissions tradeoffs.
- Sensitivity and uncertainty results.

Pros:

- Most complete.

Cons:

- Much too much for the first version.
- Requires governance, documentation, testing, and expert review.

## 11. First Implementation Phase

Name: 15-Minute Historical Replay.

The first version should visualize the last 10 complete years of Austrian electricity system behavior at 15-minute resolution, then replay those same historical patterns under suggested renewable buildout plans.

The first version should have these scenario presets:

| Scenario | Meaning |
|---|---|
| Historical actual | The observed 15-minute system for the selected historical year. |
| EAG 2030 replay | Historical 15-minute patterns scaled to EAG +27 TWh buildout. |
| NECP WAM 2030 replay | Historical 15-minute patterns scaled to NECP WAM +35 TWh buildout. |
| Delayed buildout replay | Same as a buildout plan, but only a selected percentage completed. |
| High demand replay | Same buildout, but demand scaled upward. |

Core model boundaries:

- 15-minute resolution.
- Last 10 complete years of historical data, subject to source completeness.
- Austria modelled as an island.
- Existing storage only, scaled.
- Existing pumped hydro dispatch only, scaled.
- No imports/exports.
- No grid bottlenecks.
- No optimization.
- No costs.
- No emissions.
- No sector coupling with heat, transport, hydrogen, or industry.

Core result cards:

- Selected year and scenario.
- Total demand.
- Total renewable generation.
- Annual surplus/deficit.
- Number of deficit 15-minute intervals.
- Number of surplus 15-minute intervals.
- Maximum deficit power.
- Maximum surplus power.
- Total curtailment.
- Total unserved energy.
- Storage cycles or storage throughput, if data allows.
- PV/wind/hydro/biomass contribution.

Charts:

- 15-minute stacked generation vs demand for a selected period.
- Zoom controls: 10 years, year, month, week, day.
- Residual load duration curve.
- Storage state-of-charge chart.
- Monthly surplus/deficit heatmap.
- Worst deficit intervals table.
- Annual summary by historical year.
- Scenario comparison chart for historical actual, EAG replay, and NECP WAM replay.

Download:

- Scenario JSON.
- 15-minute result CSV for selected year/scenario.
- Aggregated monthly/yearly result CSV.
- Source links.

This first phase should be clear that it is a historical replay model. It does not forecast exact future weather or future operational decisions. It asks: "If a historical year happened again under this buildout, what would the 15-minute balance look like?"

## 12. Formula Reference

15-minute energy from power:

```text
energy_MWh[t] = power_MW[t] * 0.25
```

Historical profile scaling to a target annual generation:

```text
scale_factor[technology, year] =
  target_generation_MWh[technology]
  / historical_generation_MWh[technology, year]

scaled_generation_MW[technology, t] =
  historical_generation_MW[technology, t]
  * scale_factor[technology, year]
```

Annual generation from capacity:

```text
generation_TWh = capacity_GW * capacity_factor * 8760 / 1000
```

Required capacity from generation target:

```text
capacity_GW = generation_TWh * 1000 / (capacity_factor * 8760)
```

Annual renewable balance:

```text
annual_balance_TWh = renewable_generation_TWh - electricity_demand_TWh
renewable_share = renewable_generation_TWh / electricity_demand_TWh
```

15-minute residual load:

```text
residual_load_MW[t] =
  demand_MW[t]
  - pv_MW[t]
  - wind_MW[t]
  - hydro_MW[t]
  - biomass_MW[t]
```

Storage state of charge:

```text
soc[t+1] = soc[t] + charge_MWh[t] * eta_charge - discharge_MWh[t] / eta_discharge
0 <= soc[t] <= storage_energy_capacity_MWh
0 <= charge_MW[t] <= storage_power_capacity_MW
0 <= discharge_MW[t] <= storage_power_capacity_MW
```

Curtailment:

```text
curtailment_MWh[t] = max(0, renewable_available_MWh[t] - demand_after_charging_MWh[t])
```

Unserved energy:

```text
unserved_MWh[t] = max(0, demand_MWh[t] - served_supply_MWh[t])
```

## 13. Validation Checklist

Before publishing a scenario:

- Historical annual generation by technology matches official totals within an agreed tolerance.
- Historical annual demand/load matches official totals.
- 15-minute load sums to annual demand after scaling.
- PV and wind 15-minute profiles produce plausible capacity factors for Austria.
- Hydro annual generation and seasonality are plausible.
- No negative generation or impossible storage behavior.
- Annual energy balance is explicitly separated from 15-minute balance.
- Missing 15-minute intervals are flagged and never silently hidden.
- Time zones are stored in UTC internally and displayed in Europe/Vienna.
- Sources and assumptions are visible and downloadable.
- Unit tests cover formulas, unit conversions, and edge cases.

## 14. Main Risks

| Risk | Why it matters | Mitigation |
|---|---|---|
| Confusing annual balance with 15-minute security | Users may think 100% annual renewable means no 15-minute deficits. | Show both metrics separately. |
| Historical replay bias | The future will not repeat one historical year exactly. | Use all 10 years and show the range. |
| Scaling historical dispatch | Scaled pumped hydro dispatch may not represent future operation. | Label it clearly and move rule-based dispatch to a later phase. |
| Hydropower oversimplification | Austria's hydro system is central and complex. | Start with existing dispatch patterns, then split run-of-river, reservoir, pumped storage. |
| Data licensing | Some useful data cannot be redistributed. | Store import instructions and metadata; prefer open sources. |
| Overbuilding the first model | A full optimization model can delay public learning. | Stage the project deliberately. |
| Opaque optimization | Advanced results may be hard to trust. | Keep scenario files, equations, and validation public. |

## 15. Open Questions

These are useful decisions before implementation:

1. Should the first public version be German, English, or bilingual?
2. Should the first model use the EAG legal path, the NECP WAM path, or show both equally?
3. Is the webpage meant for citizens, journalists, students, policymakers, or technical users?
4. Which exact 10-year window should be used if 2025 data is incomplete: 2015-2024 or 2016-2025?
5. Which data source should be treated as authoritative for 15-minute Austrian generation by technology?
6. How should existing storage be scaled in Phase 1: fixed at today's level, scaled with renewable buildout, or user-selectable?
7. Should pumped hydro dispatch be replayed exactly from history or adjusted only when the scaled system creates surplus/deficit?
8. Should users be allowed to edit assumptions freely, or only compare curated scenarios?
9. Do we want all calculations precomputed for fast browser visualization, or should the browser calculate selected scenarios locally?

## 16. Recommended Next Build Step

Build Phase 1 first:

- A 15-minute historical replay dataset for the chosen 10-year window.
- A static web app with historical actual, EAG 2030 replay, NECP WAM 2030 replay, delayed buildout, and high-demand presets.
- A transparent time-series model that scales historical profiles to buildout plans.
- Existing storage and existing pumped hydro dispatch only, scaled.
- Source-linked assumption panel.
- Downloadable scenario JSON and result CSV.

Prepare the data model so later phases can replace scaled historical storage dispatch with rule-based dispatch, then optimization, without changing the public scenario format.
