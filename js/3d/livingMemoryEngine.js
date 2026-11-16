// ============================================================================
// SEISMOLIVE v4.0 — Pillar 3: Living Memory & Archival Korean Typography Engine
// Module: js/3d/livingMemoryEngine.js
//
// Responsibilities (Stage R2):
//   - Canvas2D Editorial Serif Typography Rasterizer (renderEditorialTypography)
//   - 4 Kinetic Archetype Entity Builders (RESONANCE, FRACTURE, RECEDE, EXPOSE)
//   - Terrain-Aware Spatial Spawner (TerrainAwareSpawner)
//   - 6-Stage Atmospheric Lifecycle Updater (updateEntitiesLifecycle, LivingMemoryEngine)
//   - Re-exports pure semantic parser symbols from ../data/ArchivalSemanticParser.js
// ============================================================================

import {
  EVIDENCE_CLASSES,
  LIFECYCLE_STAGES,
  ARCHIVAL_HANJA_LEXICON_DB,
  HANJA_TO_HANGUL_MAP,
  extractVerbatimChronicleClauses,
  distillArchivalExpression,
  sanitizeArchivalToken,
  ArchivalSemanticParser
} from '../data/ArchivalSemanticParser.js';

export {
  EVIDENCE_CLASSES,
  LIFECYCLE_STAGES,
  ARCHIVAL_HANJA_LEXICON_DB,
  HANJA_TO_HANGUL_MAP,
  extractVerbatimChronicleClauses,
  distillArchivalExpression,
  sanitizeArchivalToken,
  ArchivalSemanticParser
};

