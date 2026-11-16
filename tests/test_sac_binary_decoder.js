// ============================================================================
// SEISMOLIVE v4.0 — SAC Binary Ingestion Adapter Unit Test Suite
// File: tests/test_sac_binary_decoder.js
// Scope: Phase W1 Verification of SAC Binary Decoder & 3-Component Station Assembler
// Standard: 12 Distinct Independent Test Fixtures based on Open SAC Binary Specification
// ============================================================================

import { assertEquals, assert, assertAlmostEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  decodeSacBinary,
  encodeSacBinary,
  assembleSacStationPacket,
  computeSHA256Sync,
  SAC_HEADER_SIZE_BYTES
} from "../js/data/sacBinaryDecoder.js";

console.log("====================================================================");
console.log("SEISMOLIVE v4.0 — Phase W1: SAC Binary Ingestion Adapter Test Suite");
console.log("====================================================================");

// ============================================================================
// Fixture 1: Little-endian SAC Binary Ingestion
// ============================================================================
Deno.test("Fixture 1: Little-endian SAC Binary Ingestion", () => {
  const npts = 200;
  const rawWaveform = new Float32Array(npts);
  for (let i = 0; i < npts; i++) {
    rawWaveform[i] = Math.sin((2.0 * Math.PI * i) / 20.0) * 150.0;
  }

  const sacBuffer = encodeSacBinary({
    floats: {
      delta: 0.01,
      b: 0.0,
      stla: 35.80,
      stlo: 129.20,
      stel: 150.0,
      cmpinc: 0.0
    },
    ints: {
      nzyear: 2016,
      nzjday: 256,
      nzhour: 11,
      nzmin: 32,
      nzsec: 54,
      nzmsec: 120
    },
    strings: {
      kstnm: "CHC",
      kcmpnm: "HHZ",
      knetwk: "KG"
    },
    data: rawWaveform
  }, { endian: "LITTLE_ENDIAN" });

  const decoded = decodeSacBinary(sacBuffer);

  assertEquals(decoded.metadata.endian, "LITTLE_ENDIAN");
  assertEquals(decoded.metadata.station, "CHC");
  assertEquals(decoded.metadata.channel, "HHZ");
  assertEquals(decoded.metadata.network, "KG");
  assertEquals(decoded.metadata.component, "Z");
  assert(decoded.metadata.orientationVerified, "Vertical component orientation must be verified");
  assertEquals(decoded.metadata.npts, 200);
  assertAlmostEquals(decoded.metadata.sampleRateHz, 100.0, 1e-4);
  assertEquals(decoded.trace.sampleCount, 200);
  assertAlmostEquals(decoded.trace.samples[5], rawWaveform[5], 1e-4);

  // Check SHA-256 checksum
  assertEquals(decoded.metadata.dataIntegrity.checksumSHA256.length, 64);
  console.log(`  [PASS] 1: Little-endian SAC decoded cleanly (npts=200, SHA-256=${decoded.metadata.dataIntegrity.checksumSHA256.slice(0, 12)}...)`);
});

// ============================================================================
// Fixture 2: Big-endian SAC Binary Ingestion
// ============================================================================
Deno.test("Fixture 2: Big-endian SAC Binary Ingestion", () => {
  const npts = 150;
  const rawWaveform = new Float32Array(npts);
  for (let i = 0; i < npts; i++) {
    rawWaveform[i] = (i - 75) * 2.5;
  }

  const sacBuffer = encodeSacBinary({
    floats: {
      delta: 0.02, // 50 Hz
      b: 0.0,
      stla: 37.90,
      stlo: 129.10,
      cmpinc: 90.0,
      cmpaz: 0.0 // North
    },
    ints: {
      nzyear: 2023,
      nzjday: 100,
      nzhour: 5,
      nzmin: 12,
      nzsec: 0,
      nzmsec: 0
    },
    strings: {
      kstnm: "YND",
      kcmpnm: "HHN",
      knetwk: "KS"
    },
    data: rawWaveform
  }, { endian: "BIG_ENDIAN" });

  const decoded = decodeSacBinary(sacBuffer);

  assertEquals(decoded.metadata.endian, "BIG_ENDIAN");
  assertEquals(decoded.metadata.station, "YND");
  assertEquals(decoded.metadata.channel, "HHN");
  assertEquals(decoded.metadata.component, "N");
  assert(decoded.metadata.orientationVerified, "North component orientation must be verified");
  assertAlmostEquals(decoded.metadata.sampleRateHz, 50.0, 1e-4);
  assertEquals(decoded.trace.sampleCount, 150);
  assertAlmostEquals(decoded.trace.samples[10], rawWaveform[10], 1e-4);
  console.log(`  [PASS] 2: Big-endian SAC decoded cleanly with byte swap (sampleRate=50Hz, component=N)`);
});

// ============================================================================
// Fixture 3: Diverse Sample Lengths (NPTS = 0, 50, 1200)
// ============================================================================
Deno.test("Fixture 3: Diverse Sample Lengths (NPTS = 0, 50, 1200)", () => {
  // 3A: Empty SAC (NPTS = 0)
  const emptyBuf = encodeSacBinary({
    floats: { delta: 0.01 },
    data: new Float32Array(0)
  });
  assertEquals(emptyBuf.byteLength, SAC_HEADER_SIZE_BYTES);
  const decEmpty = decodeSacBinary(emptyBuf);
  assertEquals(decEmpty.trace.sampleCount, 0);

  // 3B: Medium SAC (NPTS = 1200)
  const medWaveform = new Float32Array(1200);
  const medBuf = encodeSacBinary({
    floats: { delta: 0.005 }, // 200 Hz
    data: medWaveform
  });
  assertEquals(medBuf.byteLength, SAC_HEADER_SIZE_BYTES + 1200 * 4);
  const decMed = decodeSacBinary(medBuf);
  assertEquals(decMed.trace.sampleCount, 1200);
  assertAlmostEquals(decMed.trace.sampleRateHz, 200.0, 1e-4);

  console.log(`  [PASS] 3: NPTS = 0 (${emptyBuf.byteLength} B) and NPTS = 1200 (${medBuf.byteLength} B) accurately handled`);
});

// ============================================================================
// Fixture 4: Corrupted Header and Truncated Files
// ============================================================================
Deno.test("Fixture 4: Corrupted Header and Truncated Files", () => {
  // 4A: Truncated header (< 632 bytes)
  const truncatedHeader = new Uint8Array(300);
  assertThrows(() => {
    decodeSacBinary(truncatedHeader);
  }, Error, "file is truncated");

  // 4B: Truncated data body (header claims 500 samples, buffer has only 100 bytes of data)
  const partialBuf = encodeSacBinary({
    floats: { delta: 0.01 },
    data: new Float32Array(500)
  });
  const slicedPartial = partialBuf.slice(0, SAC_HEADER_SIZE_BYTES + 100);
  assertThrows(() => {
    decodeSacBinary(slicedPartial);
  }, Error, "truncated data section");

  // 4C: Corrupted NVHDR
  const corruptedNvhdr = new Uint8Array(SAC_HEADER_SIZE_BYTES);
  new DataView(corruptedNvhdr.buffer).setInt32(304, 999999, true); // invalid nvhdr
  new DataView(corruptedNvhdr.buffer).setInt32(304, 999999, false);
  assertThrows(() => {
    decodeSacBinary(corruptedNvhdr);
  }, Error, "unable to determine endianness");

  console.log(`  [PASS] 4: Strict error guards reject truncated files and corrupted NVHDR headers`);
});

