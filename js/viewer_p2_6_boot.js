import * as THREE from './lib/three.module.js';
import { OrbitControls } from './lib/OrbitControls.module.js';
import { CAMERA_STAGES } from './response/GlobalLocalCameraTransition.js';
import { LOCAL_VISUAL_THEMES } from './response/LocalSpatialMapLayer.js';
import { EvacuationExperienceController } from './ui/EvacuationExperienceController.js';
import { KOREA_BENCHMARK_REGIONS } from './response/NationwideKoreaSpatialEngine.js';

const params = new URLSearchParams(window.location.search);
const viewStage = params.get('stage') || 'campus';
const initialTheme = params.get('theme') === 'day' ? 'ARCHITECTURAL_DAY' : 'MONOLITH_NIGHT';
const requestedEventId = params.get('event') || null;
const requestedRegionId = params.get('region') || null;

const container = document.getElementById('canvas-container');
const hudRoot = document.getElementById('hud-root');
const width = window.innerWidth;
const height = window.innerHeight;

const scene = new THREE.Scene();
const initialPalette = LOCAL_VISUAL_THEMES[initialTheme];
scene.background = new THREE.Color(initialPalette.background);
scene.fog = new THREE.FogExp2(initialPalette.fogColor, initialPalette.fogDensity);

const camera = new THREE.PerspectiveCamera(42, width / height, 0.25, 6500);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(width, height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.maxPolarAngle = Math.PI * 0.475;
controls.minPolarAngle = 0.02;
controls.minDistance = 8.0;
controls.maxDistance = 4200.0;
controls.screenSpacePanning = false;
controls.rotateSpeed = 0.65;
controls.zoomSpeed = 0.9;

const rawLat = params.has('lat') ? Number(params.get('lat')) : null;
const rawLon = params.has('lon') ? Number(params.get('lon')) : null;
const safeLat = (rawLat !== null && Number.isFinite(rawLat) && rawLat >= -90 && rawLat <= 90) ? rawLat : null;
const safeLon = (rawLon !== null && Number.isFinite(rawLon) && rawLon >= -180 && rawLon <= 180) ? rawLon : null;

const controller = new EvacuationExperienceController({
  scene,
  localWorldGroup: scene,
  camera,
  renderer,
  controls,
  mountRoot: hudRoot,
  domElement: renderer.domElement,
  initialTheme,
  initialEventId: requestedEventId || null,
  initialRegionId: params.get('region') || null,
  entryMode: params.get('mode') || null,
  lat: safeLat,
  lon: safeLon,
  devMode: params.get('dev') === '1',
  onReturnToGlobe: () => {
    window.location.href = './index.html';
  }
});

if (requestedRegionId && !(requestedRegionId === 'seoul_hanyang' && controller.devMode)) {
  const reg = KOREA_BENCHMARK_REGIONS.find(r => r.id === requestedRegionId);
  if (reg) {
    controller.switchToRegion(reg.lat, reg.lon, { regionId: reg.id, name: reg.name, shortName: reg.shortName });
  }
} else if (viewStage === 'earth') {
  controller.setCameraStage(CAMERA_STAGES.GLOBAL_ORBIT);
} else if (viewStage === 'local4km' || viewStage === 'regional') {
  controller.setCameraStage(CAMERA_STAGES.REGIONAL_APPROACH);
} else if (viewStage === 'bldg') {
  controller.setCameraStage(CAMERA_STAGES.BUILDING_INSPECTION);
} else if (viewStage === 'personal') {
  controller.setCameraStage(CAMERA_STAGES.PERSONAL_LOCATION);
} else if (viewStage === 't67') {
  controller.applyTimelineStep(67);
} else if (viewStage === 't110') {
  controller.applyTimelineStep(110);
} else {
  controller.setCameraStage(CAMERA_STAGES.CAMPUS_OVERVIEW);
}

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (typeof document !== 'undefined' && document.hidden) return;
  controller.update(dt, clock.elapsedTime);
  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  const w = Math.max(1, window.innerWidth);
  const h = Math.max(1, window.innerHeight);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  const nextBaseDpr = Math.min(window.devicePixelRatio || 1, 2);
  controller.baseDpr = nextBaseDpr;
  renderer.setPixelRatio(controller?.localSpatialLayer?.state?.ecoMode ? 1.0 : nextBaseDpr);
  renderer.setSize(w, h);
  if (controller.labelContainer) {
    controller.localSpatialLayer.updateOverlayLabels(camera, controller.labelContainer, { force: true });
  }
});

window.__evacController = controller;
window.__setCameraStage = stage => controller.setCameraStage(stage);
window.__applyTimelineStep = t => controller.applyTimelineStep(t);
window.__switchFacilityPackage = id => controller.switchFacilityPackage(id);
window.__toggleHazardPolygon = f => controller.toggleHazardAvoidPolygon(f);
window.__setVisualTheme = t => controller.applyVisualTheme(t);
window.__setRouteProgress = (t, f) => controller.setRouteProgress(t, f);
window.__controls = controls;
window.__groundDataManager = controller.uiAdapter.groundDataManager;
window.__getFieldChecklistSummary = () => controller.uiAdapter.getFieldChecklistSummary();
window.__localSpatialLayer = controller.localSpatialLayer;
window.__getSpatialDiagnostics = () => controller.getDiagnostics();
