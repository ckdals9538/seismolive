// ============================================================================
// SEISMOLIVE v4.0 — SAC Binary Ingestion Adapter
// File: js/data/sacBinaryDecoder.js
// Scope: Standard 632-byte SAC Binary Ingestion, Integrity & Station Packet Assembler
// Reference: IRIS / LLNL Seismic Analysis Code (SAC) Binary File Format Spec
// ============================================================================

import { SeismologicalTrace, SeismicStationPacket } from "../geophysics/ModernSeismicSolvers.js";

/**
 * ----------------------------------------------------------------------------
 * SAC Header Constants & Variable Layouts
 * ----------------------------------------------------------------------------
 */
export const SAC_HEADER_SIZE_BYTES = 632;
export const SAC_FLOATS_COUNT = 70;
export const SAC_INTS_COUNT = 40;
export const SAC_STRINGS_BYTES = 192;

export const SAC_FLOAT_UNDEF = -12345.0;
export const SAC_INT_UNDEF = -12345;
export const SAC_STR_UNDEF = "-12345";

export const NVHDR_OFFSET_BYTES = 304; // Integer index 6 (280 + 6*4)
export const NPTS_OFFSET_BYTES = 316;  // Integer index 9 (280 + 9*4)

export const SAC_IFTYPE_NAMES = {
  1: "ITIME", // Time series file (evenly or unevenly spaced)
  2: "IRLIM", // Spectral file (real and imaginary)
  3: "IAMPH", // Spectral file (amplitude and phase)
  4: "IXY",   // General X versus Y data
  51: "IXYZ"  // General XYZ (3-D) grid data
};

export const SAC_FLOATHDRS = [
  "delta", "depmin", "depmax", "scale", "odelta", "b", "e", "o", "a", "internal0",
  "t0", "t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8", "t9",
  "f", "resp0", "resp1", "resp2", "resp3", "resp4", "resp5", "resp6", "resp7", "resp8",
  "resp9", "stla", "stlo", "stel", "stdp", "evla", "evlo", "evel", "evdp", "mag",
  "user0", "user1", "user2", "user3", "user4", "user5", "user6", "user7", "user8", "user9",
  "dist", "az", "baz", "gcarc", "internal1", "internal2", "depmen", "cmpaz", "cmpinc",
  "xminimum", "xmaximum", "yminimum", "ymaximum", "unused6", "unused7", "unused8",
  "unused9", "unused10", "unused11", "unused12"
];

export const SAC_INTHDRS = [
  "nzyear", "nzjday", "nzhour", "nzmin", "nzsec", "nzmsec", "nvhdr", "norid", "nevid", "npts",
  "internal3", "nwfid", "nxsize", "nysize", "unused13", "iftype", "idep", "iztype", "unused14", "iinst",
  "istreg", "ievreg", "ievtyp", "iqual", "isynth", "imagtyp", "imagsrc", "unused15", "unused16", "unused17",
  "unused18", "unused19", "unused20", "unused21", "unused22", "leven", "lpspol", "lovrok", "lcalda", "unused23"
];

// String offsets from byte 440
export const SAC_STRING_LAYOUT = [
  { name: "kstnm", offset: 440, length: 8 },
  { name: "kevnm", offset: 448, length: 16 }, // kevnm spans 16 bytes (kevnm + kevnm2)
  { name: "khole", offset: 464, length: 8 },
  { name: "ko", offset: 472, length: 8 },
  { name: "ka", offset: 480, length: 8 },
  { name: "kt0", offset: 488, length: 8 },
  { name: "kt1", offset: 496, length: 8 },
  { name: "kt2", offset: 504, length: 8 },
  { name: "kt3", offset: 512, length: 8 },
  { name: "kt4", offset: 520, length: 8 },
  { name: "kt5", offset: 528, length: 8 },
  { name: "kt6", offset: 536, length: 8 },
  { name: "kt7", offset: 544, length: 8 },
  { name: "kt8", offset: 552, length: 8 },
  { name: "kt9", offset: 560, length: 8 },
  { name: "kf", offset: 568, length: 8 },
  { name: "kuser0", offset: 576, length: 8 },
  { name: "kuser1", offset: 584, length: 8 },
  { name: "kuser2", offset: 592, length: 8 },
  { name: "kcmpnm", offset: 600, length: 8 },
  { name: "knetwk", offset: 608, length: 8 },
  { name: "kdatrd", offset: 616, length: 8 },
  { name: "kinst", offset: 624, length: 8 }
];

/**
 * ----------------------------------------------------------------------------
 * Pure JavaScript Synchronous SHA-256 Digest Helper
 * Matches FIPS 180-4 standard without asynchronous event loop overhead
 * ----------------------------------------------------------------------------
 */
