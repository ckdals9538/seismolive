// ============================================================================
// SEISMOLIVE v4.0 — Observed Station Waveform Bridge
// File: js/data/StationWaveformBridge.js
// Scope: Phase W2 Observed Station Motion Foundation
// Responsibilities:
//   1. SeismicStationPacket Input & Interface Validation
//   2. 3-Component Time Grid Alignment & Window Evaluation
//   3. Physical Observable & Unit Status Classification (No Arbitrary Conversions)
//   4. Station Geographic to Local Tangent / Three.js Scene Coordinate Mapping
//   5. Synchronous Time-Based Waveform Sampling (Exact & Linear Interpolation)
//   6. Observation-Driven Particle Motion Vector Computation
//   7. Provenance, Quality & Physical Motion Metric (PGA/PGV) Preservation
// ============================================================================

import { SeismologicalTrace, SeismicStationPacket } from "../geophysics/ModernSeismicSolvers.js";
import {
  WGS84,
  computeLocalENURotationMatrix,
  centerRelativeENUToThree,
  geodeticToThree
} from "../3d/geodeticEllipsoidCoord.js";

/**
 * ----------------------------------------------------------------------------
 * Constants & Type Enumerations
 * ----------------------------------------------------------------------------
 */
export const PHYSICAL_OBSERVABLE_TYPES = Object.freeze({
  RAW_COUNTS: "RAW_COUNTS",
  DISPLACEMENT: "DISPLACEMENT",
  VELOCITY: "VELOCITY",
  ACCELERATION: "ACCELERATION",
  UNKNOWN: "UNKNOWN"
});

export const GRID_ALIGNMENT_STATUS = Object.freeze({
  SAME_GRID_SAME_START: "SAME_GRID_SAME_START",
  SAME_GRID_INTEGER_OFFSET: "SAME_GRID_INTEGER_OFFSET",
  FRACTIONAL_SAMPLE_OFFSET: "FRACTIONAL_SAMPLE_OFFSET",
  INCOMPATIBLE_SAMPLE_INTERVAL: "INCOMPATIBLE_SAMPLE_INTERVAL",
  UNKNOWN: "UNKNOWN"
});

export const DATA_SOURCE_TYPES = Object.freeze({
  OBSERVED_STATION_MOTION: "OBSERVED_STATION_MOTION",
  SYNTHETIC: "SYNTHETIC"
});

export const ORIENTATION_STATUS = Object.freeze({
  VERIFIED_STANDARD_ZNE: "VERIFIED_STANDARD_ZNE",
  VERIFIED_NON_STANDARD: "VERIFIED_NON_STANDARD",
  UNVERIFIED: "UNVERIFIED",
  INCOMPLETE: "INCOMPLETE"
});

export const MOTION_QUALITY_STATUS = Object.freeze({
  VALID: "VALID",
  DEGRADED_CLIPPED: "DEGRADED_CLIPPED",
  DEGRADED_GAPS: "DEGRADED_GAPS",
  DEGRADED_TIMING: "DEGRADED_TIMING",
  UNUSABLE: "UNUSABLE"
});

/**
 * ----------------------------------------------------------------------------
 * 1. Station Packet Input Validation
 * ----------------------------------------------------------------------------
 */
export function validateStationPacket(packet) {
  const errors = [];
  const warnings = [];

  if (!packet || typeof packet !== "object") {
    return {
      isValid: false,
      status: "REJECTED_NULL_PACKET",
      errors: ["Station packet must be a non-null object"],
      warnings
    };
  }

  // Station Code
  const stationCode = packet.stationCode || "UNKNOWN";
  if (!packet.stationCode || packet.stationCode === "UNKNOWN") {
    warnings.push("Station code is missing or UNKNOWN");
  }

  // Check component traces
  const tZ = packet.traceZ;
  const tN = packet.traceN;
  const tE = packet.traceE;

  if (!tZ) errors.push("Missing Vertical (Z) component trace in station packet");
  if (!tN) errors.push("Missing North (N) component trace in station packet");
  if (!tE) errors.push("Missing East (E) component trace in station packet");

  const traces = [tZ, tN, tE].filter(Boolean);
  for (const tr of traces) {
    if (!(tr.samples instanceof Float32Array) && !Array.isArray(tr.samples)) {
      errors.push(`Component ${tr.component || "?"} has invalid or missing sample array`);
    } else if (tr.samples.length === 0) {
      errors.push(`Component ${tr.component || "?"} has empty sample array`);
    }
    if (!tr.sampleRateHz || tr.sampleRateHz <= 0) {
      errors.push(`Component ${tr.component || "?"} has invalid sample rate: ${tr.sampleRateHz}`);
    }
  }

  const isValid = errors.length === 0;

  return {
    isValid,
    status: isValid ? "VALID" : "INVALID",
    stationCode,
    errors,
    warnings
  };
}

/**
 * ----------------------------------------------------------------------------
 * 2. Physical Unit & Observable Classification
 * ----------------------------------------------------------------------------
 */
