
// import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
// import * as THREE from "three";
// import { Canvas, useThree } from "@react-three/fiber";
// import { OrbitControls, Line } from "@react-three/drei";
// import { Physics } from "@react-three/rapier";

// import TileEarth from "./TileEarth";
// import Asteroid, { ImpactFX } from "./Asteroid"; // ← FX из Asteroid.tsx
// import Stars from "./Starts";
// import Rocket from "./Rocket";

// /* ===================== Types ===================== */
// interface GlobeSceneProps {
//   missDistanceKm: number;
//   velocityKps: number;
//   onImpactSelect?: (lat: number, lon: number, worldPoint: THREE.Vector3) => void;
//   onImpact?: () => void;
//   impactSite?: { lat: number; lon: number } | null;
//   neo: {};
// }

// type HitFX = { id: number; pos: THREE.Vector3; normal: THREE.Vector3 };

// type RocketUnit = {
//   id: number;
//   start: THREE.Vector3;
//   order?: RocketOrder | null;
// };

// /* ===================== Helpers ===================== */
// const EARTH_R = 2;

// function getWorldPos(obj?: THREE.Object3D | null) {
//   const v = new THREE.Vector3();
//   if (obj) obj.getWorldPosition(v);
//   return v;
// }

// /** равномерное распределение точек на сфере (Fibonacci sphere) */
// function fibonacciSpherePoints(n: number, radius = EARTH_R + 0.25) {
//   const pts: THREE.Vector3[] = [];
//   const golden = Math.PI * (3 - Math.sqrt(5));
//   for (let i = 0; i < n; i++) {
//     const y = 1 - (i / (n - 1)) * 2; // from 1 to -1
//     const r = Math.sqrt(1 - y * y);
//     const theta = golden * i;
//     const x = Math.cos(theta) * r;
//     const z = Math.sin(theta) * r;
//     pts.push(new THREE.Vector3(x, y, z).multiplyScalar(radius));
//   }
//   return pts;
// }

// /** отражение + толчок вдоль нормали — меняем курс астероида */
// function deflectAsteroid(
//   asteroid: THREE.Object3D,
//   hitPoint: THREE.Vector3,
//   normal: THREE.Vector3,
//   push = 1.8
// ) {
//   const now = new THREE.Vector3();
//   asteroid.getWorldPosition(now);
//   const prev: THREE.Vector3 = asteroid.userData.prevPos ?? now.clone();
//   const v = (asteroid.userData.vel as THREE.Vector3) ?? now.clone().sub(prev);
//   const n = normal.clone().normalize();

//   const vReflected = v.clone().sub(n.clone().multiplyScalar(2 * v.dot(n)));
//   vReflected.add(n.clone().multiplyScalar(push));

//   asteroid.userData.vel = vReflected;
//   asteroid.userData.applyVel = true;
//   asteroid.userData.prevPos = now.clone();
// }

// /* ===================== Globe (click → lat, lon, worldPoint) ===================== */
// function Globe({
//   onImpactSelect,
// }: {
//   onImpactSelect?: (lat: number, lon: number, worldPoint: THREE.Vector3) => void;
// }) {
//   const { camera, gl, scene } = useThree();

//   const handleClick = useCallback(
//     (event: MouseEvent) => {
//       const canvas = gl.domElement;
//       const rect = canvas.getBoundingClientRect();

//       const mouse = new THREE.Vector2(
//         ((event.clientX - rect.left) / rect.width) * 2 - 1,
//         -((event.clientY - rect.top) / rect.height) * 2 + 1
//       );

//       const raycaster = new THREE.Raycaster();
//       raycaster.setFromCamera(mouse, camera);

//       const earth = scene.getObjectByName("earthSphere") as THREE.Object3D | null;
//       if (!earth) return;

//       const intersects = raycaster.intersectObject(earth, true);
//       if (!intersects.length) return;

//       const hit = intersects[0];

//       // lat/lon
//       const local = earth.worldToLocal(hit.point.clone());
//       const nx = local.x / EARTH_R;
//       const ny = local.y / EARTH_R;
//       const nz = local.z / EARTH_R;

//       const lat = 90 - (Math.acos(THREE.MathUtils.clamp(ny, -1, 1)) * 180) / Math.PI;
//       let lon = (Math.atan2(nz, nx) * 180) / Math.PI - 180;
//       if (lon < -180) lon += 360;
//       if (lon >= 180) lon -= 360;

//       // world-point на поверхности
//       const centerWorld = new THREE.Vector3();
//       earth.getWorldPosition(centerWorld);
//       const dir = hit.point.clone().sub(centerWorld).normalize();
//       const worldPoint = centerWorld.add(dir.multiplyScalar(EARTH_R));

//       onImpactSelect?.(lat, lon, worldPoint);
//     },
//     [camera, scene, onImpactSelect, gl]
//   );

//   useEffect(() => {
//     const canvas = gl.domElement;
//     canvas.addEventListener("click", handleClick);
//     return () => canvas.removeEventListener("click", handleClick);
//   }, [gl, handleClick]);

//   return (
//     <mesh name="earthSphere">
//       <sphereGeometry args={[EARTH_R, 64, 64]} />
//       <TileEarth radius={EARTH_R} zoom={2} />
//     </mesh>
//   );
// }

// /* ===================== Line segment ===================== */
// function ImpactPath({
//   start,
//   target,
//   visible,
// }: {
//   start: THREE.Vector3 | null;
//   target: THREE.Vector3 | null;
//   visible: boolean;
// }) {
//   if (!visible || !start || !target) return null;
//   return (
//     <Line
//       points={[start.toArray() as [number, number, number], target.toArray() as [number, number, number]]}
//       lineWidth={2}
//       color="white"
//       transparent
//       opacity={0.85}
//     />
//   );
// }

// /* ===================== Main Scene ===================== */
// export default function GlobeScene({
//   missDistanceKm,
//   velocityKps,
//   onImpactSelect,
//   onImpact,
//   impactSite: impactSiteFromParent,
// }: GlobeSceneProps) {
//   const [time, setTime] = useState(0);
//   const [isPlaying, setIsPlaying] = useState(true);

