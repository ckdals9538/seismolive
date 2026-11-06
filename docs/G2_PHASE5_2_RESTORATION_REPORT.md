# [SEISMOLIVE v4.0 — G2 Phase 5.2 Implementation Report]
## Sculptural Terrain Lighting Restoration · Volumetric Verticality Recovery · Poetic Micro-Phrases
### Target File: `prototype_g2_continuous_seismic_world.html`
### Execution Date: 2026-11-05 | Baseline: Clean Continuous World & Living Archival Typography

---

## 1. Executive Summary

Phase 5 구현물을 정밀 심미 검토한 결과 도출된 핵심 문제점—**과도한 암흑화로 인한 지형 입체감 상실**, **수직적 발현 억제로 인한 2D 평면화**, **단편적인 한자어 나열 및 바닥 누운 글씨 왜곡**—을 근원적으로 해결하기 위해 다음 4대 핵심 복원 및 서사 고도화 작업을 완수했습니다.

1. **[지형 조명 복원] 조각적 설악산-동해 지형감 부활**:
   - 알베도 톤 상향: 암벽 사면 청회색 `chiseledRock`(`vec3(0.165, 0.200, 0.255)`), 고산 능선 `alpineSummit`(`vec3(0.240, 0.290, 0.360)`), 대륙붕 `shelfTone`(`vec3(0.032, 0.065, 0.105)`).
   - 달빛 `wrapDiffuse` 배수를 $0.65 \to 1.45$배, `rim` 조명 배수를 $0.30 \to 0.85$배로 상향 복원하여, 파동 도착 전후 언제나 푸른 달빛 아래 험준한 산악 능선과 해저 대륙붕의 3D 실루엣이 조각품처럼 선명하게 살아 숨 쉬도록 구현.
2. **[입체감 및 수직성 복원] 해양 파동의 풍성한 유체 결 & 능선 수직 오라(Vertical Bloom)**:
   - 해양 파동: 1픽셀 네온 라인을 폐기하고, 파동 전면과 내부에 풍성한 빗살 무늬 유체 필라멘트(`filFluid`)와 입체 융기 변위($0.0016 \times 1.85$배 증폭) 및 부드러운 반투명 수직 빛의 장막(Volumetric Crest Veil / Mist)을 결합하여 공간 위로 솟구치는 유체 에너지 실현.
   - 산악 능선: 날카로운 선을 넘어, 파동 충격 시 능선을 따라 부드러운 빛의 오라(`ridgeAura` & Rising Mist)가 산등성이 위로 피어오르며 산맥 전체가 공명하는 3D 볼륨감 구축.
3. **[가독성 및 클린업] 하단 깨알 각주 100% 영구 삭제 & 카메라 정면 빌보드 복원**:
   - `renderCanvas()` 내부의 작은 글씨(한자 원문, 실록 출처 각주) 및 밑줄 코드를 단 한 줄도 남김없이 완전 삭제. 오직 숭고한 한글 서사만이 캔버스 중앙에 순수하게 렌더링됨.
   - 바닥에 누워 찌그러졌던 `드러난 해저`를 정면 직립형 카메라 추종 빌보드(`THREE.Sprite`, 고도 $+0.040$)로 복원하여 왜곡을 0%로 제거하고 가독성 100% 확보.
4. **[서사 개편] 사료의 맥락이 자연스럽게 이어지는 5대 시적 구절(Micro-Phrases)**:
   - 파동 전파 경로(외해 $\to$ 대륙붕 $\to$ 연안 $\to$ 내륙 양양 $\to$ 설악산 고산 능선)를 따라 순차적으로 피어오르는 5대 서사 연쇄 완성:
     - ① **`바닷물이 물러나고`** ($t \approx 3.2\text{s}$ | 외해 대륙붕 파동 마루 위 | 해수면 부유, 외해 방향 퇴조 유체 신장 및 수면 침잠)
     - ② **`드러난 해저`** ($t \approx 4.8\text{s}$ | 연안 대륙붕 상공 | 정면 직립 빌보드, 물이 빠져 드러나듯 밝아진 후 3.5초의 장엄한 잔광)
     - ③ **`우레 같은 울림`** ($t \approx 6.4\text{s}$ | 양양 내륙 산자락 | 22Hz 조화 스트로크 진동 및 안개형 분산 소멸)
     - ④ **`설악의 거암이`** ($t \approx 8.2\text{s}$ | 설악산 고산 능선 좌상단 | 백청색 능선 광채 속 출현, 화강암 지반 공명)
     - ⑤ **`무너져 내리다`** ($t \approx 9.4\text{s}$ | 설악산 능선 우측 하단 계곡부 | 6분할 청크 `무`·`너`·`져`·`내`·`리`·`다`가 중력 가속도를 타고 설악산 계곡 아래로 굴러 떨어지는 다물체 낙하 역학)