export function classifyTraceUnit(trace) {
  if (!trace) {
    return {
      observableType: PHYSICAL_OBSERVABLE_TYPES.UNKNOWN,
      unit: null,
      isCalibrated: false,
      hasResponseRemoved: false
    };
  }

  const rawUnit = (trace.units || "").trim().toUpperCase();
  const hasResponseRemoved = Boolean(trace.hasResponseRemoved);

  // 1. Raw Counts (instrument response unremoved or explicitly counts)
  if (
    rawUnit === "COUNTS" ||
    rawUnit === "COUNT" ||
    rawUnit === "RAW" ||
    rawUnit === "RAW_COUNTS" ||
    (!rawUnit && !hasResponseRemoved)
  ) {
    return {
      observableType: PHYSICAL_OBSERVABLE_TYPES.RAW_COUNTS,
      unit: "COUNTS",
      isCalibrated: false,
      hasResponseRemoved: false
    };
  }

  // 2. Displacement: m, nm, cm, mm
  if (
    rawUnit === "M" ||
    rawUnit === "METERS" ||
    rawUnit === "METER" ||
    rawUnit === "NM" ||
    rawUnit === "NANOMETERS" ||
    rawUnit === "CM" ||
    rawUnit === "MM"
  ) {
    const canonicalUnit = rawUnit === "NM" ? "nm" : (rawUnit === "CM" ? "cm" : (rawUnit === "MM" ? "mm" : "m"));
    return {
      observableType: PHYSICAL_OBSERVABLE_TYPES.DISPLACEMENT,
      unit: canonicalUnit,
      isCalibrated: true,
      hasResponseRemoved
    };
  }

  // 3. Velocity: m/s, nm/s, cm/s, mm/s
  if (
    rawUnit === "M/S" ||
    rawUnit === "M/SEC" ||
    rawUnit === "NM/S" ||
    rawUnit === "NM/SEC" ||
    rawUnit === "CM/S" ||
    rawUnit === "CM/SEC" ||
    rawUnit === "MM/S"
  ) {
    const canonicalUnit = rawUnit.startsWith("NM") ? "nm/s" : (rawUnit.startsWith("CM") ? "cm/s" : (rawUnit.startsWith("MM") ? "mm/s" : "m/s"));
    return {
      observableType: PHYSICAL_OBSERVABLE_TYPES.VELOCITY,
      unit: canonicalUnit,
      isCalibrated: true,
      hasResponseRemoved
    };
  }

  // 4. Acceleration: m/s^2, cm/s^2 (gal), nm/s^2
  if (
    rawUnit === "M/S2" ||
    rawUnit === "M/S^2" ||
    rawUnit === "M/SEC2" ||
    rawUnit === "CM/S2" ||
    rawUnit === "CM/S^2" ||
    rawUnit === "GAL" ||
    rawUnit === "NM/S2" ||
    rawUnit === "NM/S^2"
  ) {
    const canonicalUnit = (rawUnit.startsWith("CM") || rawUnit === "GAL") ? "cm/s^2" : (rawUnit.startsWith("NM") ? "nm/s^2" : "m/s^2");
    return {
      observableType: PHYSICAL_OBSERVABLE_TYPES.ACCELERATION,
      unit: canonicalUnit,
      isCalibrated: true,
      hasResponseRemoved
    };
  }

  return {
    observableType: PHYSICAL_OBSERVABLE_TYPES.UNKNOWN,
    unit: trace.units || "UNKNOWN",
    isCalibrated: false,
    hasResponseRemoved
  };
}

export function getPhysicalUnitStatus(packet) {
  if (!packet || !packet.traceZ || !packet.traceN || !packet.traceE) {
    return {
      observableType: PHYSICAL_OBSERVABLE_TYPES.UNKNOWN,
      unit: null,
      isUniform: false,
      isCalibrated: false,
      allowedOutputs: ["METADATA_ONLY"],
      canComputePGA: false,
      canComputePGV: false,
      componentUnits: { Z: null, N: null, E: null },
      status: "INCOMPLETE_COMPONENTS"
    };
  }

  const uZ = classifyTraceUnit(packet.traceZ);
  const uN = classifyTraceUnit(packet.traceN);
  const uE = classifyTraceUnit(packet.traceE);

  const componentUnits = {
    Z: uZ.unit,
    N: uN.unit,
    E: uE.unit
  };

  const isUniform = (uZ.observableType === uN.observableType) &&
                    (uN.observableType === uE.observableType) &&
                    (uZ.unit === uN.unit) &&
                    (uN.unit === uE.unit);

  if (!isUniform) {
    return {
      observableType: PHYSICAL_OBSERVABLE_TYPES.UNKNOWN,
      unit: null,
      isUniform: false,
      isCalibrated: false,
      allowedOutputs: ["RAW_SAMPLES_METADATA_ONLY"],
      canComputePGA: false,
      canComputePGV: false,
      componentUnits,
      status: "INCONSISTENT_UNITS",
      warning: `Inconsistent units across components: Z=${uZ.unit}, N=${uN.unit}, E=${uE.unit}`
    };
  }

  const obsType = uZ.observableType;
  const unit = uZ.unit;
  const isCalibrated = uZ.isCalibrated;

  let allowedOutputs = [];
  let canComputePGA = false;
  let canComputePGV = false;

  switch (obsType) {
    case PHYSICAL_OBSERVABLE_TYPES.RAW_COUNTS:
      allowedOutputs = ["RAW_COUNTS_WAVEFORM"];
      break;
    case PHYSICAL_OBSERVABLE_TYPES.DISPLACEMENT:
      allowedOutputs = ["DISPLACEMENT_VECTOR", "PARTICLE_MOTION_ORBIT"];
      break;
    case PHYSICAL_OBSERVABLE_TYPES.VELOCITY:
      allowedOutputs = ["VELOCITY_VECTOR", "PGV_CALCULATION"];
      canComputePGV = true;
      break;
    case PHYSICAL_OBSERVABLE_TYPES.ACCELERATION:
      allowedOutputs = ["ACCELERATION_VECTOR", "PGA_CALCULATION"];
      canComputePGA = true;
      break;
    default:
      allowedOutputs = ["RAW_SAMPLES_METADATA_ONLY"];
      break;
  }

  return {
    observableType: obsType,
    unit,
    isUniform: true,
    isCalibrated,
    allowedOutputs,
    canComputePGA,
    canComputePGV,
    componentUnits,
    status: "VALID"
  };
}