//   const [impactSite, setImpactSite] = useState<{ lat: number; lon: number } | null>(
//     impactSiteFromParent ?? null
//   );
//   useEffect(() => {
//     setImpactSite(impactSiteFromParent ?? null);
//   }, [impactSiteFromParent]);

//   // мировая точка на сфере
//   const [impactTargetWorld, setImpactTargetWorld] = useState<THREE.Vector3 | null>(null);

//   // линия (мировые координаты)
//   const asteroidRef = useRef<THREE.Mesh>(null);
//   const pathStartRef = useRef<THREE.Vector3 | null>(null);
//   const pathTargetRef = useRef<THREE.Vector3 | null>(null);

//   // ракеты: «пояс безопасности» вокруг Земли, N штук
//   const N = 18;
//   const initialRockets = useMemo(() => {
//     const pts = fibonacciSpherePoints(N);
//     return pts.map((p, i) => ({ id: i + 1, start: p, order: null as RocketOrder | null }));
//   }, []);
//   const [rockets, setRockets] = useState<RocketUnit[]>(initialRockets);
//   const [asteroidShattered, setAsteroidShattered] = useState(false);
//   const [activeRocketIds, setActiveRocketIds] = useState<Set<number>>(
//     () => new Set(rockets.map(r => r.id)) // если rockets уже создан раньше; иначе инициализируй позже
//    );
//   // FX от попаданий ракет
//   const [fxHits, setFxHits] = useState<HitFX[]>([]);
//   const fxId = useRef(1);

//   function asVec3(p: any): THREE.Vector3 {
//     if (p instanceof THREE.Vector3) return p.clone();
//     if (Array.isArray(p)) return new THREE.Vector3(p[0] ?? 0, p[1] ?? 0, p[2] ?? 0);
//     if (p && typeof p === "object") return new THREE.Vector3(p.x ?? 0, p.y ?? 0, p.z ?? 0);
//     return new THREE.Vector3();
//   }
//   // пересчитываем линию
//   useEffect(() => {
//     if (impactTargetWorld) {
//       const startWorld = getWorldPos(asteroidRef.current) || new THREE.Vector3(0, 0, 0);
//       pathStartRef.current = startWorld.clone();
//       pathTargetRef.current = impactTargetWorld.clone();
//     } else {
//       pathStartRef.current = null;
//       pathTargetRef.current = null;
//     }
//   }, [impactTargetWorld]);

//   useEffect(() => {
//   if (asteroidShattered && activeRocketIds.size === 0) {
//     // убрать линию и цель
//     setImpactTargetWorld(null);
//     setImpactSite(null);
//     pathStartRef.current = null;
//     pathTargetRef.current = null;

//     // очистить FX (если хочешь)
//     setFxHits([]);

//     // полностью убрать оставшиеся ракеты (на случай несоответствий)
//     setRockets([]);

//     // (опционально) заблокировать новые приказы после победы
//     // setVictory(true);
//   }
// }, [asteroidShattered, activeRocketIds.size]);

// useEffect(() => {
//   setActiveRocketIds(new Set(rockets.map(r => r.id)));
// }, [rockets]); 

//   // при клике — назначить приказ всем ракетам: выстроиться вдоль линии и атаковать
//   const issueOrders = useCallback((worldPoint: THREE.Vector3) => {
//     if (!asteroidRef.current) return;

//     const aPos = new THREE.Vector3();
//     asteroidRef.current.getWorldPosition(aPos);

//     const lineDir = worldPoint.clone().sub(aPos);
//     const dist = lineDir.length();
//     if (dist < 1e-3) return;
//     lineDir.normalize();

//     // дорожка waypoint’ов между астероидом и точкой удара (10%..90%), равномерно по числу ракет
//     const orders: RocketUnit[] = [];
//     rockets.forEach((r, i) => {
//       const t = (i + 1) / (rockets.length + 1); // 0..1 (без краёв)
//       const tClamped = 0.1 + 0.8 * t;
//       const wp = aPos.clone().add(lineDir.clone().multiplyScalar(dist * tClamped));

//       // небольшой боковой разброс, чтобы не летели строго по одной линии
//       const up = new THREE.Vector3(0, 1, 0);
//       const side = new THREE.Vector3().crossVectors(lineDir, up).normalize();
//       const jitter = side.multiplyScalar((Math.random() - 0.5) * 0.25);
//       wp.add(jitter);

//       const delay = 0.06 * i; // волной

//       orders.push({
//         id: r.id,
//         start: r.start.clone(),
//         order: { waypoint: wp, delay },
//       });
//     });

//     setRockets(orders);
//     setActiveRocketIds(new Set(orders.map(o => o.id)));
//   }, [rockets]);

//   return (
//     <div style={{ width: "100%", height: "95vh", display: "flex", flexDirection: "column", gap: 8 }}>
//       <div style={{ flex: 1 }}>
//         <Canvas
//           camera={{ position: [0, 0, 10], fov: 45 }}
//           dpr={[1, 1.5]}
//           gl={{
//             powerPreference: "high-performance",
//             antialias: false,
//             alpha: false,
//             preserveDrawingBuffer: false,
//           }}
//         >
//           <color attach="background" args={["black"]} />
//           <ambientLight intensity={0.5} />
//           <OrbitControls maxDistance={450} minDistance={7} makeDefault />

//           <Suspense fallback={null}>
//             <Physics gravity={[0, 0, 0]}>
//               <Stars />

//               <Globe
//                 onImpactSelect={(lat, lon, worldPoint) => {
//                   setImpactSite({ lat, lon });
//                   setImpactTargetWorld(worldPoint.clone());

//                   // отдаём приказ всем ракетам выстроиться и атаковать
//                   issueOrders(worldPoint);

//                   // проброс наверх, если нужно
//                   onImpactSelect?.(lat, lon, worldPoint);
//                 }}
//               />
//             </Physics>
//           </Suspense>

//           {/* Астероид */}
//           <Asteroid
//             ref={asteroidRef}
//             missDistanceKm={missDistanceKm}
//             velocityKps={velocityKps}
//             time={time}
//             isPlaying={isPlaying}
//             setTime={setTime}
//             impactSite={impactSite}
//             onImpact={() => {
//               setIsPlaying(false);
//               onImpact?.();
//             }}
//           />

//           {/* Линия к точке удара */}
//           <ImpactPath start={pathStartRef.current} target={pathTargetRef.current} visible={!!impactTargetWorld} />

