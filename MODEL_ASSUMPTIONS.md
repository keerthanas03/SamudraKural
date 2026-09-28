# Samudra Kural — Net Drift Prediction Model Assumptions & Technical Architecture

## 1. Executive Summary & Core Mission
When a fisherman deploys a passive or drifting net at sea without an onboard GPS beacon, the net is transported across the ocean surface by the combined forces of:
1. **Surface Ocean Currents** (primary bulk water transport)
2. **Wave-Induced Stokes Drift** (wave orbital transport in the direction of wave propagation)
3. **Direct Wind Leeway** (atmospheric drag on net surface floats and exposed upper mesh)

**CRITICAL NOTICE**:
> ⚠️ **This is a DRIFT PREDICTION system, not an exact tracking beacon.**
> It produces estimated search areas, estimated directions, and rule-based confidence indicators. It **never** claims to know or guarantee the exact location of a fishing net.

---

## 2. Governing Physical Drift Equations

The net velocity vector $\vec{U}_{net} = (U_{net}, V_{net})$ is modeled deterministically at each horizontal spatial coordinate $(x, y)$ and time step $t$ as:

$$U_{net}(t) = U_{current}(t) + U_{stokes}(t) + C_{windage} \cdot U_{wind}(t)$$

$$V_{net}(t) = V_{current}(t) + V_{stokes}(t) + C_{windage} \cdot V_{wind}(t)$$

Where:
- $U_{current}, V_{current}$: Eastward and Northward surface ocean current velocities (m/s) from Copernicus Marine / INCOIS models.
- $U_{stokes}, V_{stokes}$: Surface wave-induced Stokes drift velocity components (m/s) from spectral wave models.
- $U_{wind}, V_{wind}$: Eastward and Northward 10-meter surface atmospheric wind components (m/s).
- $C_{windage}$: Dimensionless leeway windage coefficient representing effective surface drag.

---

## 3. Windage Assumptions & Leeway Coefficients

### Model Version: `v1.0.0-surface-leeway`

> [!IMPORTANT]
> The leeway coefficients $C_{windage}$ below are **model assumptions**, not universal physical constants. Real-world net drift depends on:
> - Net construction type and mesh material (nylon monofilament vs multifilament)
> - Floats distribution (headrope buoyancy) vs sinker line weight (footrope drag)
> - Submerged vertical profile (hang ratio) and biofouling / catch mass
> - Local turbulent mixing and breaking wave action

Configurable initial coefficients:
| Net Type Identifier | Display Name | $C_{windage}$ (Fraction) | Physical Rationale |
| :--- | :--- | :--- | :--- |
| `FLOATING_GILL_NET` | Floating Gill Net | `0.028` (2.8%) | Moderate float exposure, significant submerged gill mesh |
| `DRIFTING_NET` | Drifting Net | `0.020` (2.0%) | Deep hanging net curtain, high hydrodynamic current coupling |
| `SURFACE_NET` | Surface Net | `0.035` (3.5%) | High surface buoyancy line, increased aerodynamic leeway |
| `OTHER_FLOATING_NET`| Other Floating Net | `0.025` (2.5%) | Baseline standard surface float leeway |

These coefficients are versioned in `app/core/config.py` and can be calibrated against empirical recovery observations over time.

---

## 4. Trajectory Time-Step Integration & Geodesics