/**
 * ----------------------------------------------------------------------------
 * 3. Station Metadata & Coordinate Orientation Extraction
 * ----------------------------------------------------------------------------
 */
export function getStationMetadata(packet) {
  const code = packet?.stationCode || packet?.traceZ?.station || "UNKNOWN";
  const network = packet?.traceZ?.network || "KS";
  const location = packet?.traceZ?.location || "00";

  const rawLat = (packet && packet.latitude !== undefined) ? packet.latitude : (packet?.traceZ?.metadata?.stla ?? packet?.traceZ?.stla ?? null);
  const rawLon = (packet && packet.longitude !== undefined) ? packet.longitude : (packet?.traceZ?.metadata?.stlo ?? packet?.traceZ?.stlo ?? null);
  const rawElev = (packet && packet.elevationM !== undefined) ? packet.elevationM : (packet?.traceZ?.metadata?.stel ?? packet?.traceZ?.stel ?? 0.0);

  const hasCoords = typeof rawLat === "number" && typeof rawLon === "number" &&
                    !Number.isNaN(rawLat) && !Number.isNaN(rawLon) &&
                    rawLat >= -90.0 && rawLat <= 90.0 &&
                    rawLon >= -180.0 && rawLon <= 180.0;

  let coordinateProvenance = "UNSPECIFIED";
  if (hasCoords) {
    if (packet?.traceZ?.metadata?.stla !== undefined || packet?.traceZ?.stla !== undefined) {
      coordinateProvenance = "SAC_HEADER_STLA_STLO";
    } else if (packet?.latitude !== undefined) {
      coordinateProvenance = "PACKET_METADATA";
    }
  }

  // Component Orientations
  // Standard SAC convention:
  // cmpinc: 0 = Vertical UP, 180 = Vertical DOWN, 90 = Horizontal
  // cmpaz: Azimuth in degrees clockwise from North (0 = North, 90 = East, 180 = South, 270 = West)
  const getTraceOrientation = (tr, defaultComp) => {
    if (!tr) return { cmpinc: null, cmpaz: null, isVerified: false, component: defaultComp };
    const inc = tr.cmpinc ?? tr.metadata?.cmpinc ?? tr.sacHeader?.cmpinc ?? (defaultComp === "Z" ? 0.0 : 90.0);
    const az = tr.cmpaz ?? tr.metadata?.cmpaz ?? tr.sacHeader?.cmpaz ?? (defaultComp === "N" ? 0.0 : (defaultComp === "E" ? 90.0 : 0.0));
    const isExplicit = (tr.cmpinc !== undefined || tr.metadata?.cmpinc !== undefined) &&
                       (tr.cmpaz !== undefined || tr.metadata?.cmpaz !== undefined);
    return {
      cmpinc: Number(inc),
      cmpaz: Number(az),
      isVerified: Boolean(tr.orientationVerified ?? tr.metadata?.orientationVerified ?? isExplicit),
      component: tr.component || defaultComp
    };
  };

  const orientZ = getTraceOrientation(packet?.traceZ, "Z");
  const orientN = getTraceOrientation(packet?.traceN, "N");
  const orientE = getTraceOrientation(packet?.traceE, "E");

  // Determine overall orientation status
  let orientationStatus = ORIENTATION_STATUS.UNVERIFIED;
  if (!packet?.traceZ || !packet?.traceN || !packet?.traceE) {
    orientationStatus = ORIENTATION_STATUS.INCOMPLETE;
  } else {
    const isZUp = Math.abs(orientZ.cmpinc - 0.0) < 1.0 || Math.abs(orientZ.cmpinc - 180.0) < 1.0;
    const isHoriz = Math.abs(orientN.cmpinc - 90.0) < 1.0 && Math.abs(orientE.cmpinc - 90.0) < 1.0;
    const isStdAz = (Math.abs(orientN.cmpaz - 0.0) < 1.0 || Math.abs(orientN.cmpaz - 360.0) < 1.0) &&
                    Math.abs(orientE.cmpaz - 90.0) < 1.0;

    if (orientZ.isVerified && orientN.isVerified && orientE.isVerified) {
      if (isZUp && isHoriz && isStdAz) {
        orientationStatus = ORIENTATION_STATUS.VERIFIED_STANDARD_ZNE;
      } else {
        orientationStatus = ORIENTATION_STATUS.VERIFIED_NON_STANDARD;
      }
    } else {
      orientationStatus = ORIENTATION_STATUS.UNVERIFIED;
    }
  }

  return {
    stationCode: code,
    network,
    location,
    latitude: hasCoords ? rawLat : null,
    longitude: hasCoords ? rawLon : null,
    elevationM: Number(rawElev) || 0.0,
    hasGeographicCoordinates: hasCoords,
    coordinateProvenance,
    componentOrientations: {
      Z: orientZ,
      N: orientN,
      E: orientE
    },
    orientationStatus
  };
}