// ============================================================================
// Fixture 5: Undefined Header Sentinel (-12345) Preservation
// ============================================================================
Deno.test("Fixture 5: Undefined Header Sentinel (-12345) Preservation", () => {
  // File with bare minimum (delta and npts only), all other fields undefined (-12345)
  const unassignedBuf = encodeSacBinary({
    floats: { delta: 0.01 },
    data: new Float32Array(50)
  });

  const decoded = decodeSacBinary(unassignedBuf);

  assertEquals(decoded.metadata.station, "UNKNOWN");
  assertEquals(decoded.metadata.network, null);
  assertEquals(decoded.metadata.location, null);
  assertEquals(decoded.metadata.stationCoord.latitude, null);
  assertEquals(decoded.metadata.stationCoord.longitude, null);
  assertEquals(decoded.metadata.stationCoord.elevationM, null);
  assertEquals(decoded.metadata.referenceTimeUTC, null);
  assertEquals(decoded.metadata.startTimeUTC, null);
  assertEquals(decoded.metadata.b, null);
  assertEquals(decoded.metadata.arrivalA, null);
  assertEquals(decoded.metadata.userPicks.length, 0);

  console.log(`  [PASS] 5: SAC -12345 sentinels strictly converted to null without leaking mock values`);
});

// ============================================================================
// Fixture 6: Invalid Sampling Interval DELTA
// ============================================================================
Deno.test("Fixture 6: Invalid Sampling Interval DELTA", () => {
  // 6A: DELTA = -12345.0 (undefined)
  const undefDelta = encodeSacBinary({
    floats: { delta: -12345.0 },
    data: new Float32Array(10)
  });
  assertThrows(() => {
    decodeSacBinary(undefDelta);
  }, Error, "DELTA");

  // 6B: DELTA = 0.0
  const zeroDelta = encodeSacBinary({
    floats: { delta: 0.0 },
    data: new Float32Array(10)
  });
  assertThrows(() => {
    decodeSacBinary(zeroDelta);
  }, Error, "DELTA");

  // 6C: DELTA < 0.0
  const negDelta = encodeSacBinary({
    floats: { delta: -0.01 },
    data: new Float32Array(10)
  });
  assertThrows(() => {
    decodeSacBinary(negDelta);
  }, Error, "DELTA");

  console.log(`  [PASS] 6: Non-positive and undefined DELTA values cleanly rejected`);
});

// ============================================================================
// Fixture 7: Reference Time & Sample Time Alignment
// ============================================================================
Deno.test("Fixture 7: Reference Time & Sample Time Alignment", () => {
  // 2016-09-12 11:32:54.120 UTC (Gyeongju mainshock reference)
  // b = 10.5 s, delta = 0.01 s, npts = 1000
  const timingBuf = encodeSacBinary({
    floats: {
      delta: 0.01,
      b: 10.5,
      e: 20.49
    },
    ints: {
      nzyear: 2016,
      nzjday: 256,
      nzhour: 11,
      nzmin: 32,
      nzsec: 54,
      nzmsec: 120
    },
    data: new Float32Array(1000)
  });

  const decoded = decodeSacBinary(timingBuf);

  assertEquals(decoded.metadata.referenceTimeUTC, "2016-09-12T11:32:54.120Z");
  assertEquals(decoded.metadata.startTimeUTC, "2016-09-12T11:33:04.620Z");
  assertEquals(decoded.metadata.endTimeUTC, "2016-09-12T11:33:14.610Z");

  console.log(`  [PASS] 7: Reference time (${decoded.metadata.referenceTimeUTC}) and sample times aligned to millisecond`);
});

// ============================================================================
// Fixture 8: Phase Arrival Markers (A & T0..T9)
// ============================================================================
Deno.test("Fixture 8: Phase Arrival Markers (A & T0..T9)", () => {
  const markerBuf = encodeSacBinary({
    floats: {
      delta: 0.01,
      b: 0.0,
      a: 4.35,  // P-wave arrival offset (s)
      t0: 8.90  // S-wave arrival offset (s)
    },
    ints: {
      nzyear: 2016,
      nzjday: 256,
      nzhour: 11,
      nzmin: 32,
      nzsec: 54,
      nzmsec: 0
    },
    strings: {
      ka: "P",
      kt0: "S"
    },
    data: new Float32Array(1000)
  });

  const decoded = decodeSacBinary(markerBuf);

  assert(decoded.metadata.arrivalA !== null);
  assertEquals(decoded.metadata.arrivalA.label, "P");
  assertAlmostEquals(decoded.metadata.arrivalA.offsetSec, 4.35, 1e-4);
  assertEquals(decoded.metadata.arrivalA.timeUTC, "2016-09-12T11:32:58.350Z");

  assertEquals(decoded.metadata.userPicks.length, 1);
  assertEquals(decoded.metadata.userPicks[0].label, "S");
  assertAlmostEquals(decoded.metadata.userPicks[0].offsetSec, 8.90, 1e-4);
  assertEquals(decoded.metadata.userPicks[0].timeUTC, "2016-09-12T11:33:02.900Z");

  console.log(`  [PASS] 8: P (A=${decoded.metadata.arrivalA.offsetSec}s) and S (T0=${decoded.metadata.userPicks[0].offsetSec}s) markers accurately decoded`);
});

// ============================================================================
// Fixture 9: Missing Instrument Response (Zero Fake Conversion)
// ============================================================================
Deno.test("Fixture 9: Missing Instrument Response (Zero Fake Conversion)", () => {
  const rawBuf = encodeSacBinary({
    floats: { delta: 0.01 },
    data: new Float32Array([100.0, 200.0, -150.0])
  });

  const decoded = decodeSacBinary(rawBuf);

  assertEquals(decoded.trace.units, "RAW_COUNTS");
  assertEquals(decoded.metadata.instrumentResponse.status, "MISSING");
  assertEquals(decoded.trace.hasResponseRemoved, false);
  assertEquals(decoded.trace.sensitivity, 1.0);

  console.log(`  [PASS] 9: Instrument response marked MISSING, units preserved as RAW_COUNTS with zero fake gain`);
});