- **Time Horizon**: $T_{release} \to T_{retrieval}$ (forward integration matching the fisherman's deployment duration, e.g. 2 to 24 hours).
- **Time Step ($\Delta t$)**: 15 minutes (configurable).
- **Data Subsetting Efficiency**: The engine queries a single spatial/temporal bounding box from the environmental providers for the entire forecast window, caching fields in local memory for fast bilinear interpolation.
- **Geodesic Propagation**: At each step $k$, the net coordinate $(\phi_k, \lambda_k)$ is advanced to $(\phi_{k+1}, \lambda_{k+1})$ along the spherical geodesic:
  $$\Delta d = \|\vec{U}_{net}\| \times (\Delta t \times 60) \text{ meters}$$
  $$\theta = \text{atan2}(U_{net}, V_{net}) \pmod{360^\circ}$$
  $$(\phi_{k+1}, \lambda_{k+1}) = \text{ForwardGeodesic}(\phi_k, \lambda_k, \Delta d, \theta)$$

---

## 5. Environmental Data Providers & Variables

### Primary Enrichment: Copernicus Marine Service
- **Toolbox**: Official `copernicusmarine` Python client with lazy dataset opening and spatial bounding-box subsetting.
- **Physics Dataset**: `cmems_mod_glo_phy-cur_anfc_0.083deg_P1D-m` (Global Analysis Forecast PHY).
  - Variables: `uo` (Eastward surface velocity, m/s), `vo` (Northward surface velocity, m/s).
- **Waves Dataset**: `cmems_mod_glo_wav_anfc_0.083deg_PT3H-i` (Global Analysis Forecast WAV).
  - Variables: `VHM0` (Significant wave height, m), `VMDR` (Wave direction, deg), `VTPK` (Peak period, s), `VSDX` (Stokes drift X, m/s), `VSDY` (Stokes drift Y, m/s).

### Primary Regional Reference: INCOIS (Indian National Centre for Ocean Information Services)
- **Services**: Ocean State Forecast (OSF), Location Specific Forecast (LSF), and RSMC NetCDF forecast files (`rsmc_combined_ww3_*.nc`, `RSMC_hycom_*.nc`).
- **Dynamic Metadata Parser**: Automatically discovers coordinate grids (lat, lon, time) and physical variables:
  - Surface current speed & direction (`curr_spd`, `curr_dir` or `u_curr`, `v_curr`)
  - Coastal and monsoon wind (`wnd_spd`, `wnd_dir` or `u10`, `v10`)
  - Significant wave height (`hs`, `swh`), wave direction (`dir`), wave period (`tp`)
  - Swell parameters (`sw_hgt`, `sw_per`).

---

## 6. Cross-Validation: INCOIS vs. Copernicus

> [!CAUTION]
> **No Blind Averaging**: The system **never** computes an average $(Copernicus + INCOIS)/2$.
> Instead, Copernicus acts as the physics model and INCOIS acts as the regional validation ground truth.

Discrepancies are evaluated:
1. $\Delta \text{Speed} = |U_{copernicus} - U_{incois}|$
2. $\Delta \text{Direction} = |\theta_{copernicus} - \theta_{incois}|$
3. $\Delta \text{Wave} = |H_{s, copernicus} - H_{s, incois}|$

**Agreement Classification**:
- **HIGH**: $\Delta \text{Speed} \le 0.15\text{ m/s}$, $\Delta \text{Direction} \le 35^\circ$, $\Delta \text{Wave} \le 0.35\text{ m}$. (Uncertainty multiplier: `1.0`)
- **MEDIUM**: $\Delta \text{Speed} \le 0.35\text{ m/s}$, $\Delta \text{Direction} \le 70^\circ$, $\Delta \text{Wave} \le 0.85\text{ m}$. (Uncertainty multiplier: `1.3`)
- **LOW**: Discrepant currents or wave regimes. (Uncertainty multiplier: `1.8`)

---

## 7. Multi-Factor Uncertainty & Search Area Formulation

Rather than making unverified statistical Gaussian claims (e.g. "95% probability"), the uncertainty radius $R_{search}$ is calculated as an engineering estimate:

$$R_{search} = (R_0 + \sigma_t \times d_{displacement}) \times F_{wave} \times F_{wind} \times M_{agreement} \times F_{age}$$

Where:
- $R_0 = 0.40\text{ km}$ (initial deployment GPS & release spread radius)
- $\sigma_t = 0.18 \times (\text{hours})^{0.75}$ (cumulative diffusive dispersion over time)
- $F_{wave} = 1.0 + \max(0, (H_s - 1.0) \times 0.22)$ (wave agitation dispersion)
- $F_{wind} = 1.0 + \max(0, (W_{spd} - 5.0) \times 0.04)$ (wind gust variability)
- $M_{agreement} \in [1.0, 1.8]$ (Copernicus / INCOIS agreement factor)
- $F_{age} = 1.0 + (\text{Age}_{minutes} / 720) \times 0.25$ (forecast aging factor)

**Confidence Output**:
- **HIGH**: Duration $\le 6\text{h}$, Agreement is HIGH, Waves $\le 1.8\text{m}$, Wind $\le 7.5\text{ m/s}$.
- **MEDIUM**: Duration $\le 14\text{h}$, Agreement is HIGH/MEDIUM, Waves $\le 2.5\text{m}$.
- **LOW**: Extended duration ($> 14\text{h}$), rough sea state, or provider disagreement.

---

## 8. Fisherman-Friendly Language & Safety

Technical variables ($uo, vo, VSDX, VHM0$, etc.) are strictly hidden from the fisherman UI. The UI displays:
- **Estimated movement**: `~2.4 km`
- **Drift direction**: `↗ Northeast`
- **Probable search area**: `1.5–3.3 km northeast`
- **Confidence**: `MEDIUM`
- **Ocean Current**: `Northeast 0.42 m/s`
- **Wind**: `Northeast 18 km/h`
- **Sea Condition**: `Moderate`