/**
 * ----------------------------------------------------------------------------
 * 4. 3-Component Time Grid Alignment & Common Observation Window
 * ----------------------------------------------------------------------------
 */
export function getCommonObservationWindow(packet) {
  if (!packet || !packet.traceZ || !packet.traceN || !packet.traceE) {
    return {
      hasCommonWindow: false,
      sampleGridAlignment: GRID_ALIGNMENT_STATUS.UNKNOWN,
      startTimeUTC: null,
      endTimeUTC: null,
      durationSec: 0.0,
      sampleCount: null,
      sampleIndices: null,
      allows3DVector: false,
      rejectionReason: "Missing one or more component traces"
    };
  }

  // If packet diagnostics already contain commonTimeWindow from assembleSacStationPacket, reuse
  const diag = packet.diagnostics;
  if (diag?.commonTimeWindow && diag.sampleGridAlignment) {
    const isAligned = diag.sampleGridAlignment === GRID_ALIGNMENT_STATUS.SAME_GRID_SAME_START ||
                      diag.sampleGridAlignment === GRID_ALIGNMENT_STATUS.SAME_GRID_INTEGER_OFFSET;
    return {
      hasCommonWindow: Boolean(diag.commonTimeWindow.hasCommonWindow),
      sampleGridAlignment: diag.sampleGridAlignment,
      startTimeUTC: diag.commonTimeWindow.startTimeUTC,
      endTimeUTC: diag.commonTimeWindow.endTimeUTC,
      durationSec: diag.commonTimeWindow.durationSec,
      sampleCount: diag.commonTimeWindow.commonSampleCount,
      sampleIndices: diag.commonTimeWindow.sampleIndices,
      allows3DVector: isAligned && Boolean(diag.commonTimeWindow.hasCommonWindow),
      rejectionReason: isAligned ? null : (
        diag.sampleGridAlignment === GRID_ALIGNMENT_STATUS.FRACTIONAL_SAMPLE_OFFSET
          ? "FRACTIONAL_SAMPLE_OFFSET requires non-integer phase alignment; 3D vector calculation rejected."
          : `Alignment state '${diag.sampleGridAlignment}' does not permit 3D vector calculation.`
      )
    };
  }

  // Evaluate independently from trace objects
  const tZ = packet.traceZ;
  const tN = packet.traceN;
  const tE = packet.traceE;

  const rateZ = tZ.sampleRateHz;
  const rateN = tN.sampleRateHz;
  const rateE = tE.sampleRateHz;
  const dtZ = tZ.dt || (1.0 / rateZ);
  const dtN = tN.dt || (1.0 / rateN);
  const dtE = tE.dt || (1.0 / rateE);

  const dtTol = 1e-6;
  const sameRate = Math.abs(dtZ - dtN) < dtTol && Math.abs(dtN - dtE) < dtTol;

  if (!sameRate) {
    return {
      hasCommonWindow: false,
      sampleGridAlignment: GRID_ALIGNMENT_STATUS.INCOMPATIBLE_SAMPLE_INTERVAL,
      startTimeUTC: null,
      endTimeUTC: null,
      durationSec: 0.0,
      sampleCount: null,
      sampleIndices: null,
      allows3DVector: false,
      rejectionReason: `Sampling rates differ across components: Z=${rateZ}Hz, N=${rateN}Hz, E=${rateE}Hz`
    };
  }

  // If no start times are provided, but sample counts match, treat as relative time series
  const countZ = tZ.samples.length;
  const countN = tN.samples.length;
  const countE = tE.samples.length;

  if (!tZ.startTimeUTC || !tN.startTimeUTC || !tE.startTimeUTC) {
    const minCount = Math.min(countZ, countN, countE);
    const sameStart = countZ === countN && countN === countE;
    return {
      hasCommonWindow: minCount > 0,
      sampleGridAlignment: sameStart ? GRID_ALIGNMENT_STATUS.SAME_GRID_SAME_START : GRID_ALIGNMENT_STATUS.SAME_GRID_INTEGER_OFFSET,
      startTimeUTC: null,
      endTimeUTC: null,
      durationSec: Number(((minCount - 1) * dtZ).toFixed(6)),
      sampleCount: minCount,
      sampleIndices: {
        Z: { start: 0, end: minCount - 1, count: minCount },
        N: { start: 0, end: minCount - 1, count: minCount },
        E: { start: 0, end: minCount - 1, count: minCount }
      },
      allows3DVector: true,
      rejectionReason: null
    };
  }

  // Parse millisecond UTC timestamps
  const tStartMs_Z = new Date(tZ.startTimeUTC).getTime();
  const tStartMs_N = new Date(tN.startTimeUTC).getTime();
  const tStartMs_E = new Date(tE.startTimeUTC).getTime();

  const sampleIntervalMs = dtZ * 1000.0;
  const timeEpsMs = Math.min(0.05, sampleIntervalMs * 0.001);

  const offsetSamplesN = (tStartMs_N - tStartMs_Z) / sampleIntervalMs;
  const offsetSamplesE = (tStartMs_E - tStartMs_Z) / sampleIntervalMs;

  const roundOffsetN = Math.round(offsetSamplesN);
  const roundOffsetE = Math.round(offsetSamplesE);

  const remN_ms = Math.abs((offsetSamplesN - roundOffsetN) * sampleIntervalMs);
  const remE_ms = Math.abs((offsetSamplesE - roundOffsetE) * sampleIntervalMs);

  const isGridAligned = (remN_ms <= timeEpsMs) && (remE_ms <= timeEpsMs);

  let sampleGridAlignment = GRID_ALIGNMENT_STATUS.UNKNOWN;
  if (!isGridAligned) {
    sampleGridAlignment = GRID_ALIGNMENT_STATUS.FRACTIONAL_SAMPLE_OFFSET;
  } else if (roundOffsetN === 0 && roundOffsetE === 0 &&
             Math.max(Math.abs(tStartMs_Z - tStartMs_N), Math.abs(tStartMs_Z - tStartMs_E)) <= timeEpsMs) {
    sampleGridAlignment = GRID_ALIGNMENT_STATUS.SAME_GRID_SAME_START;
  } else {
    sampleGridAlignment = GRID_ALIGNMENT_STATUS.SAME_GRID_INTEGER_OFFSET;
  }

  // Common overlap window
  const tEndMs_Z = tStartMs_Z + (countZ - 1) * sampleIntervalMs;
  const tEndMs_N = tStartMs_N + (countN - 1) * sampleIntervalMs;
  const tEndMs_E = tStartMs_E + (countE - 1) * sampleIntervalMs;

  const commonStartMs = Math.max(tStartMs_Z, tStartMs_N, tStartMs_E);
  const commonEndMs = Math.min(tEndMs_Z, tEndMs_N, tEndMs_E);

  if (commonEndMs < commonStartMs) {
    return {
      hasCommonWindow: false,
      sampleGridAlignment,
      startTimeUTC: null,
      endTimeUTC: null,
      durationSec: 0.0,
      sampleCount: 0,
      sampleIndices: null,
      allows3DVector: false,
      rejectionReason: "No temporal overlap among 3 components"
    };
  }

  const durationSec = (commonEndMs - commonStartMs) / 1000.0;

  if (!isGridAligned) {
    return {
      hasCommonWindow: true,
      sampleGridAlignment,
      startTimeUTC: new Date(commonStartMs).toISOString(),
      endTimeUTC: new Date(commonEndMs).toISOString(),
      durationSec: Number(durationSec.toFixed(6)),
      sampleCount: null,
      sampleIndices: null,
      allows3DVector: false,
      rejectionReason: "Sub-sample fractional timing offset detected; 3D vector calculation rejected without non-integer phase alignment."
    };
  }

  // Integer indices for aligned grid
  const startIdx_Z = Math.round((commonStartMs - tStartMs_Z) / sampleIntervalMs);
  const endIdx_Z = Math.round((commonEndMs - tStartMs_Z) / sampleIntervalMs);
  const count_Z = endIdx_Z - startIdx_Z + 1;

  const startIdx_N = Math.round((commonStartMs - tStartMs_N) / sampleIntervalMs);
  const endIdx_N = Math.round((commonEndMs - tStartMs_N) / sampleIntervalMs);

  const startIdx_E = Math.round((commonStartMs - tStartMs_E) / sampleIntervalMs);
  const endIdx_E = Math.round((commonEndMs - tStartMs_E) / sampleIntervalMs);

  return {
    hasCommonWindow: true,
    sampleGridAlignment,
    startTimeUTC: new Date(commonStartMs).toISOString(),
    endTimeUTC: new Date(commonEndMs).toISOString(),
    durationSec: Number(durationSec.toFixed(6)),
    sampleCount: count_Z,
    sampleIndices: {
      Z: { start: startIdx_Z, end: endIdx_Z, count: count_Z },
      N: { start: startIdx_N, end: endIdx_N, count: count_Z },
      E: { start: startIdx_E, end: endIdx_E, count: count_Z }
    },
    allows3DVector: true,
    rejectionReason: null
  };
}