---

## 2. 5대 시적 구절 시공간 배치 및 물리 거동 실측표

| 구절 ID | 시적 구절 표기 | 사료 출처 및 맥락 | 키네틱 아키타입 | 실측 표고 / 경사도 | 도달 ($t_{arr}$) | 시각 연출 및 물리 소멸 거동 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `01` | **바닷물이 물러나고** | `海中爲潮退之状`<br>(숙종실록 1681-06-26) | **RECEDE (퇴조)** | $-742.3\text{m}$<br>($5.4^\circ$, 동해 외해) | $3.20\text{s}$ | 파동 마루 상공($+0.038$)에서 유체 캘리그래피로 출현. 외해 방향 퇴조 유동($+24\text{mm}$, 수평 $1.75\times$ 신장) 후 해수면 속으로 스며들어 침잠. |
| `02` | **드러난 해저** | `露出百餘歩`<br>(승정원일기 1681-05-14) | **EXPOSE (노출)** | $-318.7\text{m}$<br>($19.7^\circ$, 연안 대륙붕) | $4.80\text{s}$ | 카메라 정면 직립 빌보드($+0.040$). 물이 빠져 바닥이 드러나듯 선명하게 밝아진 뒤, 3.5초간 대륙붕에 장엄한 여운 잔광 유지 후 암흑 침잠. |
| `03` | **우레 같은 울림** | `聲如雷`<br>(숙종실록 1681-06-26) | **RESONANCE (공명)** | $+76.8\text{m}$<br>($24.0^\circ$, 양양 산자락) | $6.40\text{s}$ | 파동 내륙 상륙 시 대지에서 피어오름. $\sim 22\text{Hz}$ 미세 위상차 획 진동(Stroke Tremor) 후 산악 안개처럼 은은하게 분산 소멸. |
| `04` | **설악의 거암이** | `巨巖`<br>(실록 사료 종합) | **RESONANCE (공명)** | $+70.5\text{m} \sim +1400\text{m}$<br>($30.7^\circ$, 설악산 좌상단) | $8.20\text{s}$ | 설악산 능선이 점화될 때 좌상단 능선 광채 속에서 묵직하게 출현. 화강암 지반 공명 떨림 유지. |
| `05` | **무너져 내리다** | `崩頽`<br>(승정원일기 1681-05-14) | **FRACTURE (파쇄)** | 설악산 급경사면 계곡부<br>(우측 하단 슬로프) | $9.40\text{s}$ | `설악의 거암이` 바로 우측 하단에 연달아 출현하여 서사 완성. 2.2초간 또렷이 읽힌 뒤, 6개 청크(`무`,`너`,`져`,`내`,`리`,`다`)로 균열되어 중력($-\nabla h, -g \cdot \Delta t^2$)을 타고 계곡 아래로 굴러 떨어짐. |

---

## 3. 조명 및 셰이더 복원 파라미터 상세

### 3-1. `integratedTerrainMat` 조명 파라미터 복원
```glsl
// 베이스 알베도: 깊은 계곡도 검은 덩어리가 아닌 깊은 남색 유지, 암벽 사면 청회색 부각
vec3 indigoVoid   = vec3(0.055, 0.075, 0.110);
vec3 chiseledRock = vec3(0.165, 0.200, 0.255);
vec3 alpineSummit = vec3(0.240, 0.290, 0.360);
vec3 shelfTone    = vec3(0.032, 0.065, 0.105);
vec3 slopeTone    = vec3(0.014, 0.028, 0.055);

// 달빛 Diffuse 및 Rim 배수 상향
vec3 lit = baseAlbedo * (u_ambientColor + u_lightColor * (wrapDiffuse * 1.45));
lit += u_lightColor * (spec * 0.22);
lit += vec3(0.55, 0.75, 0.95) * (rim * 0.85);

// 산악 능선 오라 & 상승 안개 (Vertical Mist Aura)
float ridgeAura = totalRidgeShape * ridgeEnvelope * (0.65 + 0.45 * sin(ridgeFlowCoord * 75.0 - u_simTime * 2.2));
float ridgeResonance = isAlpine * (surfaceRidgeStream * 1.6 + ridgeAura * 1.1 + summitCondensation + ridgeCoda);
```