//           {/* Ракеты-перехватчики по окружности планеты */}
//           {!asteroidShattered && rockets.map(r => (
//             <Rocket
//               key={r.id}
//               id={r.id}
//               start={r.start}
//               targetRef={asteroidRef}
//               order={r.order}
//               speed={2.5}      // ← медленнее
//               turnRate={3.5}  // ← поворот тоже помягче
//               hitRadius={0.32}
//               onHit={(rocketId, hitPoint) => {
//                     const hp = asVec3(hitPoint);              // помощник, который приводит к Vector3
//                     if (asteroidRef.current) {
//                     // 1) нормаль в точке удара: из hitPoint к центру астероида
//                     const aPos = new THREE.Vector3();
//                     asteroidRef.current.getWorldPosition(aPos);
//                     const normal = aPos.clone().sub(hp).normalize();

//                     // 2) эффект удара (каждый раз) + отклонение курса
//                     setFxHits(list => [...list, { id: fxId.current++, pos: hp.clone(), normal }]);
//                     deflectAsteroid(asteroidRef.current, hp, normal, 1.6); // push можешь подстроить

//                     // 3) убрать попавшую ракету из списка на рендер
//                     setRockets(prev => prev.filter(r => r.id !== rocketId));

//                     // 4) отметить попадание в активном наборе и если это была ПОСЛЕДНЯЯ — разрушить и очистить
//                     setActiveRocketIds(prev => {
//                         const next = new Set(prev);
//                         next.delete(rocketId);

//                         if (next.size === 0 && asteroidRef.current && !asteroidShattered) {
//                         // ЛОМАЕМ астероид только когда все ракеты уже попали
//                         (asteroidRef.current as any).shatter?.(hp, normal);
//                         setAsteroidShattered(true);

//                         // очистка направляющей линии/цели
//                         setImpactTargetWorld(null);
//                         setImpactSite(null);
//                         pathStartRef.current = null;
//                         pathTargetRef.current = null;

//                         // (опционально) подчистить вспышки со временем
//                         // setFxHits([]);
//                         }

//                         return next;
//                     });
//                     }
//                 }}
//             //   onHit={(rocketId, hitPoint) => {
//             //     const hp = asVec3(hitPoint);           // ✅ robust
//             //     if (asteroidRef.current) {
//             //     const aPos = new THREE.Vector3();
//             //     asteroidRef.current.getWorldPosition(aPos);
//             //     const normal = aPos.clone().sub(hp).normalize();

//             //     // deflect OR shatter (depending on your current logic)
//             //     // deflectAsteroid(asteroidRef.current, hp, normal, 1.9);
//             //     (asteroidRef.current as any).shatter?.(hp, normal);

//             //     setFxHits(list => [...list, { id: fxId.current++, pos: hp.clone(), normal }]); // ✅ hp.clone() is safe
//             //     }
//             //     // setAsteroidGone(true);
//             //     // setRockets([]);               // убрать все ракеты
//             //     // setImpactTargetWorld(null);   // убрать линию
//             //     // setImpactSite(null);          // сброс гео-цели (на всякий случай)
//             //     // pathStartRef.current = null;  // подстраховка
//             //     // pathTargetRef.current = null;
//             //     // setRockets(list => list.map(u => (u.id === rocketId ? { ...u, order: null } : u)));
//             // }}
//             />
//           ))}

//           {/* FX от попаданий ракет */}
//           {fxHits.map((fx) => (
//             <ImpactFX
//               key={fx.id}
//               position={fx.pos}
//               normal={fx.normal}
//               onDone={() => setFxHits((list) => list.filter((x) => x.id !== fx.id))}
//             />
//           ))}

//           <Stars />
//         </Canvas>
//       </div>

//       <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 8 }}>
//         <button onClick={() => setIsPlaying((p) => !p)} style={{ padding: "6px 10px" }}>
//           {isPlaying ? "Pause" : "Play"}
//         </button>
//         <button onClick={() => setTime(0)} style={{ padding: "6px 10px" }}>
//           Reset time
//         </button>

//         <input
//           type="range"
//           min={0}
//           max={200}
//           value={time}
//           onChange={(e) => setTime(Number(e.target.value))}
//           style={{ flex: 1 }}
//         />
//         <span style={{ width: 50 }}>{time.toFixed(0)}s</span>
//         <span style={{ opacity: 0.7 }}>
//           {impactSite ? `Target: ${impactSite.lat.toFixed(2)}°, ${impactSite.lon.toFixed(2)}°` : "No target"}
//         </span>
//       </div>
//     </div>
//   );
// }





import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Line } from "@react-three/drei";
import { Physics } from "@react-three/rapier";

import TileEarth from "./TileEarth";
import Asteroid, { ImpactFX } from "./Asteroid";
import Stars from "./Starts";
import Rocket from "./Rocket"; // default export

/* Если у Rocket.tsx не экспортируется тип, объявим локально */
type RocketOrder = { waypoint?: THREE.Vector3 | null; delay?: number };

/* ===================== Types ===================== */
interface GlobeSceneProps {
  missDistanceKm: number;
  velocityKps: number;
  onImpactSelect?: (lat: number, lon: number, worldPoint: THREE.Vector3) => void;
  onImpact?: () => void;
  onPlanReady?: (plan: RocketPlan | null) => void;
  onAiSummaryReady?: (summary: string) => void;
  impactSite?: { lat: number; lon: number } | null;
  neo?: any;
}

type HitFX = { id: number; pos: THREE.Vector3; normal: THREE.Vector3 };

type RocketUnit = {
  id: number;
  start: THREE.Vector3;
  order?: RocketOrder | null;
};
type RocketProfile = {
  id: string;
  count: number;
  speed: number;
  deltaV_kps: number;
  hitRadius?: number;
  delaySec?: number;
};
type RocketPlan = {
  summary: string;
  rocketCount: number;
  profiles: RocketProfile[];
  postShatter: {
    targetRadial_dv_kps: number;
    minimumSafePerigee_km: number;
    suggestExtraInterceptors?: boolean;
  };
};
/* ===================== Helpers ===================== */
const EARTH_R = 2;