/**
 * ----------------------------------------------------------------------------
 * 5. Time-Based Waveform Sampling (Exact & Linear Interpolation)
 * ----------------------------------------------------------------------------
 * Interpolates single trace or synchronized packet at continuous time `timeSec`.
 * For packets, `timeSec` is relative to the common window start.
 */
export function sampleTraceAt(trace, timeSec) {
  if (!trace || !trace.samples || trace.samples.length === 0) {
    return {
      value: null,
      interpolated: false,
      interpolationMethod: "INVALID_TRACE",
      sourceSampleIndices: [],
      status: "INVALID_TRACE"
    };
  }

  const dt = trace.dt || (1.0 / trace.sampleRateHz);
  const totalSamples = trace.samples.length;
  const durationSec = (totalSamples - 1) * dt;

  if (timeSec < -1e-7) {
    return {
      value: null,
      interpolated: false,
      interpolationMethod: "OUT_OF_BOUNDS",
      sourceSampleIndices: [0],
      status: "BEFORE_START"
    };
  }

  if (timeSec > durationSec + 1e-7) {
    return {
      value: null,
      interpolated: false,
      interpolationMethod: "OUT_OF_BOUNDS",
      sourceSampleIndices: [totalSamples - 1],
      status: "AFTER_END"
    };
  }

  const samplePos = Math.max(0.0, Math.min(totalSamples - 1, timeSec / dt));
  const k0 = Math.floor(samplePos);
  const frac = samplePos - k0;

  if (frac < 1e-6 || k0 >= totalSamples - 1) {
    return {
      value: trace.samples[k0],
      interpolated: false,
      interpolationMethod: "EXACT",
      sourceSampleIndices: [k0],
      status: "SUCCESS"
    };
  }

  const k1 = k0 + 1;
  const val0 = trace.samples[k0];
  const val1 = trace.samples[k1];
  const interpolatedVal = val0 * (1.0 - frac) + val1 * frac;

  return {
    value: interpolatedVal,
    interpolated: true,
    interpolationMethod: "LINEAR",
    sourceSampleIndices: [k0, k1],
    fraction: frac,
    status: "SUCCESS"
  };
}