export function computeSHA256Sync(bytes) {
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ]);
  let H0 = 0x6a09e667, H1 = 0xbb67ae85, H2 = 0x3c6ef372, H3 = 0xa54ff53a;
  let H4 = 0x510e527f, H5 = 0x9b05688c, H6 = 0x1f83d9ab, H7 = 0x5be0cd19;

  const len = bytes.length;
  const bitLen = len * 8;
  const padLen = (((len + 8) >> 6) + 1) << 6;
  const buf = new Uint8Array(padLen);
  buf.set(bytes);
  buf[len] = 0x80;

  const view = new DataView(buf.buffer);
  view.setUint32(padLen - 4, bitLen, false);
  view.setUint32(padLen - 8, Math.floor(bitLen / 0x100000000), false);

  const W = new Uint32Array(64);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));

  for (let i = 0; i < padLen; i += 64) {
    for (let t = 0; t < 16; t++) {
      W[t] = view.getUint32(i + t * 4, false);
    }
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(W[t - 15], 7) ^ rotr(W[t - 15], 18) ^ (W[t - 15] >>> 3);
      const s1 = rotr(W[t - 2], 17) ^ rotr(W[t - 2], 19) ^ (W[t - 2] >>> 10);
      W[t] = (W[t - 16] + s0 + W[t - 7] + s1) >>> 0;
    }
    let a = H0, b = H1, c = H2, d = H3, e = H4, f = H5, g = H6, h = H7;
    for (let t = 0; t < 64; t++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ ((~e) & g);
      const temp1 = (h + S1 + ch + K[t] + W[t]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    H0 = (H0 + a) >>> 0;
    H1 = (H1 + b) >>> 0;
    H2 = (H2 + c) >>> 0;
    H3 = (H3 + d) >>> 0;
    H4 = (H4 + e) >>> 0;
    H5 = (H5 + f) >>> 0;
    H6 = (H6 + g) >>> 0;
    H7 = (H7 + h) >>> 0;
  }
  return [H0, H1, H2, H3, H4, H5, H6, H7].map(x => x.toString(16).padStart(8, "0")).join("");
}

/**
 * ----------------------------------------------------------------------------
 * Helper: Sentinel Nullification
 * ----------------------------------------------------------------------------
 */
function nullifyFloat(val) {
  if (val === undefined || Number.isNaN(val) || Math.abs(val - SAC_FLOAT_UNDEF) < 1e-4) {
    return null;
  }
  return val;
}

function nullifyInt(val) {
  if (val === undefined || val === SAC_INT_UNDEF) {
    return null;
  }
  return val;
}

function cleanString(str) {
  if (!str) return null;
  const trimmed = str.replace(/\0/g, "").trim();
  if (trimmed === "" || trimmed === SAC_STR_UNDEF) {
    return null;
  }
  return trimmed;
}

/**
 * ----------------------------------------------------------------------------
 * SAC Endianness Detection
 * ----------------------------------------------------------------------------
 * Examines NVHDR (Header Version, standard 6) at offset 304,
 * and validates NPTS and IFTYPE if needed.
 */
export function detectSacEndianness(view) {
  if (view.byteLength < SAC_HEADER_SIZE_BYTES) {
    throw new Error(`Invalid SAC: file is truncated (size ${view.byteLength} < 632 bytes)`);
  }

  const leNvhdr = view.getInt32(NVHDR_OFFSET_BYTES, true);
  const beNvhdr = view.getInt32(NVHDR_OFFSET_BYTES, false);

  if (leNvhdr === 6 && beNvhdr !== 6) return true;
  if (beNvhdr === 6 && leNvhdr !== 6) return false;

  // SAC v7 or non-standard NVHDR within plausible version range (1..100)
  const lePlau = leNvhdr >= 1 && leNvhdr <= 100;
  const bePlau = beNvhdr >= 1 && beNvhdr <= 100;

  if (lePlau && !bePlau) return true;
  if (bePlau && !lePlau) return false;

  // Disambiguate using NPTS consistency with total buffer size
  const leNpts = view.getInt32(NPTS_OFFSET_BYTES, true);
  const beNpts = view.getInt32(NPTS_OFFSET_BYTES, false);
  const total = view.byteLength;

  const leExpected = SAC_HEADER_SIZE_BYTES + leNpts * 4;
  const beExpected = SAC_HEADER_SIZE_BYTES + beNpts * 4;

  if (leExpected === total && beExpected !== total) return true;
  if (beExpected === total && leExpected !== total) return false;

  throw new Error(`Invalid SAC header: unable to determine endianness (NVHDR LE=${leNvhdr}, BE=${beNvhdr})`);
}

/**
 * ----------------------------------------------------------------------------
 * Decode SAC Binary File
 * ----------------------------------------------------------------------------
 * @param {ArrayBuffer|Uint8Array} input - Raw binary SAC byte buffer
 * @param {Object} options - Ingestion options
 * @returns {Object} { trace: SeismologicalTrace, metadata: Object }
 */