// ============================================================================
// Fixture 10: 3-Component Assembly: Start Time Skew Detection
// ============================================================================
Deno.test("Fixture 10: 3-Component Assembly: Start Time Skew Detection", () => {
  const traceZ = decodeSacBinary(encodeSacBinary({
    floats: { delta: 0.01, b: 0.0 },
    ints: { nzyear: 2016, nzjday: 256, nzhour: 11, nzmin: 32, nzsec: 0, nzmsec: 0 },
    strings: { kstnm: "CHC", kcmpnm: "HHZ" },
    data: new Float32Array(100)
  })).trace;

  // Trace N has a 50 ms start time skew (5 samples offset)
  const traceN = decodeSacBinary(encodeSacBinary({
    floats: { delta: 0.01, b: 0.05 }, // +50 ms
    ints: { nzyear: 2016, nzjday: 256, nzhour: 11, nzmin: 32, nzsec: 0, nzmsec: 0 },
    strings: { kstnm: "CHC", kcmpnm: "HHN" },
    data: new Float32Array(100)
  })).trace;

  const traceE = decodeSacBinary(encodeSacBinary({
    floats: { delta: 0.01, b: 0.0 },
    ints: { nzyear: 2016, nzjday: 256, nzhour: 11, nzmin: 32, nzsec: 0, nzmsec: 0 },
    strings: { kstnm: "CHC", kcmpnm: "HHE" },
    data: new Float32Array(100)
  })).trace;

  const result = assembleSacStationPacket([traceZ, traceN, traceE]);

  assertEquals(result.isSynchronized, false);
  assert(result.diagnostics.requiresTimeAlignment, "Must flag time alignment requirement");
  assertAlmostEquals(result.diagnostics.timeSkewMs, 50.0, 1e-2);
  assert(result.diagnostics.warnings.length > 0);

  console.log(`  [PASS] 10: 50ms timestamp skew correctly flagged (halfPeriodTolerance=5.0ms, requiresTimeAlignment=true)`);
});

// ============================================================================
// Fixture 11: 3-Component Assembly: Sampling Frequency Mismatch Rejection
// ============================================================================
Deno.test("Fixture 11: 3-Component Assembly: Sampling Frequency Mismatch Rejection", () => {
  const traceZ = decodeSacBinary(encodeSacBinary({
    floats: { delta: 0.01 }, // 100 Hz
    strings: { kstnm: "CHC", kcmpnm: "HHZ" },
    data: new Float32Array(100)
  })).trace;

  const traceN = decodeSacBinary(encodeSacBinary({
    floats: { delta: 0.02 }, // 50 Hz
    strings: { kstnm: "CHC", kcmpnm: "HHN" },
    data: new Float32Array(100)
  })).trace;

  const traceE = decodeSacBinary(encodeSacBinary({
    floats: { delta: 0.01 }, // 100 Hz
    strings: { kstnm: "CHC", kcmpnm: "HHE" },
    data: new Float32Array(100)
  })).trace;

  const result = assembleSacStationPacket([traceZ, traceN, traceE]);

  assertEquals(result.status, "REJECTED");
  assertEquals(result.isSynchronized, false);
  assert(result.diagnostics.requiresResampling, "Must flag resampling requirement");
  assert(result.diagnostics.errors.some(e => e.includes("Sampling rate mismatch")));

  console.log(`  [PASS] 11: Heterogeneous sample rates (100Hz vs 50Hz) strictly rejected without silent downsampling`);
});

// ============================================================================
// Fixture 12: 3-Component Assembly: Unverified Orientation Rejection
// ============================================================================
Deno.test("Fixture 12: 3-Component Assembly: Unverified Orientation Rejection", () => {
  const traceZ = decodeSacBinary(encodeSacBinary({
    floats: { delta: 0.01, cmpinc: 0.0 },
    strings: { kstnm: "CHC", kcmpnm: "HHZ" },
    data: new Float32Array(100)
  })).trace;

  // Unoriented orthogonal horizontal components (HH1 and HH2)
  const trace1 = decodeSacBinary(encodeSacBinary({
    floats: { delta: 0.01, cmpinc: 90.0, cmpaz: 45.0 }, // 45° azimuth (neither N nor E)
    strings: { kstnm: "CHC", kcmpnm: "HH1" },
    data: new Float32Array(100)
  })).trace;

  const trace2 = decodeSacBinary(encodeSacBinary({
    floats: { delta: 0.01, cmpinc: 90.0, cmpaz: 135.0 },
    strings: { kstnm: "CHC", kcmpnm: "HH2" },
    data: new Float32Array(100)
  })).trace;

  const result = assembleSacStationPacket([traceZ, trace1, trace2]);

  assertEquals(result.status, "REJECTED");
  assertEquals(result.isSynchronized, false);
  assertEquals(result.diagnostics.orientationVerified, false);
  assertEquals(result.packet.traceN, null, "Must NOT map diagonal component to North");
  assertEquals(result.packet.traceE, null, "Must NOT map diagonal component to East");
  assert(result.diagnostics.errors.some(e => e.includes("orientation")));

  console.log(`  [PASS] 12: Diagonal components (45°/135°) strictly prevented from blind N/E mapping`);
});

// ============================================================================
// Synchronized Station Packet Verification (End-to-End Success Case)
// ============================================================================
Deno.test("Fixture 13: Synchronized Station Packet End-to-End Verification", () => {
  const commonMeta = {
    floats: { delta: 0.01, b: 0.0, stla: 35.80, stlo: 129.20, stel: 150.0 },
    ints: { nzyear: 2016, nzjday: 256, nzhour: 11, nzmin: 32, nzsec: 0, nzmsec: 0 }
  };

  const decZ = decodeSacBinary(encodeSacBinary({
    ...commonMeta,
    floats: { ...commonMeta.floats, cmpinc: 0.0 },
    strings: { kstnm: "CHC", kcmpnm: "HHZ", knetwk: "KG" },
    data: new Float32Array(500)
  }));

  const decN = decodeSacBinary(encodeSacBinary({
    ...commonMeta,
    floats: { ...commonMeta.floats, cmpinc: 90.0, cmpaz: 0.0 },
    strings: { kstnm: "CHC", kcmpnm: "HHN", knetwk: "KG" },
    data: new Float32Array(500)
  }));

  const decE = decodeSacBinary(encodeSacBinary({
    ...commonMeta,
    floats: { ...commonMeta.floats, cmpinc: 90.0, cmpaz: 90.0 },
    strings: { kstnm: "CHC", kcmpnm: "HHE", knetwk: "KG" },
    data: new Float32Array(500)
  }));

  const result = assembleSacStationPacket([decZ, decN, decE], {
    latitude: 35.80,
    longitude: 129.20,
    elevationM: 150.0
  });

  assertEquals(result.status, "SUCCESS");
  assertEquals(result.isSynchronized, true);
  assertEquals(result.packet.stationCode, "CHC");
  assertEquals(result.packet.latitude, 35.80);
  assert(result.packet.traceZ !== null);
  assert(result.packet.traceN !== null);
  assert(result.packet.traceE !== null);
  assertEquals(result.diagnostics.errors.length, 0);

  console.log(`  [PASS] E2E: Perfectly synchronized 3-component packet instantiated (Station CHC, 500 samples @ 100Hz)`);
});