export function getSampleAt(packetOrTrace, timeSec, options = {}) {
  // 1. Single Trace
  if (packetOrTrace instanceof SeismologicalTrace || (packetOrTrace.samples && !packetOrTrace.traceZ)) {
    return sampleTraceAt(packetOrTrace, timeSec);
  }

  // 2. SeismicStationPacket
  const packet = packetOrTrace;
  const obsWindow = getCommonObservationWindow(packet);

  if (!obsWindow.hasCommonWindow) {
    return {
      status: "REJECTED_NO_COMMON_WINDOW",
      error: obsWindow.rejectionReason || "No common time window among components",
      samples: null
    };
  }

  if (!obsWindow.allows3DVector) {
    return {
      status: "REJECTED_GRID_ALIGNMENT",
      error: obsWindow.rejectionReason,
      alignment: obsWindow.sampleGridAlignment,
      samples: null
    };
  }

  if (timeSec < -1e-7 || timeSec > obsWindow.durationSec + 1e-7) {
    return {
      status: "OUT_OF_BOUNDS",
      timeSec,
      durationSec: obsWindow.durationSec,
      samples: null
    };
  }

  const dt = packet.traceZ.dt || (1.0 / packet.traceZ.sampleRateHz);

  const sampleComponent = (tr, compKey) => {
    const startIdx = obsWindow.sampleIndices[compKey].start;
    const samplePos = startIdx + (timeSec / dt);
    const k0 = Math.floor(samplePos);
    const frac = samplePos - k0;
    const maxIdx = obsWindow.sampleIndices[compKey].end;

    if (frac < 1e-6 || k0 >= maxIdx) {
      return {
        value: tr.samples[k0],
        interpolated: false,
        method: "EXACT",
        indices: [k0]
      };
    }
    const k1 = Math.min(tr.samples.length - 1, k0 + 1);
    const v = tr.samples[k0] * (1.0 - frac) + tr.samples[k1] * frac;
    return {
      value: v,
      interpolated: true,
      method: "LINEAR",
      indices: [k0, k1]
    };
  };

  const sZ = sampleComponent(packet.traceZ, "Z");
  const sN = sampleComponent(packet.traceN, "N");
  const sE = sampleComponent(packet.traceE, "E");

  const isInterp = sZ.interpolated || sN.interpolated || sE.interpolated;

  return {
    status: "SUCCESS",
    timeSec,
    samples: {
      z: sZ.value,
      n: sN.value,
      e: sE.value
    },
    interpolated: isInterp,
    interpolationMethod: isInterp ? "LINEAR" : "EXACT",
    sourceSampleIndices: {
      Z: sZ.indices,
      N: sN.indices,
      E: sE.indices
    }
  };
}

/**
 * ----------------------------------------------------------------------------
 * 6. Vector Transformation: Sensor Component Space -> Local ENU -> Scene
 * ----------------------------------------------------------------------------
 */
export function transformComponentVectorToENU(samples, orientations) {
  // Default standard orientations
  const orientZ = orientations?.Z || { cmpinc: 0.0, cmpaz: 0.0 };
  const orientN = orientations?.N || { cmpinc: 90.0, cmpaz: 0.0 };
  const orientE = orientations?.E || { cmpinc: 90.0, cmpaz: 90.0 };

  const sZ = samples.z ?? 0.0;
  const sN = samples.n ?? 0.0;
  const sE = samples.e ?? 0.0;

  // For component i with inclination theta (deg from zenith) and azimuth alpha (deg clockwise from North):
  // unit vector in ENU:
  //   East  = sin(theta) * sin(alpha)
  //   North = sin(theta) * cos(alpha)
  //   Up    = cos(theta)
  const toUnit = (incDeg, azDeg) => {
    const thRad = (incDeg * Math.PI) / 180.0;
    const azRad = (azDeg * Math.PI) / 180.0;
    const sinTh = Math.sin(thRad);
    return {
      east: sinTh * Math.sin(azRad),
      north: sinTh * Math.cos(azRad),
      up: Math.cos(thRad)
    };
  };

  const uZ = toUnit(orientZ.cmpinc, orientZ.cmpaz);
  const uN = toUnit(orientN.cmpinc, orientN.cmpaz);
  const uE = toUnit(orientE.cmpinc, orientE.cmpaz);

  const east = sZ * uZ.east + sN * uN.east + sE * uE.east;
  const north = sZ * uZ.north + sN * uN.north + sE * uE.north;
  const up = sZ * uZ.up + sN * uN.up + sE * uE.up;

  return { east, north, up };
}

export function transformENUToThree(enuVector) {
  if (!enuVector) return null;
  // Three.js SEISMOLIVE scene convention:
  // +X: East
  // +Y: Up (Local Horizon Zenith)
  // -Z: North
  return {
    x: enuVector.east,
    y: enuVector.up,
    z: -enuVector.north
  };
}

