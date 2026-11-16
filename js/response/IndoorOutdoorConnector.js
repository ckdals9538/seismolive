// ============================================================================
// SEISMOLIVE v4.0 — Indoor-Outdoor Connector Specification
// File: js/response/IndoorOutdoorConnector.js
//
// Explicit physical portal connecting the interior vertical egress core
// to the external campus pedestrian graph. Proximity-based auto-snapping is banned.
// ============================================================================

export const PORTAL_DOOR_TYPES = Object.freeze({
  DOUBLE_LEAF_FIRE_DOOR: 'DOUBLE_LEAF_FIRE_DOOR',
  SINGLE_LEAF_FIRE_DOOR: 'SINGLE_LEAF_FIRE_DOOR',
  TEMPERED_GLASS_SWING: 'TEMPERED_GLASS_SWING',
  REVOLVING_DOOR: 'REVOLVING_DOOR',
  SECURITY_SLIDING_DOOR: 'SECURITY_SLIDING_DOOR'
});

export const LOCK_MECHANISMS = Object.freeze({
  FAIL_SAFE_MAGNETIC: 'FAIL_SAFE_MAGNETIC', // De-energizes and unlocks on power loss
  FAIL_SECURE_LATCH: 'FAIL_SECURE_LATCH',   // Stays locked on power loss (hazardous in fire/quake)
  MECHANICAL_CRASH_BAR: 'MECHANICAL_CRASH_BAR', // Pure mechanical panic release
  KEY_DEADBOLT: 'KEY_DEADBOLT'
});

export const EGRESS_STATUS = Object.freeze({
  VERIFIED: 'VERIFIED',
  PARTIALLY_VERIFIED: 'PARTIALLY_VERIFIED',
  PROVISIONAL: 'PROVISIONAL',
  RESTRICTED: 'RESTRICTED'
});

export class IndoorOutdoorConnector {
  /**
   * @param {Object} spec
   */
  constructor(spec = {}) {
    if (!spec.connectorId || !spec.sourceIndoorNodeId || !spec.targetOutdoorNodeId) {
      throw new Error('[IndoorOutdoorConnector] Required topological anchor IDs missing.');
    }

    this.connectorId = spec.connectorId;
    this.sourceIndoorNodeId = spec.sourceIndoorNodeId;
    this.targetOutdoorNodeId = spec.targetOutdoorNodeId;

    // Geometric transition attributes:
    // lengthMeters (4.0m) is PARTIALLY_VERIFIED from OSM building facade to footway gap.
    // verticalDropMeters, step presence, and ramp gradient are PROVISIONAL pending physical survey F-03.
    this.geometry = Object.freeze({
      lengthMeters: spec.geometry?.lengthMeters ?? 4.0,
      bearingDegrees: spec.geometry?.bearingDegrees ?? 118.4,
      verticalDropMeters: spec.geometry?.verticalDropMeters ?? 0.15,
      hasThresholdStep: spec.geometry?.hasThresholdStep ?? true,
      hasRamp: spec.geometry?.hasRamp ?? true,
      rampSlopePercent: spec.geometry?.rampSlopePercent ?? 8.33,
      geometryProvenance: EGRESS_STATUS.PROVISIONAL
    });

    // Hardware & locking attributes:
    // All door hardware, lock mechanism, panic bar, and power outage unlock behavior
    // are strictly PROVISIONAL until on-site test F-02 is executed.
    // General assumptions of automatic power-outage unlocking are strictly forbidden.
    this.hardware = Object.freeze({
      doorType: spec.hardware?.doorType ?? PORTAL_DOOR_TYPES.DOUBLE_LEAF_FIRE_DOOR,
      clearWidthMeters: spec.hardware?.clearWidthMeters ?? 1.80,
      clearHeightMeters: spec.hardware?.clearHeightMeters ?? 2.10,
      openingDirection: spec.hardware?.openingDirection ?? 'OUTWARD_EGRESS',
      lockMechanism: spec.hardware?.lockMechanism ?? LOCK_MECHANISMS.FAIL_SAFE_MAGNETIC,
      hasManualCrashBar: spec.hardware?.hasManualCrashBar ?? true,
      powerOutageBehavior: spec.hardware?.powerOutageBehavior ?? 'AUTOMATIC_UNLOCKED',
      hardwareProvenance: EGRESS_STATUS.PROVISIONAL
    });

    this.hazard = Object.freeze({
      overheadGlassFacade: spec.hazard?.overheadGlassFacade ?? true,
      facadeTileSpallRisk: spec.hazard?.facadeTileSpallRisk ?? 'MEDIUM',
      debrisBufferZoneMeters: spec.hazard?.debrisBufferZoneMeters ?? 6.0
    });

    this.provenance = Object.freeze({
      status: EGRESS_STATUS.PROVISIONAL, // Classified strictly as PROVISIONAL pending F-02/F-03
      source: spec.provenance?.source ?? 'ARCHITECTURAL_STANDARD_ESTIMATE_ISO_23601',
      lastAudited: '2026-11-11',
      pendingSurveys: Object.freeze(spec.provenance?.pendingSurveys || [
        'F-02: Physical inspection of 1F SE fire door latch, panic bar, and power-cut unlock circuit',
        'F-03: Measurement of exterior threshold step and actual ramp clearance'
      ])
    });
  }