function getWorldPos(obj?: THREE.Object3D | null) {
  const v = new THREE.Vector3();
  if (obj) obj.getWorldPosition(v);
  return v;
}

function fibonacciSpherePoints(n: number, radius = EARTH_R + 0.25) {
  const pts: THREE.Vector3[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / Math.max(1, n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = golden * i;
    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;
    pts.push(new THREE.Vector3(x, y, z).multiplyScalar(radius));
  }
  return pts;
}

/** отражение + толчок вдоль нормали — меняем курс астероида */
function deflectAsteroid(
  asteroid: THREE.Object3D,
  hitPoint: THREE.Vector3,
  normal: THREE.Vector3,
  push = 2.0
) {
  const now = new THREE.Vector3();
  asteroid.getWorldPosition(now);
  const prev: THREE.Vector3 = asteroid.userData.prevPos ?? now.clone();
  const v = (asteroid.userData.vel as THREE.Vector3) ?? now.clone().sub(prev);

  const n = normal.clone().normalize();
  let vNew = v.clone().sub(n.clone().multiplyScalar(2 * v.dot(n)));
  vNew.add(n.clone().multiplyScalar(push));

  // гарантируем не-внутрь
  const rHat = now.clone().normalize();
  if (vNew.dot(rHat) < 0) {
    const tangential = vNew.clone().sub(rHat.clone().multiplyScalar(vNew.dot(rHat)));
    vNew = tangential.add(rHat.clone().multiplyScalar(Math.abs(vNew.dot(rHat))));
  }

  asteroid.userData.vel = vNew;
  asteroid.userData.applyVel = true;
  asteroid.userData.prevPos = now.clone();
}

/* ===================== Globe (click → lat, lon, worldPoint) ===================== */
function Globe({
  onImpactSelect, 
  onGeoClick
}: {
  onImpactSelect?: (lat: number, lon: number, worldPoint: THREE.Vector3) => void;
  onGeoClick?: (lat: number, lon: number, worldPoint: THREE.Vector3) => void;
}) {
  const { camera, gl, scene } = useThree();

  const handleClick = useCallback(
    (event: MouseEvent) => {
      const canvas = gl.domElement;
      const rect = canvas.getBoundingClientRect();

      const mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);

      const earth = scene.getObjectByName("earthSphere") as THREE.Object3D | null;
      if (!earth) return;

      const intersects = raycaster.intersectObject(earth, true);
      if (!intersects.length) return;

      const hit = intersects[0];

      // lat/lon
      const local = earth.worldToLocal(hit.point.clone());
      const nx = local.x / EARTH_R;
      const ny = local.y / EARTH_R;
      const nz = local.z / EARTH_R;

      const lat = 90 - (Math.acos(THREE.MathUtils.clamp(ny, -1, 1)) * 180) / Math.PI;
      let lon = (Math.atan2(nz, nx) * 180) / Math.PI - 180;
      if (lon < -180) lon += 360;
      if (lon >= 180) lon -= 360;

      // world-point на поверхности
      const centerWorld = new THREE.Vector3();
      earth.getWorldPosition(centerWorld);
      const dir = hit.point.clone().sub(centerWorld).normalize();
      const worldPoint = centerWorld.add(dir.multiplyScalar(EARTH_R));

      onImpactSelect?.(lat, lon, worldPoint);
      onGeoClick?.(lat, lon, worldPoint);
    },
    [camera, scene, onImpactSelect, gl, onGeoClick]
  );

  useEffect(() => {
    const canvas = gl.domElement;
    canvas.addEventListener("click", handleClick);
    return () => canvas.removeEventListener("click", handleClick);
  }, [gl, handleClick]);

  return (
    <mesh name="earthSphere">
      <sphereGeometry args={[EARTH_R, 64, 64]} />
      <TileEarth radius={EARTH_R} zoom={2} />
    </mesh>
  );
}