export function decodeSacBinary(input, options = {}) {
  // Normalize input to DataView and Uint8Array
  let view;
  let rawBytes;
  if (input instanceof Uint8Array) {
    view = new DataView(input.buffer, input.byteOffset, input.byteLength);
    rawBytes = input;
  } else if (input instanceof ArrayBuffer) {
    view = new DataView(input);
    rawBytes = new Uint8Array(input);
  } else {
    throw new TypeError("decodeSacBinary expects ArrayBuffer or Uint8Array as input");
  }

  if (view.byteLength < SAC_HEADER_SIZE_BYTES) {
    throw new Error(`Invalid SAC: file is truncated (size ${view.byteLength} < ${SAC_HEADER_SIZE_BYTES} bytes)`);
  }

  // 1. Detect Endianness
  const isLittleEndian = detectSacEndianness(view);
  const endianName = isLittleEndian ? "LITTLE_ENDIAN" : "BIG_ENDIAN";

  // 2. Decode 70 Float32 Header Values
  const rawFloats = {};
  for (let i = 0; i < SAC_FLOATS_COUNT; i++) {
    const val = view.getFloat32(i * 4, isLittleEndian);
    rawFloats[SAC_FLOATHDRS[i]] = val;
  }

  // 3. Decode 40 Int32 Header Values
  const rawInts = {};
  for (let i = 0; i < SAC_INTS_COUNT; i++) {
    const val = view.getInt32(280 + i * 4, isLittleEndian);
    rawInts[SAC_INTHDRS[i]] = val;
  }

  // 4. Decode 192 Alphanumeric Character Section
  const rawStrings = {};
  const decoder = new TextDecoder("latin1");
  for (const item of SAC_STRING_LAYOUT) {
    const strBytes = new Uint8Array(view.buffer, view.byteOffset + item.offset, item.length);
    rawStrings[item.name] = decoder.decode(strBytes);
  }

  // 5. Mandatory Header Validations
  const nvhdr = nullifyInt(rawInts.nvhdr);
  const npts = nullifyInt(rawInts.npts);
  const delta = nullifyFloat(rawFloats.delta);
  const iftype = nullifyInt(rawInts.iftype);
  const leven = nullifyInt(rawInts.leven);

  if (nvhdr === null) {
    throw new Error(`Invalid SAC header: NVHDR is undefined`);
  }

  // SAC v7 double-precision footer inspection
  if (nvhdr === 7) {
    const expectedDataBytes = (npts ?? 0) * 4;
    const v7MinBytes = SAC_HEADER_SIZE_BYTES + expectedDataBytes + 176;
    if (view.byteLength < v7MinBytes) {
      throw new Error(`Invalid SAC v7: missing double-precision footer (NVHDR=7 requires at least ${v7MinBytes} bytes, got ${view.byteLength})`);
    }
    throw new Error(`Unsupported SAC version: SAC v7 (NVHDR=7) with double-precision footer (176 bytes) is currently unsupported; only standard SAC v6 (NVHDR=6) is supported`);
  }

  if (nvhdr !== 6) {
    throw new Error(`Unsupported SAC header version: NVHDR=${nvhdr}; only SAC v6 (NVHDR=6) is supported`);
  }

  if (npts === null || npts < 0) {
    throw new Error(`Invalid SAC header: NPTS is invalid or undefined (${rawInts.npts})`);
  }

  if (delta === null || delta <= 0.0 || !Number.isFinite(delta)) {
    throw new Error(`Invalid SAC header: DELTA (sampling interval) is invalid (${rawFloats.delta})`);
  }

  // IFTYPE & LEVEN Validation: evenly spaced time-series only
  if (iftype === null) {
    throw new Error(`Invalid SAC header: undefined IFTYPE (-12345)`);
  }
  if (iftype !== 1) {
    const typeName = SAC_IFTYPE_NAMES[iftype];
    if (typeName) {
      throw new Error(`Unsupported SAC file type: IFTYPE=${iftype} (${typeName}); only evenly spaced time-series (IFTYPE=ITIME) is supported`);
    } else {
      throw new Error(`Invalid SAC header: invalid IFTYPE=${iftype} (not a recognized SAC file type; note IUNKN=5 is an IDEP code, not IFTYPE)`);
    }
  }

  if (leven === null) {
    throw new Error(`Invalid SAC header: undefined LEVEN (-12345)`);
  }
  if (leven === 0) {
    throw new Error(`Unsupported SAC file structure: LEVEN=0 (unevenly spaced time-series); unevenly spaced data is not supported by evenly spaced decoder`);
  }
  if (leven !== 1) {
    throw new Error(`Invalid SAC header: invalid LEVEN value (${rawInts.leven}); expected 1 (true) or 0 (false)`);
  }

  // 6. Data Section Size & Truncation Check
  const expectedDataBytes = npts * 4;
  const totalExpectedBytes = SAC_HEADER_SIZE_BYTES + expectedDataBytes;

  if (view.byteLength < totalExpectedBytes) {
    throw new Error(
      `Invalid SAC: truncated data section (expected ${totalExpectedBytes} bytes for NPTS=${npts}, got ${view.byteLength})`
    );
  }

  // 7. Decode Waveform Data Points (Float32)
  const samples = new Float32Array(npts);
  let minAmp = Infinity;
  let maxAmp = -Infinity;
  let sumAmp = 0.0;
  let hasCorruptSamples = false;

  for (let i = 0; i < npts; i++) {
    const s = view.getFloat32(SAC_HEADER_SIZE_BYTES + i * 4, isLittleEndian);
    if (!Number.isFinite(s)) {
      hasCorruptSamples = true;
      samples[i] = 0.0;
    } else {
      samples[i] = s;
      if (s < minAmp) minAmp = s;
      if (s > maxAmp) maxAmp = s;
      sumAmp += s;
    }
  }

  if (npts === 0) {
    minAmp = 0.0;
    maxAmp = 0.0;
  }

  const meanAmp = npts > 0 ? sumAmp / npts : 0.0;
  const sampleRateHz = 1.0 / delta;

  // 8. Time System & Reference Calculation
  const nzyear = nullifyInt(rawInts.nzyear);
  const nzjday = nullifyInt(rawInts.nzjday);
  const nzhour = nullifyInt(rawInts.nzhour) ?? 0;
  const nzmin = nullifyInt(rawInts.nzmin) ?? 0;
  const nzsec = nullifyInt(rawInts.nzsec) ?? 0;
  const nzmsec = nullifyInt(rawInts.nzmsec) ?? 0;

  const b = nullifyFloat(rawFloats.b);
  const e = nullifyFloat(rawFloats.e);
  const o = nullifyFloat(rawFloats.o);
  const a = nullifyFloat(rawFloats.a);

  let referenceTimeUTC = null;
  let startTimeUTC = null;
  let endTimeUTC = null;
  let originTimeUTC = null;

  if (nzyear !== null && nzjday !== null && nzyear >= 1900 && nzjday >= 1 && nzjday <= 366) {
    const refMs = Date.UTC(nzyear, 0, 1) +
      (nzjday - 1) * 86400000 +
      nzhour * 3600000 +
      nzmin * 60000 +
      nzsec * 1000 +
      nzmsec;

    referenceTimeUTC = new Date(refMs).toISOString();

    if (b !== null) {
      const startMs = refMs + Math.round(b * 1000.0);
      startTimeUTC = new Date(startMs).toISOString();
      const endMs = startMs + Math.round((npts - 1) * delta * 1000.0);
      endTimeUTC = new Date(endMs).toISOString();
    } else {
      startTimeUTC = referenceTimeUTC;
      const endMs = refMs + Math.round((npts - 1) * delta * 1000.0);
      endTimeUTC = new Date(endMs).toISOString();
    }

    if (o !== null) {
      originTimeUTC = new Date(refMs + Math.round(o * 1000.0)).toISOString();
    }
  }

  // 9. Pick Markers (P, S, User Markers t0..t9)
  const ka = cleanString(rawStrings.ka);
  const arrivalA = a !== null ? {
    offsetSec: a,
    label: ka || "A",
    timeUTC: referenceTimeUTC ? new Date(new Date(referenceTimeUTC).getTime() + Math.round(a * 1000.0)).toISOString() : null
  } : null;

  const userPicks = [];
  for (let tIdx = 0; tIdx <= 9; tIdx++) {
    const tVal = nullifyFloat(rawFloats[`t${tIdx}`]);
    if (tVal !== null) {
      const tLabel = cleanString(rawStrings[`kt${tIdx}`]) || `T${tIdx}`;
      userPicks.push({
        index: tIdx,
        offsetSec: tVal,
        label: tLabel,
        timeUTC: referenceTimeUTC ? new Date(new Date(referenceTimeUTC).getTime() + Math.round(tVal * 1000.0)).toISOString() : null
      });
    }
  }

  // 10. Identifiers & Station Coordinates
  const station = cleanString(rawStrings.kstnm) || options.station || "UNKNOWN";
  const channel = cleanString(rawStrings.kcmpnm) || options.channel || "UNKNOWN";
  const network = cleanString(rawStrings.knetwk) || options.network || null;
  const location = cleanString(rawStrings.khole) || options.location || null;

  const stla = nullifyFloat(rawFloats.stla);
  const stlo = nullifyFloat(rawFloats.stlo);
  const stel = nullifyFloat(rawFloats.stel);
  const stdp = nullifyFloat(rawFloats.stdp);

  const evla = nullifyFloat(rawFloats.evla);
  const evlo = nullifyFloat(rawFloats.evlo);
  const evel = nullifyFloat(rawFloats.evel);
  const evdp = nullifyFloat(rawFloats.evdp);
  const mag = nullifyFloat(rawFloats.mag);

  // 11. Component & Orientation Verification
  const cmpaz = nullifyFloat(rawFloats.cmpaz);
  const cmpinc = nullifyFloat(rawFloats.cmpinc);

  let component = "UNKNOWN";
  let orientationVerified = false;

  // SAC standard cmpinc: 0 = Vertical Up, 90 = Horizontal, 180 = Vertical Down
  // cmpaz: degrees clockwise from North
  if (cmpinc !== null) {
    if (Math.abs(cmpinc - 0.0) <= 5.0 || Math.abs(cmpinc - 180.0) <= 5.0) {
      component = "Z";
      orientationVerified = true;
    } else if (Math.abs(cmpinc - 90.0) <= 5.0) {
      if (cmpaz !== null) {
        if (Math.abs(cmpaz - 0.0) <= 5.0 || Math.abs(cmpaz - 360.0) <= 5.0) {
          component = "N";
          orientationVerified = true;
        } else if (Math.abs(cmpaz - 90.0) <= 5.0) {
          component = "E";
          orientationVerified = true;
        } else {
          // Horizontal but arbitrary azimuth (borehole, rotated)
          component = "H";
          orientationVerified = false;
        }
      }
    }
  }

  // Fallback to channel naming convention if orientation was not established via cmpinc/cmpaz
  if (!orientationVerified && channel !== "UNKNOWN") {
    const lastChar = channel.slice(-1).toUpperCase();
    if (lastChar === "Z") {
      component = "Z";
      orientationVerified = true;
    } else if (lastChar === "N") {
      component = "N";
      orientationVerified = true;
    } else if (lastChar === "E") {
      component = "E";
      orientationVerified = true;
    } else if (lastChar === "1" || lastChar === "2") {
      // Unoriented orthogonal horizontal components (standard SEED convention)
      component = lastChar;
      orientationVerified = false;
    }
  }

  // 12. Quality Flags & Clipping Evaluation
  // Clipping check: if more than 3 consecutive samples hit max or min, or extreme values
  let isClipped = false;
  if (npts >= 5) {
    let flatCount = 1;
    for (let i = 1; i < npts; i++) {
      if (samples[i] === samples[i - 1] && (samples[i] === minAmp || samples[i] === maxAmp) && samples[i] !== 0.0) {
        flatCount++;
        if (flatCount >= 4) {
          isClipped = true;
          break;
        }
      } else {
        flatCount = 1;
      }
    }
  }

  // Gaps check: in SAC format (evenly spaced ITIME), explicit internal gaps do not exist,
  // but if samples contain blocks of exact NaN or sentinel values, flag hasGaps
  const hasGaps = hasCorruptSamples;

  // 13. Synchronous SHA-256 Checksum Calculation
  const checksumSHA256 = computeSHA256Sync(rawBytes);

  // 14. Instrument Response Status
  // SAC binary header does not contain Pole-Zero response functions.
  // Standard rule: preserve RAW_COUNTS, flag MISSING, zero fake conversions.
  const physicalUnit = "RAW_COUNTS";
  const instrumentResponseStatus = "MISSING";
  const sensitivity = 1.0;
  const hasResponseRemoved = false;

  // 15. Construct SeismologicalTrace Instance
  const trace = new SeismologicalTrace({
    network: network || "KS",
    station: station,
    location: location || "00",
    channel: channel !== "UNKNOWN" ? channel : "HHZ",
    component: component,
    startTimeUTC: startTimeUTC,
    sampleRateHz: sampleRateHz,
    samples: samples,
    units: physicalUnit,
    sensitivity: sensitivity,
    hasResponseRemoved: hasResponseRemoved,
    isClipped: isClipped,
    hasGaps: hasGaps,
    checksumSHA256: checksumSHA256,
    provenance: [
      {
        step: "SAC_BINARY_INGESTION",
        timestamp: new Date().toISOString(),
        detail: `Decoded from ${endianName} SAC file (size: ${view.byteLength} B, npts: ${npts}, delta: ${delta} s)`
      }
    ]
  });

  // Attach SAC-specific extended metadata to trace object
  const metadata = {
    decoderVersion: "SEISMOLIVE_SAC_v4.0",
    endian: endianName,
    nvhdr,
    npts,
    delta,
    sampleRateHz,
    station,
    network,
    location,
    channel,
    component,
    orientationVerified,
    cmpaz,
    cmpinc,
    referenceTimeUTC,
    startTimeUTC,
    endTimeUTC,
    originTimeUTC,
    b,
    e,
    o,
    arrivalA,
    userPicks,
    stationCoord: {
      latitude: stla,
      longitude: stlo,
      elevationM: stel,
      depthM: stdp
    },
    eventCoord: {
      latitude: evla,
      longitude: evlo,
      elevationM: evel,
      depthKm: evdp,
      magnitude: mag
    },
    distance: {
      distKm: nullifyFloat(rawFloats.dist),
      azDeg: nullifyFloat(rawFloats.az),
      bazDeg: nullifyFloat(rawFloats.baz),
      gcarcDeg: nullifyFloat(rawFloats.gcarc)
    },
    instrumentResponse: {
      status: instrumentResponseStatus,
      physicalUnit: physicalUnit,
      sensitivity: sensitivity,
      hasResponseRemoved: hasResponseRemoved
    },
    dataIntegrity: {
      fileSizeBytes: view.byteLength,
      checksumSHA256,
      hasCorruptSamples,
      isClipped,
      hasGaps,
      minAmp: Number(minAmp.toFixed(6)),
      maxAmp: Number(maxAmp.toFixed(6)),
      meanAmp: Number(meanAmp.toFixed(6))
    },
    rawFloats,
    rawInts,
    rawStrings
  };

  return {
    trace,
    metadata
  };
}