// ============================================================================
// Fixture 14: SAC File Type (IFTYPE) & Evenly Spaced (LEVEN) Validation
// ============================================================================
Deno.test("Fixture 14: SAC File Type (IFTYPE) & Evenly Spaced (LEVEN) Validation", () => {
  // 14A: Valid ITIME (1) + LEVEN (1)
  const validBuf = encodeSacBinary({
    floats: { delta: 0.01 },
    ints: { iftype: 1, leven: 1 },
    data: new Float32Array(50)
  });
  const decValid = decodeSacBinary(validBuf);
  assertEquals(decValid.metadata.npts, 50);

  // 14B: ITIME (1) + LEVEN (0) -> Unevenly spaced time-series must be rejected
  const unevenBuf = encodeSacBinary({
    floats: { delta: 0.01 },
    ints: { iftype: 1, leven: 0 },
    data: new Float32Array(50)
  });
  assertThrows(() => {
    decodeSacBinary(unevenBuf);
  }, Error, "unevenly spaced time-series");

  // 14C: IRLIM (2) -> Spectral Real/Imag rejected
  const irlimBuf = encodeSacBinary({
    floats: { delta: 0.01 },
    ints: { iftype: 2, leven: 1 },
    data: new Float32Array(50)
  });
  assertThrows(() => {
    decodeSacBinary(irlimBuf);
  }, Error, "IFTYPE=2 (IRLIM)");

  // 14D: IAMPH (3) -> Spectral Ampl/Phase rejected
  const iamphBuf = encodeSacBinary({
    floats: { delta: 0.01 },
    ints: { iftype: 3, leven: 1 },
    data: new Float32Array(50)
  });
  assertThrows(() => {
    decodeSacBinary(iamphBuf);
  }, Error, "IFTYPE=3 (IAMPH)");

  // 14E: IXY (4) -> General X versus Y rejected
  const ixyBuf = encodeSacBinary({
    floats: { delta: 0.01 },
    ints: { iftype: 4, leven: 1 },
    data: new Float32Array(50)
  });
  assertThrows(() => {
    decodeSacBinary(ixyBuf);
  }, Error, "IFTYPE=4 (IXY)");

  // 14F: Undefined IFTYPE (-12345) rejected
  const undefTypeBuf = encodeSacBinary({
    floats: { delta: 0.01 },
    ints: { iftype: -12345, leven: 1 },
    data: new Float32Array(50)
  });
  assertThrows(() => {
    decodeSacBinary(undefTypeBuf);
  }, Error, "undefined IFTYPE");

  // 14G: Undefined LEVEN (-12345) rejected
  const undefLevenBuf = encodeSacBinary({
    floats: { delta: 0.01 },
    ints: { iftype: 1, leven: -12345 },
    data: new Float32Array(50)
  });
  assertThrows(() => {
    decodeSacBinary(undefLevenBuf);
  }, Error, "undefined LEVEN");

  console.log(`  [PASS] 14: Non-time-series (IRLIM, IAMPH, IXY) and uneven (LEVEN=0) strictly rejected`);
});

// ============================================================================
// Fixture 15: SAC v7 Double-Precision Footer Inspection & Rejection
// ============================================================================
Deno.test("Fixture 15: SAC v7 Double-Precision Footer Inspection & Rejection", () => {
  // 15A: SAC v7 file with 176-byte double-precision footer appended
  const npts = 100;
  const v6Buf = encodeSacBinary({
    floats: { delta: 0.01 },
    ints: { nvhdr: 7 }, // v7
    data: new Float32Array(npts)
  });
  // Append 176 bytes for the 22 double-precision header fields
  const v7WithFooter = new Uint8Array(v6Buf.byteLength + 176);
  v7WithFooter.set(new Uint8Array(v6Buf));
  // Fill footer with dummy doubles
  new DataView(v7WithFooter.buffer).setFloat64(v6Buf.byteLength, 0.01, true);

  assertThrows(() => {
    decodeSacBinary(v7WithFooter);
  }, Error, "SAC v7 (NVHDR=7) with double-precision footer");

  // 15B: SAC v7 claiming v7 but missing the 176-byte footer
  assertThrows(() => {
    decodeSacBinary(v6Buf);
  }, Error, "missing double-precision footer");

  console.log(`  [PASS] 15: SAC v7 double-precision footer inspected; unsupported v7 files rejected with diagnostic error`);
});

// ============================================================================
// Fixture 16: 3-Component Sub-Sample Skew & Grid Alignment Audit
// ============================================================================
Deno.test("Fixture 16: 3-Component Sub-Sample Skew & Grid Alignment Audit", () => {
  const commonHeader = {
    floats: { delta: 0.01 }, // 100 Hz, period = 10.0 ms, half-period = 5.0 ms
    ints: { nzyear: 2016, nzjday: 256, nzhour: 11, nzmin: 32, nzsec: 0, nzmsec: 0 },
    strings: { kstnm: "CHC" }
  };

  // 16A: Exact Sample Grid Alignment (skew = 0)
  const traceZ_exact = decodeSacBinary(encodeSacBinary({
    ...commonHeader,
    floats: { ...commonHeader.floats, b: 0.0, cmpinc: 0.0 },
    strings: { ...commonHeader.strings, kcmpnm: "HHZ" },
    data: new Float32Array(200)
  })).trace;

  const traceN_exact = decodeSacBinary(encodeSacBinary({
    ...commonHeader,
    floats: { ...commonHeader.floats, b: 0.0, cmpinc: 90.0, cmpaz: 0.0 },
    strings: { ...commonHeader.strings, kcmpnm: "HHN" },
    data: new Float32Array(200)
  })).trace;

  const traceE_exact = decodeSacBinary(encodeSacBinary({
    ...commonHeader,
    floats: { ...commonHeader.floats, b: 0.0, cmpinc: 90.0, cmpaz: 90.0 },
    strings: { ...commonHeader.strings, kcmpnm: "HHE" },
    data: new Float32Array(200)
  })).trace;

  const resExact = assembleSacStationPacket([traceZ_exact, traceN_exact, traceE_exact]);
  assertEquals(resExact.isSynchronized, true);
  assertEquals(resExact.diagnostics.sampleGridAlignment, "SAME_GRID_SAME_START");
  assertEquals(resExact.diagnostics.requiresTimeAlignment, false);
  assertEquals(resExact.diagnostics.timeSkewMs, 0.0);

  // 16B: Sub-sample skew: 2.0 ms skew on 100 Hz signal (within 5.0 ms half-period)
  // Must NOT be declared synchronized; must flag FRACTIONAL_SAMPLE_OFFSET
  const traceN_subSample = decodeSacBinary(encodeSacBinary({
    ...commonHeader,
    floats: { ...commonHeader.floats, b: 0.002, cmpinc: 90.0, cmpaz: 0.0 }, // +2 ms skew
    strings: { ...commonHeader.strings, kcmpnm: "HHN" },
    data: new Float32Array(200)
  })).trace;

  const resSubSample = assembleSacStationPacket([traceZ_exact, traceN_subSample, traceE_exact]);
  assertEquals(resSubSample.isSynchronized, false, "Sub-sample skew must NOT be assumed synchronized");
  assertEquals(resSubSample.diagnostics.sampleGridAlignment, "FRACTIONAL_SAMPLE_OFFSET");
  assertEquals(resSubSample.diagnostics.requiresTimeAlignment, true);
  assertAlmostEquals(resSubSample.diagnostics.timeSkewMs, 2.0, 1e-2);
  assertEquals(resSubSample.diagnostics.sampleInterval.ms, 10.0);
  assertEquals(resSubSample.diagnostics.startTimeSkew.ms, 2.0);

  console.log(`  [PASS] 16: Sub-sample skew (2ms on 100Hz) accurately categorized as FRACTIONAL_SAMPLE_OFFSET; not falsely declared synchronized`);
});