  /**
   * Evaluate whether this connector is passable under current physical and situational conditions.
   *
   * @param {{
   *   isPowerOut?: boolean,
   *   isDoorMechanicallyJammed?: boolean,
   *   requiresWheelchair?: boolean,
   *   isExteriorDebrisBlocked?: boolean
   * }} context
   * @returns {{
   *   isPassable: boolean,
   *   effectiveWidthMeters: number,
   *   reason?: string,
   *   warning?: string
   * }}
   */
  evaluatePassability(context = {}) {
    if (context.isDoorMechanicallyJammed) {
      return {
        isPassable: false,
        effectiveWidthMeters: 0.0,
        reason: 'DOOR_MECHANICALLY_JAMMED: Severe shaking deformed door frame or mechanical lock.',
        warning: 'Immediate alternative egress required: check NW stairwell or ground windows.'
      };
    }

    if (context.isExteriorDebrisBlocked) {
      return {
        isPassable: false,
        effectiveWidthMeters: 0.0,
        reason: 'EXTERIOR_DEBRIS_BLOCKED: Fallen facade tiles or masonry obstructing doorway.',
        warning: 'Do not force exit. Use secondary egress.'
      };
    }

    // Power outage & Lock check
    let lockStateUnlocked = true;
    if (this.hardware.lockMechanism === LOCK_MECHANISMS.FAIL_SECURE_LATCH && context.isPowerOut) {
      lockStateUnlocked = this.hardware.hasManualCrashBar;
      if (!lockStateUnlocked) {
        return {
          isPassable: false,
          effectiveWidthMeters: 0.0,
          reason: 'FAIL_SECURE_LOCKED: Door remained locked on power loss and lacks crash bar.'
        };
      }
    }

    // Wheelchair / Accessibility validation
    if (context.requiresWheelchair) {
      if (this.hardware.clearWidthMeters < 0.90) {
        return {
          isPassable: false,
          effectiveWidthMeters: this.hardware.clearWidthMeters,
          reason: 'INSUFFICIENT_WIDTH_FOR_WHEELCHAIR: Clear width under 0.90m.'
        };
      }
      if (this.geometry.hasThresholdStep && !this.geometry.hasRamp) {
        return {
          isPassable: false,
          effectiveWidthMeters: this.hardware.clearWidthMeters,
          reason: 'UNRAMPED_VERTICAL_STEP: Step height exceeds wheelchair clearance without ramp.'
        };
      }
      if (this.geometry.hasRamp && this.geometry.rampSlopePercent > 12.5) {
        return {
          isPassable: false,
          effectiveWidthMeters: this.hardware.clearWidthMeters,
          reason: 'RAMP_TOO_STEEP: Exceeds maximum safe wheelchair slope.'
        };
      }
    }

    // Warnings for provisional assumptions
    let provisionalWarning = undefined;
    if (this.hardware.hardwareProvenance === EGRESS_STATUS.PROVISIONAL) {
      provisionalWarning = 'CAUTION [PROVISIONAL]: Automatic power-cut door unlock and ramp accessibility are unverified estimates. Physical inspection required.';
    }

    return {
      isPassable: true,
      effectiveWidthMeters: this.hardware.clearWidthMeters,
      warning: provisionalWarning || (this.hazard.overheadGlassFacade
        ? 'CAUTION: Clear 6m debris fall zone immediately upon stepping outside. Watch for falling glass.'
        : undefined)
    };
  }

  /**
   * Return topological graph edge representation for the routing engine.
   *
   * @returns {{
   *   source: string,
   *   target: string,
   *   distance: number,
   *   hasStairs: boolean,
   *   isWheelchairPassable: boolean,
   *   connectorId: string
   * }}
   */
  getGraphEdge() {
    return {
      source: this.sourceIndoorNodeId,
      target: this.targetOutdoorNodeId,
      distance: this.geometry.lengthMeters,
      hasStairs: false,
      isWheelchairPassable: this.geometry.hasRamp,
      connectorId: this.connectorId
    };
  }
}

/**
 * Pre-configured singleton connector for Hanyang Engineering Bldg 1 South-East Egress.
 */
export const HANYANG_BLDG212_SE_CONNECTOR = new IndoorOutdoorConnector({
  connectorId: 'CONNECTOR_EGRESS_1F_SE',
  sourceIndoorNodeId: 'NODE_EXIT_1F_SE',
  targetOutdoorNodeId: 'OSM_NODE_6415394841',
  geometry: {
    lengthMeters: 4.0,
    bearingDegrees: 118.4,
    verticalDropMeters: 0.15,
    hasThresholdStep: true,
    hasRamp: true,
    rampSlopePercent: 8.33
  },
  hardware: {
    doorType: PORTAL_DOOR_TYPES.DOUBLE_LEAF_FIRE_DOOR,
    clearWidthMeters: 1.80,
    clearHeightMeters: 2.10,
    openingDirection: 'OUTWARD_EGRESS',
    lockMechanism: LOCK_MECHANISMS.FAIL_SAFE_MAGNETIC,
    hasManualCrashBar: true,
    powerOutageBehavior: 'AUTOMATIC_UNLOCKED'
  },
  hazard: {
    overheadGlassFacade: true,
    facadeTileSpallRisk: 'MEDIUM',
    debrisBufferZoneMeters: 6.0
  },
  provenance: {
    status: EGRESS_STATUS.PROVISIONAL,
    source: 'ARCHITECTURAL_STANDARD_ESTIMATE_ISO_23601',
    lastAudited: '2026-11-11',
    pendingSurveys: [
      'F-02: Fire door latch and magnetic power-drop test',
      'F-03: Measurement of 4m egress path threshold step'
    ]
  }
});