/**
 * ----------------------------------------------------------------------------
 * 3-Component SAC Seismic Station Packet Assembler
 * ----------------------------------------------------------------------------
 * Assembles and verifies 3-component seismic data (Z, N, E) from decoded SAC records.
 *
 * Checks:
 *   1. Station code compatibility
 *   2. Sampling rate exact equality
 *   3. Sample count equality
 *   4. Sample timestamp alignment (calculates time skew, checks against half-period)
 *   5. Component orientation verification (refuses blind N/E mapping if unverified)
 *   6. Clipping and gap inspection
 *
 * @param {Array|Object} inputTraces - Array [traceZ, traceN, traceE] or { z, n, e }
 * @param {Object} options - Assembly options
 * @returns {Object} { packet: SeismicStationPacket|null, status: string, isSynchronized: boolean, diagnostics: Object }
 */
export function assembleSacStationPacket(inputTraces, options = {}) {
  const errors = [];
  const warnings = [];

  // 1. Normalize input components
  let tZ = null, tN = null, tE = null;
  const unassignedTraces = [];

  if (Array.isArray(inputTraces)) {
    for (const item of inputTraces) {
      const tr = item.trace || item;
      const comp = tr.component || tr.channel?.slice(-1)?.toUpperCase();
      if (comp === "Z") {
        tZ = tr;
      } else if (comp === "N") {
        tN = tr;
      } else if (comp === "E") {
        tE = tr;
      } else {
        unassignedTraces.push(tr);
      }
    }
    // If tN or tE were not explicitly identified as N or E, fill with remaining traces
    if (!tN && unassignedTraces.length > 0) {
      tN = unassignedTraces.shift();
    }
    if (!tE && unassignedTraces.length > 0) {
      tE = unassignedTraces.shift();
    }
  } else if (inputTraces && typeof inputTraces === "object") {
    tZ = inputTraces.z?.trace || inputTraces.z || inputTraces.traceZ || null;
    tN = inputTraces.n?.trace || inputTraces.n || inputTraces.traceN || null;
    tE = inputTraces.e?.trace || inputTraces.e || inputTraces.traceE || null;
  }

  // 2. Component Availability Check
  if (!tZ) errors.push("Missing Vertical (Z) component trace");
  if (!tN) errors.push("Missing North (N) component trace");
  if (!tE) errors.push("Missing East (E) component trace");

  const stationCode = tZ?.station || tN?.station || tE?.station || "UNKNOWN";

  if (!tZ || !tN || !tE) {
    const emptyPacket = new SeismicStationPacket({
      stationCode,
      latitude: options.latitude ?? null,
      longitude: options.longitude ?? null,
      elevationM: options.elevationM ?? 0.0,
      traceZ: tZ,
      traceN: null,
      traceE: null
    });
    emptyPacket.isSynchronized = false;

    return {
      packet: emptyPacket,
      status: "REJECTED",
      isSynchronized: false,
      diagnostics: {
        stationCode,
        channelCodes: { Z: tZ?.channel || null, N: tN?.channel || null, E: tE?.channel || null },
        sampleRateHz: tZ?.sampleRateHz || null,
        sampleCount: tZ?.sampleCount || null,
        sampleInterval: null,
        startTimeSkew: null,
        timeSkewMs: 0.0,
        halfPeriodToleranceMs: 0.0,
        sampleGridAlignment: "UNKNOWN",
        requiresTimeAlignment: true,
        requiresResampling: false,
        commonTimeWindow: null,
        orientationVerified: false,
        hasClipping: false,
        hasGaps: false,
        errors,
        warnings
      }
    };
  }

  // 3. Station Code Consistency
  const stationZ = tZ.station || "UNKNOWN";
  const stationN = tN.station || "UNKNOWN";
  const stationE = tE.station || "UNKNOWN";

  const sameStation = (stationZ === stationN) && (stationN === stationE);
  if (!sameStation) {
    errors.push(`Station mismatch across components: Z=${stationZ}, N=${stationN}, E=${stationE}`);
  }

  // 4. Component Orientation Verification
  // If horizontal traces are unverified or arbitrary angles (e.g. cmpaz != 0 / 90), refuse blind assignment
  let orientationVerified = true;
  if (tN.component !== "N" || tE.component !== "E") {
    orientationVerified = false;
    errors.push(`Unverified horizontal component orientation: N=${tN.component}, E=${tE.component}. Refusing blind North/East mapping.`);
  }

  // 5. Sampling Frequency Equality & Interval Compatibility
  const rateZ = tZ.sampleRateHz;
  const rateN = tN.sampleRateHz;
  const rateE = tE.sampleRateHz;
  const dtZ = tZ.dt || (1.0 / rateZ);
  const dtN = tN.dt || (1.0 / rateN);
  const dtE = tE.dt || (1.0 / rateE);

  const dtTol = 1e-6; // 1 microsecond tolerance
  const sameRate = Math.abs(dtZ - dtN) < dtTol && Math.abs(dtN - dtE) < dtTol;
  let requiresResampling = false;

  if (!sameRate) {
    requiresResampling = true;
    errors.push(`Sampling rate mismatch: Z=${rateZ} Hz (dt=${dtZ}s), N=${rateN} Hz (dt=${dtN}s), E=${rateE} Hz (dt=${dtE}s). Resampling required.`);
  }

  // 6. Sample Count Equality
  const countZ = tZ.sampleCount;
  const countN = tN.sampleCount;
  const countE = tE.sampleCount;
  const sameCount = (countZ === countN) && (countN === countE);

  if (!sameCount) {
    warnings.push(`Sample count mismatch across components: Z=${countZ}, N=${countN}, E=${countE}. Common overlap window will be adjusted.`);
  }

  // 7. Time Alignment & Sample-Grid Alignment Audit
  let timeSkewMs = 0.0;
  let requiresTimeAlignment = false;
  let sampleGridAlignment = "UNKNOWN";
  let commonTimeWindow = null;
  const nominalDt = dtZ;
  const sampleIntervalMs = nominalDt * 1000.0;
  const halfPeriodMs = sampleIntervalMs * 0.5;

  if (!sameRate) {
    sampleGridAlignment = "INCOMPATIBLE_SAMPLE_INTERVAL";
    requiresTimeAlignment = true;
  } else if (!tZ.startTimeUTC || !tN.startTimeUTC || !tE.startTimeUTC) {
    sampleGridAlignment = "UNKNOWN";
    requiresTimeAlignment = true;
    warnings.push("One or more components lack UTC start time; timing alignment cannot be confirmed.");
  } else {
    // Parse start times in milliseconds (Float64 precision)
    const tStartMs_Z = new Date(tZ.startTimeUTC).getTime();
    const tStartMs_N = new Date(tN.startTimeUTC).getTime();
    const tStartMs_E = new Date(tE.startTimeUTC).getTime();

    const skewZN = Math.abs(tStartMs_Z - tStartMs_N);
    const skewZE = Math.abs(tStartMs_Z - tStartMs_E);
    const skewNE = Math.abs(tStartMs_N - tStartMs_E);
    timeSkewMs = Math.max(skewZN, skewZE, skewNE);

    // Floating-point time tolerance: 0.05 ms or 0.1% of sample interval
    const timeEpsMs = Math.min(0.05, sampleIntervalMs * 0.001);

    // Check sample grid phase offset relative to Z
    const offsetSamplesN = (tStartMs_N - tStartMs_Z) / sampleIntervalMs;
    const offsetSamplesE = (tStartMs_E - tStartMs_Z) / sampleIntervalMs;

    const roundOffsetN = Math.round(offsetSamplesN);
    const roundOffsetE = Math.round(offsetSamplesE);

    const remN_ms = Math.abs((offsetSamplesN - roundOffsetN) * sampleIntervalMs);
    const remE_ms = Math.abs((offsetSamplesE - roundOffsetE) * sampleIntervalMs);

    const isGridAligned = (remN_ms <= timeEpsMs) && (remE_ms <= timeEpsMs);

    if (isGridAligned) {
      if (roundOffsetN === 0 && roundOffsetE === 0 && timeSkewMs <= timeEpsMs) {
        sampleGridAlignment = "SAME_GRID_SAME_START";
        requiresTimeAlignment = false;
      } else {
        sampleGridAlignment = "SAME_GRID_INTEGER_OFFSET";
        requiresTimeAlignment = true;
        warnings.push(
          `Components share identical sample grid but have integer index offsets (N=${roundOffsetN}, E=${roundOffsetE} samples). Window slicing/indexing alignment required without interpolation.`
        );
      }
    } else {
      sampleGridAlignment = "FRACTIONAL_SAMPLE_OFFSET";
      requiresTimeAlignment = true;
      warnings.push(
        `Sub-sample fractional timing offset detected (remN=${remN_ms.toFixed(3)}ms, remE=${remE_ms.toFixed(3)}ms). Requires fractional interpolation or phase shift; components do NOT lie on identical discrete grid.`
      );
    }

    // Evaluate Common Time Window
    const tEndMs_Z = tStartMs_Z + (countZ - 1) * sampleIntervalMs;
    const tEndMs_N = tStartMs_N + (countN - 1) * sampleIntervalMs;
    const tEndMs_E = tStartMs_E + (countE - 1) * sampleIntervalMs;

    const commonStartMs = Math.max(tStartMs_Z, tStartMs_N, tStartMs_E);
    const commonEndMs = Math.min(tEndMs_Z, tEndMs_N, tEndMs_E);

    if (commonEndMs >= commonStartMs) {
      const durationSec = (commonEndMs - commonStartMs) / 1000.0;
      if (isGridAligned) {
        const startIdx_Z = Math.round((commonStartMs - tStartMs_Z) / sampleIntervalMs);
        const endIdx_Z = Math.round((commonEndMs - tStartMs_Z) / sampleIntervalMs);
        const count_Z = endIdx_Z - startIdx_Z + 1;

        const startIdx_N = Math.round((commonStartMs - tStartMs_N) / sampleIntervalMs);
        const endIdx_N = Math.round((commonEndMs - tStartMs_N) / sampleIntervalMs);

        const startIdx_E = Math.round((commonStartMs - tStartMs_E) / sampleIntervalMs);
        const endIdx_E = Math.round((commonEndMs - tStartMs_E) / sampleIntervalMs);

        commonTimeWindow = {
          hasCommonWindow: true,
          startTimeUTC: new Date(commonStartMs).toISOString(),
          endTimeUTC: new Date(commonEndMs).toISOString(),
          durationSec: Number(durationSec.toFixed(6)),
          commonSampleCount: count_Z,
          sampleIndices: {
            Z: { start: startIdx_Z, end: endIdx_Z, count: count_Z },
            N: { start: startIdx_N, end: endIdx_N, count: count_Z },
            E: { start: startIdx_E, end: endIdx_E, count: count_Z }
          }
        };
      } else {
        commonTimeWindow = {
          hasCommonWindow: true,
          startTimeUTC: new Date(commonStartMs).toISOString(),
          endTimeUTC: new Date(commonEndMs).toISOString(),
          durationSec: Number(durationSec.toFixed(6)),
          commonSampleCount: null,
          sampleIndices: null,
          note: "Continuous time overlap exists, but discrete indices are non-integer due to fractional sample offset"
        };
      }
    } else {
      commonTimeWindow = {
        hasCommonWindow: false,
        startTimeUTC: null,
        endTimeUTC: null,
        durationSec: 0.0,
        commonSampleCount: 0,
        sampleIndices: null,
        note: "No temporal overlap among 3 components"
      };
    }
  }

  // 8. Quality Flags: Clipping and Gaps
  const hasClipping = Boolean(tZ.qualityFlags?.isClipped || tN.qualityFlags?.isClipped || tE.qualityFlags?.isClipped);
  const hasGaps = Boolean(tZ.qualityFlags?.hasGaps || tN.qualityFlags?.hasGaps || tE.qualityFlags?.hasGaps);

  if (hasClipping) warnings.push("One or more components exhibit sample clipping");
  if (hasGaps) warnings.push("One or more components contain sample gaps or corrupted data points");

  // 9. Evaluate Synchronization: Requires exact same grid and same start time
  const isFullySynchronized = sameStation && sameRate && sameCount && orientationVerified &&
                              (sampleGridAlignment === "SAME_GRID_SAME_START") && !requiresTimeAlignment && errors.length === 0;

  // 10. Instantiate SeismicStationPacket
  const packet = new SeismicStationPacket({
    stationCode: stationZ,
    latitude: options.latitude ?? null,
    longitude: options.longitude ?? null,
    elevationM: options.elevationM ?? 0.0,
    traceZ: tZ,
    traceN: orientationVerified ? tN : null,
    traceE: orientationVerified ? tE : null
  });

  // Override packet synchronization with strict multi-condition result
  packet.isSynchronized = isFullySynchronized;

  return {
    packet: packet,
    status: isFullySynchronized ? "SUCCESS" : (errors.length > 0 ? "REJECTED" : "UNSYNCHRONIZED"),
    isSynchronized: isFullySynchronized,
    diagnostics: {
      stationCode: stationZ,
      channelCodes: { Z: tZ.channel, N: tN.channel, E: tE.channel },
      sampleRateHz: rateZ,
      sampleCount: countZ,
      sampleInterval: {
        sec: nominalDt,
        ms: Number(sampleIntervalMs.toFixed(3))
      },
      startTimeSkew: {
        ms: Number(timeSkewMs.toFixed(3)),
        sec: Number((timeSkewMs / 1000.0).toFixed(6))
      },
      timeSkewMs: Number(timeSkewMs.toFixed(3)),
      halfPeriodToleranceMs: Number(halfPeriodMs.toFixed(3)),
      sampleGridAlignment,
      requiresTimeAlignment,
      requiresResampling,
      commonTimeWindow,
      orientationVerified,
      isSynchronized: isFullySynchronized,
      hasClipping,
      hasGaps,
      errors,
      warnings
    }
  };
}