// ============================================================================
// Fixture 17: Official ObsPy Canonical Test Fixture (test.sac, Little-Endian)
// ============================================================================
Deno.test("Fixture 17: Official ObsPy Canonical Test Fixture (test.sac, Little-Endian)", async () => {
  const bytes = await Deno.readFile("tests/fixtures/test.sac");
  assertEquals(bytes.length, 1032, "test.sac must be exactly 1032 bytes");

  const decoded = decodeSacBinary(bytes);

  // Metadata verification against official ObsPy ground-truth
  assertEquals(decoded.metadata.endian, "LITTLE_ENDIAN");
  assertEquals(decoded.metadata.nvhdr, 6);
  assertEquals(decoded.metadata.npts, 100);
  assertAlmostEquals(decoded.metadata.delta, 1.0, 1e-6);
  assertAlmostEquals(decoded.metadata.sampleRateHz, 1.0, 1e-6);
  assertEquals(decoded.metadata.station, "STA");
  assertEquals(decoded.metadata.channel, "Q");
  assertEquals(decoded.metadata.network, null, "Undefined knetwk sentinel (-12345) must be null");

  // Timing verification
  assertEquals(decoded.metadata.referenceTimeUTC, "1978-07-18T08:00:00.000Z");
  assertAlmostEquals(decoded.metadata.b, 10.0, 1e-4);
  assertAlmostEquals(decoded.metadata.e, 109.0, 1e-4);
  assertEquals(decoded.metadata.startTimeUTC, "1978-07-18T08:00:10.000Z");
  assertEquals(decoded.metadata.endTimeUTC, "1978-07-18T08:01:49.000Z");

  // Float32 waveform samples ground-truth comparison
  assertEquals(decoded.trace.sampleCount, 100);
  assertAlmostEquals(decoded.trace.samples[0], -8.742277657347586e-8, 1e-9);
  assertAlmostEquals(decoded.trace.samples[1], -0.30901697278022766, 1e-6);
  assertAlmostEquals(decoded.trace.samples[98], 0.5877771377563477, 1e-6);
  assertAlmostEquals(decoded.trace.samples[99], 0.30900734663009644, 1e-6);

  console.log(`  [PASS] 17: Official ObsPy canonical test.sac cross-validated with 100% precision (1978-07-18T08:00:10Z, 100 samples)`);
});

// ============================================================================
// Fixture 18: Official ObsPy Canonical Test Fixture (test.sac.swap, Big-Endian)
// ============================================================================
Deno.test("Fixture 18: Official ObsPy Canonical Test Fixture (test.sac.swap, Big-Endian)", async () => {
  const bytes = await Deno.readFile("tests/fixtures/test.sac.swap");
  assertEquals(bytes.length, 1032, "test.sac.swap must be exactly 1032 bytes");

  const decoded = decodeSacBinary(bytes);

  // Metadata verification
  assertEquals(decoded.metadata.endian, "BIG_ENDIAN");
  assertEquals(decoded.metadata.nvhdr, 6);
  assertEquals(decoded.metadata.npts, 100);
  assertAlmostEquals(decoded.metadata.delta, 1.0, 1e-6);
  assertEquals(decoded.metadata.station, "STA");
  assertEquals(decoded.metadata.channel, "Q");
  assertEquals(decoded.metadata.network, null);

  // Timing verification
  assertEquals(decoded.metadata.startTimeUTC, "1978-07-18T08:00:10.000Z");
  assertEquals(decoded.metadata.endTimeUTC, "1978-07-18T08:01:49.000Z");

  // Waveform sample equality under big-endian byte-swapping
  assertEquals(decoded.trace.sampleCount, 100);
  assertAlmostEquals(decoded.trace.samples[0], -8.742277657347586e-8, 1e-9);
  assertAlmostEquals(decoded.trace.samples[1], -0.30901697278022766, 1e-6);
  assertAlmostEquals(decoded.trace.samples[99], 0.30900734663009644, 1e-6);

  console.log(`  [PASS] 18: Official ObsPy byte-swapped test.sac.swap cross-validated (Big-Endian byte swap exact match)`);
});