/* ===================== Line segment ===================== */
function ImpactPath({
  start,
  target,
  visible,
}: {
  start: THREE.Vector3 | null;
  target: THREE.Vector3 | null;
  visible: boolean;
}) {
  if (!visible || !start || !target) return null;
  return (
    <Line
      points={[start.toArray() as [number, number, number], target.toArray() as [number, number, number]]}
      lineWidth={2}
      color="white"
      transparent
      opacity={0.85}
    />
  );
}
/* ===================== Main Scene ===================== */
export default function GlobeScene({
  missDistanceKm,
  velocityKps,
  onImpactSelect,
  onImpact,
  
  impactSite: impactSiteFromParent, onPlanReady, onAiSummaryReady
}: GlobeSceneProps) {
  const [time, setTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [plan, setPlan] = useState<RocketPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [asteroidShattered, setAsteroidShattered] = useState(false); 

  const [impactSite, setImpactSite] = useState<{ lat: number; lon: number } | null>(
    impactSiteFromParent ?? null
  );
  useEffect(() => {
    setImpactSite(impactSiteFromParent ?? null);
  }, [impactSiteFromParent]);

  // мировая точка на сфере
  const [impactTargetWorld, setImpactTargetWorld] = useState<THREE.Vector3 | null>(null);

  // линия (мировые координаты)
  const asteroidRef = useRef<THREE.Mesh>(null);
  const pathStartRef = useRef<THREE.Vector3 | null>(null);
  const pathTargetRef = useRef<THREE.Vector3 | null>(null);
  

  async function fetchImpactAI(lat: number, lon: number, massKg: number) {
    const res = await fetch("/api/ai/predict-impact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat, lon, mass_kg: massKg }),
    });
    if (!res.ok) throw new Error(`AI impact API failed: ${res.status}`);
    
    const data = await res.json().catch(() => ({}));
    if (typeof data === "string") return data;
    return "(No AI summary returned)";
  }

  const diameterKm = /* define this variable */ 1; // example value
  const density = /* define this variable */ 3000; // example value

  const massKg = estimateMassKg(diameterKm, density);

   useEffect(() => {
    if (!massKg || !velocityKps) return;

    setPlanLoading(true);
    setPlanError(null);

    fetch("/api/ai/plan-intercept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        massKg,
        relSpeedKps: velocityKps,
        diameterM: diameterKm * 1000,
        densityKgM3: density,
      }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: RocketPlan) => {
        setPlan(data);
        onPlanReady?.(data);              
      })
      .catch((e) => {
        setPlanError(String(e));
        onPlanReady?.(null);             
      })
      .finally(() => setPlanLoading(false));
  }, [massKg, velocityKps, diameterKm, density, onPlanReady]);

  const handleGlobeClick = useCallback(
  
    async (lat: number, lon: number, worldPoint: THREE.Vector3) => {
      
      if (asteroidShattered) return;

      // your local scene updates
      setImpactSite({ lat, lon });
      setImpactTargetWorld(worldPoint.clone());
      // issueOrders(worldPoint);

      // AI summary (bubble up)
      try {
        const aiText = await fetchImpactAI(lat, lon, massKg);
        console.log("aiText", aiText);
        onAiSummaryReady?.(aiText);
      } catch (e) {
        onAiSummaryReady?.(`(AI unavailable: ${String(e)})`);
      }
    },
    [asteroidShattered, massKg, onAiSummaryReady]
  );


  function estimateMassKg(diameterKm: number, densityKgM3 = 3000) {
    const radiusM = (diameterKm * 1000) / 2;
    const volumeM3 = (4 / 3) * Math.PI * Math.pow(radiusM, 3);
    return volumeM3 * densityKgM3;
  }
  // ракеты
  const N = plan?.rocketCount ?? 0;
  const initialRockets = useMemo(() => {
    const pts = fibonacciSpherePoints(N);
    return pts.map((p, i) => ({ 
      id: i + 1, 
      start: p, 
      order: null as RocketOrder | null 
    }));
  }, [N]); // Add N as dependency

  const [rockets, setRockets] = useState<RocketUnit[]>(initialRockets);
  useEffect(() => {
    setRockets(initialRockets);
  }, [initialRockets]);
  // учёт попаданий

  const [activeRocketIds, setActiveRocketIds] = useState<Set<number>>(
    () => new Set(initialRockets.map(r => r.id))
  );

  // FX от попаданий ракет
  const [fxHits, setFxHits] = useState<HitFX[]>([]);
  const fxId = useRef(1);

  function asVec3(p: any): THREE.Vector3 {
    if (p instanceof THREE.Vector3) return p.clone();
    if (Array.isArray(p)) return new THREE.Vector3(p[0] ?? 0, p[1] ?? 0, p[2] ?? 0);
    if (p && typeof p === "object") return new THREE.Vector3(p.x ?? 0, p.y ?? 0, p.z ?? 0);
    return new THREE.Vector3();
  }

  // линия обновляется при смене цели
  useEffect(() => {
    if (impactTargetWorld) {
      const startWorld = getWorldPos(asteroidRef.current) || new THREE.Vector3(0, 0, 0);
      pathStartRef.current = startWorld.clone();
      pathTargetRef.current = impactTargetWorld.clone();
    } else {
      pathStartRef.current = null;
      pathTargetRef.current = null;
    }
  }, [impactTargetWorld]);

  // очистка после ТОЛЬКО последней ракеты (когда уже шардили)
  useEffect(() => {
    if (asteroidShattered && activeRocketIds.size === 0) {
      setImpactTargetWorld(null);
      setImpactSite(null);
      pathStartRef.current = null;
      pathTargetRef.current = null;
      setFxHits([]);
      setRockets([]);
    }
  }, [asteroidShattered, activeRocketIds.size]);

  // держим Set ID в синхроне с массивом ракет
  useEffect(() => {
    setActiveRocketIds(new Set(rockets.map(r => r.id)));
  }, [rockets]);

  // при клике — отдаем приказы всем ракетам
  const issueOrders = useCallback((worldPoint: THREE.Vector3) => {
  if (!asteroidRef.current) return;

  // просто раздать всем: старт сразу, без промежуточных точек
  const orders: RocketUnit[] = rockets.map((r) => ({
    id: r.id,
    start: r.start.clone(),
    order: { waypoint: null, delay: 0 }, // ← ключевой момент
  }));

  setRockets(orders);
  setActiveRocketIds(new Set(orders.map(o => o.id)));
}, [rockets]);

  return (
    <div style={{ width: "100%", height: "95vh", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ flex: 1 }}>
        <Canvas
          camera={{ position: [0, 0, 10], fov: 45 }}
          dpr={[1, 1.5]}
          gl={{
            powerPreference: "high-performance",
            antialias: false,
            alpha: false,
            preserveDrawingBuffer: false,
          }}
        >
          <color attach="background" args={["black"]} />
          <ambientLight intensity={0.5} />
          <OrbitControls maxDistance={450} minDistance={7} makeDefault />

          <Suspense fallback={null}>
            <Physics gravity={[0, 0, 0]}>
              <Stars />
              <Globe
                onGeoClick={handleGlobeClick} 
                onImpactSelect={(lat, lon, worldPoint) => {
                  if (asteroidShattered) return;
                  setImpactSite({ lat, lon });
                  setImpactTargetWorld(worldPoint.clone());
                  issueOrders(worldPoint);
                  onImpactSelect?.(lat, lon, worldPoint);
                  

                }}
              />
            </Physics>
          </Suspense>

          {/* Астероид */}
          <Asteroid
            ref={asteroidRef}
            missDistanceKm={missDistanceKm}
            velocityKps={velocityKps}
            time={time}
            isPlaying={isPlaying}
            setTime={setTime}
            impactSite={impactSite}
            onImpact={() => {
              setIsPlaying(false);
              onImpact?.();
            }}
          />

          {/* Линия к точке удара */}
          {!asteroidShattered && (
            <ImpactPath
              start={pathStartRef.current}
              target={pathTargetRef.current}
              visible={!!impactTargetWorld}
            />
          )}

          {/* Ракеты */}
          {!asteroidShattered && rockets.map((r) => (
            <Rocket
              key={r.id}
              id={r.id}
              start={r.start}
              targetRef={asteroidRef}
              order={r.order}
              speed={2.5}
              turnRate={1.5}
              hitRadius={0.38}
              onHit={(rocketId, hitPoint) => {
                const hp = asVec3(hitPoint);
                if (!asteroidRef.current) return;

                // нормаль из точки удара к центру астероида
                const aPos = new THREE.Vector3();
                asteroidRef.current.getWorldPosition(aPos);
                const normal = aPos.clone().sub(hp).normalize();

                // 1) эффект + отклонение курса (но НЕ шардим)
                setFxHits(list => [...list, { id: fxId.current++, pos: hp.clone(), normal }]);
                deflectAsteroid(asteroidRef.current, hp, normal, 2.0);
                (asteroidRef.current as any).cancelGuidance?.(); // выключить автопилот dive

                // 2) убрать САМУ попавшую ракету из рендера
                setRockets(prev => prev.filter(x => x.id !== rocketId));

                // 3) снять ID из активного набора и — если это была ПОСЛЕДНЯЯ — шардим и чистим
                setActiveRocketIds(prev => {
                  const next = new Set(prev);
                  next.delete(rocketId);

                  if (next.size === 0 && (asteroidRef.current as any)?.shatter && !asteroidShattered) {
                    // ✅ разрушить ТОЛЬКО когда ВСЕ ракеты попали
                    (asteroidRef.current as any).shatter(hp, normal);
                    setAsteroidShattered(true);

                    // очистить линию/цель
                    setImpactTargetWorld(null);
                    setImpactSite(null);
                    pathStartRef.current = null;
                    pathTargetRef.current = null;

                    // (ракеты уберутся автоматически, т.к. уже пустой набор и мы их фильтруем по onHit)
                  }

                  return next;
                });
              }}
              // onHit={(rocketId, hitPoint) => {
              //   const hp = asVec3(hitPoint);
              //   if (asteroidRef.current) {
              //     const aPos = new THREE.Vector3();
              //     asteroidRef.current.getWorldPosition(aPos);
              //     const normal = aPos.clone().sub(hp).normalize();

              //     // FX + отклонение
              //     setFxHits((list) => [...list, { id: fxId.current++, pos: hp.clone(), normal }]);
              //     deflectAsteroid(asteroidRef.current, hp, normal, 2.0);
              //     // выключаем наведение при первом же ударе
              //     (asteroidRef.current as any).cancelGuidance?.();

              //     // убираем конкретную ракету
              //     setRockets((prev) => prev.filter((x) => x.id !== rocketId));

              //     // обновляем активный набор и, если это ПОСЛЕДНЯЯ — шардим и чистим
              //     setActiveRocketIds((prev) => {
              //       const next = new Set(prev);
              //       next.delete(rocketId);

              //       if (next.size === 0 && (asteroidRef.current as any)?.shatter && !asteroidShattered) {
              //         (asteroidRef.current as any).shatter(hp, normal);
              //         setAsteroidShattered(true);
              //         setImpactTargetWorld(null);
              //         setImpactSite(null);
              //         pathStartRef.current = null;
              //         pathTargetRef.current = null;
              //       }
              //       return next;
              //     });
              //   }
              // }}
            />
          ))}

          {/* FX от попаданий ракет */}
          {fxHits.map((fx) => (
            <ImpactFX
              key={fx.id}
              position={fx.pos}
              normal={fx.normal}
              onDone={() => setFxHits((list) => list.filter((x) => x.id !== fx.id))}
            />
          ))}

          <Stars />
        </Canvas>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 8 }}>
        <button onClick={() => setIsPlaying((p) => !p)} style={{ padding: "6px 10px" }}>
          {isPlaying ? "Pause" : "Play"}
        </button>
        <button onClick={() => setTime(0)} style={{ padding: "6px 10px" }}>
          Reset time
        </button>

        <input
          type="range"
          min={0}
          max={200}
          value={time}
          onChange={(e) => setTime(Number(e.target.value))}
          style={{ flex: 1 }}
        />
        <span style={{ width: 50 }}>{time.toFixed(0)}s</span>
        <span style={{ opacity: 0.7 }}>
          {impactSite ? `Target: ${impactSite.lat.toFixed(2)}°, ${impactSite.lon.toFixed(2)}°` : "No target"}
        </span>
      </div>
    </div>
  );
}












