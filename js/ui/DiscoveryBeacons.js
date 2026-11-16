// ============================================================================
// SEISMOLIVE v4.0 — Interactive 3D Discovery Beacons
// Sublime, non-game-VFX epicenter beacons on continuous WGS84 globe
// ============================================================================

import { THREE } from '../lib/three-runtime.js';
import { getEventCoords, getAllLocalizedEvents } from '../data/eventCatalogHelpers.js';
import { geodeticToThree, computeGlobeCenterAndPolarAxis } from '../3d/geodeticEllipsoidCoord.js';

const _tmpObj = new THREE.Object3D();
const _tmpQuat = new THREE.Quaternion();
const _tmpZAxis = new THREE.Vector3(0, 0, 1);
const _tmpNormal = new THREE.Vector3();

class DiscoveryBeaconBatch {
  constructor(nodes = [], scene = null) {
    this.nodes = nodes;
    this.count = nodes.length;
    this.batchVisible = true;
    this.group = new THREE.Group();
    this.group.name = 'DiscoveryBeaconsInstancedBatch';

    const maxCount = Math.max(1, this.count);
    const coreGeo = new THREE.SphereGeometry(0.011, 10, 10);
    const coreMat = new THREE.MeshBasicMaterial({ depthTest: false, transparent: true, opacity: 0.88 });
    this.coreMesh = new THREE.InstancedMesh(coreGeo, coreMat, maxCount);
    this.coreMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.coreMesh.renderOrder = 12;
    this.coreMesh.frustumCulled = false;

    const ringGeo = new THREE.RingGeometry(0.016, 0.027, 20);
    const ringMat = new THREE.MeshBasicMaterial({
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.40,
      blending: THREE.NormalBlending,
      depthTest: false
    });
    this.ringMesh = new THREE.InstancedMesh(ringGeo, ringMat, maxCount);
    this.ringMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.ringMesh.renderOrder = 11;
    this.ringMesh.frustumCulled = false;

    const col = new THREE.Color();
    for (let i = 0; i < this.count; i++) {
      const nd = this.nodes[i];
      col.setHex(nd.coreColorHex);
      this.coreMesh.setColorAt(i, col);
      col.setHex(nd.ringColorHex);
      this.ringMesh.setColorAt(i, col);
    }
    if (this.coreMesh.instanceColor) this.coreMesh.instanceColor.needsUpdate = true;
    if (this.ringMesh.instanceColor) this.ringMesh.instanceColor.needsUpdate = true;

    this.group.add(this.coreMesh);
    this.group.add(this.ringMesh);
    if (scene) scene.add(this.group);
    this.updateMatrices(0);
  }

  updateMatrices(time = 0) {
    if (!this.batchVisible) {
      this.group.visible = false;
      return;
    }
    let anyVisible = false;
    for (let i = 0; i < this.count; i++) {
      const nd = this.nodes[i];
      const vis = Boolean(nd.group.visible && !nd.isFocalEpicenter && nd.lat != null && nd.lon != null);
      if (!vis) {
        _tmpObj.position.set(0, -9999, 0);
        _tmpObj.scale.set(0.0001, 0.0001, 0.0001);
        _tmpObj.quaternion.identity();
        _tmpObj.updateMatrix();
        this.coreMesh.setMatrixAt(i, _tmpObj.matrix);
        this.ringMesh.setMatrixAt(i, _tmpObj.matrix);
        continue;
      }

      anyVisible = true;
      _tmpObj.position.copy(nd.group.position);
      _tmpObj.quaternion.identity();
      _tmpObj.scale.set(1, 1, 1);
      _tmpObj.updateMatrix();
      this.coreMesh.setMatrixAt(i, _tmpObj.matrix);

      const pulse = Math.sin(time * 2.2 + nd.phase);
      const s = 1.0 + 0.25 * pulse;
      _tmpObj.quaternion.copy(nd._ringQuat);
      _tmpObj.scale.set(s, s, 1);
      _tmpObj.updateMatrix();
      this.ringMesh.setMatrixAt(i, _tmpObj.matrix);
    }
    this.group.visible = anyVisible;
    if (anyVisible) {
      this.coreMesh.instanceMatrix.needsUpdate = true;
      this.ringMesh.instanceMatrix.needsUpdate = true;
    }
  }

  dispose(scene) {
    if (scene && this.group) scene.remove(this.group);
    this.coreMesh.geometry.dispose();
    this.coreMesh.material.dispose();
    this.ringMesh.geometry.dispose();
    this.ringMesh.material.dispose();
  }
}