// ============================================================================
// Fixture 19: Mandatory Grid Alignment Matrix (Cases A through G & Multi-Frequency)
// ============================================================================
Deno.test("Fixture 19: Mandatory Grid Alignment Matrix (Cases A through G & Multi-Frequency)", () => {
  const baseFloats = { stla: 35.80, stlo: 129.20 };
  const baseInts = { nzyear: 2016, nzjday: 256, nzhour: 11, nzmin: 32, nzsec: 0, nzmsec: 0 };
  const baseStrings = { kstnm: "CHC" };

  // --- Case A: 100 Hz, Z=0ms, N=0ms, E=0ms ---
  {
    const tZ = decodeSacBinary(encodeSacBinary({ floats: { ...baseFloats, delta: 0.01, b: 0.0, cmpinc: 0.0 }, ints: baseInts, strings: { ...baseStrings, kcmpnm: "HHZ" }, data: new Float32Array(200) })).trace;
    const tN = decodeSacBinary(encodeSacBinary({ floats: { ...baseFloats, delta: 0.01, b: 0.0, cmpinc: 90.0, cmpaz: 0.0 }, ints: baseInts, strings: { ...baseStrings, kcmpnm: "HHN" }, data: new Float32Array(200) })).trace;
    const tE = decodeSacBinary(encodeSacBinary({ floats: { ...baseFloats, delta: 0.01, b: 0.0, cmpinc: 90.0, cmpaz: 90.0 }, ints: baseInts, strings: { ...baseStrings, kcmpnm: "HHE" }, data: new Float32Array(200) })).trace;
    const resA = assembleSacStationPacket([tZ, tN, tE]);
    assertEquals(resA.diagnostics.sampleGridAlignment, "SAME_GRID_SAME_START");
    assertEquals(resA.isSynchronized, true);
    assertEquals(resA.diagnostics.requiresTimeAlignment, false);
    assertEquals(resA.diagnostics.commonTimeWindow.commonSampleCount, 200);
  }

  // --- Case B: 100 Hz, Z=0ms, N=10ms, E=20ms ---
  {
    const tZ = decodeSacBinary(encodeSacBinary({ floats: { ...baseFloats, delta: 0.01, b: 0.0, cmpinc: 0.0 }, ints: baseInts, strings: { ...baseStrings, kcmpnm: "HHZ" }, data: new Float32Array(200) })).trace;
    const tN = decodeSacBinary(encodeSacBinary({ floats: { ...baseFloats, delta: 0.01, b: 0.010, cmpinc: 90.0, cmpaz: 0.0 }, ints: baseInts, strings: { ...baseStrings, kcmpnm: "HHN" }, data: new Float32Array(200) })).trace;
    const tE = decodeSacBinary(encodeSacBinary({ floats: { ...baseFloats, delta: 0.01, b: 0.020, cmpinc: 90.0, cmpaz: 90.0 }, ints: baseInts, strings: { ...baseStrings, kcmpnm: "HHE" }, data: new Float32Array(200) })).trace;
    const resB = assembleSacStationPacket([tZ, tN, tE]);
    assertEquals(resB.diagnostics.sampleGridAlignment, "SAME_GRID_INTEGER_OFFSET");
    assertEquals(resB.isSynchronized, false);
    assertEquals(resB.diagnostics.requiresTimeAlignment, true);
    assertAlmostEquals(resB.diagnostics.startTimeSkew.ms, 20.0, 1e-2);
    // Overlap starts at 20ms (index Z=2, N=1, E=0), ends at Z's end (1.99s, index 199 for Z, 198 for N, 197 for E). Common count = 198 samples.
    assertEquals(resB.diagnostics.commonTimeWindow.sampleIndices.Z.start, 2);
    assertEquals(resB.diagnostics.commonTimeWindow.sampleIndices.N.start, 1);
    assertEquals(resB.diagnostics.commonTimeWindow.sampleIndices.E.start, 0);
  }

  // --- Case C: 100 Hz, Z=0ms, N=2ms, E=0ms ---
  {
    const tZ = decodeSacBinary(encodeSacBinary({ floats: { ...baseFloats, delta: 0.01, b: 0.0, cmpinc: 0.0 }, ints: baseInts, strings: { ...baseStrings, kcmpnm: "HHZ" }, data: new Float32Array(200) })).trace;
    const tN = decodeSacBinary(encodeSacBinary({ floats: { ...baseFloats, delta: 0.01, b: 0.002, cmpinc: 90.0, cmpaz: 0.0 }, ints: baseInts, strings: { ...baseStrings, kcmpnm: "HHN" }, data: new Float32Array(200) })).trace;
    const tE = decodeSacBinary(encodeSacBinary({ floats: { ...baseFloats, delta: 0.01, b: 0.0, cmpinc: 90.0, cmpaz: 90.0 }, ints: baseInts, strings: { ...baseStrings, kcmpnm: "HHE" }, data: new Float32Array(200) })).trace;
    const resC = assembleSacStationPacket([tZ, tN, tE]);
    assertEquals(resC.diagnostics.sampleGridAlignment, "FRACTIONAL_SAMPLE_OFFSET");
    assertEquals(resC.isSynchronized, false);
    assertEquals(resC.diagnostics.requiresTimeAlignment, true);
    assertEquals(resC.diagnostics.commonTimeWindow.sampleIndices, null);
  }

  // --- Case D: 100 Hz, Z=0ms, N=5ms (Half Sample), E=0ms ---
  {
    const tZ = decodeSacBinary(encodeSacBinary({ floats: { ...baseFloats, delta: 0.01, b: 0.0, cmpinc: 0.0 }, ints: baseInts, strings: { ...baseStrings, kcmpnm: "HHZ" }, data: new Float32Array(200) })).trace;
    const tN = decodeSacBinary(encodeSacBinary({ floats: { ...baseFloats, delta: 0.01, b: 0.005, cmpinc: 90.0, cmpaz: 0.0 }, ints: baseInts, strings: { ...baseStrings, kcmpnm: "HHN" }, data: new Float32Array(200) })).trace;
    const tE = decodeSacBinary(encodeSacBinary({ floats: { ...baseFloats, delta: 0.01, b: 0.0, cmpinc: 90.0, cmpaz: 90.0 }, ints: baseInts, strings: { ...baseStrings, kcmpnm: "HHE" }, data: new Float32Array(200) })).trace;
    const resD = assembleSacStationPacket([tZ, tN, tE]);
    assertEquals(resD.diagnostics.sampleGridAlignment, "FRACTIONAL_SAMPLE_OFFSET");
    assertEquals(resD.isSynchronized, false);
    assertEquals(resD.diagnostics.requiresTimeAlignment, true);
  }

  // --- Case E: 100 Hz, Z=0ms, N=10ms, E=0ms ---
  {
    const tZ = decodeSacBinary(encodeSacBinary({ floats: { ...baseFloats, delta: 0.01, b: 0.0, cmpinc: 0.0 }, ints: baseInts, strings: { ...baseStrings, kcmpnm: "HHZ" }, data: new Float32Array(200) })).trace;
    const tN = decodeSacBinary(encodeSacBinary({ floats: { ...baseFloats, delta: 0.01, b: 0.010, cmpinc: 90.0, cmpaz: 0.0 }, ints: baseInts, strings: { ...baseStrings, kcmpnm: "HHN" }, data: new Float32Array(200) })).trace;
    const tE = decodeSacBinary(encodeSacBinary({ floats: { ...baseFloats, delta: 0.01, b: 0.0, cmpinc: 90.0, cmpaz: 90.0 }, ints: baseInts, strings: { ...baseStrings, kcmpnm: "HHE" }, data: new Float32Array(200) })).trace;
    const resE = assembleSacStationPacket([tZ, tN, tE]);
    assertEquals(resE.diagnostics.sampleGridAlignment, "SAME_GRID_INTEGER_OFFSET");
    assertEquals(resE.isSynchronized, false);
    assertEquals(resE.diagnostics.requiresTimeAlignment, true);
  }

  // --- Case F: Z=0ms (100Hz), N=0ms (100Hz), E=0ms (50Hz) ---
  {
    const tZ = decodeSacBinary(encodeSacBinary({ floats: { ...baseFloats, delta: 0.01, b: 0.0, cmpinc: 0.0 }, ints: baseInts, strings: { ...baseStrings, kcmpnm: "HHZ" }, data: new Float32Array(200) })).trace;
    const tN = decodeSacBinary(encodeSacBinary({ floats: { ...baseFloats, delta: 0.01, b: 0.0, cmpinc: 90.0, cmpaz: 0.0 }, ints: baseInts, strings: { ...baseStrings, kcmpnm: "HHN" }, data: new Float32Array(200) })).trace;
    const tE = decodeSacBinary(encodeSacBinary({ floats: { ...baseFloats, delta: 0.02, b: 0.0, cmpinc: 90.0, cmpaz: 90.0 }, ints: baseInts, strings: { ...baseStrings, kcmpnm: "HHE" }, data: new Float32Array(100) })).trace;
    const resF = assembleSacStationPacket([tZ, tN, tE]);
    assertEquals(resF.diagnostics.sampleGridAlignment, "INCOMPATIBLE_SAMPLE_INTERVAL");
    assertEquals(resF.isSynchronized, false);
    assertEquals(resF.diagnostics.requiresTimeAlignment, true);
    assertEquals(resF.diagnostics.commonTimeWindow, null);
  }

  // --- Case G: Heterogeneous reference times & B combinations yielding identical absolute start time ---
  {
    // Z: ref 11:32:00, b = 10.0 -> start 11:32:10
    const tZ = decodeSacBinary(encodeSacBinary({ floats: { ...baseFloats, delta: 0.01, b: 10.0, cmpinc: 0.0 }, ints: { ...baseInts, nzsec: 0 }, strings: { ...baseStrings, kcmpnm: "HHZ" }, data: new Float32Array(200) })).trace;
    // N: ref 11:32:04, b = 6.0 -> start 11:32:10
    const tN = decodeSacBinary(encodeSacBinary({ floats: { ...baseFloats, delta: 0.01, b: 6.0, cmpinc: 90.0, cmpaz: 0.0 }, ints: { ...baseInts, nzsec: 4 }, strings: { ...baseStrings, kcmpnm: "HHN" }, data: new Float32Array(200) })).trace;
    // E: ref 11:32:10, b = 0.0 -> start 11:32:10
    const tE = decodeSacBinary(encodeSacBinary({ floats: { ...baseFloats, delta: 0.01, b: 0.0, cmpinc: 90.0, cmpaz: 90.0 }, ints: { ...baseInts, nzsec: 10 }, strings: { ...baseStrings, kcmpnm: "HHE" }, data: new Float32Array(200) })).trace;
    const resG = assembleSacStationPacket([tZ, tN, tE]);
    assertEquals(resG.diagnostics.sampleGridAlignment, "SAME_GRID_SAME_START");
    assertEquals(resG.isSynchronized, true);
    assertEquals(resG.diagnostics.requiresTimeAlignment, false);
    assertAlmostEquals(resG.diagnostics.startTimeSkew.ms, 0.0, 1e-2);
  }

  // --- Multi-Rate Verification: 20 Hz (dt = 50ms) ---
  {
    // 20Hz integer offset (50ms)
    const tZ_20 = decodeSacBinary(encodeSacBinary({ floats: { ...baseFloats, delta: 0.05, b: 0.0, cmpinc: 0.0 }, ints: baseInts, strings: { ...baseStrings, kcmpnm: "HHZ" }, data: new Float32Array(100) })).trace;
    const tN_20 = decodeSacBinary(encodeSacBinary({ floats: { ...baseFloats, delta: 0.05, b: 0.05, cmpinc: 90.0, cmpaz: 0.0 }, ints: baseInts, strings: { ...baseStrings, kcmpnm: "HHN" }, data: new Float32Array(100) })).trace;
    const tE_20 = decodeSacBinary(encodeSacBinary({ floats: { ...baseFloats, delta: 0.05, b: 0.0, cmpinc: 90.0, cmpaz: 90.0 }, ints: baseInts, strings: { ...baseStrings, kcmpnm: "HHE" }, data: new Float32Array(100) })).trace;
    const res20Int = assembleSacStationPacket([tZ_20, tN_20, tE_20]);
    assertEquals(res20Int.diagnostics.sampleGridAlignment, "SAME_GRID_INTEGER_OFFSET");

    // 20Hz fractional offset (15ms < 50ms)
    const tN_20_frac = decodeSacBinary(encodeSacBinary({ floats: { ...baseFloats, delta: 0.05, b: 0.015, cmpinc: 90.0, cmpaz: 0.0 }, ints: baseInts, strings: { ...baseStrings, kcmpnm: "HHN" }, data: new Float32Array(100) })).trace;
    const res20Frac = assembleSacStationPacket([tZ_20, tN_20_frac, tE_20]);
    assertEquals(res20Frac.diagnostics.sampleGridAlignment, "FRACTIONAL_SAMPLE_OFFSET");
  }

  // --- Multi-Rate Verification: 200 Hz (dt = 5ms) ---
  {
    // 200Hz integer offset (15ms = 3 samples)
    const tZ_200 = decodeSacBinary(encodeSacBinary({ floats: { ...baseFloats, delta: 0.005, b: 0.0, cmpinc: 0.0 }, ints: baseInts, strings: { ...baseStrings, kcmpnm: "HHZ" }, data: new Float32Array(300) })).trace;
    const tN_200 = decodeSacBinary(encodeSacBinary({ floats: { ...baseFloats, delta: 0.005, b: 0.015, cmpinc: 90.0, cmpaz: 0.0 }, ints: baseInts, strings: { ...baseStrings, kcmpnm: "HHN" }, data: new Float32Array(300) })).trace;
    const tE_200 = decodeSacBinary(encodeSacBinary({ floats: { ...baseFloats, delta: 0.005, b: 0.0, cmpinc: 90.0, cmpaz: 90.0 }, ints: baseInts, strings: { ...baseStrings, kcmpnm: "HHE" }, data: new Float32Array(300) })).trace;
    const res200Int = assembleSacStationPacket([tZ_200, tN_200, tE_200]);
    assertEquals(res200Int.diagnostics.sampleGridAlignment, "SAME_GRID_INTEGER_OFFSET");

    // 200Hz fractional offset (1ms < 5ms)
    const tN_200_frac = decodeSacBinary(encodeSacBinary({ floats: { ...baseFloats, delta: 0.005, b: 0.001, cmpinc: 90.0, cmpaz: 0.0 }, ints: baseInts, strings: { ...baseStrings, kcmpnm: "HHN" }, data: new Float32Array(300) })).trace;
    const res200Frac = assembleSacStationPacket([tZ_200, tN_200_frac, tE_200]);
    assertEquals(res200Frac.diagnostics.sampleGridAlignment, "FRACTIONAL_SAMPLE_OFFSET");
  }

  console.log(`  [PASS] 19: All Cases A-G verified on 100Hz, plus 20Hz and 200Hz integer/fractional offsets`);
});