export function transformENUToECEF(enuVector, latDeg, lonDeg) {
  if (!enuVector || typeof latDeg !== "number" || typeof lonDeg !== "number") return null;
  const R = computeLocalENURotationMatrix(latDeg, lonDeg);
  // v_ecef = R^T * v_enu
  // R rows are [e_east, e_north, e_up]
  const e = enuVector.east;
  const n = enuVector.north;
  const u = enuVector.up;

  const X = R[0][0] * e + R[1][0] * n + R[2][0] * u;
  const Y = R[0][1] * e + R[1][1] * n + R[2][1] * u;
  const Z = R[0][2] * e + R[1][2] * n + R[2][2] * u;

  return { x: X, y: Y, z: Z };
}

/**
 * ----------------------------------------------------------------------------
 * 7. Particle Motion Evaluation at Time t
 * ----------------------------------------------------------------------------
 */
export function getParticleMotionAt(packet, timeSec, options = {}) {
  const baseProvenance = packet?.traceZ?.provenance ? [...packet.traceZ.provenance] : [];

  const validation = validateStationPacket(packet);
  if (!validation.isValid) {
    return {
      status: "REJECTED_INVALID_PACKET",
      errors: validation.errors,
      motion: null,
      provenance: baseProvenance
    };
  }

  const unitStatus = getPhysicalUnitStatus(packet);
  const meta = getStationMetadata(packet);
  const obsWindow = getCommonObservationWindow(packet);

  if (!obsWindow.allows3DVector) {
    return {
      status: "REJECTED_GRID_ALIGNMENT",
      rejectionReason: obsWindow.rejectionReason,
      alignment: obsWindow.sampleGridAlignment,
      motion: null,
      provenance: baseProvenance
    };
  }

  // Check orientation requirements
  if (meta.orientationStatus === ORIENTATION_STATUS.UNVERIFIED && !options.allowUnverifiedOrientation) {
    return {
      status: "REJECTED_UNVERIFIED_ORIENTATION",
      rejectionReason: "Component orientations are unverified. 3D spatial vector transformation rejected to avoid incorrect directional mapping.",
      motion: null,
      provenance: baseProvenance
    };
  }

  const sampleRes = getSampleAt(packet, timeSec, options);
  if (sampleRes.status !== "SUCCESS") {
    return {
      ...sampleRes,
      provenance: baseProvenance
    };
  }

  // Check observable and units
  const obsType = unitStatus.observableType;
  const isRawCounts = obsType === PHYSICAL_OBSERVABLE_TYPES.RAW_COUNTS;
  const isPhysicalDisplacement = obsType === PHYSICAL_OBSERVABLE_TYPES.DISPLACEMENT;

  // Compute local ENU vector
  const enuVector = transformComponentVectorToENU(sampleRes.samples, meta.componentOrientations);
  const sceneVector = transformENUToThree(enuVector);

  let ecefVector = null;
  if (meta.hasGeographicCoordinates) {
    ecefVector = transformENUToECEF(enuVector, meta.latitude, meta.longitude);
  }

  const magnitude = Math.hypot(enuVector.east, enuVector.north, enuVector.up);

  const sourceType = options.sourceType ||
                     packet.sourceType ||
                     (packet.isSynthetic || packet.traceZ?.isSynthetic ? DATA_SOURCE_TYPES.SYNTHETIC : DATA_SOURCE_TYPES.OBSERVED_STATION_MOTION);

  // Preserve provenance
  const provenance = [
    ...(packet.traceZ?.provenance || []),
    {
      step: "STATION_PARTICLE_MOTION_EVALUATION",
      timestamp: new Date().toISOString(),
      detail: `Evaluated at t=${timeSec}s (${sampleRes.interpolationMethod}), unit=${unitStatus.unit || "COUNTS"}, observable=${obsType}`
    }
  ];

  return {
    status: "SUCCESS",
    stationCode: meta.stationCode,
    timeSec,
    observableType: obsType,
    physicalUnit: isRawCounts ? "COUNTS" : unitStatus.unit,
    isPhysicalDisplacement,
    isRawCounts,
    sourceType,
    samples: sampleRes.samples,
    // When observable is RAW_COUNTS, physicalVector in meters is strictly null!
    physicalVector: isRawCounts ? null : enuVector,
    sceneVector: isRawCounts ? null : sceneVector,
    ecefVector: isRawCounts ? null : ecefVector,
    rawCountsVector: isRawCounts ? enuVector : null,
    magnitude: isRawCounts ? null : magnitude,
    rawMagnitude: isRawCounts ? magnitude : null,
    interpolation: {
      interpolated: sampleRes.interpolated,
      method: sampleRes.interpolationMethod,
      sourceIndices: sampleRes.sourceSampleIndices
    },
    stationLocation: {
      latitude: meta.latitude,
      longitude: meta.longitude,
      elevationM: meta.elevationM,
      hasCoordinates: meta.hasGeographicCoordinates,
      provenance: meta.coordinateProvenance
    },
    provenance,
    warning: isRawCounts
      ? "RAW_COUNTS preserved. Response removal and calibration required for metric displacement/velocity/acceleration."
      : null
  };
}

/**
 * ----------------------------------------------------------------------------
 * 8. Motion Quality & Physical Metric Assessment (PGA / PGV)
 * ----------------------------------------------------------------------------
 */