// import React, { useCallback, useEffect, useRef, useState } from "react";
// import { Canvas, useFrame, useThree } from "@react-three/fiber";
// import { OrbitControls, Stars, Line } from "@react-three/drei";
// import TileEarth from "./TileEarth";
// import Asteroid from "./Asteroid";
// import AsteroidFlybyOrbit from "./AsteroidFlybyOrbit";
// import * as THREE from "three";

// interface GlobeSceneProps {
//   missDistanceKm: number;
//   velocityKps: number;
//   onImpactSelect?: (lat: number, lon: number) => void;
//   onImpact?: () => void;
//   impactSite?: { lat: number; lon: number } | null;
// }

// function CameraController({
//   asteroidRef,
//   isPlaying,
// }: {
//   asteroidRef: React.RefObject<THREE.Mesh>;
//   isPlaying: boolean;
// }) {
//   const { camera } = useThree();
//   const prevPos = useRef<THREE.Vector3 | null>(null);

//   useFrame(() => {
//     const asteroid = asteroidRef.current;
//     if (!asteroid) return;

//     const curr = asteroid.position.clone();

//     // Estimate forward direction from last frame
//     if (!prevPos.current) prevPos.current = curr.clone();
//     const vel = curr.clone().sub(prevPos.current);
//     prevPos.current.copy(curr);

//     // If asteroid is nearly stationary, fall back to a sane forward
//     const hasDir = vel.lengthSq() > 1e-6;
//     const forward = hasDir ? vel.normalize() : new THREE.Vector3(0, 0, 1);

//     // Camera offset: a bit behind along -forward and slightly above
//     const behind = forward.clone().multiplyScalar(-8);
//     const up = new THREE.Vector3(0, 3, 0);
//     const desired = curr.clone().add(behind).add(up);

//     // Smoothly move camera and always look at the asteroid
//     camera.position.lerp(desired, 0.12);
//     camera.lookAt(curr);
//   });

//   return null;
// }

// function Globe({
//   onImpactSelect,
// }: {
//   onImpactSelect?: (lat: number, lon: number) => void;
// }) {
//   const { camera, gl, scene } = useThree();

//   const handleClick = useCallback(
//     (event: MouseEvent) => {
//       const canvas = gl.domElement;
//       const rect = canvas.getBoundingClientRect();

//       const mouse = new THREE.Vector2();
//       mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
//       mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

//       const raycaster = new THREE.Raycaster();
//       raycaster.setFromCamera(mouse, camera);

