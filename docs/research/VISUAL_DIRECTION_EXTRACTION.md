# SEISMOLIVE — Visual Direction Extraction
## 레퍼런스 시각 디자인 10대 차원 역설계 및 Nocturnal Monolith 통합 미학 원칙

**작성일**: 2026-11-16  
**전제 규칙**: [`GEMINI.md`](file:///Users/katsina/Downloads/earth/GEMINI.md) · `.agents/rules/art_direction.md` (불변 정체성: *The Living Earth · Science Made Visible · Data Made Audible · Lithic Memory & Crustal Resonance* · 게임 VFX/대시보드 슬롭 영구 금지)

---

## 1. 10대 시각 디자인 차원별 역설계 매트릭스 (Section 8)

외부 레퍼런스의 외형이나 색상을 맹목적으로 모방하지 않고, **왜 그 시각 표현이 인지적·미학적으로 효과적인지** 원인을 분해한 뒤 SEISMOLIVE에 적용할 수 있는 것과 버려야 할 것을 분리한다.

| 차원 | 대표 레퍼런스 근거 | 효과적인 이유 (지각·공간 원리) | SEISMOLIVE 적용 원칙 (채택 vs 배제) |
| :--- | :--- | :--- | :--- |
| **1. 카메라 구도 (Camera Composition)** | `Mini Seoul` (`pitch: 60°`, `bearing: -22°`, 역 선택 시 `pitch: 66°`), `Seoul 3D Atlas` (사선 `V(34,39,46)` + 포커스 `V(14,16,20)`), `Seoul Data Atlas` (`pitch: 45°`, `bearing: -14°`) | 완전한 수직 탑다운(`90°`)은 건물의 높이·층고·지형 경사(단차)를 소멸시키고, 너무 낮은 지평선 각도(`15°`)는 앞 건물에 뒤 골목이 완전히 가린다. **`45°~66°` 사선 조망(Oblique Bird's-Eye)** 이 지형 고저와 보행 네트워크·대피소 거리를 동시에 읽게 하는 최적 구간이다. | • **채택**: 4km 지역맵 `pitch 52°~60°`, 건물/개인 위치 `62°~66°` 사선 프리셋 + 화면 하단 여백 확보(`LookAt` 오프셋).<br>• **배제**: 정사영(Orthographic) 디오라마 판 컷아웃(`Seoul 3D Atlas`) — SEISMOLIVE는 **연속 곡면 지구** 위에 놓여야 함. |
| **2. 조명과 그림자 (Lighting & Shading)** | `Mini Seoul` `TrainLayer` (`DirectionalLight 0.55` + `Ambient 0.92`, 지붕 흰색 틴트 `0.45`로 윗면-옆면 명도차 분리), `Seoul Data Atlas` (`point` 상단 눈부심 제거 가능 라이트 3분할) | 상단에서 살짝 비스듬한 주광이 없으면 같은 색 박스들이 평면 스티커처럼 납작하게 뭉개진다. 면 법선에 따른 **미세한 윗면 vs 옆면 명암 분리**만으로도 그림자 맵 고비용 없이 입체감이 즉시 살아난다. | • **채택**: 기존 `monolithLandAlbedo` + 사선 달빛(`u_lightDir`)에 **계곡 캐비티 감쇠(`smoothstep(2.0, 18.0, vSlope)`)** 및 4km 건물 옥상-벽면 Lambert 명도차 적용.<br>• **배제**: 실사 태양 그림자 캐스팅을 저사양 PC에서 기본 활성화하는 것(프레임 드롭 원인). |
| **3. 지형 재질 (Terrain Material)** | `SEISMOLIVE` [`SeismicTerrainShaders.js`](file:///Users/katsina/Downloads/earth/js/3d/shaders/SeismicTerrainShaders.js) (`monolithOceanAlbedo`, `monolithLandAlbedo`, `grain`), `Seoul 3D Atlas` (고도별 식생 그라데이션 + `-0.04` 스커트) | 도색되지 않은 플라스틱 모형처럼 보이는 원인은 ① 저지대 평야의 명도 변화 부재, ② 마이크로 그레인·암석 계곡 명암 부재 때문이다. 고도(Hypsometry)와 경사(Slope)를 미세하게 직조해야 돌과 지각의 물성이 드러난다. | • **채택**: 현행 암회색 현무암 톤(`#0e131c ~ #3d4a5c`)을 유지하되 저지대/계곡/능선의 미세 표고 성층화 및 T-X 프로브 점선 고리 복원.<br>• **배제**: `Seoul 3D Atlas`의 파스텔 낮 잔디색(`#d6dfc2`) 및 수작업 강변 깎기. |
| **4. 건물 표현 (Building Representation)** | `Seoul Data Atlas` (짙은 남청 무채색 건물 `#0A1118`, `minZoom: 11.25`), `Mini Seoul` (`#3a4452`, `opacity 0.72 → 0.08`) | 4km 도시 안에 수천 동 건물이 모두 밝은 외벽과 화려한 디테일을 가지면 피난 경로나 지진 파동이 시각 노이즈에 묻힌다. **건물은 침묵하는 음화(Negative Space) 볼륨**으로 깔고 선택 대상만 선명한 한지 아이보리 와이어프레임으로 승격시켜야 한다. | • **채택**: 주변 4km 건물은 어두운 현무암 슬레이트 `#111827`/`#1e293b` 매스(`InstancedMesh`)로 억제하고, 선택 건물·대피소만 `#f8fafc` 한지 아이보리 건축 선화 강조.<br>• **배제**: `S-Map` 식 사진 텍스처 건물 또는 임의 위험도 색칠(빨간/노란 건물 히트맵). |
| **5. 공간 깊이 (Spatial Depth)** | `NASA Eyes` (깊은 우주 배경과 대기 림), `SEISMOLIVE` (`FogExp2(0x020408)` + `rim`), `Mini Seoul` (`setUnderground` 배경 어둡게 + 건물 `0.08` 투명화) | 시선의 앞·중·뒤 거리감을 만드는 요소는 **먼 거리의 절제된 지수 안개**와 **관심 깊이 외 레이어의 불투명도 억제(Depth-of-Focus by Opacity)** 다. | • **채택**: `BUILDING_INSPECTION` 진입 시 주변 4km 컨텍스트 건물 `opacity → 0.16` 자동 X-Ray 투시.<br>• **배제**: 거대한 반투명 구체 돔(대기 림은 지구본 셰이더 내부에서만 계산) 및 과도한 검은 안개 벽. |
| **6. 애니메이션 속도와 움직임 (Motion)** | `Mini Seoul` `LiveFleet` (`CORRECTION_HALF_LIFE = 2.5s` 지수 감쇠 보정), `GlobalLocalCameraTransition` (`Quintic ease 6t^5 - 15t^4 + 10t^3`), `StationFocus` (`PULSE_MS = 1800ms`) | 갑작스러운 위치 점프(Teleport)나 매 프레임 진동하는 애니메이션은 관측자 인지를 망가뜨린다. 가속/감속을 물리적으로 감쇠시키고 정지된 상태에서도 장면이 자립해야 한다. | • **채택**: 구면 SLERP 궤도 비행, Quintic 감속 전환, `StationFocus` 스타일의 얇은 지표 포커스 링.<br>• **배제**: `StationFocus`도 원색 게임 오라처럼 과도하게 번쩍이지 않도록 1px 한지/스카이블루 단색 선 유지; `prefers-reduced-motion` 시 전환 시간 0ms. |
| **7. 데이터 레이어의 시각적 위계 (Figure-Ground)** | `Seoul Data Atlas` (`Static Geo Fabric` vs `Temporal Data Layers`), `Mini Seoul` (선로 `line-halo` 0.22 + `line` 0.95) | 지도 배경이 조용할수록 데이터(지진파, 대피 경로, 위험 계단)가 얇은 선만으로도 또렷하게 떠오른다(Figure-Ground Contrast). 경로 1줄에 얇은 외곽 후광(`0.2`)을 깔면 어두운 지형과 겹쳐도 단절되지 않는다. | • **채택**: 3단계 위계 — **1층(배경 75~88%)**: 심해·현무암 지형·무채색 도시 → **2층(맥락)**: 간선도로·수계·공식 대피소 윤곽 → **3층(주 신호)**: 지진파/한국어 사료 또는 대피 경로(백색)·계단 주의(절제된 호박색 `#f59e0b`). |
| **8. 정보 표시 밀도 (Density Control)** | `Mini Seoul` `StationLabels` (`lineCount >= 3` → zoom `10.6`, HUD `obstacles()` 회피), `Seoul 3D Atlas` (`overviewCount` vs `fullCount`) | 정보를 많이 띄울수록 전문적인 게 아니라 **아무것도 안 읽히게** 된다. 카메라 줌/단계에 맞춰 표시 대상을 선별(Progressive Disclosure)하고 HUD 영역과 절대 겹치지 않게 비워야 한다. | • **채택**: ① 단계별 LOD(`4km`에서는 주요 대피소/병원/거점만 → `Campus`에서 건물군 → `Building`에서 층/출입구), ② HTML AABB HUD 회피 충돌 제거.<br>• **배제**: 화면 사방을 채우는 메트릭 카드·게이지·고정 범례 패널. |
| **9. 사용자 인터랙션 (Interaction)** | `Mini Seoul` (단일 클릭 통합 라우팅 + `dragstart` 시 자동 추적 즉시 양보), `Seoul Data Atlas` (`transparent pickable` 분리), `GlobalLocalCameraTransition` (`pointerdown/wheel` 인터럽트) | 자동 전시/카메라 이동 중에 마우스 입력을 무시하면 사용자는 즉시 갇힌 느낌을 받는다. **어느 순간이든 사용자 조작이 최우선 인터럽트**여야 하며, 역/열차와 건물이 겹칠 때 단일 히트 라우터로 우선순위를 명확히 해야 한다. | • **채택**: 자동 비행/전시 중 `pointerdown`·`wheel`·`touchstart` 즉시 제어권 양보, `ESC` 1키로 상위 계층 복귀, 단일 클릭 우선순위 라우터(`대피소/거점 > 컨텍스트 건물 > 빈 공간 해제`). |
| **10. 전환 효과 (Spatial Transitions)** | `NASA Eyes` / `SEISMOLIVE` `startDescentFlight` (`threeToECEF` → `ecefToThree` 리앵커링) | 서로 다른 두 화면이 컷(Cut)으로 바뀌면 사용자는 공간적 인과관계를 잃는다. 지구 위 특정 지점에서 4km 지역으로 내려갈 때 방위(North)와 곡면 기울기가 연속 유지되어야 **하나의 살아 있는 지구**로 인식된다. | • **채택**: `GLOBAL → LOCAL 4KM → BUILDING → INDOOR → RESPONSE` 전 과정에서 동일 `LocalTangentAnchor` 방위(`+X=East, -Z=North, +Y=Up`) 유지 + 구면 호(Arc-Hop) 카메라 궤적. |

---

## 2. SEISMOLIVE Nocturnal Monolith 통합 시각 원칙 (기존 작품 + 지역 공간맵 공존 규범)

기존 SEISMOLIVE(`index.html`)와 신규 지역 공간맵 계층(`viewer_p2_6.html` 및 향후 통합 씬)이 하나의 작품처럼 호흡하기 위해 다음 5대 시각 규범을 확정한다.

1. **화면의 75~85% 여백과 어둠 보존**:
   - 지역 공간맵도 흰색 낮 지도나 원색 위성사진으로 바꾸지 않는다. 깊은 심해-현무암 톤(`#020408` 배경, `#0d1522` 기반 지반, `#182234` 도시 건물 매스)을 공통 어휘로 사용한다.
2. **색상의 절제된 의미론 (No Rainbow / No Game Glow)**:
   - `#f8fafc` (Hanji Ivory): 활성 층 슬래브, 추천 대피 경로, 선택 건물 윤곽, 3D 사료 단어.
   - `#f59e0b` (Subdued Amber): 옥외 계단(`highway=steps`) 구간 및 `SUSPECTED`/`PROVISIONAL` 주의 표시 (게임 네온 빨강/초록 대체).
   - `#38bdf8` (Muted Cyan/Horizon Blue): WGS84 수직 기준 앵커, 공식 대피소(`VERIFIED`), T-X 프로브 기준선.
   - **일체 금지**: 반투명 돔(지진파/대피반경), 수직 레이저 빔(대피소 기둥), 한자 3D 비석, 무지개색 위험 히트맵.
3. **사료와 건축 데이터의 언어 순수성**:
   - 글로벌/역사 지구에서는 **단어 단위 순수 한국어(한자/문장 배제)**만 3D 공간에 띄운다.
   - 지역/건축 공간에서는 **행동 우선 편집형 한국어 지침 + 출처/불확실성 소형 배지(`SIMULATED SCENARIO`, `PROVISIONAL 3F`, `OBSERVED_STATION`)**만 하단 절제된 스트립에 배치하고 내부 상태 코드(`S1_SHAKING`)는 숨긴다.
4. **정지 화면(Still Frame) 자립성 검증**:
   - 파동 애니메이션이나 경로 이동 마커를 멈추고 UI를 `[H]`로 숨긴 상태에서도, **지형 음영·수직 앵커·4km 도시 매스·선택 건물의 세밀한 층 와이어프레임 대비**만으로 갤러리 전시 수준의 화면 구도가 성립해야 한다.
5. **저사양 환경 일관성**:
   - 고화질 모드(`HIGH`)와 강의실/에코 모드(`CLASSROOM/ECO`) 모두 동일한 색상 위계와 안전 경고 가독성을 유지하며, 폴리곤 밀도와 프레임당 부가 업데이트 주기만 조절한다.

---
*다음 문서: [`PRIORITIZED_DEVELOPMENT_ROADMAP.md`](file:///Users/katsina/Downloads/earth/docs/research/PRIORITIZED_DEVELOPMENT_ROADMAP.md) (7축 평가 매트릭스 · 3단계 우선순위 로드맵 · 즉시 흡수/검증 후 도입/비도입 확정)*