let activeBeaconBatch = null;

export class DiscoveryNode {
  constructor(eventData, lat0, lon0, options = {}) {
    this.eventData = eventData;
    this.id = eventData.id || eventData.eventId;
    const coords = getEventCoords(eventData);
    this.lat = coords.lat;
    this.lon = coords.lon;
    this.group = new THREE.Group();
    this.group.name = `DiscoveryNode_${this.id}`;
    this.group.userData = { beacon: this, eventId: this.id };

    const mag = eventData.scientificEstimates?.[0]?.estimatedMag ?? eventData.mag?.v ?? eventData.mag ?? 5.5;
    const isGreat = mag >= 7.0;
    const isModern = eventData.century >= 20;

    let coreColor = 0xEAE4D5; // Hanji Ivory
    let ringColor = 0xC89D54; // Brass
    if (isGreat) {
      coreColor = 0xFFF5E6;
      ringColor = 0xD94E34; // Cinnabar
    } else if (isModern) {
      coreColor = 0xC8DFF5;
      ringColor = 0x64B5F6; // Pale moon blue
    }
    this.coreColorHex = coreColor;
    this.ringColorHex = ringColor;
    this._ringQuat = new THREE.Quaternion();
    this.isFocalEpicenter = false;
    this._batched = Boolean(options.batched);

    // Lightweight virtual proxies so external code inspecting ringMesh/coreMesh stays compatible
    if (!this._batched) {
      const coreGeo = new THREE.SphereGeometry(0.018, 12, 12);
      const coreMat = new THREE.MeshBasicMaterial({ color: coreColor, depthTest: false, transparent: true });
      this.coreMesh = new THREE.Mesh(coreGeo, coreMat);
      this.coreMesh.renderOrder = 12;
      this.group.add(this.coreMesh);

      const ringGeo = new THREE.RingGeometry(0.024, 0.040, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: ringColor,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending,
        depthTest: false
      });
      this.ringMesh = new THREE.Mesh(ringGeo, ringMat);
      this.ringMesh.renderOrder = 11;
      this.group.add(this.ringMesh);
    } else {
      this.coreMesh = { visible: true };
      this.ringMesh = { visible: true, scale: { set() {} }, material: { opacity: 0.75 } };
    }

    // Raycasting hit sphere (invisible material = 0 WebGL draw calls, still raycastable)
    const hitGeo = new THREE.SphereGeometry(0.09, 6, 6);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    this.hitMesh = new THREE.Mesh(hitGeo, hitMat);
    this.hitMesh.userData = { beacon: this };
    this.group.add(this.hitMesh);

    this.phase = Math.random() * Math.PI * 2.0;
    this.updatePosition(lat0, lon0);
  }

  updatePosition(lat0, lon0) {
    if (this.lat != null && this.lon != null) {
      const [x, y, z] = geodeticToThree(this.lat, this.lon, 0.015, lat0, lon0, 0.0);
      this.group.position.set(x, y, z);

      this.isFocalEpicenter = (Math.abs(x) < 0.02 && Math.abs(z) < 0.02);
      if (this.isFocalEpicenter) {
        this.ringMesh.visible = false;
        this.coreMesh.visible = false;
      } else {
        this.ringMesh.visible = true;
        this.coreMesh.visible = true;
      }

      const globeCenter = computeGlobeCenterAndPolarAxis(lat0, lon0).centerThree;
      _tmpNormal.set(x - globeCenter[0], y - globeCenter[1], z - globeCenter[2]).normalize();
      _tmpQuat.setFromUnitVectors(_tmpZAxis, _tmpNormal);
      this._ringQuat.copy(_tmpQuat);
      if (!this._batched && this.ringMesh.quaternion) {
        this.ringMesh.quaternion.copy(_tmpQuat);
      }
    }
  }

  update(time) {
    if (this._batched) {
      if (activeBeaconBatch && activeBeaconBatch.nodes[0] === this) {
        activeBeaconBatch.updateMatrices(time);
      }
      return;
    }
    const pulse = Math.sin(time * 2.2 + this.phase);
    const s = 1.0 + 0.25 * pulse;
    this.ringMesh.scale.set(s, s, 1.0);
    this.ringMesh.material.opacity = 0.55 + 0.35 * pulse;
  }
}

