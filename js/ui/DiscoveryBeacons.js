// ============================================================================
// SEISMOLIVE v4.0 — Interactive 3D Discovery Beacons
// Sublime, non-game-VFX epicenter beacons on continuous WGS84 globe
// ============================================================================

import { getEventCoords, getAllLocalizedEvents } from '../data/eventCatalogHelpers.js';
import { geodeticToThree, computeGlobeCenterAndPolarAxis } from '../3d/geodeticEllipsoidCoord.js';

export class DiscoveryNode {
  constructor(eventData, lat0, lon0) {
    const THREE = window.THREE;
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

    // Core marker
    const coreGeo = new THREE.SphereGeometry(0.018, 12, 12);
    const coreMat = new THREE.MeshBasicMaterial({ color: coreColor, depthTest: false, transparent: true });
    this.coreMesh = new THREE.Mesh(coreGeo, coreMat);
    this.coreMesh.renderOrder = 12;
    this.group.add(this.coreMesh);

    // Pulse ring
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

    // Raycasting hit sphere
    const hitGeo = new THREE.SphereGeometry(0.09, 8, 8);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    this.hitMesh = new THREE.Mesh(hitGeo, hitMat);
    this.hitMesh.userData = { beacon: this };
    this.group.add(this.hitMesh);

    this.phase = Math.random() * Math.PI * 2.0;
    this.updatePosition(lat0, lon0);
  }

  updatePosition(lat0, lon0) {
    const THREE = window.THREE;
    if (this.lat != null && this.lon != null) {
      const [x, y, z] = geodeticToThree(this.lat, this.lon, 0.015, lat0, lon0, 0.0);
      this.group.position.set(x, y, z);

      // If this node represents the active focal event, hide its pulse ring to prevent artificial circular VFX
      const isFocalEpicenter = (Math.abs(x) < 0.02 && Math.abs(z) < 0.02);
      if (isFocalEpicenter) {
        this.ringMesh.visible = false;
        this.coreMesh.visible = false;
      } else {
        this.ringMesh.visible = true;
        this.coreMesh.visible = true;
      }

      const globeCenter = computeGlobeCenterAndPolarAxis(lat0, lon0).centerThree;
      const normal = new THREE.Vector3(x - globeCenter[0], y - globeCenter[1], z - globeCenter[2]).normalize();
      this.ringMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    }
  }

  update(time) {
    const pulse = Math.sin(time * 2.2 + this.phase);
    const s = 1.0 + 0.25 * pulse;
    this.ringMesh.scale.set(s, s, 1.0);
    this.ringMesh.material.opacity = 0.55 + 0.35 * pulse;
  }
}

export function initDiscoveryNodes(lat0, lon0, scene = null, discoveryNodesList = null) {
  const s = scene || (typeof window !== 'undefined' ? window.scene : null);
  const list = discoveryNodesList || (typeof window !== 'undefined' ? window.discoveryNodes : null);
  if (!s || !list) return;

  list.forEach(n => {
    s.remove(n.group);
  });
  list.length = 0;
  const allEvents = getAllLocalizedEvents();
  // Include all baseline historical/instrumental benchmarks plus major global events (M>=5.5)
  const beaconEvents = allEvents.filter(ev => {
    if (!ev.id?.includes('usgs')) return true;
    const m = ev.mag?.v ?? ev.mag ?? 0;
    return m >= 5.5;
  });
  beaconEvents.forEach(ev => {
    const node = new DiscoveryNode(ev, lat0, lon0);
    s.add(node.group);
    list.push(node);
  });
}

export function updateDiscoveryNodePositions(lat0, lon0, discoveryNodesList = null) {
  const list = discoveryNodesList || (typeof window !== 'undefined' ? window.discoveryNodes : null);
  if (list) {
    list.forEach(n => n.updatePosition(lat0, lon0));
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