//       const earth = scene.getObjectByName("earthSphere");
//       if (!earth) return;

//       const intersects = raycaster.intersectObject(earth);
//       if (intersects.length > 0) {
//         const point = intersects[0].point;
//         const radius = 2;
//         const lat = 90 - (Math.acos(point.y / radius) * 180) / Math.PI;
//         const lon =
//           ((Math.atan2(point.z, point.x) * 180) / Math.PI + 180) % 360 - 180;
//         onImpactSelect?.(lat, lon);
//       }
//     },
//     [camera, scene, onImpactSelect, gl]
//   );

//   useEffect(() => {
//     const canvas = gl.domElement;
//     canvas.addEventListener("click", handleClick);
//     return () => canvas.removeEventListener("click", handleClick);
//   }, [gl, handleClick]);

//   return (
//     <mesh name="earthSphere">
//       <sphereGeometry args={[2, 64, 64]} />
//       <TileEarth radius={2} zoom={2} />
//     </mesh>
//   );
// }

// // Small helper to convert lat/lon to a point on the Earth sphere
// function toEarthPos(lat: number, lon: number, radius = 2) {
//   const phi = (90 - lat) * (Math.PI / 180);
//   const theta = (lon + 180) * (Math.PI / 180);
//   return new THREE.Vector3(
//     radius * Math.sin(phi) * Math.cos(theta),
//     radius * Math.cos(phi),
//     radius * Math.sin(phi) * Math.sin(theta)
//   );
// }

// // Straight guide line from the asteroid’s position (at selection time) to the target point
// function ImpactPath({
//   start,
//   target,
//   visible,
// }: {
//   start: THREE.Vector3 | null;
//   target: THREE.Vector3 | null;
//   visible: boolean;
// }) {
//   if (!visible || !start || !target) return null;
//   return (
//     <Line
//       points={[
//         start.toArray() as [number, number, number],
//         target.toArray() as [number, number, number],
//       ]}
//       lineWidth={2}
//       color="white"
//       transparent
//       opacity={0.75}
//     />
//   );
// }

// export default function GlobeScene({
//   missDistanceKm,
//   velocityKps,
//   onImpactSelect,
//   onImpact,
//   impactSite,
// }: GlobeSceneProps) {
//   const [time, setTime] = useState(0);
//   const [isPlaying, setIsPlaying] = useState(true);
//   const [cameraMode, setCameraMode] = useState<"follow" | "free">("follow");

//   const asteroidRef = useRef<THREE.Mesh>(null);

//   // Store a frozen copy of the asteroid position at the moment an impactSite is picked,
//   // so the straight path is stable (no drifting start).
//   const pathStartRef = useRef<THREE.Vector3 | null>(null);
//   const pathTargetRef = useRef<THREE.Vector3 | null>(null);

//   // When impactSite changes, capture current asteroid position and compute target point
//   // useEffect(() => {
//   //   if (impactSite) {
//   //     const currentPos =
//   //       asteroidRef.current?.position?.clone() ?? new THREE.Vector3(0, 0, 0);
//   //     pathStartRef.current = currentPos;
//   //     pathTargetRef.current = toEarthPos(impactSite.lat, impactSite.lon, 2);
//   //   } else {
//   //     pathStartRef.current = null;
//   //     pathTargetRef.current = null;
//   //   }
//   // }, [impactSite]);
//   useEffect(() => {
//   if (impactSite) {
//     setCameraMode("free");   // eliminate parallax artifacts during the straight dive
//   }
// }, [impactSite]);

//   return (
//     <div className="w-full h-[95vh] flex flex-col gap-2">
//       <div className="flex-1">
//         <Canvas camera={{ position: [0, 0, 10], fov: 45 }}>
//           <ambientLight intensity={0.5} />
//           <directionalLight position={[5, 5, 5]} />

//           <Globe onImpactSelect={onImpactSelect} />

//           <AsteroidFlybyOrbit missDistanceKm={missDistanceKm} />

//           <Asteroid
//             ref={asteroidRef}
//             missDistanceKm={missDistanceKm}
//             velocityKps={velocityKps}
//             time={time}
//             isPlaying={isPlaying}
//             setTime={setTime} // Asteroid uses functional updates internally
//             impactSite={impactSite}
//             onImpact={() => {
//               setIsPlaying(false);
//               onImpact?.();
//             }}
//           />

//           {/* Straight guide line to impact target */}
//           <ImpactPath
//             start={pathStartRef.current}
//             target={pathTargetRef.current}
//             visible={!!impactSite}
//           />

//           {cameraMode === 'follow' && (
//             <CameraController asteroidRef={asteroidRef} isPlaying={isPlaying} />
//           )}
//           {cameraMode === 'free' && <OrbitControls />}

//           <Stars />
          
//         </Canvas>
//       </div>

//       {/* Controls */}
//       <div className="flex items-center gap-4 p-2">
//         <button
//           onClick={() => setIsPlaying((prev) => !prev)}
//           className="px-3 py-1 bg-blue-600 text-white rounded"
//         >
//           {isPlaying ? "Pause" : "Play"}
//         </button>

//         <button
//           onClick={() =>
//             setCameraMode(cameraMode === "follow" ? "free" : "follow")
//           }
//           className="px-3 py-1 bg-green-600 text-white rounded"
//         >
//           {cameraMode === "follow" ? "Free Camera" : "Follow Asteroid"}
//         </button>

//         <button
//           onClick={() => setTime(0)}
//           className="px-3 py-1 bg-gray-600 text-white rounded"
//         >
//           Reset
//         </button>

//         <input
//           type="range"
//           min={0}
//           max={200}
//           value={time}
//           onChange={(e) => setTime(Number(e.target.value))}
//           className="flex-1"
//         />
//         <span className="w-12 text-sm text-gray-700">{time.toFixed(0)}s</span>

//         <div className="text-xs text-gray-600">
//           Impact:{" "}
//           {impactSite
//             ? `${impactSite.lat.toFixed(1)}°, ${impactSite.lon.toFixed(1)}°`
//             : "None"}
//         </div>
//       </div>
//     </div>
//   );
// }