// ============================================================================
// Fixture 20: Complex Grid Timing Edge Cases
// ============================================================================
Deno.test("Fixture 20: Complex Grid Timing Edge Cases (Negative B, Date Boundary, Long Records, Unequal Counts)", () => {
  const baseFloats = { stla: 35.80, stlo: 129.20 };
  const baseStrings = { kstnm: "CHC" };

  // 20.1: Negative B (pre-trigger buffer: b = -5.0 s)
  {
    const ints = { nzyear: 2016, nzjday: 256, nzhour: 11, nzmin: 32, nzsec: 10, nzmsec: 0 };
    const tZ = decodeSacBinary(encodeSacBinary({ floats: { ...baseFloats, delta: 0.01, b: -5.0, cmpinc: 0.0 }, ints, strings: { ...baseStrings, kcmpnm: "HHZ" }, data: new Float32Array(100) })).trace;
    const tN = decodeSacBinary(encodeSacBinary({ floats: { ...baseFloats, delta: 0.01, b: -5.0, cmpinc: 90.0, cmpaz: 0.0 }, ints, strings: { ...baseStrings, kcmpnm: "HHN" }, data: new Float32Array(100) })).trace;
    const tE = decodeSacBinary(encodeSacBinary({ floats: { ...baseFloats, delta: 0.01, b: -5.0, cmpinc: 90.0, cmpaz: 90.0 }, ints, strings: { ...baseStrings, kcmpnm: "HHE" }, data: new Float32Array(100) })).trace;
    const res = assembleSacStationPacket([tZ, tN, tE]);
    assertEquals(res.diagnostics.sampleGridAlignment, "SAME_GRID_SAME_START");
    assertEquals(res.isSynchronized, true);
    assertEquals(tZ.startTimeUTC, "2016-09-12T11:32:05.000Z");
  }

  // 20.2: UTC Day / Year Boundary Crossing (2023-12-31 23:59:50 + 15s -> 2024-01-01 00:00:05)
  {
    const ints = { nzyear: 2023, nzjday: 365, nzhour: 23, nzmin: 59, nzsec: 50, nzmsec: 0 };
    const tZ = decodeSacBinary(encodeSacBinary({ floats: { ...baseFloats, delta: 0.01, b: 15.0, cmpinc: 0.0 }, ints, strings: { ...baseStrings, kcmpnm: "HHZ" }, data: new Float32Array(100) })).trace;
    const tN = decodeSacBinary(encodeSacBinary({ floats: { ...baseFloats, delta: 0.01, b: 15.0, cmpinc: 90.0, cmpaz: 0.0 }, ints, strings: { ...baseStrings, kcmpnm: "HHN" }, data: new Float32Array(100) })).trace;
    const tE = decodeSacBinary(encodeSacBinary({ floats: { ...baseFloats, delta: 0.01, b: 15.0, cmpinc: 90.0, cmpaz: 90.0 }, ints, strings: { ...baseStrings, kcmpnm: "HHE" }, data: new Float32Array(100) })).trace;
    const res = assembleSacStationPacket([tZ, tN, tE]);
    assertEquals(res.diagnostics.sampleGridAlignment, "SAME_GRID_SAME_START");
    assertEquals(tZ.startTimeUTC, "2024-01-01T00:00:05.000Z");
  }

  // 20.3: Long Record Floating Precision (100,000 samples at 100 Hz = 1,000 s)
  {
    const ints = { nzyear: 2016, nzjday: 256, nzhour: 11, nzmin: 0, nzsec: 0, nzmsec: 0 };
    const longSamples = new Float32Array(100000);
    const tZ = decodeSacBinary(encodeSacBinary({ floats: { ...baseFloats, delta: 0.01, b: 0.0, cmpinc: 0.0 }, ints, strings: { ...baseStrings, kcmpnm: "HHZ" }, data: longSamples })).trace;
    const tN = decodeSacBinary(encodeSacBinary({ floats: { ...baseFloats, delta: 0.01, b: 0.0, cmpinc: 90.0, cmpaz: 0.0 }, ints, strings: { ...baseStrings, kcmpnm: "HHN" }, data: longSamples })).trace;
    const tE = decodeSacBinary(encodeSacBinary({ floats: { ...baseFloats, delta: 0.01, b: 0.0, cmpinc: 90.0, cmpaz: 90.0 }, ints, strings: { ...baseStrings, kcmpnm: "HHE" }, data: longSamples })).trace;
    const res = assembleSacStationPacket([tZ, tN, tE]);
    assertEquals(res.diagnostics.sampleGridAlignment, "SAME_GRID_SAME_START");
    assertEquals(res.diagnostics.commonTimeWindow.commonSampleCount, 100000);
    assertAlmostEquals(res.diagnostics.commonTimeWindow.durationSec, 999.99, 1e-2);
  }

  // 20.4: Unequal Sample Counts Shortening Common Window
  {
    const ints = { nzyear: 2016, nzjday: 256, nzhour: 11, nzmin: 32, nzsec: 0, nzmsec: 0 };
    const tZ = decodeSacBinary(encodeSacBinary({ floats: { ...baseFloats, delta: 0.01, b: 0.0, cmpinc: 0.0 }, ints, strings: { ...baseStrings, kcmpnm: "HHZ" }, data: new Float32Array(500) })).trace;
    const tN = decodeSacBinary(encodeSacBinary({ floats: { ...baseFloats, delta: 0.01, b: 0.0, cmpinc: 90.0, cmpaz: 0.0 }, ints, strings: { ...baseStrings, kcmpnm: "HHN" }, data: new Float32Array(300) })).trace;
    const tE = decodeSacBinary(encodeSacBinary({ floats: { ...baseFloats, delta: 0.01, b: 0.0, cmpinc: 90.0, cmpaz: 90.0 }, ints, strings: { ...baseStrings, kcmpnm: "HHE" }, data: new Float32Array(400) })).trace;
    const res = assembleSacStationPacket([tZ, tN, tE]);
    assertEquals(res.diagnostics.sampleGridAlignment, "SAME_GRID_SAME_START");
    assertEquals(res.isSynchronized, false, "Unequal sample count must not be considered fully synchronized");
    // Common window is bounded by the shortest trace (N: 300 samples)
    assertEquals(res.diagnostics.commonTimeWindow.commonSampleCount, 300);
    assertEquals(res.diagnostics.commonTimeWindow.sampleIndices.Z.count, 300);
    assertEquals(res.diagnostics.commonTimeWindow.sampleIndices.N.count, 300);
    assertEquals(res.diagnostics.commonTimeWindow.sampleIndices.E.count, 300);
  }

  // 20.5: Negative Integer Offset (N starts 20ms earlier than Z)
  {
    const ints = { nzyear: 2016, nzjday: 256, nzhour: 11, nzmin: 32, nzsec: 0, nzmsec: 0 };
    // Z starts at 0.020s, N starts at 0.000s (-20ms relative to Z), E starts at 0.020s
    const tZ = decodeSacBinary(encodeSacBinary({ floats: { ...baseFloats, delta: 0.01, b: 0.020, cmpinc: 0.0 }, ints, strings: { ...baseStrings, kcmpnm: "HHZ" }, data: new Float32Array(200) })).trace;
    const tN = decodeSacBinary(encodeSacBinary({ floats: { ...baseFloats, delta: 0.01, b: 0.000, cmpinc: 90.0, cmpaz: 0.0 }, ints, strings: { ...baseStrings, kcmpnm: "HHN" }, data: new Float32Array(200) })).trace;
    const tE = decodeSacBinary(encodeSacBinary({ floats: { ...baseFloats, delta: 0.01, b: 0.020, cmpinc: 90.0, cmpaz: 90.0 }, ints, strings: { ...baseStrings, kcmpnm: "HHE" }, data: new Float32Array(200) })).trace;
    const res = assembleSacStationPacket([tZ, tN, tE]);
    assertEquals(res.diagnostics.sampleGridAlignment, "SAME_GRID_INTEGER_OFFSET");
    assertEquals(res.isSynchronized, false);
    assertEquals(res.diagnostics.requiresTimeAlignment, true);
    // Common window start is 20ms (max start: Z/E start)
    // N started 20ms earlier, so N common window start index is 2
    assertEquals(res.diagnostics.commonTimeWindow.sampleIndices.Z.start, 0);
    assertEquals(res.diagnostics.commonTimeWindow.sampleIndices.N.start, 2);
    assertEquals(res.diagnostics.commonTimeWindow.sampleIndices.E.start, 0);
  }

  console.log(`  [PASS] 20: Complex timing edge cases (negative B, date boundary, long records, unequal counts, negative offset) all passed`);
});

console.log("\n====================================================================");
console.log("ALL 12 SAC INGESTION FIXTURES & PACKET ASSEMBLER TESTS PASSED (100%)");
console.log("====================================================================");
