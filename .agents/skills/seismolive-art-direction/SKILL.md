---
name: seismolive-art-direction
description: Expert guidance on SEISMOLIVE v4.0's aesthetic vision, spatial hierarchy, lighting, nocturnal monolith palette, archival Korean typography, and strict anti-game-VFX standards. Use whenever designing, reviewing, or rendering 3D scenes, camera compositions, atmospheric effects, or historical text overlays.
---

# SEISMOLIVE Art Direction Skill

This skill enforces the visual language and artistic principles of SEISMOLIVE v4.0. It guides the creation of a sublime, contemplative audiovisual media artwork rather than a technical simulator or game-like visualization.

---

## 1. Spatial Hierarchy & Composition (공간 구성과 시각적 위계)

SEISMOLIVE establishes a continuous three-dimensional world where planet curvature, mountain topography, and ocean bathymetry exist within a single perspective.

### The 3-Tier Visual Hierarchy
1. **Primary Ground (1차 위계 — 심연과 지구 질량체)**:
   - The dark, curved planetary mass and the nocturnal horizon establish the primary world.
   - Deep void and ocean darkness (`#020617` ~ `#030712`) dominate at least 70% of the canvas.
2. **Secondary Feature (2차 위계 — 지형 사면과 단층 파쇄선)**:
   - Natural topography (Taebaek mountain ridges, continental shelves, deep sea trenches) revealed through cold, grazing celestial light.
   - The seismic rupture is expressed as an ultra-precise, razor-thin fault line (`Pure White #ffffff` with faint `Ice Cyan #38bdf8` atmospheric halo), NOT an expanding cartoon ring.
3. **Tertiary Resonance (3차 위계 — 대기적 사료 타이포그래피)**:
   - One or two pure Korean historical words hovering delicately in the mountain mist or above the coastal fault, perfectly integrated into the spatial air perspective.

---

## 2. Natural Materials & Lighting (자연스러운 재질 및 조명)

### G1 Controlled Baseline Lighting vs Production Event Lighting
- **G1 Baseline Stage**: Uses an identical, controlled standard lighting setup across all geographic regions (Korean East Coast and Japan Trench) to evaluate terrain silhouette and atmospheric scattering fairly without event bias.
- **Event-Specific Celestial Stage**: After reliable event time data is confirmed, astronomical solar/lunar position calculations are applied in a later phase.

```javascript
// G1 Controlled Baseline Lighting (Identical across regions)
const g1DirectionalLight = new THREE.DirectionalLight(0xdbeafe, 1.6);
g1DirectionalLight.position.set(-30, 40, -25); // Standardized elevation & azimuth
scene.add(g1DirectionalLight);

const g1AmbientLight = new THREE.AmbientLight(0x08101e, 0.7);
scene.add(g1AmbientLight);

// Production Event Moonlight Recipe (For nocturnal event phases)
// const moonLight = new THREE.DirectionalLight(0x94b8e0, 1.8);
// const rimLight = new THREE.DirectionalLight(0xc8e0ff, 2.2);
```

### Material Standards
- **Land Topography**: High roughness (`0.85 ~ 0.95`), zero metalness, subtle normal perturbation derived from DEM elevation gradients.
- **Ocean / Marine Waters**: Smooth roughness (`0.05 ~ 0.15`), dark albedo, strong Fresnel glancing reflection of horizon star/moonlight.
- **Atmosphere**: Two-layer physical scattering gradient (dense cool cyan mist near terrain valleys fading to deep void indigo at altitude).

---

## 3. Spatial Archival Typography (사료 타이포그래피)

### The 4 Absolute Typography Rules
1. **No Hanja (漢字) & No 3D Steles**: Chinese characters and 3D stone steles are permanently banned. They turn the contemplative landscape into a cluttered graveyard or museum exhibit.
2. **Pure Korean Archival Essence**: Extract 1 or 2 essential historical action verbs or natural phenomena from Korean primary records (Veritable Records of the Joseon Dynasty, Seungjeongwon Ilgi):
   - 1681 Yangyang Offshore: `울다` (*"산이 울다"*), `퇴조` (*"조수가 밀려가는 듯하다"*).
   - 2016 Gyeongju Inland: `흔들리다` (*"천지가 흔들리다"*).
3. **Canvas Sprite Offscreen Rendering**:
   ```javascript
   function createAtmosphericKoreanSprite(text, fontSize = 80, color = 'rgba(125, 211, 252, 0.65)') {
     const cvs = document.createElement('canvas');
     cvs.width = 512;
     cvs.height = 256;
     const ctx = cvs.getContext('2d');
     ctx.font = `300 ${fontSize}px "Noto Serif KR", serif`;
     ctx.fillStyle = color;
     ctx.textAlign = 'center';
     ctx.textBaseline = 'middle';
     ctx.fillText(text, 256, 128);
     
     const texture = new THREE.CanvasTexture(cvs);
     const mat = new THREE.SpriteMaterial({
       map: texture,
       transparent: true,
       blending: THREE.AdditiveBlending,
       depthWrite: false,
       depthTest: false // Prevents unsightly clipping behind polygon edges
     });
     const sprite = new THREE.Sprite(mat);
     sprite.renderOrder = 999;
     return sprite;
   }
   ```
4. **Spatial Placement**: Anchor text sprites organically along ridge silhouettes or hovering above the coastline at low opacity (0.4 ~ 0.7), echoing the cold, quiet breath of historical memory.

---

## 4. Anti-Game VFX Verification Checklist

Before generating or approving any 3D scene, run this subtraction check:

| Prohibited Element (Game VFX) | Approved SEISMOLIVE Equivalent | Status |
|:---|:---|:---:|
| Giant semi-transparent spherical domes (P/S wave shells) | Subtle ground-surface shader displacement & luminance waves | **BANNED** |
| Vertical glowing laser cylinders & light columns | Razor-sharp fault seam following mountain contours | **BANNED** |
| 3D stone steles & floating cards | Atmospheric offscreen Korean text sprites | **BANNED** |
| Rainbow / Jet colormap heatmaps | Monochromatic silver-blue, pure white, and pale cyan | **BANNED** |
| Sci-Fi HUD digital cards, dials, compasses | Zero on-screen clutter; text lives in 3D air | **BANNED** |

---

## 5. Still Frame Quality Standards (정지 화면 완성도)

A scene is NOT acceptable if it only looks good in motion. Test every iteration with a frozen 1920×1080 screenshot:
- Does the terrain silhouette against the horizon possess majestic gravity?
- Is there convincing atmospheric depth haze between near ridges and distant peaks?
- Is the lighting directionally consistent with celestial geometry?
- Could this still image be hung in an art gallery as a standalone fine-art print?