### 3-2. `waterMat` 입체 유체 융기 및 발광 장막 (Volumetric Swell & Mist Veil)
```glsl
// 수면 입체 융기: 과장된 절벽 대신 자연스럽고 묵직한 3D 수면 기립
float shoalingAmp = mix(1.0, 1.85, shelfFactor);
float waveSwell = sin(omega * dt_wave) * env * (0.0016 * u_physicalDisplacement * shoalingAmp) / sqrt(max(0.20, hypoDist * 2.5));

// 부드러운 유체 결(filFluid) & 반투명 수직 빛의 장막(Crest Veil)
vec3 crestBloomColor = vec3(0.40, 0.74, 0.98);
vec3 crestVeilColor  = vec3(0.62, 0.85, 1.0);
float crestEnergy = pow(clamp(vWaterSwell * 420.0, 0.0, 1.0), 1.3) * vWaveFrontFactor;
float grazing = pow(1.0 - NdotV, 2.0);
float crestBloom = crestEnergy * (0.50 + 0.50 * filFluid) * (0.70 + 0.50 * vShelfFactor) * (0.5 + 0.5 * grazing);
float crestVeil = pow(vWaveFrontFactor, 1.5) * (0.40 + 0.60 * filFluid) * (0.55 + 0.45 * grazing) * (0.50 + 0.50 * vShelfFactor);

finalColor += crestBloomColor * (crestBloom * 0.95) + crestVeilColor * (crestVeil * 0.35) + subseaGlow;
alpha += crestBloom * 0.30 + crestVeil * 0.12;
```

---

## 4. 7대 핵심 검증 정지화면 (1080p Stills)

모든 캡처는 `captures/g2_phase5_2/` 및 아티팩트 디렉토리에 보존되었습니다:

1. `01_sculptural_terrain_lighting_t0p5.png`: 달빛 아래 선명하게 드러나는 설악산 암벽과 해저 대륙붕의 3D 조각적 윤곽 ($t=0.5\text{s}$, 파동 도착 전).
2. `02_volumetric_crest_phrase1_t3p8.png`: 입체 유체 결을 머금은 3D 해양 파동과 수면 위를 부유하는 `바닷물이 물러나고` ($t=3.8\text{s}$).
3. `03_exposed_seabed_phrase2_t5p5.png`: 바닷물이 물러난 공간에 카메라 정면으로 선명하게 기립한 `드러난 해저`의 인과적 서사 ($t=5.5\text{s}$).
4. `04_inland_roar_phrase3_t7p2.png`: 파동이 해안을 넘어 내륙을 강타하며 피어오르는 `우레 같은 울림`과 22Hz 조화 진동 ($t=7.2\text{s}$).
5. `05_seorak_rock_narrative_t9p8.png`: `설악의 거암이`와 `무너져 내리다`가 상하좌우 무충돌로 이어지며 완성되는 완전한 사료 서사 ($t=9.8\text{s}$).
6. `06_fracture_cliff_tumbling_t14p5.png`: `무너져 내리다`의 6개 청크가 설악산 계곡 슬로프를 따라 굴러 떨어지는 다물체 낙하 역학 ($t=14.5\text{s}$).
7. `07_serene_aftermath_calm_t20p5.png`: $t=20.5\text{s}$ 이후 모든 텍스트가 100% 소멸하고 깊은 고요와 조각적 입체감만 남은 적막한 심야 대지.

---

## 5. 최종 산출 비디오 사양

- **파일명**: `g2_phase5_2_full_sequence.mp4`
- **해상도 및 규격**: $1280 \times 720$, 24.000 fps, H.264 (yuv420p, CRF 18)
- **정확한 러닝타임**: **strictly 20.000000초 (480 frames, 인덱스 0 ~ 479)**
- **미리보기 GIF**: `g2_phase5_2_preview.gif` ($640 \times 360$, 12 fps)