function lerpScalar(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Editorial Typography Canvas Rasterizer
 * Dual-Pass Soft Ambient Dark Cushion & Crystalline Serif Glyphs
 * Automatically scales font size and letter spacing for multi-word chronicle expressions
 */
export function renderEditorialTypography(ctx, canvas, text, formationProg, visualOpts = {}, strokeJitterPx = 0.0, enableDarkCushion = true) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Pure Korean Archival Typography Enforcement (Mandatory Rule 4), with optional native mode for global benchmarks
  const rawStr = String(text || '').trim();
  const cleanText = visualOpts.allowNativeScript
    ? (rawStr || '대지가 진동하다')
    : (rawStr.replace(/[\u4e00-\u9fff\u3040-\u30ff]/g, '').replace(/\s+/g, ' ').trim() || '대지가 진동하다');

  const cX = canvas.width / 2;
  const cY = canvas.height / 2;
  const baseFontSize = visualOpts.fontSize || 82;
  const fontFamily = visualOpts.fontFamily || '"Noto Serif KR", "Nanum Myeongjo", Batang, serif';
  const colorSecondary = visualOpts.colorSecondary || '#c8e8fc';
  const haloColor = visualOpts.haloColor || 'rgba(140, 205, 255, 0.40)';

  let fontSize = baseFontSize;
  let letterSpacing = '0.18em';
  const charCount = cleanText.length;

  if (canvas.width <= 320 && charCount <= 2) {
    fontSize = Math.min(baseFontSize, Math.round(canvas.width * 0.40));
    letterSpacing = '0.02em';
  } else if (charCount <= 4) {
    fontSize = baseFontSize;
    letterSpacing = '0.20em';
  } else if (charCount <= 8) {
    fontSize = Math.round(baseFontSize * 0.88);
    letterSpacing = '0.12em';
  } else if (charCount <= 11) {
    fontSize = Math.round(baseFontSize * 0.78);
    letterSpacing = '0.08em';
  } else {
    fontSize = Math.round(baseFontSize * 0.70);
    letterSpacing = '0.05em';
  }

  if ('letterSpacing' in ctx) {
    ctx.letterSpacing = letterSpacing;
  }
  ctx.font = `600 ${fontSize}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (typeof ctx.measureText === 'function' && canvas.width > 320) {
    const measuredW = ctx.measureText(cleanText).width || 0;
    const maxAllowedW = canvas.width * 0.86;
    if (measuredW > maxAllowedW && measuredW > 0) {
      fontSize = Math.max(36, Math.floor(fontSize * (maxAllowedW / measuredW)));
      ctx.font = `600 ${fontSize}px ${fontFamily}`;
    }
  }
  canvas.finalFontSize = fontSize;

  // PASS 1: Soft Ambient Dark Cushion (Zero harsh black outlines, no boxes)
  if (enableDarkCushion && visualOpts.enableDarkCushion !== false) {
    ctx.save();
    ctx.shadowColor = 'rgba(2, 5, 12, 0.78)';
    ctx.shadowBlur = Math.round(fontSize * 0.46);
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 1;
    ctx.fillStyle = 'rgba(2, 5, 12, 0.62)';
    ctx.fillText(cleanText, cX + strokeJitterPx, cY);
    ctx.restore();
  }

  // PASS 2: Crystalline Editorial Serif with subtle Hanji Ivory luminous taper
  ctx.save();
  ctx.shadowColor = haloColor;
  ctx.shadowBlur = Math.round(fontSize * 0.18);
  const grad = ctx.createLinearGradient(0, cY - fontSize * 0.46, 0, cY + fontSize * 0.46);
  grad.addColorStop(0.0, '#ffffff');
  grad.addColorStop(0.55, '#eae4d5');
  grad.addColorStop(1.0, colorSecondary);
  ctx.fillStyle = grad;
  ctx.fillText(cleanText, cX + strokeJitterPx, cY);
  ctx.restore();

  // PASS 3: Fixed-Center Alpha Symmetric Wipe
  if (formationProg < 1.0) {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-in';
    const halfSpan = (canvas.width * 0.52) * Math.min(1.0, formationProg * 1.15);
    const feather = canvas.width * 0.10;
    const x0 = Math.max(0, cX - halfSpan);
    const x1 = Math.min(canvas.width, cX + halfSpan);

    const wipeGrad = ctx.createLinearGradient(0, 0, canvas.width, 0);
    wipeGrad.addColorStop(0.0, 'rgba(255, 255, 255, 0.0)');
    const p0_start = Math.max(0.0, (x0 - feather) / canvas.width);
    const p0_end = Math.max(0.0, Math.min(1.0, x0 / canvas.width));
    const p1_start = Math.max(0.0, Math.min(1.0, x1 / canvas.width));
    const p1_end = Math.min(1.0, (x1 + feather) / canvas.width);

    if (p0_start > 0.0) wipeGrad.addColorStop(p0_start, 'rgba(255, 255, 255, 0.0)');
    wipeGrad.addColorStop(p0_end, 'rgba(255, 255, 255, 1.0)');
    wipeGrad.addColorStop(p1_start, 'rgba(255, 255, 255, 1.0)');
    if (p1_end < 1.0) wipeGrad.addColorStop(p1_end, 'rgba(255, 255, 255, 0.0)');
    wipeGrad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');

    ctx.fillStyle = wipeGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }
}

/**
 * Generate soft radial atmospheric halo texture
 */
export function createRadialHaloTexture(arg1, arg2) {
  const THREE_INST = (arg1 && arg1.CanvasTexture) ? arg1 : (typeof window !== 'undefined' ? window.THREE : globalThis.THREE);
  const haloColorStr = typeof arg1 === 'string' ? arg1 : (arg2 || 'rgba(140, 205, 255, 0.35)');
  if (typeof document === 'undefined') return null;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const half = size / 2;
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0.0, haloColorStr);
  grad.addColorStop(0.35, haloColorStr.replace(/[\d\.]+\)$/, '0.15)'));
  grad.addColorStop(0.70, haloColorStr.replace(/[\d\.]+\)$/, '0.04)'));
  grad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE_INST.CanvasTexture(canvas);
  tex.minFilter = THREE_INST.LinearFilter;
  tex.magFilter = THREE_INST.LinearFilter;
  return tex;
}

/**
 * Kinetic Archetype 1: RESONANCE (Bedrock Vibration & Harmonic Tremor)
 */
export function createResonanceEntity(arg1, arg2, arg3, arg4) {
  let THREE_INST, unitDef, cand, enableDarkCushion;
  if (arg1 && arg1.Group) {
    THREE_INST = arg1; unitDef = arg2; cand = arg3; enableDarkCushion = arg4 !== false;
  } else {
    THREE_INST = typeof window !== 'undefined' ? window.THREE : globalThis.THREE;
    unitDef = arg1; cand = arg2; enableDarkCushion = arg3 !== false;
  }
  const group = new THREE_INST.Group();

  const haloTex = createRadialHaloTexture(THREE_INST, unitDef.visual.haloColor);
  const haloMat = new THREE_INST.SpriteMaterial({
    map: haloTex,
    transparent: true,
    opacity: 0.0,
    blending: THREE_INST.AdditiveBlending,
    depthWrite: false,
    depthTest: true
  });
  const haloSprite = new THREE_INST.Sprite(haloMat);
  haloSprite.scale.set(unitDef.visual.spriteW * 1.35, unitDef.visual.spriteH * 2.2, 1.0);
  haloSprite.renderOrder = 95;
  group.add(haloSprite);

  const canvas = document.createElement('canvas');
  canvas.width = unitDef.visual.canvasW;
  canvas.height = unitDef.visual.canvasH;
  const ctx = canvas.getContext('2d');
  const texture = new THREE_INST.CanvasTexture(canvas);
  texture.generateMipmaps = true;
  texture.minFilter = THREE_INST.LinearMipmapLinearFilter;
  texture.magFilter = THREE_INST.LinearFilter;

  function renderCanvas(formationProg, strokeJitterPx = 0.0) {
    const cushionEnabled = typeof globalThis !== 'undefined' && typeof globalThis.__ENABLE_DARK_CUSHION__ === 'boolean'
      ? globalThis.__ENABLE_DARK_CUSHION__
      : enableDarkCushion;
    renderEditorialTypography(ctx, canvas, unitDef.semantic.displayText, formationProg, unitDef.visual, strokeJitterPx, cushionEnabled);
    texture.needsUpdate = true;
    if (group.userData) {
      group.userData.finalFontSize = canvas.finalFontSize || unitDef.visual?.fontSize || 78;
    }
  }

  renderCanvas(0.0, 0.0);

  const spriteMat = new THREE_INST.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0.0,
    blending: THREE_INST.NormalBlending,
    depthWrite: false,
    depthTest: true
  });
  const sprite = new THREE_INST.Sprite(spriteMat);
  sprite.scale.set(unitDef.visual.spriteW, unitDef.visual.spriteH, 1.0);
  sprite.renderOrder = 100;
  group.add(sprite);

  const finalY = (cand.groundY || 0.0) + Math.max(0.010, unitDef.spatial?.elevationOffset || 0.020);
  group.position.set(cand.worldX, finalY, cand.worldZ);

  group.userData = {
    unitDef: unitDef,
    cand: cand,
    sprite: sprite,
    spriteMat: spriteMat,
    haloSprite: haloSprite,
    haloMat: haloMat,
    mainMesh: sprite,
    renderCanvas: renderCanvas,
    finalFontSize: canvas.finalFontSize || unitDef.visual?.fontSize || 78,
    canvasH: canvas.height,
    canvasW: canvas.width,
    t_activation: cand.t_activation,
    lifecycleState: 'LATENT',
    currentOpacity: 0.0,
    collisionStatus: 'CLEAR',
    eventId: unitDef.eventId || '',
    sourceId: unitDef.sourceId || '',
    token: unitDef.token || '',
    displayText: unitDef.semantic?.displayText || unitDef.token || '',
    semanticLabel: unitDef.semantic?.semanticLabel || '',
    sourceCitation: unitDef.editorialRationale || unitDef.source?.sourceReference || '',
    worldPos: { x: cand.worldX, y: finalY, z: cand.worldZ },
    terrainCoord: { normU: (cand.worldX / 0.72) + 0.5, normV: 0.5 - (cand.worldZ / 0.576), groundY: cand.groundY, elevation: cand.elevation }
  };

  return group;
}

/**
 * Kinetic Archetype 2: FRACTURE (Rock Shatter & Slope Tumbling)
 */
export function createFractureEntity(arg1, arg2, arg3, arg4) {
  let THREE_INST, unitDef, cand, enableDarkCushion;
  if (arg1 && arg1.Group) {
    THREE_INST = arg1; unitDef = arg2; cand = arg3; enableDarkCushion = arg4 !== false;
  } else {
    THREE_INST = typeof window !== 'undefined' ? window.THREE : globalThis.THREE;
    unitDef = arg1; cand = arg2; enableDarkCushion = arg3 !== false;
  }
  const group = new THREE_INST.Group();

  const haloTex = createRadialHaloTexture(THREE_INST, unitDef.visual.haloColor);
  const haloMat = new THREE_INST.SpriteMaterial({
    map: haloTex,
    transparent: true,
    opacity: 0.0,
    blending: THREE_INST.AdditiveBlending,
    depthWrite: false,
    depthTest: true
  });
  const haloSprite = new THREE_INST.Sprite(haloMat);
  haloSprite.scale.set(unitDef.visual.spriteW * 1.35, unitDef.visual.spriteH * 2.2, 1.0);
  haloSprite.renderOrder = 95;
  group.add(haloSprite);

  const rawText = String(unitDef.semantic.displayText || unitDef.token || '거암이 붕괴되고').trim();
  const hasSpaces = rawText.includes(' ');
  const tokenChunks = hasSpaces ? rawText.split(/\s+/).filter(Boolean) : rawText.split('');
  const chunkWeights = tokenChunks.map(tk => Math.max(1.0, tk.length * 0.85));
  const gapWeight = hasSpaces ? 0.45 : 0.0;
  const totalWeight = Math.max(1.0, chunkWeights.reduce((acc, w) => acc + w, 0) + Math.max(0, tokenChunks.length - 1) * gapWeight);
  const effectiveSpanW = Math.max(unitDef.visual.spriteW || 0.22, Math.min(0.32, totalWeight * 0.022));
  const unitAdvance = effectiveSpanW / totalWeight;
  const chunkBaseH = unitDef.visual.spriteH || 0.062;
  const chunks = [];

  const gradX = cand.gradX || 0;
  const gradZ = cand.gradZ || 0;
  const gradMag = Math.max(0.001, Math.sqrt(gradX * gradX + gradZ * gradZ));
  const slopeDirX = -gradX / gradMag;
  const slopeDirZ = -gradZ / gradMag;

  let cursorWeight = -totalWeight * 0.5;
  const chunkCount = Math.max(1, tokenChunks.length);

  tokenChunks.forEach((gl, glyphIdx) => {
    const w = chunkWeights[glyphIdx];
    const centerWeight = cursorWeight + w * 0.5;
    cursorWeight += w + gapWeight;

    const cW = gl.length > 2 ? 512 : 256;
    const cH = 256;
    const c = document.createElement('canvas');
    c.width = cW;
    c.height = cH;
    const ctx = c.getContext('2d');
    const tex = new THREE_INST.CanvasTexture(c);
    tex.generateMipmaps = true;
    tex.minFilter = THREE_INST.LinearMipmapLinearFilter;
    tex.magFilter = THREE_INST.LinearFilter;

    function renderChunk(prog) {
      const cushionEnabled = typeof globalThis !== 'undefined' && typeof globalThis.__ENABLE_DARK_CUSHION__ === 'boolean'
        ? globalThis.__ENABLE_DARK_CUSHION__
        : enableDarkCushion;
      renderEditorialTypography(ctx, c, gl, prog, unitDef.visual, 0.0, cushionEnabled);
      tex.needsUpdate = true;
    }

    renderChunk(1.0);

    const sMat = new THREE_INST.SpriteMaterial({
      map: tex,
      transparent: true,
      opacity: 0.0,
      blending: THREE_INST.NormalBlending,
      depthWrite: false,
      depthTest: true
    });
    const sp = new THREE_INST.Sprite(sMat);
    const aspect = cW / cH;
    const spH = Math.max(0.038, Math.min(chunkBaseH, unitAdvance * 2.1));
    sp.scale.set(spH * aspect, spH, 1.0);
    sp.renderOrder = 100;
    const baseOffsetX = centerWeight * unitAdvance;
    sp.position.set(baseOffsetX, 0.0, 0.0);
    group.add(sp);

    const relIdx = glyphIdx - (chunkCount - 1) * 0.5;
    const spreadX = relIdx * 0.0045;
    const fallVelY = -0.022 - Math.abs(relIdx) * 0.0025;
    const spreadZ = ((glyphIdx % 2 === 0) ? -1 : 1) * (0.003 + glyphIdx * 0.0015);

    chunks.push({
      glyph: gl,
      sprite: sp,
      mat: sMat,
      baseOffsetX: baseOffsetX,
      renderChunk: renderChunk,
      spreadX: spreadX,
      fallVelY: fallVelY,
      spreadZ: spreadZ,
      gradDirX: slopeDirX,
      gradDirZ: slopeDirZ,
      rotSpeed: ((glyphIdx % 2 === 0) ? 1 : -1) * (0.75 + glyphIdx * 0.18)
    });
  });

  const finalY = (cand.groundY || 0.0) + Math.max(0.010, unitDef.spatial?.elevationOffset || 0.020);
  group.position.set(cand.worldX, finalY, cand.worldZ);

  group.userData = {
    unitDef: unitDef,
    cand: cand,
    chunks: chunks,
    haloSprite: haloSprite,
    haloMat: haloMat,
    mainMesh: chunks[Math.floor(chunks.length / 2)]?.sprite || group,
    chunkCanvasSize: 256,
    chunkFontSize: Math.min(unitDef.visual?.fontSize || 78, Math.round(256 * 0.40)),
    t_activation: cand.t_activation,
    lifecycleState: 'LATENT',
    currentOpacity: 0.0,
    collisionStatus: 'CLEAR',
    eventId: unitDef.eventId || '',
    sourceId: unitDef.sourceId || '',
    token: unitDef.token || '',
    displayText: unitDef.semantic?.displayText || unitDef.token || '',
    semanticLabel: unitDef.semantic?.semanticLabel || '',
    sourceCitation: unitDef.editorialRationale || unitDef.source?.sourceReference || '',
    worldPos: { x: cand.worldX, y: finalY, z: cand.worldZ },
    terrainCoord: { normU: (cand.worldX / 0.72) + 0.5, normV: 0.5 - (cand.worldZ / 0.576), groundY: cand.groundY, elevation: cand.elevation }
  };

  return group;
}

/**
 * Kinetic Archetype 3: RECEDE (Seaward Water Retreat & Void)
 */
export function createRecedeEntity(arg1, arg2, arg3, arg4) {
  let THREE_INST, unitDef, cand, enableDarkCushion;
  if (arg1 && arg1.Group) {
    THREE_INST = arg1; unitDef = arg2; cand = arg3; enableDarkCushion = arg4 !== false;
  } else {
    THREE_INST = typeof window !== 'undefined' ? window.THREE : globalThis.THREE;
    unitDef = arg1; cand = arg2; enableDarkCushion = arg3 !== false;
  }
  const group = new THREE_INST.Group();

  const haloTex = createRadialHaloTexture(THREE_INST, unitDef.visual.haloColor);
  const haloMat = new THREE_INST.SpriteMaterial({
    map: haloTex,
    transparent: true,
    opacity: 0.0,
    blending: THREE_INST.AdditiveBlending,
    depthWrite: false,
    depthTest: true
  });
  const haloSprite = new THREE_INST.Sprite(haloMat);
  haloSprite.scale.set(unitDef.visual.spriteW * 1.35, unitDef.visual.spriteH * 2.2, 1.0);
  haloSprite.renderOrder = 95;
  group.add(haloSprite);

  const canvas = document.createElement('canvas');
  canvas.width = unitDef.visual.canvasW;
  canvas.height = unitDef.visual.canvasH;
  const ctx = canvas.getContext('2d');
  const texture = new THREE_INST.CanvasTexture(canvas);
  texture.generateMipmaps = true;
  texture.minFilter = THREE_INST.LinearMipmapLinearFilter;
  texture.magFilter = THREE_INST.LinearFilter;

  function renderCanvas(formationProg) {
    const cushionEnabled = typeof globalThis !== 'undefined' && typeof globalThis.__ENABLE_DARK_CUSHION__ === 'boolean'
      ? globalThis.__ENABLE_DARK_CUSHION__
      : enableDarkCushion;
    renderEditorialTypography(ctx, canvas, unitDef.semantic.displayText, formationProg, unitDef.visual, 0.0, cushionEnabled);
    texture.needsUpdate = true;
    if (group.userData) {
      group.userData.finalFontSize = canvas.finalFontSize || unitDef.visual?.fontSize || 78;
    }
  }

  renderCanvas(0.0);

  const spriteMat = new THREE_INST.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0.0,
    blending: THREE_INST.NormalBlending,
    depthWrite: false,
    depthTest: true
  });
  const sprite = new THREE_INST.Sprite(spriteMat);
  sprite.scale.set(unitDef.visual.spriteW, unitDef.visual.spriteH, 1.0);
  sprite.renderOrder = 100;
  group.add(sprite);

  const finalRecedeY = (cand.groundY || 0.0) + Math.max(0.010, unitDef.spatial?.elevationOffset || 0.020);
  group.position.set(cand.worldX, finalRecedeY, cand.worldZ);

  group.userData = {
    unitDef: unitDef,
    cand: cand,
    sprite: sprite,
    spriteMat: spriteMat,
    haloSprite: haloSprite,
    haloMat: haloMat,
    mainMesh: sprite,
    renderCanvas: renderCanvas,
    finalFontSize: canvas.finalFontSize || unitDef.visual?.fontSize || 78,
    canvasH: canvas.height,
    canvasW: canvas.width,
    t_activation: cand.t_activation,
    lifecycleState: 'LATENT',
    currentOpacity: 0.0,
    collisionStatus: 'CLEAR',
    eventId: unitDef.eventId || '',
    sourceId: unitDef.sourceId || '',
    token: unitDef.token || '',
    displayText: unitDef.semantic?.displayText || unitDef.token || '',
    semanticLabel: unitDef.semantic?.semanticLabel || '',
    sourceCitation: unitDef.editorialRationale || unitDef.source?.sourceReference || '',
    worldPos: { x: cand.worldX, y: finalRecedeY, z: cand.worldZ },
    terrainCoord: { normU: (cand.worldX / 0.72) + 0.5, normV: 0.5 - (cand.worldZ / 0.576), groundY: cand.groundY, elevation: cand.elevation }
  };

  return group;
}

/**
 * Kinetic Archetype 4: EXPOSE (Upright Bathymetric Billboard / Sediment Venting)
 */
export function createExposeEntity(arg1, arg2, arg3, arg4) {
  let THREE_INST, unitDef, cand, enableDarkCushion;
  if (arg1 && arg1.Group) {
    THREE_INST = arg1; unitDef = arg2; cand = arg3; enableDarkCushion = arg4 !== false;
  } else {
    THREE_INST = typeof window !== 'undefined' ? window.THREE : globalThis.THREE;
    unitDef = arg1; cand = arg2; enableDarkCushion = arg3 !== false;
  }
  const group = new THREE_INST.Group();

  const haloTex = createRadialHaloTexture(THREE_INST, unitDef.visual.haloColor);
  const haloMat = new THREE_INST.SpriteMaterial({
    map: haloTex,
    transparent: true,
    opacity: 0.0,
    blending: THREE_INST.AdditiveBlending,
    depthWrite: false,
    depthTest: true
  });
  const haloSprite = new THREE_INST.Sprite(haloMat);
  haloSprite.scale.set(unitDef.visual.spriteW * 1.35, unitDef.visual.spriteH * 2.2, 1.0);
  haloSprite.renderOrder = 95;
  group.add(haloSprite);

  const canvas = document.createElement('canvas');
  canvas.width = unitDef.visual.canvasW;
  canvas.height = unitDef.visual.canvasH;
  const ctx = canvas.getContext('2d');
  const texture = new THREE_INST.CanvasTexture(canvas);
  texture.generateMipmaps = true;
  texture.minFilter = THREE_INST.LinearMipmapLinearFilter;
  texture.magFilter = THREE_INST.LinearFilter;

  function renderCanvas(formationProg) {
    const cushionEnabled = typeof globalThis !== 'undefined' && typeof globalThis.__ENABLE_DARK_CUSHION__ === 'boolean'
      ? globalThis.__ENABLE_DARK_CUSHION__
      : enableDarkCushion;
    renderEditorialTypography(ctx, canvas, unitDef.semantic.displayText, formationProg, unitDef.visual, 0.0, cushionEnabled);
    texture.needsUpdate = true;
    if (group.userData) {
      group.userData.finalFontSize = canvas.finalFontSize || unitDef.visual?.fontSize || 78;
    }
  }

  renderCanvas(0.0);

  const spriteMat = new THREE_INST.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0.0,
    blending: THREE_INST.NormalBlending,
    depthWrite: false,
    depthTest: true
  });
  const sprite = new THREE_INST.Sprite(spriteMat);
  sprite.scale.set(unitDef.visual.spriteW, unitDef.visual.spriteH, 1.0);
  sprite.renderOrder = 100;
  group.add(sprite);

  const finalY = (cand.groundY || 0.0) + Math.max(0.010, unitDef.spatial?.elevationOffset || 0.020);
  group.position.set(cand.worldX, finalY, cand.worldZ);

  group.userData = {
    unitDef: unitDef,
    cand: cand,
    sprite: sprite,
    spriteMat: spriteMat,
    haloSprite: haloSprite,
    haloMat: haloMat,
    mainMesh: sprite,
    renderCanvas: renderCanvas,
    finalFontSize: canvas.finalFontSize || unitDef.visual?.fontSize || 78,
    canvasH: canvas.height,
    canvasW: canvas.width,
    t_activation: cand.t_activation,
    lifecycleState: 'LATENT',
    currentOpacity: 0.0,
    collisionStatus: 'CLEAR',
    eventId: unitDef.eventId || '',
    sourceId: unitDef.sourceId || '',
    token: unitDef.token || '',
    displayText: unitDef.semantic?.displayText || unitDef.token || '',
    semanticLabel: unitDef.semantic?.semanticLabel || '',
    sourceCitation: unitDef.editorialRationale || unitDef.source?.sourceReference || '',
    worldPos: { x: cand.worldX, y: finalY, z: cand.worldZ },
    terrainCoord: { normU: (cand.worldX / 0.72) + 0.5, normV: 0.5 - (cand.worldZ / 0.576), groundY: cand.groundY, elevation: cand.elevation }
  };

  return group;
}

/**
 * Unified Terrain-Aware Spatial Spawner
 * Supports both standalone function lookups `(unitDef, parsedEvent, lookupFn)`
 * and regional/global exhibition context options `{ isRegionalActive, getTerrainMetricsAt, physicalSizeUnits }`.
 */
export class TerrainAwareSpawner {
  constructor(candidateCache = []) {
    this.candidateCache = candidateCache;
  }

  resolveCandidate(unitDef, parsedEvent, optionsOrLookup = null) {
    const isLookupFn = typeof optionsOrLookup === 'function';
    const opts = isLookupFn ? {} : (optionsOrLookup || {});
    const terrainMetricsLookup = isLookupFn ? optionsOrLookup : (opts.getTerrainMetricsAt || null);
    const isRegionalActive = opts.isRegionalActive !== undefined ? Boolean(opts.isRegionalActive) : true;
    const physW = opts.physicalSizeUnits?.x || 1.3142;
    const physH = opts.physicalSizeUnits?.y || 0.6634;

    const unitIndex = parsedEvent?.semanticUnits ? parsedEvent.semanticUnits.indexOf(unitDef) : 0;
    const totalUnits = parsedEvent?.semanticUnits?.length || 1;
    const spreadOffset = (unitIndex >= 0 && totalUnits > 1)
      ? (unitIndex - (totalUnits - 1) * 0.5) * 0.055
      : 0.0;

    const demCoverageStatus = isRegionalActive
      ? 'IN_COVERAGE'
      : 'GLOBAL_ETOPO_PLANETARY_COVERAGE';

    let chosenWorldX = 0;
    let chosenWorldZ = 0;
    let groundY = 0;
    let elevation = 0;
    let slope = 0;
    let gradX = 0;
    let gradZ = 0;
    let normX = 0;
    let normZ = 1;
    let suitability = 'OPTIMAL_AFFINITY_MATCH';

    if (unitDef.spatial?.anchorHint && isRegionalActive) {
      chosenWorldX = unitDef.spatial.anchorHint.worldX;
      chosenWorldZ = unitDef.spatial.anchorHint.worldZ;
      if (typeof terrainMetricsLookup === 'function') {
        const m = terrainMetricsLookup(chosenWorldX, chosenWorldZ);
        groundY = m.groundY;
        elevation = m.meters;
        slope = m.slopeDeg;
        gradX = m.gradX;
        gradZ = m.gradZ;
        normX = m.normX;
        normZ = m.normZ;
      }
      suitability = 'PROFILE_ANCHOR_VERIFIED';
    } else if (isRegionalActive && this.candidateCache.length > 0) {
      const preferredCategory = unitDef.spatial?.preferredType?.toUpperCase() || 'GENERAL_TERRAIN';
      const targetZone = unitDef.spatial?.stageZone || 'ZONE_B_INLAND';

      const matches = this.candidateCache.filter(c =>
        (c.category === preferredCategory || preferredCategory === 'GENERAL_TERRAIN') &&
        c.zone === targetZone
      );

      const pool = (matches.length > 0) ? matches : this.candidateCache.filter(c => c.zone === targetZone);
      const focalPool = pool.filter(c => Math.abs(c.worldX) <= 0.12 && Math.abs(c.worldZ) <= 0.08);
      const candidateList = (targetZone === 'ZONE_C_MOUNTAIN' || focalPool.length === 0) ? pool : focalPool;
      const poolIdx = Math.min(
        Math.max(0, candidateList.length - 1),
        Math.max(0, Math.floor(candidateList.length * (0.35 + (unitIndex >= 0 ? unitIndex * 0.22 : 0))))
      );
      const chosen = candidateList[poolIdx] || candidateList[Math.floor(candidateList.length / 2)] || { worldX: 0, worldZ: 0, groundY: 0, elevation: 0, slope: 0 };

      const maxExtentX = physW * 0.42;
      const maxExtentZ = physH * 0.42;
      chosenWorldX = Math.max(-maxExtentX, Math.min(maxExtentX, chosen.worldX));
      chosenWorldZ = Math.max(-maxExtentZ, Math.min(maxExtentZ, chosen.worldZ));

      if (typeof terrainMetricsLookup === 'function') {
        const m = terrainMetricsLookup(chosenWorldX, chosenWorldZ);
        groundY = m.groundY;
        elevation = m.meters;
        slope = m.slopeDeg;
        gradX = m.gradX;
        gradZ = m.gradZ;
        normX = m.normX;
        normZ = m.normZ;
      } else {
        groundY = chosen.groundY;
        elevation = chosen.elevation;
        slope = chosen.slope;
        gradX = chosen.gradX || 0;
        gradZ = chosen.gradZ || 0;
        normX = chosen.normX || 0;
        normZ = chosen.normZ || 1;
      }
      suitability = 'GENERIC_AFFINITY_MATCH';
    } else if (!isRegionalActive) {
      chosenWorldX = spreadOffset;
      chosenWorldZ = (unitIndex % 2 === 0 ? 0.018 : -0.018);
      groundY = 0.005;
      elevation = 120.0;
      slope = 5.0;
      suitability = 'PLANETARY_EPICENTRAL_ANCHOR';
    }

    return {
      worldX: chosenWorldX,
      worldZ: chosenWorldZ,
      groundY: Math.max(0.0, groundY),
      elevation: elevation,
      slope: slope,
      gradX: gradX,
      gradZ: gradZ,
      normX: normX,
      normZ: normZ,
      t_activation: unitDef.timing.t_activation,
      demCoverageStatus: demCoverageStatus,
      suitability: suitability,
      suitabilityStatus: suitability
    };
  }
}

/**
 * Shared 6-Stage Kinetic Lifecycle Updater for Archival Entities
 * Manages FOV-adaptive legibility scaling, wave arrival emergence, acoustic resonance,
 * slope dissolution, residue decay, and dead culling.
 */
export function updateEntitiesLifecycle(entities, {
  simTime = 0.0,
  camera = null,
  enableStratum3 = 1.0,
  dominantFreqHz = 1.0
} = {}) {
  if (!Array.isArray(entities) || entities.length === 0) return;

  const targetGlyphFraction = 0.030;

  entities.forEach(grp => {
    const u = grp.userData;
    if (!u || !u.unitDef) return;
    const unitDef = u.unitDef;
    const cand = u.cand || {};
    const t_act = u.t_activation;
    const lc = unitDef.timing;
    const totalDuration = lc.formationDuration + lc.minLegibilityDuration + lc.resonanceDuration + lc.dissolutionDuration + lc.residueDuration;

    if (camera) {
      const distToCam = camera.position.distanceTo(grp.position);
      const fovRad = (camera.fov || 45) * Math.PI / 180.0;
      const fovScale = 2.0 * Math.tan(fovRad * 0.5) * distToCam;
      const fogFactor = Math.max(0.0, Math.min(1.0, (3.2 - distToCam) / 1.8));
      u.fogFactor = fogFactor;

      if (u.sprite) {
        const canvasH = u.canvasH || unitDef.visual?.canvasH || 384;
        const canvasW = u.canvasW || unitDef.visual?.canvasW || 2048;
        const finalFontSize = u.finalFontSize || unitDef.visual?.fontSize || 78;
        const fontRatio = Math.max(0.08, finalFontSize / canvasH);
        const targetWorldH = fovScale * (targetGlyphFraction / fontRatio);
        const aspect = canvasW / canvasH;
        const targetWorldW = targetWorldH * aspect;

        u.targetWorldH = targetWorldH;
        u.targetWorldW = targetWorldW;
        u.sprite.scale.set(targetWorldW, targetWorldH, 1.0);

        if (u.haloSprite) {
          u.haloSprite.scale.set(targetWorldW * 1.35, targetWorldH * 2.2, 1.0);
        }
      } else if (u.chunks && u.chunks.length > 0) {
        const chunkCanvasH = u.chunkCanvasSize || 256;
        const chunkFontSize = u.chunkFontSize || 78;
        const chunkFontRatio = Math.max(0.15, chunkFontSize / chunkCanvasH);
        const chunkTargetH = fovScale * (targetGlyphFraction / chunkFontRatio);
        const chunkTargetW = chunkTargetH;
        const baseScaleRef = 0.062;
        const scaleRatio = chunkTargetH / baseScaleRef;

        u.scaleRatio = scaleRatio;
        u.targetWorldH = chunkTargetH;
        u.targetWorldW = chunkTargetW * u.chunks.length;

        u.chunks.forEach(chk => {
          chk.sprite.scale.set(chunkTargetW, chunkTargetH, 1.0);
          if (u.lifecycleState !== 'DISSOLUTION' && u.lifecycleState !== 'RESIDUE') {
            chk.sprite.position.set(chk.baseOffsetX * scaleRatio, 0.0, 0.0);
          }
        });

        if (u.haloSprite) {
          const totalW = chunkTargetW * (u.chunks.length * 0.95 + 1.2);
          u.haloSprite.scale.set(totalW, chunkTargetH * 2.2, 1.0);
        }
      }
    }

    if (enableStratum3 < 0.5) {
      grp.visible = false;
      u.currentOpacity = 0.0;
      u.lifecycleState = 'LATENT';
      return;
    }

    const dtAct = simTime - t_act;

    if (dtAct < 0.0) {
      grp.visible = false;
      u.currentOpacity = 0.0;
      u.lifecycleState = 'LATENT';
    } else if (dtAct < lc.formationDuration) {
      grp.visible = true;
      u.lifecycleState = 'EMERGENCE';
      const prog = Math.min(1.0, dtAct / lc.formationDuration);
      const easeOut = 1.0 - Math.pow(1.0 - prog, 2.5);
      u.currentOpacity = easeOut * 0.95;
      if (u.renderCanvas) u.renderCanvas(prog, 0.0);
      if (unitDef.kinetic.archetype === 'FRACTURE' && u.chunks) {
        const sRatio = u.scaleRatio || 1.0;
        u.chunks.forEach(chk => {
          chk.mat.opacity = easeOut * 0.95;
          chk.sprite.position.set(chk.baseOffsetX * sRatio, 0.0, 0.0);
          chk.sprite.material.rotation = 0.0;
        });
      }
      if (u.spriteMat) u.spriteMat.opacity = u.currentOpacity;
      if (u.haloMat) u.haloMat.opacity = Math.sin(prog * Math.PI) * 0.18;
    } else if (dtAct < lc.formationDuration + lc.minLegibilityDuration) {
      grp.visible = true;
      u.lifecycleState = 'FORMATION';
      u.currentOpacity = 0.98;
      if (u.renderCanvas) u.renderCanvas(1.0, 0.0);
      if (unitDef.kinetic.archetype === 'FRACTURE' && u.chunks) {
        const sRatio = u.scaleRatio || 1.0;
        u.chunks.forEach(chk => {
          chk.mat.opacity = 0.98;
          chk.sprite.position.set(chk.baseOffsetX * sRatio, 0.0, 0.0);
          chk.sprite.material.rotation = 0.0;
        });
      }
      if (u.spriteMat) u.spriteMat.opacity = 0.98;
      if (u.haloMat) u.haloMat.opacity = 0.12;
    } else if (dtAct < lc.formationDuration + lc.minLegibilityDuration + lc.resonanceDuration) {
      grp.visible = true;
      u.lifecycleState = 'RESONANCE';
      const resT = dtAct - (lc.formationDuration + lc.minLegibilityDuration);
      u.currentOpacity = 0.95;

      const baseX = u.worldPos ? u.worldPos.x : cand.worldX;
      const baseY = u.worldPos ? u.worldPos.y : (Math.max(cand.groundY || 0.0, 0.020) + 0.120);
      const baseZ = u.worldPos ? u.worldPos.z : cand.worldZ;

      if (unitDef.kinetic.archetype === 'RESONANCE') {
        const tremorFreq = 20.0 * Math.min(1.5, dominantFreqHz);
        const strokeJitter = Math.sin(resT * tremorFreq) * 2.8;
        if (u.renderCanvas) u.renderCanvas(1.0, strokeJitter);
        grp.position.x = baseX + Math.sin(resT * tremorFreq) * 0.0005;
        grp.position.y = baseY;
        grp.position.z = baseZ;
        if (u.spriteMat) u.spriteMat.opacity = 0.95;
        if (u.haloMat) u.haloMat.opacity = 0.15;
      } else if (unitDef.kinetic.archetype === 'FRACTURE' && u.chunks) {
        grp.position.x = baseX;
        grp.position.y = baseY;
        grp.position.z = baseZ;
        const sRatio = u.scaleRatio || 1.0;
        u.chunks.forEach((chk, idx) => {
          const microJitter = ((idx % 2 === 0) ? 1 : -1) * Math.sin(resT * 26.0) * 0.0004 * sRatio;
          chk.sprite.position.set(chk.baseOffsetX * sRatio + microJitter, 0.0, 0.0);
          chk.mat.opacity = 0.98;
        });
        if (u.haloMat) u.haloMat.opacity = 0.12;
      } else if (unitDef.kinetic.archetype === 'RECEDE') {
        grp.position.x = baseX;
        grp.position.y = baseY + Math.sin(simTime * 3.6) * 0.003;
        grp.position.z = baseZ;
        if (u.spriteMat) u.spriteMat.opacity = 0.94;
        if (u.haloMat) u.haloMat.opacity = 0.12;
      } else if (unitDef.kinetic.archetype === 'EXPOSE') {
        grp.position.x = baseX;
        grp.position.y = baseY;
        grp.position.z = baseZ;
        u.currentOpacity = 0.98;
        if (u.spriteMat) u.spriteMat.opacity = 0.98;
        if (u.haloMat) u.haloMat.opacity = 0.16;
      }
    } else if (dtAct < lc.formationDuration + lc.minLegibilityDuration + lc.resonanceDuration + lc.dissolutionDuration) {
      grp.visible = true;
      u.lifecycleState = 'DISSOLUTION';
      const dissT = dtAct - (lc.formationDuration + lc.minLegibilityDuration + lc.resonanceDuration);
      const dissProg = Math.min(1.0, dissT / lc.dissolutionDuration);

      const baseX = u.worldPos ? u.worldPos.x : cand.worldX;
      const baseY = u.worldPos ? u.worldPos.y : (Math.max(cand.groundY || 0.0, 0.020) + 0.120);
      const baseZ = u.worldPos ? u.worldPos.z : cand.worldZ;

      if (unitDef.kinetic.archetype === 'RESONANCE') {
        u.currentOpacity = lerpScalar(0.95, 0.18, dissProg);
        if (u.spriteMat) u.spriteMat.opacity = u.currentOpacity;
        if (u.haloMat) u.haloMat.opacity = (1.0 - dissProg) * 0.10;
        grp.position.x = baseX;
        grp.position.y = baseY;
        grp.position.z = baseZ;
      } else if (unitDef.kinetic.archetype === 'FRACTURE' && u.chunks) {
        const fallProg = dissProg * dissProg;
        u.currentOpacity = lerpScalar(0.98, 0.20, dissProg);
        grp.position.x = baseX;
        grp.position.y = baseY;
        grp.position.z = baseZ;
        const sRatio = u.scaleRatio || 1.0;
        u.chunks.forEach(chk => {
          chk.sprite.position.x = chk.baseOffsetX * sRatio + (chk.spreadX + chk.gradDirX * 0.015) * dissProg * 3.6 * sRatio;
          chk.sprite.position.y = chk.fallVelY * fallProg * 2.8 * sRatio;
          chk.sprite.position.z = (chk.spreadZ + chk.gradDirZ * 0.015) * dissProg * 3.6 * sRatio;
          chk.sprite.material.rotation = chk.rotSpeed * dissProg * 1.2;
          chk.mat.opacity = u.currentOpacity;
        });
        if (u.haloMat) u.haloMat.opacity = (1.0 - dissProg) * 0.08;
      } else if (unitDef.kinetic.archetype === 'RECEDE') {
        u.currentOpacity = lerpScalar(0.94, 0.18, dissProg);
        const baseW = u.targetWorldW || unitDef.visual.spriteW;
        if (u.sprite) u.sprite.scale.x = baseW * (1.0 + dissProg * 0.70);
        grp.position.x = baseX + dissProg * 0.018;
        grp.position.z = baseZ - dissProg * 0.008;
        grp.position.y = baseY - dissProg * 0.008;
        if (u.spriteMat) u.spriteMat.opacity = u.currentOpacity;
        if (u.haloMat) u.haloMat.opacity = (1.0 - dissProg) * 0.08;
      } else if (unitDef.kinetic.archetype === 'EXPOSE') {
        u.currentOpacity = lerpScalar(0.98, 0.45, dissProg);
        if (u.spriteMat) u.spriteMat.opacity = u.currentOpacity;
        if (u.haloMat) u.haloMat.opacity = (1.0 - dissProg) * 0.12;
      }
    } else if (dtAct < totalDuration) {
      grp.visible = true;
      u.lifecycleState = 'RESIDUE';
      const resT = dtAct - (lc.formationDuration + lc.minLegibilityDuration + lc.resonanceDuration + lc.dissolutionDuration);
      const resProg = Math.min(1.0, resT / lc.residueDuration);

      if (unitDef.kinetic.archetype === 'EXPOSE') {
        u.currentOpacity = lerpScalar(0.45, 0.0, resProg);
        if (u.spriteMat) u.spriteMat.opacity = u.currentOpacity;
        if (u.haloMat) u.haloMat.opacity = (1.0 - resProg) * 0.06;
      } else if (unitDef.kinetic.archetype === 'FRACTURE' && u.chunks) {
        u.currentOpacity = lerpScalar(0.20, 0.0, resProg);
        u.chunks.forEach(chk => { chk.mat.opacity = u.currentOpacity; });
        if (u.haloMat) u.haloMat.opacity = 0.0;
      } else {
        u.currentOpacity = lerpScalar(0.18, 0.0, resProg);
        if (u.spriteMat) u.spriteMat.opacity = u.currentOpacity;
        if (u.haloMat) u.haloMat.opacity = 0.0;
      }
    } else {
      grp.visible = false;
      u.currentOpacity = 0.0;
      u.lifecycleState = 'DEAD';
      if (u.spriteMat) u.spriteMat.opacity = 0.0;
      if (u.haloMat) u.haloMat.opacity = 0.0;
      if (unitDef.kinetic.archetype === 'FRACTURE' && u.chunks) {
        u.chunks.forEach(chk => { chk.mat.opacity = 0.0; });
      }
    }

    const fogMul = (u.fogFactor !== undefined) ? u.fogFactor : 1.0;
    if (u.spriteMat) u.spriteMat.opacity *= fogMul;
    if (u.haloMat) u.haloMat.opacity *= fogMul;
    if (u.chunks) {
      u.chunks.forEach(chk => { if (chk.mat) chk.mat.opacity *= fogMul; });
    }
  });
}

/**
 * Modern Living Memory & Archival Korean Typography Engine
 * Coordinates parsing, terrain-aware spawning, kinetic rendering, and lifecycle state.
 */
export class LivingMemoryEngine {
  constructor({ scene = null, THREE = null, livingSoundfield = null, candidateCache = [] } = {}) {
    this.scene = scene;
    this.THREE = THREE;
    this.livingSoundfield = livingSoundfield;
    this.entities = [];
    this.currentParsedEvent = null;
    this.parser = new ArchivalSemanticParser();
    this.spawner = new TerrainAwareSpawner(candidateCache);
    this.enableDarkCushion = true;
    this.displayMode = 'korean';
  }

  /**
   * Advance all active archival typography entities for `simTime`.
   */
  update(simTime, { camera = null, enableStratum3 = 1.0, dominantFreqHz = 1.0 } = {}) {
    updateEntitiesLifecycle(this.entities, {
      simTime,
      camera,
      enableStratum3,
      dominantFreqHz: this.currentParsedEvent?.dominantFreqHz || dominantFreqHz
    });
  }

  setMultilingualDisplayMode(mode) {
    this.displayMode = mode === 'native' ? 'native' : 'korean';
    this.parser.setDisplayMode(this.displayMode);
    if (this.currentParsedEvent) {
      const newParsed = this.parser.parseEvent(this.currentParsedEvent.eventId);
      this.currentParsedEvent = newParsed;
      this.entities.forEach((group, idx) => {
        const u = newParsed.semanticUnits[idx];
        if (u && group.userData) {
          group.userData.unitDef = u;
          group.userData.token = u.token || '';
          group.userData.displayText = u.semantic?.displayText || u.token || '';
          if (typeof group.userData.renderCanvas === 'function') {
            group.userData.renderCanvas(1.0);
          } else if (Array.isArray(group.userData.chunks)) {
            group.userData.chunks.forEach(ch => {
              if (typeof ch.renderChunk === 'function') ch.renderChunk(1.0);
            });
          }
        }
      });
    }
  }

  setDarkCushionEnabled(enabled) {
    this.enableDarkCushion = !!enabled;
    this.entities.forEach(group => {
      if (typeof group.userData?.renderCanvas === 'function') {
        group.userData.renderCanvas(1.0);
      }
    });
  }

  getActiveEntities() {
    return this.entities.filter(e =>
      e.userData?.lifecycleState !== 'LATENT' && e.userData?.lifecycleState !== 'DEAD'
    );
  }

  dispose() {
    if (this.scene) {
      this.entities.forEach(group => {
        this.scene.remove(group);
        group.traverse(child => {
          if (child.material) {
            if (child.material.map) child.material.map.dispose();
            child.material.dispose();
          }
          if (child.geometry) child.geometry.dispose();
        });
      });
    }
    this.entities = [];
    this.currentParsedEvent = null;
  }
}