export function getDiscoveryBeaconBatchGroup() {
  return activeBeaconBatch?.group || null;
}

export function setDiscoveryBeaconsVisible(visible = true) {
  const show = Boolean(visible);
  if (activeBeaconBatch) {
    activeBeaconBatch.batchVisible = show;
    if (!show) {
      activeBeaconBatch.group.visible = false;
    }
  }
  if (!show) {
    hideBeaconTooltip();
  }
}

export function initDiscoveryNodes(lat0, lon0, scene = null, discoveryNodesList = null) {
  const s = scene || (typeof window !== 'undefined' ? window.scene : null);
  const list = discoveryNodesList || (typeof window !== 'undefined' ? window.discoveryNodes : null);
  if (!s || !list) return;

  if (activeBeaconBatch) {
    activeBeaconBatch.dispose(s);
    activeBeaconBatch = null;
  }
  list.forEach(n => {
    s.remove(n.group);
  });
  list.length = 0;
  const allEvents = getAllLocalizedEvents();
  // Include all baseline historical/instrumental benchmarks plus major global events (M>=5.8) so orbit view remains serene
  const beaconEvents = allEvents.filter(ev => {
    if (!ev.id?.includes('usgs')) return true;
    const m = ev.mag?.v ?? ev.mag ?? 0;
    return m >= 5.8;
  });
  beaconEvents.forEach(ev => {
    const node = new DiscoveryNode(ev, lat0, lon0, { batched: true });
    s.add(node.group);
    list.push(node);
  });
  activeBeaconBatch = new DiscoveryBeaconBatch(list, s);
}

export function updateDiscoveryNodePositions(lat0, lon0, discoveryNodesList = null) {
  const list = discoveryNodesList || (typeof window !== 'undefined' ? window.discoveryNodes : null);
  if (list) {
    list.forEach(n => n.updatePosition(lat0, lon0));
    if (activeBeaconBatch) activeBeaconBatch.updateMatrices(0);
  }
}

export function showBeaconTooltip(beacon, screenX, screenY) {
  const tt = document.getElementById('beacon-tooltip');
  if (!tt || !beacon) return;
  const ev = beacon.eventData || beacon;

  const eraEl = document.getElementById('tt-era');
  const titleEl = document.getElementById('tt-title');
  const metaEl = document.getElementById('tt-meta');
  const quoteEl = document.getElementById('tt-quote');

  const eraText = ev.dateConversion?.reignName ? `${ev.dateConversion.reignName} (${ev.dateConversion.gregorianYear || ev.dateText})` : (ev.dateText || "연대 미상");
  const titleText = ev.place || ev.titleKo || ev.canonicalName || "역사지진";
  const magText = ev.scientificEstimates?.[0]?.estimatedMag ? `추정 M ${ev.scientificEstimates[0].estimatedMag}` : (ev.mag?.v ? `규모 M ${ev.mag.v}` : "문헌 진도 추정");
  const mmiText = ev.macroseismic?.maxIntensityMMI?.rawRoman ? ` · MMI ${ev.macroseismic.maxIntensityMMI.rawRoman}` : "";
  const quoteText = ev.primaryText?.originalScript || ev.text || ev.uncertainty || "";

  if (eraEl) eraEl.textContent = eraText;
  if (titleEl) titleEl.textContent = titleText;
  const latVal = (beacon.lat != null) ? beacon.lat : (ev.lat || 0);
  const lonVal = (beacon.lon != null) ? beacon.lon : (ev.lon || 0);
  if (metaEl) metaEl.textContent = `${magText}${mmiText} · ${latVal.toFixed(2)}°N, ${lonVal.toFixed(2)}°E`;
  if (quoteEl) quoteEl.textContent = quoteText ? `"${quoteText.substring(0, 68)}..."` : "";

  let left = screenX + 16;
  if (left + 330 > window.innerWidth) {
    left = Math.max(16, screenX - 336);
  }
  let top = Math.max(80, Math.min(window.innerHeight - 100, screenY));

  tt.style.left = `${left}px`;
  tt.style.top = `${top}px`;
  tt.style.transform = 'translateY(-50%)';
  tt.style.display = 'block';
}

export function hideBeaconTooltip() {
  const tt = document.getElementById('beacon-tooltip');
  if (tt) tt.style.display = 'none';
}

if (typeof window !== 'undefined') {
  window.showBeaconTooltip = showBeaconTooltip;
  window.hideBeaconTooltip = hideBeaconTooltip;
}