// import { useCallback, useState, useRef } from "react";
// import { Canvas, useFrame, useThree } from "@react-three/fiber";
// import { OrbitControls, Stars } from "@react-three/drei";
// import TileEarth from "./TileEarth";
// import Asteroid from "./Asteroid";
// import AsteroidFlybyOrbit from "./AsteroidFlybyOrbit";
// import * as THREE from "three";
// import React from "react";

// interface GlobeSceneProps {
//   missDistanceKm: number;
//   velocityKps: number;
//   onImpactSelect?: (lat: number, lon: number) => void;
//   onImpact?: () => void;
//   impactSite?: { lat: number; lon: number } | null; // Add this prop
// }

// function CameraController({ asteroidRef, isPlaying }: { asteroidRef: React.RefObject<THREE.Mesh>, isPlaying: boolean }) {
//   const { camera } = useThree();
  
//   useFrame(() => {
//     if (asteroidRef.current && isPlaying) {
//       const asteroidPos = asteroidRef.current.position;
      
//       // Position camera to follow asteroid trajectory
//       // Camera positioned behind and slightly above the asteroid
//       const offset = new THREE.Vector3(-8, 3, -5);
//       const targetCameraPos = asteroidPos.clone().add(offset);
      
//       // Smooth camera movement
//       camera.position.lerp(targetCameraPos, 0.05);
      
//       // Make camera look towards Earth, not directly at asteroid
//       camera.lookAt(0, 0, 0);
//     }
//   });
  
//   return null;
// }

// function Globe({ onImpactSelect }: { onImpactSelect?: (lat: number, lon: number) => void }) {
//   const { camera, gl, scene } = useThree();

//   const handleClick = useCallback(
//     (event: any) => {
//       console.log("🖱️ Click detected on canvas");
      
//       const canvas = gl.domElement;
//       const rect = canvas.getBoundingClientRect();
      
//       const mouse = new THREE.Vector2();
//       mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
//       mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

//       console.log("🖱️ Mouse coordinates:", mouse);

//       const raycaster = new THREE.Raycaster();
//       raycaster.setFromCamera(mouse, camera);

//       const earth = scene.getObjectByName("earthSphere");
//       console.log("🌍 Earth object found:", !!earth);
      
//       if (!earth) return;

//       const intersects = raycaster.intersectObject(earth);
//       console.log("🎯 Intersections found:", intersects.length);
      
//       if (intersects.length > 0) {
//         const point = intersects[0].point;
//         console.log("📍 Intersection point:", point);

//         const radius = 2;
//         const lat = 90 - (Math.acos(point.y / radius) * 180) / Math.PI;
//         const lon =
//           ((Math.atan2(point.z, point.x) * 180) / Math.PI + 180) % 360 - 180;

//         console.log("🗺️ Calculated lat/lon:", { lat, lon });
//         onImpactSelect?.(lat, lon);
//       }
//     },
//     [camera, scene, onImpactSelect, gl]
//   );

//   React.useEffect(() => {
//     const canvas = gl.domElement;
//     canvas.addEventListener('click', handleClick);
    
//     return () => {
//       canvas.removeEventListener('click', handleClick);
//     };
//   }, [gl, handleClick]);

//   return (
//     <mesh name="earthSphere">
//       <sphereGeometry args={[2, 64, 64]} />
//       <TileEarth radius={2} zoom={2} />
//     </mesh>
//   );
// }

// export default function GlobeScene({
//   missDistanceKm,
//   velocityKps,
//   onImpactSelect,
//   onImpact,
//   impactSite, // Accept impactSite from parent
// }: GlobeSceneProps) {
//   const [time, setTime] = useState(0);
//   const [isPlaying, setIsPlaying] = useState(true);
//   const [cameraMode, setCameraMode] = useState<'follow' | 'free'>('follow');
//   // Remove local impactSite state - it comes from parent now
//   const asteroidRef = useRef<THREE.Mesh>(null);

//   return (
//     <div className="w-full h-[95vh] flex flex-col gap-2">
//       <div className="flex-1">
//         <Canvas camera={{ position: [0, 0, 10], fov: 45 }}>
//           <ambientLight intensity={0.5} />
//           <directionalLight position={[5, 5, 5]} />

//           <Globe 
//             onImpactSelect={onImpactSelect} // Direct pass-through to parent
//           />

//           <AsteroidFlybyOrbit missDistanceKm={missDistanceKm} />
//           <Asteroid
//             ref={asteroidRef}
//             missDistanceKm={missDistanceKm}
//             velocityKps={velocityKps}
//             time={time}
//             isPlaying={isPlaying}
//             setTime={setTime}
//             impactSite={impactSite} // Pass impact site from parent
//             onImpact={() => {
//               setIsPlaying(false);
//               onImpact?.();
//             }}
//           />

//           {cameraMode === 'follow' && (
//             <CameraController asteroidRef={asteroidRef} isPlaying={isPlaying} />
//           )}

//           <Stars />
//           {cameraMode === 'free' && <OrbitControls />}
//         </Canvas>
//       </div>

//       {/* Controls */}
//       <div className="flex items-center gap-4 p-2">
//         <button
//           onClick={() => setIsPlaying((prev) => !prev)}
//           className="px-3 py-1 bg-blue-600 text-white rounded"
//         >
//           {isPlaying ? "Pause" : "Play"}
//         </button>
        
//         <button
//           onClick={() => setCameraMode(cameraMode === 'follow' ? 'free' : 'follow')}
//           className="px-3 py-1 bg-green-600 text-white rounded"
//         >
//           {cameraMode === 'follow' ? "Free Camera" : "Follow Asteroid"}
//         </button>
        
//         <button
//           onClick={() => setTime(0)}
//           className="px-3 py-1 bg-gray-600 text-white rounded"
//         >
//           Reset
//         </button>
        
//         <input
//           type="range"
//           min={0}
//           max={200}
//           value={time}
//           onChange={(e) => setTime(Number(e.target.value))}
//           className="flex-1"
//         />
//         <span className="w-12 text-sm text-gray-700">{time.toFixed(0)}s</span>
        
//         {/* Debug info */}
//         <div className="text-xs text-gray-600">
//           Impact: {impactSite ? `${impactSite.lat.toFixed(1)}°, ${impactSite.lon.toFixed(1)}°` : "None"}
//         </div>
//       </div>
//     </div>
//   );
// }