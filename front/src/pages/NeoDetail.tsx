// import { useParams } from "react-router";

// export default function NeoDetail() {
//   const { id } = useParams();
//   return <h1>NEO Detail Page — ID: {id}</h1>;
// }

import * as THREE from "three";
import { useLoaderData, type LoaderFunction } from "react-router";
import GlobeScene from "../lib/components/GlobeScene";
import { simulateImpact } from "../lib/utils/impactSim";
import { useMemo, useState, useEffect, useRef, useFrame } from "react";
import PlanPanel from './../lib/components/PlanPanel';
import { AiThreatPanel } from "./../lib/components/AiThreatPanel";

async function fetchImpactThreat(lat: number, lon: number, massKg: number) {
  console.log("data", lat, lon, massKg)
  const res = await fetch('/api/ai/predict-impact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat, lon, mass_kg: massKg }),
  });
  if (!res.ok) throw new Error('Impact threat API failed');
  const data = await res.json();
  console.log('Impact threat API →', data);
  return data;
}

async function fetchCountryImpactThreat(lat: number, lon: number) {
  console.log("data", lat, lon)
  const res = await fetch(`/api/nominatim/getLocation?lat=${lat}&lon=${lon}`);

  const data = await res.json();
  console.log('Country Impact threat API →', data);
  return data;
}

// Loader
export const loader: LoaderFunction = async ({ params }) => {
  const neoId = params.id;
  const res = await fetch(`/api/neo/${neoId}`);
  if (!res.ok) throw new Response("Failed to fetch NEO", { status: res.status });
  return res.json();
};

