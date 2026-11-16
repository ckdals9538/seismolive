// ============================================================================
// SEISMOLIVE v4.0 — Pure GeoTIFF Raster Sampler & Surface Classification
// File: js/3d/GeoRasterSampler.js
//
// Domain-pure raster alignment & land/ocean/coastal multi-criteria classifier.
// Zero Three.js / DOM / network I/O dependencies (extracted in Stage R2).
// ============================================================================

export const SURFACE_CLASSIFICATION = Object.freeze({
  LAND: 'LAND',
  OCEAN: 'OCEAN',
  COASTAL_UNCERTAIN: 'COASTAL_UNCERTAIN',
  NODATA: 'NODATA'
});

export const RASTER_PIXEL_TYPE = Object.freeze({
  PIXEL_IS_AREA: 'RasterPixelIsArea',
  PIXEL_IS_POINT: 'RasterPixelIsPoint'
});

/**
 * Pixel Alignment & Sampling helper for GeoTIFF rasters
 */
export class GeoRasterSampler {
  /**
   * @param {Object} config
   * @param {Float32Array|Uint16Array} config.data - Elevation data array
   * @param {number} config.width - Raster width in pixels
   * @param {number} config.height - Raster height in pixels
   * @param {number} config.west - Western boundary longitude
   * @param {number} config.north - Northern boundary latitude
   * @param {number} config.pixelWidth - Longitude step per pixel (positive)
   * @param {number} config.pixelHeight - Latitude step per pixel (positive)
   * @param {string} config.pixelType - RasterPixelIsPoint or RasterPixelIsArea
   * @param {number} [config.noDataValue=-99999.0]
   * @param {number} [config.hMin=0]
   * @param {number} [config.hMax=0]
   * @param {boolean} [config.isNormalized=false]
   */
  constructor(config) {
    this.data = config.data;
    this.width = config.width;
    this.height = config.height;
    this.west = config.west;
    this.north = config.north;
    this.pixelWidth = config.pixelWidth;
    this.pixelHeight = config.pixelHeight;
    this.pixelType = config.pixelType || RASTER_PIXEL_TYPE.PIXEL_IS_POINT;
    this.noDataValue = config.noDataValue !== undefined ? config.noDataValue : -99999.0;
    this.hMin = config.hMin || 0;
    this.hMax = config.hMax || 0;
    this.isNormalized = !!config.isNormalized;
  }

  /**
   * Convert geographic coordinate (lat, lon) to continuous pixel coordinate (px, py).
   * Correctly applies half-pixel offset for RasterPixelIsArea.
   *
   * @param {number} lat - Latitude in degrees
   * @param {number} lon - Longitude in degrees
   * @returns {{ px: number, py: number, inside: boolean }}
   */
  coordToPixel(lat, lon) {
    let px = (lon - this.west) / this.pixelWidth;
    let py = (this.north - lat) / this.pixelHeight;

    // In RasterPixelIsArea, the tiepoint is the outer corner of the top-left pixel.
    // The pixel center is at px - 0.5, py - 0.5.
    if (this.pixelType === RASTER_PIXEL_TYPE.PIXEL_IS_AREA) {
      px -= 0.5;
      py -= 0.5;
    }

    const inside = px >= 0.0 && px <= (this.width - 1.0) && py >= 0.0 && py <= (this.height - 1.0);
    return { px, py, inside };
  }

  /**
   * Bilinear sampling of elevation at (lat, lon).
   *
   * @param {number} lat - Latitude in degrees
   * @param {number} lon - Longitude in degrees
   * @returns {{ elevation: number|null, validity: string }}
   */
  sampleElevation(lat, lon) {
    const { px, py, inside } = this.coordToPixel(lat, lon);
    if (!inside) {
      return { elevation: null, validity: 'OUT_OF_BOUNDS' };
    }

    const x0 = Math.floor(px);
    const x1 = Math.min(x0 + 1, this.width - 1);
    const y0 = Math.floor(py);
    const y1 = Math.min(y0 + 1, this.height - 1);

    const fx = px - x0;
    const fy = py - y0;

    const v00 = this._getPixel(x0, y0);
    const v10 = this._getPixel(x1, y0);
    const v01 = this._getPixel(x0, y1);
    const v11 = this._getPixel(x1, y1);

    if (v00 === null || v10 === null || v01 === null || v11 === null) {
      return { elevation: null, validity: 'NODATA' };
    }

    // Bilinear interpolation
    const top = v00 * (1.0 - fx) + v10 * fx;
    const bottom = v01 * (1.0 - fx) + v11 * fx;
    const elev = top * (1.0 - fy) + bottom * fy;

    return { elevation: elev, validity: 'VALID' };
  }

  _getPixel(x, y) {
    const idx = y * this.width + x;
    const raw = this.data[idx];
    if (raw === undefined || Number.isNaN(raw) || Math.abs(raw - this.noDataValue) < 0.1) {
      return null;
    }
    if (this.isNormalized) {
      return this.hMin + (raw / 65535.0) * (this.hMax - this.hMin);
    }
    return raw;
  }
}

/**
 * Multi-criteria Land / Ocean / Coastal Classification
 *
 * @param {number} H - Sampled elevation (meters)
 * @param {number|null} H_etopo - Regional ETOPO elevation for the same location (meters)
 * @param {number} localGradient - Spatial variance in 3x3 window (meters)
 * @returns {string} One of SURFACE_CLASSIFICATION values
 */
export function classifySurface(H, H_etopo, localGradient = 0.0) {
  // If elevation is strictly negative beyond coastal surf zone, it is ocean bathymetry
  if (H < -2.0) {
    return SURFACE_CLASSIFICATION.OCEAN;
  }

  // If ETOPO indicates deep marine shelf (< -5.0m) and local gradient is flat (< 0.05m),
  // it is open water flattened to 0.0m by radar DSM processing.
  if (H_etopo !== null && H_etopo < -5.0 && Math.abs(H) < 0.2 && localGradient < 0.05) {
    return SURFACE_CLASSIFICATION.OCEAN;
  }

  // Intertidal / shoreline transition zone (-1.5m to +2.0m) with gentle slope
  if (H >= -1.5 && H <= 2.0 && (H_etopo === null || H_etopo >= -5.0)) {
    return SURFACE_CLASSIFICATION.COASTAL_UNCERTAIN;
  }

  // Elevated terrestrial land
  if (H > 2.0) {
    return SURFACE_CLASSIFICATION.LAND;
  }

  return SURFACE_CLASSIFICATION.COASTAL_UNCERTAIN;
}