/**
 * ----------------------------------------------------------------------------
 * SAC Binary Encoder (Test Fixture Generator & Serializer)
 * ----------------------------------------------------------------------------
 * Writes byte-accurate SAC files for Little-Endian and Big-Endian test fixtures.
 *
 * @param {Object} sacObj
 * @param {Object} options
 * @returns {ArrayBuffer}
 */
export function encodeSacBinary(sacObj, options = {}) {
  const isLittleEndian = options.endian === "BIG_ENDIAN" ? false : (options.isLittleEndian ?? true);
  const samples = sacObj.data || new Float32Array(0);
  const npts = samples.length;

  const totalBytes = SAC_HEADER_SIZE_BYTES + npts * 4;
  const buffer = new ArrayBuffer(totalBytes);
  const view = new DataView(buffer);

  // Initialize all floats to SAC_FLOAT_UNDEF (-12345.0)
  for (let i = 0; i < SAC_FLOATS_COUNT; i++) {
    view.setFloat32(i * 4, SAC_FLOAT_UNDEF, isLittleEndian);
  }

  // Initialize all ints to SAC_INT_UNDEF (-12345)
  for (let i = 0; i < SAC_INTS_COUNT; i++) {
    view.setInt32(280 + i * 4, SAC_INT_UNDEF, isLittleEndian);
  }

  // Initialize all strings to "-12345  " (spaces padded to 8 or 16 bytes)
  const encoder = new TextEncoder();
  const initStr8 = encoder.encode("-12345  ");
  const initStr16 = encoder.encode("-12345          ");
  const uint8View = new Uint8Array(buffer);

  for (const item of SAC_STRING_LAYOUT) {
    if (item.length === 16) {
      uint8View.set(initStr16, item.offset);
    } else {
      uint8View.set(initStr8, item.offset);
    }
  }

  // Set default required ints
  view.setInt32(280 + 6 * 4, 6, isLittleEndian);    // nvhdr = 6
  view.setInt32(280 + 9 * 4, npts, isLittleEndian); // npts
  view.setInt32(280 + 15 * 4, 1, isLittleEndian);   // iftype = 1 (ITIME)
  view.setInt32(280 + 35 * 4, 1, isLittleEndian);   // leven = 1 (evenly spaced)

  // Write provided floats
  if (sacObj.floats) {
    for (const [key, val] of Object.entries(sacObj.floats)) {
      const idx = SAC_FLOATHDRS.indexOf(key);
      if (idx !== -1 && val !== null && val !== undefined) {
        view.setFloat32(idx * 4, Number(val), isLittleEndian);
      }
    }
  }

  // Write provided ints
  if (sacObj.ints) {
    for (const [key, val] of Object.entries(sacObj.ints)) {
      const idx = SAC_INTHDRS.indexOf(key);
      if (idx !== -1 && val !== null && val !== undefined) {
        view.setInt32(280 + idx * 4, Math.round(Number(val)), isLittleEndian);
      }
    }
  }

  // Write provided strings
  if (sacObj.strings) {
    for (const [key, val] of Object.entries(sacObj.strings)) {
      const item = SAC_STRING_LAYOUT.find(s => s.name === key);
      if (item && val) {
        const padded = String(val).padEnd(item.length, " ").slice(0, item.length);
        const encoded = encoder.encode(padded);
        uint8View.set(encoded, item.offset);
      }
    }
  }

  // Write waveform data samples (Float32)
  for (let i = 0; i < npts; i++) {
    view.setFloat32(SAC_HEADER_SIZE_BYTES + i * 4, Number(samples[i]), isLittleEndian);
  }

  return buffer;
}