export function getMotionQuality(packet, options = {}) {
  const validation = validateStationPacket(packet);
  if (!validation.isValid) {
    return {
      status: MOTION_QUALITY_STATUS.UNUSABLE,
      qualityScore: 0.0,
      errors: validation.errors
    };
  }

  const tZ = packet.traceZ;
  const tN = packet.traceN;
  const tE = packet.traceE;

  const unitStatus = getPhysicalUnitStatus(packet);
  const obsWindow = getCommonObservationWindow(packet);

  const hasClipping = Boolean(tZ.qualityFlags?.isClipped || tN.qualityFlags?.isClipped || tE.qualityFlags?.isClipped);
  const hasGaps = Boolean(tZ.qualityFlags?.hasGaps || tN.qualityFlags?.hasGaps || tE.qualityFlags?.hasGaps);

  // Evaluate Peak Ground Acceleration (PGA) and Peak Ground Velocity (PGV)
  let pga = null;
  let pgaUnit = null;
  let pgaComponents = null;

  let pgv = null;
  let pgvUnit = null;
  let pgvComponents = null;

  if (obsWindow.hasCommonWindow && obsWindow.sampleIndices) {
    const idxZ = obsWindow.sampleIndices.Z;
    const idxN = obsWindow.sampleIndices.N;
    const idxE = obsWindow.sampleIndices.E;
    const count = obsWindow.sampleCount;

    // 1. PGA: ONLY computed if observable is strictly ACCELERATION
    if (unitStatus.canComputePGA && unitStatus.observableType === PHYSICAL_OBSERVABLE_TYPES.ACCELERATION) {
      let maxRes = 0.0;
      let maxZ = 0.0, maxN = 0.0, maxE = 0.0;
      for (let i = 0; i < count; i++) {
        const aZ = tZ.samples[idxZ.start + i];
        const aN = tN.samples[idxN.start + i];
        const aE = tE.samples[idxE.start + i];
        const res = Math.sqrt(aZ * aZ + aN * aN + aE * aE);
        if (res > maxRes) maxRes = res;
        if (Math.abs(aZ) > maxZ) maxZ = Math.abs(aZ);
        if (Math.abs(aN) > maxN) maxN = Math.abs(aN);
        if (Math.abs(aE) > maxE) maxE = Math.abs(aE);
      }
      pga = maxRes;
      pgaUnit = unitStatus.unit;
      pgaComponents = { Z: maxZ, N: maxN, E: maxE };
    }

    // 2. PGV: ONLY computed if observable is strictly VELOCITY
    if (unitStatus.canComputePGV && unitStatus.observableType === PHYSICAL_OBSERVABLE_TYPES.VELOCITY) {
      let maxRes = 0.0;
      let maxZ = 0.0, maxN = 0.0, maxE = 0.0;
      for (let i = 0; i < count; i++) {
        const vZ = tZ.samples[idxZ.start + i];
        const vN = tN.samples[idxN.start + i];
        const vE = tE.samples[idxE.start + i];
        const res = Math.sqrt(vZ * vZ + vN * vN + vE * vE);
        if (res > maxRes) maxRes = res;
        if (Math.abs(vZ) > maxZ) maxZ = Math.abs(vZ);
        if (Math.abs(vN) > maxN) maxN = Math.abs(vN);
        if (Math.abs(vE) > maxE) maxE = Math.abs(vE);
      }
      pgv = maxRes;
      pgvUnit = unitStatus.unit;
      pgvComponents = { Z: maxZ, N: maxN, E: maxE };
    }
  }

  let overallStatus = MOTION_QUALITY_STATUS.VALID;
  if (hasClipping) overallStatus = MOTION_QUALITY_STATUS.DEGRADED_CLIPPED;
  else if (hasGaps) overallStatus = MOTION_QUALITY_STATUS.DEGRADED_GAPS;
  else if (!obsWindow.allows3DVector) overallStatus = MOTION_QUALITY_STATUS.DEGRADED_TIMING;

  const sourceType = options.sourceType ||
                     packet.sourceType ||
                     (packet.isSynthetic || tZ.isSynthetic ? DATA_SOURCE_TYPES.SYNTHETIC : DATA_SOURCE_TYPES.OBSERVED_STATION_MOTION);

  return {
    status: overallStatus,
    stationCode: packet.stationCode,
    sourceType,
    hasClipping,
    hasGaps,
    maxAmplitudes: {
      Z: tZ.qualityFlags?.maxAmplitude ?? null,
      N: tN.qualityFlags?.maxAmplitude ?? null,
      E: tE.qualityFlags?.maxAmplitude ?? null
    },
    pga,
    pgaUnit,
    pgaComponents,
    pgv,
    pgvUnit,
    pgvComponents,
    analysisWindow: {
      hasCommonWindow: obsWindow.hasCommonWindow,
      startTimeUTC: obsWindow.startTimeUTC,
      endTimeUTC: obsWindow.endTimeUTC,
      durationSec: obsWindow.durationSec,
      sampleCount: obsWindow.sampleCount,
      sampleGridAlignment: obsWindow.sampleGridAlignment
    },
    provenance: [
      ...(tZ.provenance || []),
      {
        step: "MOTION_QUALITY_ASSESSMENT",
        timestamp: new Date().toISOString(),
        detail: `Evaluated quality: status=${overallStatus}, PGA=${pga !== null ? `${pga.toFixed(4)} ${pgaUnit}` : "null"}, PGV=${pgv !== null ? `${pgv.toFixed(4)} ${pgvUnit}` : "null"}`
      }
    ]
  };
}