function Rocket({
  start,
  targetRef,
  onHit,
  speed = 6,            // ед/с (под твой масштаб)
  turnRate = 4,         // рад/с: как быстро поворачиваемся на цель
  hitRadius = 0.25,     // на каком расстоянии считаем перехват
  trail = true,
}: {
  start: THREE.Vector3;
  targetRef: React.RefObject<THREE.Object3D>;
  onHit: (hitPoint: THREE.Vector3) => void;
  speed?: number;
  turnRate?: number;
  hitRadius?: number;
  trail?: boolean;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const vel = useRef(new THREE.Vector3());     // текущая скорость
  const dir = useRef(new THREE.Vector3(0,1,0));// направление полёта
  const alive = useRef(true);

  // стартовая позиция и направление (в сторону цели)
  useEffect(() => {
    if (!ref.current) return;
    ref.current.position.copy(start);
    if (targetRef.current) {
      const to = new THREE.Vector3();
      targetRef.current.getWorldPosition(to);
      dir.current.copy(to.sub(start).normalize());
    }
    vel.current.copy(dir.current).multiplyScalar(speed);
  }, [start, targetRef, speed]);

  useFrame((_, dt) => {
    if (!ref.current || !alive.current) return;
    const m = ref.current;

    // текущее положение цели
    const target = new THREE.Vector3();
    if (targetRef.current) targetRef.current.getWorldPosition(target);

    // желаемое направление
    const toTarget = target.clone().sub(m.position).normalize();

    // плавно поворачиваемся к цели с ограничением угловой скорости
    const currentDir = dir.current.clone();
    const angle = currentDir.angleTo(toTarget);
    const maxStep = turnRate * dt;
    const t = angle < 1e-5 ? 1 : Math.min(1, maxStep / angle);
    const newDir = currentDir.lerp(toTarget, t).normalize();
    dir.current.copy(newDir);

    // обновляем скорость и позицию
    vel.current.copy(newDir).multiplyScalar(speed);
    m.position.addScaledVector(vel.current, dt);

    // простая ориентация «носом» вперёд
    const up = new THREE.Vector3(0,1,0);
    const right = new THREE.Vector3().crossVectors(up, newDir).normalize();
    const pseudoUp = new THREE.Vector3().crossVectors(newDir, right).normalize();
    const mat = new THREE.Matrix4().makeBasis(right, pseudoUp, newDir);
    m.quaternion.setFromRotationMatrix(mat);

    // Проверка перехвата
    const dist = m.position.distanceTo(target);
    if (dist < hitRadius) {
      alive.current = false;
      onHit(m.position.clone());
    }
  });

  return (
    <group>
      <mesh ref={ref}>
        {/* простая «ракета» */}
        <coneGeometry args={[0.05, 0.15, 12]} />
        <meshStandardMaterial emissive="#ffffff" emissiveIntensity={0.6} metalness={0.2} roughness={0.4} />
      </mesh>

      {/* простой «пламя/хвост» */}
      {trail && (
        <mesh position={ref.current?.position}>
          {/* можно заменить на <Trail> из drei, если хочешь */}
        </mesh>
      )}
    </group>
  );
}


export default function NeoDetail() {
  const neo = useLoaderData<any>();

  // ⚠️ safer: pick the approach relative to Earth, not just [0]
  const earthApproach = useMemo(() => {
    const list = (neo.close_approach_data || []).filter((a: any) => a.orbiting_body === "Earth");
    if (!list.length) return null;
    // nearest to "now"
    const now = Date.now();
    list.sort(
      (a: any, b: any) =>
        Math.abs(a.epoch_date_close_approach - now) -
        Math.abs(b.epoch_date_close_approach - now)
    );
    return list[0];
  }, [neo]);

  const diameterKm = neo.estimated_diameter.kilometers.estimated_diameter_max;
  const velocityKps = earthApproach
    ? parseFloat(earthApproach.relative_velocity.kilometers_per_second)
    : parseFloat(neo.close_approach_data[0].relative_velocity.kilometers_per_second);
  const missDistanceKm = earthApproach
    ? parseFloat(earthApproach.miss_distance.kilometers)
    : parseFloat(neo.close_approach_data[0].miss_distance.kilometers);

  // UI state
  const [impactSite, setImpactSite] = useState<{ lat: number; lon: number } | null>(null);
  const [impactData, setImpactData] = useState<any | null>(null);
  const [aiSummary, setAiSummary] = useState();
  const [aiCountry, setAiCountry] = useState();
  const [plan, setPlan] = useState();

  return (
    <div>
      {/* <div className="mb-4 flex gap-2">
        <button
          onClick={() => {
            // Set NYC as target -> asteroid should dive there
            setImpactSite({ lat: 40.7, lon: -74.0 });
          }}
          className="px-4 py-2 bg-green-600 text-white rounded"
        >
          Test Impact Site (NYC)
        </button>

        <button
          onClick={() => {
            // Just compute physics numbers for NYC (doesn't move asteroid)
            const sim = simulateImpact({
              diameterKm,
              velocityKps,
              impactLat: 40.7,
              impactLon: -74.0,
            });
            setImpactData(sim);
          }}
          className="px-4 py-2 bg-red-600 text-white rounded"
        >
          Test Impact Simulation
        </button>

        <button onClick={() => { setImpactSite(null); setImpactData(null); setAiSummary(null); }}
                className="px-4 py-2 bg-gray-600 text-white rounded">
          Reset
        </button>
      </div> */}

      <div className="flex gap-4">
        {/* 3D Visualization */}
        <div className="flex-1">
          <GlobeScene
            missDistanceKm={missDistanceKm}
            velocityKps={velocityKps}
            neo={neo}
            // ✅ pass impactSite so the asteroid will redirect when you click the green button
            impactSite={impactSite}
            onImpactSelect={(lat, lon) => {
              // Clicking the globe sets a target and will trigger a dive
              setImpactSite({ lat, lon });
            }}
            onPlanReady={setPlan}
            // onAiSummeryReady={setAiSummary}
            onAiSummaryReady={(s) => {
                console.log("NeoDetail received AI summary:", s);
                setAiSummary(s);
            }}
            // onImpact={() => {
            //   // When the asteroid actually hits, compute physics using the chosen site
            //   const impactLat = impactSite?.lat ?? 0;
            //   const impactLon = impactSite?.lon ?? 0;
            //   const sim = simulateImpact({
            //     diameterKm,
            //     velocityKps,
            //     impactLat,
            //     impactLon,
            //   });
            //   setImpactData(sim);
            // }}
            onImpact={ async () => {
                console.log("onImpact")
                const impactLat = impactSite?.lat ?? 0;
                const impactLon = impactSite?.lon ?? 0;

                // physics numbers
                const sim = simulateImpact({ diameterKm, velocityKps, impactLat, impactLon });
                setImpactData(sim);

                // compute MASS (kg)
                const density = 3000; // kg/m^3
                const radiusM = (diameterKm * 1000) / 2;
                const massKg = (4 / 3) * Math.PI * Math.pow(radiusM, 3) * density;

                // AI call with ONLY lat, lon, mass
                // const risks = await fetchImpactThreat(impactLat, impactLon, massKg);
                // console.log("fetchImpactThreat", risks)
                // setAiSummary(risks ?? '(no ai_summary in response)');
                // const impactLocation = await fetchCountryImpactThreat(impactLat, impactLon);
                // setAiCountry(impactLocation ?? '(no country in response)');
            }}
          />
        </div>

        {/* Sidebar */}
        <div className="w-80 p-4 bg-gray-100 rounded shadow text-gray-900" style={{ height: '95vh', overflowY: 'auto' }}>
          <div className="mb-4 p-2 bg-yellow-100 rounded text-xs">
            <strong>Debug:</strong><br />
            Site: {impactSite ? `${impactSite.lat.toFixed(2)}°, ${impactSite.lon.toFixed(2)}°` : "—"}<br />
            Data: {impactData ? "✅ Generated" : "❌ Not yet"}<br />
            Miss: {missDistanceKm.toFixed(0)} km<br />
            Vel: {velocityKps.toFixed(2)} km/s
          </div>
            {plan && <PlanPanel plan={plan} />}
            <AiThreatPanel text={aiSummary} />

          {!impactData ? (
            <>
              <h2 className="text-lg font-semibold mb-2">Impact Simulation</h2>
              <p className="text-sm text-gray-600 whitespace-pre-line">
                {impactSite
                  ? "Target selected.\nLet the asteroid hit to generate results."
                  : "1) Click on Earth. Let the asteroid impact\n2) See results here"}
              </p>
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold mb-2">Impact Results</h2>
              <ul className="space-y-1 text-sm">
                <li><strong>Mass:</strong> {impactData.mass.toExponential(3)} kg</li>
                <li><strong>Energy:</strong> {(impactData.energyJ / 1e18).toFixed(2)} ×10¹⁸ J</li>
                <li><strong>TNT Eq.:</strong> {impactData.tntKilotons.toLocaleString()} kt</li>
                <li><strong>Crater:</strong> {(impactData.craterDiameterM / 1000).toFixed(2)} km</li>
                <li><strong>Seismic:</strong> {impactData.magnitude.toFixed(1)} Mw</li>
                {impactSite && (
                  <li><strong>Site:</strong> {impactSite.lat.toFixed(2)}°, {impactSite.lon.toFixed(2)}°</li>
                )}
              </ul>
              {/* { aiSummary && (
                <div className="mt-4 p-2 rounded bg-white text-gray-900 text-sm">
                  <h3 className="font-semibold mb-1">AI Threat Note</h3>
                  <p className="whitespace-pre-wrap">{aiSummary}</p>
                </div>
              )} */}
            </>
          )}
        </div>
      </div>
    </div>
  );
}


