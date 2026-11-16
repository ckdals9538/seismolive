// ============================================================================
// SEISMOLIVE v4.0 — Unified Three.js ES Module Runtime & OrbitControls Bridge
// File: js/lib/three-runtime.js
//
// Single authoritative Three.js runtime imported across index.html, js/main.js,
// and UI/3D modules (Stage R3), eliminating the legacy global three.min.js UMD
// bundle while exposing an extensible globalThis.THREE bridge for diagnostics.
// ============================================================================

import * as THREE_CORE from './three.module.js';
import { OrbitControls, MapControls } from './OrbitControls.module.js';

export const THREE = Object.assign({}, THREE_CORE, {
  OrbitControls,
  MapControls,
  __SEISMOLIVE_UNIFIED_ESM__: true
});

if (typeof globalThis !== 'undefined') {
  globalThis.THREE = THREE;
}
if (typeof window !== 'undefined') {
  window.THREE = THREE;
}

export * from './three.module.js';
export { OrbitControls, MapControls };
export default THREE;
