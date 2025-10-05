import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import BigShatterFX from "./BigShatterFX"; 


/* ===================== Props ===================== */
interface AsteroidProps {
  missDistanceKm?: number;
  velocityKps?: number;  // км/с (визуальная скорость)
  time: number;          // глобальный слайдер/время для flyby
  isPlaying: boolean;
  setTime: (t: number | ((p: number) => number)) => void;
  color?: string;
  onImpact?: () => void;
  impactSite?: { lat: number; lon: number } | null;
}

/* ===================== Scene constants ===================== */
const EARTH_RADIUS = 2;
const ASTEROID_RADIUS = 0.3;

// Put your file in public/impact.mp3
const IMPACT_URL = "/impact.mp3";

/* ===================== Utils ===================== */
function mapMissKmToScene(missKm: number) {
  const SAFETY = 0.05;
  const MIN_MISS = EARTH_RADIUS + ASTEROID_RADIUS + SAFETY;
  const MAX_MISS = 20;
  const t = Math.log10(Math.max(1, missKm)) / 8; // ~0..1
  return MIN_MISS + (MAX_MISS - MIN_MISS) * Math.min(1, Math.max(0, t));
}

function toEarthPos(lat: number, lon: number) {
  const phi = (90 - lat) * Math.PI / 180;
  const theta = (lon + 180) * Math.PI / 180;
  return new THREE.Vector3(
    EARTH_RADIUS * Math.sin(phi) * Math.cos(theta),
    EARTH_RADIUS * Math.cos(phi),
    EARTH_RADIUS * Math.sin(phi) * Math.sin(theta)
  );
}

/* ===================== Impact FX (exported) ===================== */
export function ImpactFX({
  position,
  normal,
  onDone,
  duration = 2.2,
  particleCount = 180,
}: {
  position: THREE.Vector3;
  normal: THREE.Vector3;
  onDone?: () => void;
  duration?: number;
  particleCount?: number;
}) {
  const group = useRef<THREE.Group>(null);
  const flashMat = useRef<THREE.MeshBasicMaterial>(null);
  const shockMat = useRef<THREE.MeshBasicMaterial>(null);
  const instRef = useRef<THREE.InstancedMesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  const velocities = useRef<THREE.Vector3[]>([]);
  const lifes = useRef<number[]>([]);
  const qBasis = useRef(new THREE.Quaternion());
  const tRef = useRef(0);

  const { camera } = useThree();
  const audioListener = useRef<THREE.AudioListener>();
  const audioObj = useRef<THREE.PositionalAudio>();
  const audioBuffer = useRef<AudioBuffer | null>(null);

  useEffect(() => {
    const tryUnlock = () => {
      try {
        // @ts-ignore
        const ctx: AudioContext | undefined = THREE.AudioContext.getContext();
        if (ctx && ctx.state !== "running") ctx.resume();
      } catch {}
      window.removeEventListener("pointerdown", tryUnlock);
      window.removeEventListener("keydown", tryUnlock);
    };
    window.addEventListener("pointerdown", tryUnlock, { once: true });
    window.addEventListener("keydown", tryUnlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", tryUnlock);
      window.removeEventListener("keydown", tryUnlock);
    };
  }, []);

  useEffect(() => {
    if (!audioListener.current) {
      audioListener.current = new THREE.AudioListener();
      camera.add(audioListener.current);
    }
    audioObj.current = new THREE.PositionalAudio(audioListener.current);
    audioObj.current.setRefDistance(4);
    audioObj.current.setDistanceModel("exponential");
    audioObj.current.setRolloffFactor(1.2);
    audioObj.current.setVolume(0.9);

    const loader = new THREE.AudioLoader();
    loader.load(IMPACT_URL, (buffer) => {
      audioBuffer.current = buffer;
      playOnce();
    });

    if (group.current) group.current.add(audioObj.current);
    return () => {
      if (audioObj.current) {
        audioObj.current.stop();
        if (group.current) group.current.remove(audioObj.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera]);

  const playOnce = () => {
    if (!audioObj.current || !audioBuffer.current) return;
    try {
      audioObj.current.setBuffer(audioBuffer.current);
      audioObj.current.setPlaybackRate(0.95 + Math.random() * 0.1);
      audioObj.current.detune = (Math.random() - 0.5) * 200;
      audioObj.current.play();
    } catch {}
  };

  useEffect(() => {
    const from = new THREE.Vector3(0, 1, 0);
    const to = normal.clone().normalize();
    qBasis.current.setFromUnitVectors(from, to);

    velocities.current = [];
    lifes.current = [];
    for (let i = 0; i < particleCount; i++) {
      const v = new THREE.Vector3(
        (Math.random() * 2 - 1),
        Math.random(),
        (Math.random() * 2 - 1)
      ).normalize();
      v.applyQuaternion(qBasis.current);
      const speed = 2 + Math.random() * 7;
      velocities.current.push(v.multiplyScalar(speed));
      lifes.current.push(1 + Math.random() * 0.8);
    }
    playOnce();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dummy = useRef(new THREE.Object3D()).current;

  useFrame((_, delta) => {
    tRef.current += delta;

    if (flashMat.current && group.current) {
      const flashT = Math.min(1, tRef.current / 0.5);
      const scale = 0.2 + flashT * 5.0;
      const flash = group.current.children[0];
      flash.scale.setScalar(scale);
      flashMat.current.opacity = 1.0 - flashT;
    }

    if (shockMat.current && group.current) {
      const waveT = Math.min(1, tRef.current / 1.1);
      const s = 0.5 + waveT * 6.0;
      const ring = group.current.children[1] as THREE.Mesh;
      ring.scale.set(s, s, s);
      shockMat.current.opacity = 0.9 * (1.0 - waveT);
    }

    if (lightRef.current) {
      const lt = tRef.current;
      lightRef.current.intensity = lt < 0.35 ? 20 * (1 - lt / 0.35) : Math.max(0, 6 * (1 - (lt - 0.35) / 0.6));
      lightRef.current.distance = 15;
    }

    if (instRef.current) {
      for (let i = 0; i < particleCount; i++) {
        lifes.current[i] -= delta;
        const vel = velocities.current[i];
        vel.multiplyScalar(Math.exp(-delta * 1.3));
        const pos = new THREE.Vector3().copy(vel).multiplyScalar(Math.max(0, lifes.current[i]));
        dummy.position.copy(pos);
        dummy.scale.setScalar(0.04 + (1 - Math.max(0, lifes.current[i]) / 1.8) * 0.05);
        dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        dummy.updateMatrix();
        instRef.current.setMatrixAt(i, dummy.matrix);
      }
      instRef.current.instanceMatrix.needsUpdate = true;

      const mat = instRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 1.0 - tRef.current / duration);
    }

    if (tRef.current >= duration) onDone?.();
  });

  const ringGeom = new THREE.RingGeometry(0.2, 0.23, 64);
  const shockQuat = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    normal.clone().normalize()
  );

  return (
    <group ref={group} position={position}>
      <mesh>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial ref={flashMat} color={0xffe08a} transparent opacity={1} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh quaternion={shockQuat}>
        <primitive object={ringGeom} attach="geometry" />
        <meshBasicMaterial ref={shockMat} color={0xffa600} transparent opacity={0.9} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
      </mesh>
      <instancedMesh ref={instRef} args={[undefined as any, undefined as any, particleCount]}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshBasicMaterial color={0xffc14d} transparent opacity={1} blending={THREE.AdditiveBlending} />
      </instancedMesh>
      <pointLight ref={lightRef} color={0xffc77d} position={[0, 0, 0]} intensity={15} distance={10} />
    </group>
  );
}

/* ===================== Asteroid (flyby/dive/deflection + SHATTER + cancelGuidance) ===================== */
const Asteroid = forwardRef<THREE.Mesh, AsteroidProps>((
  {
    missDistanceKm,
    velocityKps,
    time,
    isPlaying,
    setTime,
    color = "red",
    onImpact,
    impactSite,
  },
  forwardedRef
) => {
  const ref = useRef<THREE.Mesh>(null!);
 
  const [hasImpacted, setHasImpacted] = useState(false);
  const [impactPos, setImpactPos] = useState<THREE.Vector3 | null>(null);
  const [impactNormal, setImpactNormal] = useState<THREE.Vector3 | null>(null);
  const [showFX, setShowFX] = useState(false);
  const [shatterFX, setShatterFX] = useState<{pos: THREE.Vector3, normal: THREE.Vector3} | null>(null);

  const mode = useRef<"flyby" | "dive">("flyby");
  const guidanceActive = useRef(true);

  // Dive params
  const diveStart = useRef(new THREE.Vector3());
  const diveTarget = useRef(new THREE.Vector3());
  const dir = useRef(new THREE.Vector3());
  const totalDist = useRef(0);
  const s = useRef(0);
  const diveSpeed = useRef(5);

  // Flyby params
  const flybyDir = useRef(new THREE.Vector3(0, 0, 1));
  const flybyStartZ = -30;

  // SHATTER (instanced fragments)
  const fragmentsRef = useRef<THREE.InstancedMesh>(null);
  const fragVel = useRef<THREE.Vector3[]>([]);
  const fragLife = useRef<number[]>([]);
  const fragCount = useRef(0);
  const fragmented = useRef(false);

  if (!missDistanceKm || !velocityKps || isNaN(missDistanceKm) || isNaN(velocityKps)) return null;
  const v_units = velocityKps * 0.02;

   useImperativeHandle(
    forwardedRef,
    () =>
      Object.assign(ref.current, {
        // вызвать снаружи: разломать на осколки
        shatter: (hitPoint: THREE.Vector3, normal: THREE.Vector3) => {
          if (fragmented.current) return;
          const m = ref.current;
          const center = m.position.clone();
          spawnFragments(center, normal, hitPoint);
          fragmented.current = true;
          setHasImpacted(false);
          setShowFX(false);
          m.visible = false;
        },
        // вызвать снаружи: полностью отключить guidance (режим dive/flyby)
        cancelGuidance: () => {
          guidanceActive.current = false;
        },
      }) as any,
    []
  );
  // init prevPos once
  useEffect(() => {
    if (!ref.current) return;
    ref.current.userData.prevPos = ref.current.position.clone();
  }, []);

  // switch to "dive" when impactSite appears (only if not shattered)
  useEffect(() => {
    if (fragmented.current) return;
    if (impactSite && !hasImpacted) {
      const start =
        ref.current?.position?.clone() ??
        new THREE.Vector3(mapMissKmToScene(missDistanceKm), 0, flybyStartZ);
      const target = toEarthPos(impactSite.lat, impactSite.lon);

      diveStart.current.copy(start);
      diveTarget.current.copy(target);
      dir.current.copy(target).sub(start).normalize();
      totalDist.current = start.distanceTo(target);
      s.current = 0;

      const unitsPerSec = Math.max(0.8, velocityKps * 0.04);
      diveSpeed.current = unitsPerSec;

      ref.current?.position.copy(start);
      mode.current = "dive";
      guidanceActive.current = true; // включаем guidance только при явной цели
    } else {
      mode.current = "flyby";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [impactSite]);

  // spawn fragment helpers
  function spawnFragments(center: THREE.Vector3, normal: THREE.Vector3, hitPoint: THREE.Vector3, count = 36) {
    fragCount.current = count;
    fragVel.current = [];
    fragLife.current = [];

    const prev: THREE.Vector3 = ref.current.userData.prevPos ?? center.clone();
    const baseVel = center.clone().sub(prev);
    const n = normal.clone().normalize();

    const inst = fragmentsRef.current;
    const dummy = new THREE.Object3D();

    for (let i = 0; i < count; i++) {
      const spread = new THREE.Vector3(
        (Math.random() * 2 - 1),
        (Math.random() * 2 - 1),
        (Math.random() * 2 - 1)
      ).normalize();

      const v = n
        .clone()
        .multiplyScalar(2.8 + Math.random() * 2.4)
        .add(spread.multiplyScalar(0.8))
        .add(baseVel.clone().multiplyScalar(0.7));

      fragVel.current.push(v);
      fragLife.current.push(2.8 + Math.random() * 2.2);

      if (inst) {
        dummy.position.copy(hitPoint);
        dummy.scale.setScalar(0.05 + Math.random() * 0.05);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
      }
    }
    if (inst) inst.instanceMatrix.needsUpdate = true;
  }

  // movement + collisions
  useFrame((_, delta) => {
    const m = ref.current;
    if (!m) return;

    if (!fragmented.current) {
      // 1) manual velocity from rockets has priority
      if (m.userData.applyVel && m.userData.vel) {
        guidanceActive.current = false;
        const v = m.userData.vel as THREE.Vector3;
        m.position.add(v.clone().multiplyScalar(delta));
      } else if (guidanceActive.current) {
        // 2) guidance (dive / flyby)
        if (mode.current === "dive") {
          s.current = Math.min(totalDist.current, s.current + diveSpeed.current * delta);
          const pos = diveStart.current.clone().addScaledVector(dir.current, s.current);
          m.position.copy(pos);
        } else {
          const missScene = mapMissKmToScene(missDistanceKm!);
          if (isPlaying && !hasImpacted) setTime((p) => p + delta * 10);
          const t = time * v_units;
          const base = new THREE.Vector3(missScene, 0, flybyStartZ);
          const pos = base.addScaledVector(flybyDir.current, t);
          m.position.copy(pos);
        }
      }

      const prevPos: THREE.Vector3 = m.userData.prevPos ?? m.position.clone();
      m.userData.prevPos = m.position.clone();

      // collision with Earth — only if moving inward
      if (!hasImpacted) {
        const r = m.position.length();
        const HIT = EARTH_RADIUS + ASTEROID_RADIUS;

        const v = (m.userData.vel as THREE.Vector3) ?? m.position.clone().sub(prevPos);
        const rHat = m.position.clone().normalize();
        const vRadial = v.dot(rHat); // < 0 — внутрь

        if (r <= HIT && vRadial < 0) {
          const surfacePos = m.position.clone().setLength(HIT);
          m.position.copy(surfacePos);

          const n = surfacePos.clone().normalize();
          setHasImpacted(true);
          setImpactPos(surfacePos.clone());
          setImpactNormal(n);
          setShowFX(true);

          onImpact?.();
        }
      }
    } else {
      // fragments update
      const inst = fragmentsRef.current;
      if (!inst) return;
      const dummy = new THREE.Object3D();

      for (let i = 0; i < fragCount.current; i++) {
        let life = (fragLife.current[i] -= delta);
        if (life <= 0) continue;

        const mat = new THREE.Matrix4();
        inst.getMatrixAt(i, mat);
        const pos = new THREE.Vector3();
        const rot = new THREE.Quaternion();
        const scl = new THREE.Vector3();
        mat.decompose(pos, rot, scl);

        fragVel.current[i].multiplyScalar(1 - 0.9 * delta);
        pos.add(pos.clone().normalize().multiplyScalar(0.5 * delta));
        pos.add(fragVel.current[i].clone().multiplyScalar(delta));

        const scale = Math.max(0.01, 0.08 * (life / 3));
        dummy.position.copy(pos);
        dummy.scale.setScalar(scale);
        dummy.rotation.set(
          dummy.rotation.x + 2 * delta,
          dummy.rotation.y + 2.3 * delta,
          dummy.rotation.z + 1.7 * delta
        );
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
      }
      inst.instanceMatrix.needsUpdate = true;
    }
  });

   useImperativeHandle(
    forwardedRef,
    () =>
      Object.assign(ref.current!, {
        // чтобы родитель мог отключить «нырянье» к земле, если оно есть
        cancelGuidance: () => {
          // примеры: сбросить режим/скорость/флаги
          mode.current = "flyby";
          // можно обнулить любые твои «dive» переменные
        },

        // публичный метод: «сломать на части»
        shatter: (hitPoint: THREE.Vector3, normal: THREE.Vector3) => {
          setHasImpacted(true);   // скрыть базовый меш (если ты по этому флагу его прячешь)
          // если у тебя запускался маленький ImpactFX — выключи:
          // setShowFX(false);

          // запустить большой FX
          setShatterFX({ pos: hitPoint.clone(), normal: normal.clone() });
        },
      }),
    []
  );

  return (
    <>
      {/* ядро */}
      <mesh ref={ref} visible={!hasImpacted && !fragmented.current}>
        <sphereGeometry args={[ASTEROID_RADIUS, 32, 32]} />
        <meshStandardMaterial color={hasImpacted ? "orange" : (mode.current === "dive" ? "red" : color)} />
      </mesh>

      {/* FX удара о Землю */}
      {showFX && impactPos && impactNormal && (
        <ImpactFX
          position={impactPos}
          normal={impactNormal}
          onDone={() => setShowFX(false)}
        />
      )}

      {/* осколки */}
      <instancedMesh ref={fragmentsRef} args={[undefined as any, undefined as any, 64]} frustumCulled={false}>
        <icosahedronGeometry args={[0.05, 0]} />
        <meshStandardMaterial color="#aaaaaa" metalness={0.2} roughness={0.7} />
      </instancedMesh>
      {shatterFX && (
        <BigShatterFX
          position={shatterFX.pos}
          normal={shatterFX.normal}
          duration={5}
          debrisCount={140}
          sparkCount={320}
          onDone={() => setShatterFX(null)}
        />
      )}
    </>
  );
});

export default Asteroid;




// import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
// import { useFrame, useThree } from "@react-three/fiber";
// import * as THREE from "three";

// /* ===================== Props ===================== */
// interface AsteroidProps {
//   missDistanceKm?: number;
//   velocityKps?: number;  // км/с (визуальная скорость)
//   time: number;          // глобальный слайдер/время для flyby
//   isPlaying: boolean;
//   setTime: (t: number | ((p: number) => number)) => void;
//   color?: string;
//   onImpact?: () => void;
//   impactSite?: { lat: number; lon: number } | null;
// }

// /* ===================== Scene constants ===================== */
// const EARTH_RADIUS = 2;
// const ASTEROID_RADIUS = 0.3;

// // Put your file in public/impact.mp3
// const IMPACT_URL = "/impact.mp3";

// /* ===================== Utils ===================== */
// function mapMissKmToScene(missKm: number) {
//   const SAFETY = 0.05;
//   const MIN_MISS = EARTH_RADIUS + ASTEROID_RADIUS + SAFETY;
//   const MAX_MISS = 20;
//   const t = Math.log10(Math.max(1, missKm)) / 8; // ~0..1
//   return MIN_MISS + (MAX_MISS - MIN_MISS) * Math.min(1, Math.max(0, t));
// }

// function toEarthPos(lat: number, lon: number) {
//   const phi = (90 - lat) * Math.PI / 180;
//   const theta = (lon + 180) * Math.PI / 180;
//   return new THREE.Vector3(
//     EARTH_RADIUS * Math.sin(phi) * Math.cos(theta),
//     EARTH_RADIUS * Math.cos(phi),
//     EARTH_RADIUS * Math.sin(phi) * Math.sin(theta)
//   );
// }

// /* ===================== Impact FX (exported) ===================== */
// export function ImpactFX({
//   position,
//   normal,
//   onDone,
//   duration = 2.2,
//   particleCount = 180,
// }: {
//   position: THREE.Vector3;
//   normal: THREE.Vector3;
//   onDone?: () => void;
//   duration?: number;
//   particleCount?: number;
// }) {
//   const group = useRef<THREE.Group>(null);
//   const flashMat = useRef<THREE.MeshBasicMaterial>(null);
//   const shockMat = useRef<THREE.MeshBasicMaterial>(null);
//   const instRef = useRef<THREE.InstancedMesh>(null);
//   const lightRef = useRef<THREE.PointLight>(null);

//   const velocities = useRef<THREE.Vector3[]>([]);
//   const lifes = useRef<number[]>([]);
//   const qBasis = useRef(new THREE.Quaternion());
//   const tRef = useRef(0);

//   const { camera } = useThree();
//   const audioListener = useRef<THREE.AudioListener>();
//   const audioObj = useRef<THREE.PositionalAudio>();
//   const audioBuffer = useRef<AudioBuffer | null>(null);

//   useEffect(() => {
//     const tryUnlock = () => {
//       try {
//         // @ts-ignore
//         const ctx: AudioContext | undefined = THREE.AudioContext.getContext();
//         if (ctx && ctx.state !== "running") ctx.resume();
//       } catch {}
//       window.removeEventListener("pointerdown", tryUnlock);
//       window.removeEventListener("keydown", tryUnlock);
//     };
//     window.addEventListener("pointerdown", tryUnlock, { once: true });
//     window.addEventListener("keydown", tryUnlock, { once: true });
//     return () => {
//       window.removeEventListener("pointerdown", tryUnlock);
//       window.removeEventListener("keydown", tryUnlock);
//     };
//   }, []);

//   useEffect(() => {
//     if (!audioListener.current) {
//       audioListener.current = new THREE.AudioListener();
//       camera.add(audioListener.current);
//     }
//     audioObj.current = new THREE.PositionalAudio(audioListener.current);
//     audioObj.current.setRefDistance(4);
//     audioObj.current.setDistanceModel("exponential");
//     audioObj.current.setRolloffFactor(1.2);
//     audioObj.current.setVolume(0.9);

//     const loader = new THREE.AudioLoader();
//     loader.load(IMPACT_URL, (buffer) => {
//       audioBuffer.current = buffer;
//       playOnce();
//     });

//     if (group.current) group.current.add(audioObj.current);
//     return () => {
//       if (audioObj.current) {
//         audioObj.current.stop();
//         if (group.current) group.current.remove(audioObj.current);
//       }
//     };
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [camera]);

//   const playOnce = () => {
//     if (!audioObj.current || !audioBuffer.current) return;
//     try {
//       audioObj.current.setBuffer(audioBuffer.current);
//       audioObj.current.setPlaybackRate(0.95 + Math.random() * 0.1);
//       audioObj.current.detune = (Math.random() - 0.5) * 200;
//       audioObj.current.play();
//     } catch {}
//   };

//   useEffect(() => {
//     const from = new THREE.Vector3(0, 1, 0);
//     const to = normal.clone().normalize();
//     qBasis.current.setFromUnitVectors(from, to);

//     velocities.current = [];
//     lifes.current = [];
//     for (let i = 0; i < particleCount; i++) {
//       const v = new THREE.Vector3(
//         (Math.random() * 2 - 1),
//         Math.random(),
//         (Math.random() * 2 - 1)
//       ).normalize();
//       v.applyQuaternion(qBasis.current);
//       const speed = 2 + Math.random() * 7;
//       velocities.current.push(v.multiplyScalar(speed));
//       lifes.current.push(1 + Math.random() * 0.8);
//     }
//     playOnce();
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []);

//   const dummy = useRef(new THREE.Object3D()).current;

//   useFrame((_, delta) => {
//     tRef.current += delta;

//     if (flashMat.current && group.current) {
//       const flashT = Math.min(1, tRef.current / 0.5);
//       const scale = 0.2 + flashT * 5.0;
//       const flash = group.current.children[0];
//       flash.scale.setScalar(scale);
//       flashMat.current.opacity = 1.0 - flashT;
//     }

//     if (shockMat.current && group.current) {
//       const waveT = Math.min(1, tRef.current / 1.1);
//       const s = 0.5 + waveT * 6.0;
//       const ring = group.current.children[1] as THREE.Mesh;
//       ring.scale.set(s, s, s);
//       shockMat.current.opacity = 0.9 * (1.0 - waveT);
//     }

//     if (lightRef.current) {
//       const lt = tRef.current;
//       lightRef.current.intensity = lt < 0.35 ? 20 * (1 - lt / 0.35) : Math.max(0, 6 * (1 - (lt - 0.35) / 0.6));
//       lightRef.current.distance = 15;
//     }

//     if (instRef.current) {
//       for (let i = 0; i < particleCount; i++) {
//         lifes.current[i] -= delta;
//         const vel = velocities.current[i];
//         vel.multiplyScalar(Math.exp(-delta * 1.3));
//         const pos = new THREE.Vector3().copy(vel).multiplyScalar(Math.max(0, lifes.current[i]));
//         dummy.position.copy(pos);
//         dummy.scale.setScalar(0.04 + (1 - Math.max(0, lifes.current[i]) / 1.8) * 0.05);
//         dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
//         dummy.updateMatrix();
//         instRef.current.setMatrixAt(i, dummy.matrix);
//       }
//       instRef.current.instanceMatrix.needsUpdate = true;

//       const mat = instRef.current.material as THREE.MeshBasicMaterial;
//       mat.opacity = Math.max(0, 1.0 - tRef.current / duration);
//     }

//     if (tRef.current >= duration) onDone?.();
//   });

//   const ringGeom = new THREE.RingGeometry(0.2, 0.23, 64);
//   const shockQuat = new THREE.Quaternion().setFromUnitVectors(
//     new THREE.Vector3(0, 1, 0),
//     normal.clone().normalize()
//   );

//   return (
//     <group ref={group} position={position}>
//       <mesh>
//         <sphereGeometry args={[1, 32, 32]} />
//         <meshBasicMaterial ref={flashMat} color={0xffe08a} transparent opacity={1} blending={THREE.AdditiveBlending} />
//       </mesh>
//       <mesh quaternion={shockQuat}>
//         <primitive object={ringGeom} attach="geometry" />
//         <meshBasicMaterial ref={shockMat} color={0xffa600} transparent opacity={0.9} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
//       </mesh>
//       <instancedMesh ref={instRef} args={[undefined as any, undefined as any, particleCount]}>
//         <sphereGeometry args={[0.03, 8, 8]} />
//         <meshBasicMaterial color={0xffc14d} transparent opacity={1} blending={THREE.AdditiveBlending} />
//       </instancedMesh>
//       <pointLight ref={lightRef} color={0xffc77d} position={[0, 0, 0]} intensity={15} distance={10} />
//     </group>
//   );
// }

// /* ===================== Asteroid (with flyby/dive/deflection + SHATTER) ===================== */
// const Asteroid = forwardRef<THREE.Mesh, AsteroidProps>((
//   {
//     missDistanceKm,
//     velocityKps,
//     time,
//     isPlaying,
//     setTime,
//     color = "red",
//     onImpact,
//     impactSite,
//   },
//   forwardedRef
// ) => {
//   const ref = useRef<THREE.Mesh>(null!);
//   useImperativeHandle(forwardedRef, () =>
//     Object.assign(ref.current, {
//       /** external: break asteroid into fragments */
//       shatter: (hitPoint: THREE.Vector3, normal: THREE.Vector3) => {
//         if (fragmented.current) return;
//         const m = ref.current;
//         const center = m.position.clone();
//         spawnFragments(center, normal, hitPoint);
//         fragmented.current = true;
//         setHasImpacted(false); // блокируем earth-impact визуально
//         setShowFX(false);
//         m.visible = false;     // прячем ядро
//       }
//     }) as any
//   , []);

//   const [hasImpacted, setHasImpacted] = useState(false);
//   const [impactPos, setImpactPos] = useState<THREE.Vector3 | null>(null);
//   const [impactNormal, setImpactNormal] = useState<THREE.Vector3 | null>(null);
//   const [showFX, setShowFX] = useState(false);

//   const mode = useRef<"flyby" | "dive">("flyby");

//   // Dive params
//   const diveStart = useRef(new THREE.Vector3());
//   const diveTarget = useRef(new THREE.Vector3());
//   const dir = useRef(new THREE.Vector3());
//   const totalDist = useRef(0);
//   const s = useRef(0);
//   const diveSpeed = useRef(5);

//   // Flyby params
//   const flybyDir = useRef(new THREE.Vector3(0, 0, 1));
//   const flybyStartZ = -30;

//   // ====== SHATTER state (instanced fragments) ======
//   const fragmentsRef = useRef<THREE.InstancedMesh>(null);
//   const fragVel = useRef<THREE.Vector3[]>([]);
//   const fragLife = useRef<number[]>([]);
//   const fragCount = useRef(0);
//   const fragmented = useRef(false);

//   if (!missDistanceKm || !velocityKps || isNaN(missDistanceKm) || isNaN(velocityKps)) return null;
//   const v_units = velocityKps * 0.02;

//   // init prevPos once
//   useEffect(() => {
//     if (!ref.current) return;
//     ref.current.userData.prevPos = ref.current.position.clone();
//   }, []);

//   // switch to "dive" when impactSite appears (only if not shattered)
//   useEffect(() => {
//     if (fragmented.current) return;
//     if (impactSite && !hasImpacted) {
//       const start = ref.current?.position?.clone()
//         ?? new THREE.Vector3(mapMissKmToScene(missDistanceKm), 0, flybyStartZ);
//       const target = toEarthPos(impactSite.lat, impactSite.lon);

//       diveStart.current.copy(start);
//       diveTarget.current.copy(target);
//       dir.current.copy(target).sub(start).normalize();
//       totalDist.current = start.distanceTo(target);
//       s.current = 0;

//       const unitsPerSec = Math.max(0.8, velocityKps * 0.04);
//       diveSpeed.current = unitsPerSec;

//       ref.current?.position.copy(start);
//       mode.current = "dive";
//     } else {
//       mode.current = "flyby";
//     }
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [impactSite]);

//   // ====== fragments spawn ======
//   function spawnFragments(center: THREE.Vector3, normal: THREE.Vector3, hitPoint: THREE.Vector3, count = 36) {
//     fragCount.current = count;
//     fragVel.current = [];
//     fragLife.current = [];
//     // базовая скорость осколков от нормали + небольшой разброс, захватываем текущую скорость астероида
//     const prev: THREE.Vector3 = (ref.current.userData.prevPos ?? center.clone());
//     const baseVel = center.clone().sub(prev); // примерно текущая скорость
//     const n = normal.clone().normalize();

//     for (let i = 0; i < count; i++) {
//       const spread = new THREE.Vector3(
//         (Math.random() * 2 - 1),
//         (Math.random() * 2 - 1),
//         (Math.random() * 2 - 1)
//       ).normalize();

//       const v = n.clone()
//         .multiplyScalar(2.8 + Math.random() * 2.4) // радиальный разлёт
//         .add(spread.multiplyScalar(0.8))           // небольшой шум
//         .add(baseVel.clone().multiplyScalar(0.7)); // наследуем часть скорости

//       fragVel.current.push(v);
//       fragLife.current.push(2.8 + Math.random() * 2.2); // секунды жизни каждого
//     }

//     // ставим instanced mesh в позицию удара
//     if (fragmentsRef.current) {
//       const dummy = new THREE.Object3D();
//       for (let i = 0; i < count; i++) {
//         dummy.position.copy(hitPoint);
//         dummy.scale.setScalar(0.05 + Math.random() * 0.05);
//         dummy.updateMatrix();
//         fragmentsRef.current.setMatrixAt(i, dummy.matrix);
//       }
//       fragmentsRef.current.instanceMatrix.needsUpdate = true;
//     }
//   }

//   // ====== Update base asteroid OR fragments ======
//   useFrame((_, delta) => {
//     const m = ref.current;
//     if (!m) return;

//     if (!fragmented.current) {
//       // base movement
//       if (mode.current === "dive") {
//         s.current = Math.min(totalDist.current, s.current + diveSpeed.current * delta);
//         const pos = diveStart.current.clone().addScaledVector(dir.current, s.current);
//         m.position.copy(pos);
//       } else {
//         const missScene = mapMissKmToScene(missDistanceKm!);
//         if (isPlaying && !hasImpacted) setTime((p) => p + delta * 10);
//         const t = time * v_units;
//         const base = new THREE.Vector3(missScene, 0, flybyStartZ);
//         const pos = base.addScaledVector(flybyDir.current, t);
//         m.position.copy(pos);
//       }

//       // ✅ rocket “impulse” velocity
//       if (m.userData.applyVel && m.userData.vel) {
//         const v = m.userData.vel as THREE.Vector3;
//         m.position.add(v.clone().multiplyScalar(delta));
//       }
//       m.userData.prevPos = m.position.clone();

//       // collision with Earth (если не раздроблен)
//       const distToCenter = m.position.length();
//       const HIT = EARTH_RADIUS + ASTEROID_RADIUS;
//       if (!hasImpacted && distToCenter <= HIT) {
//         const surfacePos = m.position.clone().setLength(HIT);
//         m.position.copy(surfacePos);

//         const n = surfacePos.clone().normalize();
//         setHasImpacted(true);
//         setImpactPos(surfacePos.clone());
//         setImpactNormal(n);
//         setShowFX(true);

//         onImpact?.();
//       }
//     } else {
//       // ===== Fragments simulation =====
//       const inst = fragmentsRef.current;
//       if (!inst) return;

//       const dummy = new THREE.Object3D();
//       let alive = 0;

//       for (let i = 0; i < fragCount.current; i++) {
//         let life = (fragLife.current[i] -= delta);
//         if (life <= 0) continue;

//         alive++;

//         // простое сопротивление + «гравитация отталкивания» (чтобы не врезались в Землю)
//         fragVel.current[i].multiplyScalar(1 - 0.9 * delta); // drag
//         const pos = new THREE.Vector3();
//         inst.getMatrixAt(i, dummy.matrix);
//         dummy.matrix.decompose(pos, new THREE.Quaternion(), new THREE.Vector3());

//         // небольшое отталкивание от центра Земли
//         const away = pos.clone().normalize().multiplyScalar(0.5 * delta);
//         pos.add(away);

//         // движение по собственной скорости
//         pos.add(fragVel.current[i].clone().multiplyScalar(delta));

//         const scale = Math.max(0.01, 0.08 * (life / 3));
//         dummy.position.copy(pos);
//         dummy.scale.setScalar(scale);
//         dummy.rotation.set(
//           dummy.rotation.x + 2 * delta,
//           dummy.rotation.y + 2.3 * delta,
//           dummy.rotation.z + 1.7 * delta
//         );
//         dummy.updateMatrix();
//         inst.setMatrixAt(i, dummy.matrix);
//       }

//       inst.instanceMatrix.needsUpdate = true;

//       // когда все осколки «умерли» — ничего не рисуем
//       if (alive === 0) {
//         // полностью выключаем узел астероида (ядро уже hidden)
//         // (можно показать «победу»)
//       }
//     }
//   });

//   return (
//     <>
//       {/* ядро астероида */}
//       <mesh ref={ref} visible={!hasImpacted && !fragmented.current}>
//         <sphereGeometry args={[ASTEROID_RADIUS, 32, 32]} />
//         <meshStandardMaterial color={hasImpacted ? "orange" : (mode.current === "dive" ? "red" : color)} />
//       </mesh>

//       {/* FX удара о Землю */}
//       {showFX && impactPos && impactNormal && (
//         <ImpactFX
//           position={impactPos}
//           normal={impactNormal}
//           onDone={() => setShowFX(false)}
//         />
//       )}

//       {/* Поле осколков (показывается после shatter) */}
//       <instancedMesh ref={fragmentsRef} args={[undefined as any, undefined as any, 64]} frustumCulled={false}>
//         <icosahedronGeometry args={[0.05, 0]} />
//         <meshStandardMaterial color="#aaaaaa" metalness={0.2} roughness={0.7} />
//       </instancedMesh>
//     </>
//   );
// });

// export default Asteroid;

























































// import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
// import { useFrame } from "@react-three/fiber";
// import * as THREE from "three";

// interface AsteroidProps {
//   missDistanceKm?: number;
//   velocityKps?: number;  // км/с (визуальная скорость)
//   time: number;          // глобальный слайдер/время для flyby
//   isPlaying: boolean;
//   setTime: (t: number | ((p: number) => number)) => void;
//   color?: string;
//   onImpact?: () => void;
//   impactSite?: { lat: number; lon: number } | null;
// }

// /* ====== Константы сцены и утилы ====== */
// const EARTH_RADIUS = 2;
// const ASTEROID_RADIUS = 0.3;

// function mapMissKmToScene(missKm: number) {
//   const SAFETY = 0.05;
//   const MIN_MISS = EARTH_RADIUS + ASTEROID_RADIUS + SAFETY;
//   const MAX_MISS = 20;
//   const t = Math.log10(Math.max(1, missKm)) / 8; // ~0..1
//   return MIN_MISS + (MAX_MISS - MIN_MISS) * Math.min(1, Math.max(0, t));
// }

// function toEarthPos(lat: number, lon: number) {
//   const phi = (90 - lat) * Math.PI / 180;
//   const theta = (lon + 180) * Math.PI / 180;
//   return new THREE.Vector3(
//     EARTH_RADIUS * Math.sin(phi) * Math.cos(theta),
//     EARTH_RADIUS * Math.cos(phi),
//     EARTH_RADIUS * Math.sin(phi) * Math.sin(theta)
//   );
// }

// /* ====== Эффект столкновения: вспышка + ударная волна + частицы + свет ====== */
// function ImpactFX({
//   position,
//   normal,
//   onDone,
//   duration = 2.2,
//   particleCount = 180,
// }: {
//   position: THREE.Vector3;
//   normal: THREE.Vector3;          // нормаль поверхности (наружу от центра)
//   onDone?: () => void;
//   duration?: number;
//   particleCount?: number;
// }) {
//   const group = useRef<THREE.Group>(null);
//   const flashMat = useRef<THREE.MeshBasicMaterial>(null);
//   const shockMat = useRef<THREE.MeshBasicMaterial>(null);
//   const lightRef = useRef<THREE.PointLight>(null);

//   // Частицы-осколки (instanced mesh)
//   const instRef = useRef<THREE.InstancedMesh>(null);
//   const velocities = useRef<THREE.Vector3[]>([]);
//   const lifes = useRef<number[]>([]);
//   const qBasis = useRef<THREE.Quaternion>(new THREE.Quaternion());
//   const tRef = useRef(0);

//   // Базис: ориентируем локальную ось +Y вдоль нормали поверхности
//   useEffect(() => {
//     const from = new THREE.Vector3(0, 1, 0);
//     const to = normal.clone().normalize();
//     qBasis.current.setFromUnitVectors(from, to);

//     // Сгенерим частицы в полупространство наружу
//     velocities.current = [];
//     lifes.current = [];
//     for (let i = 0; i < particleCount; i++) {
//       // случайное направление в полусфере вокруг +Y
//       const v = new THREE.Vector3(
//         (Math.random() * 2 - 1),
//         Math.random(),             // только положительное Y
//         (Math.random() * 2 - 1)
//       ).normalize();

//       // повернуть так, чтобы +Y совпал с нормалью
//       v.applyQuaternion(qBasis.current);

//       // скорость и жизнь
//       const speed = 2 + Math.random() * 7;        // ед/сек
//       const vel = v.multiplyScalar(speed);
//       velocities.current.push(vel);
//       lifes.current.push(1 + Math.random() * 0.8); // сек жизни частицы
//     }
//   }, [normal, particleCount]);

//   // Матрицы для инстансов
//   const dummy = useRef(new THREE.Object3D()).current;

//   useFrame((_, delta) => {
//     tRef.current += delta;

//     // FLASH (сферическая вспышка)
//     if (flashMat.current) {
//       const flashT = Math.min(1, tRef.current / 0.5); // первая полсекунды
//       const scale = 0.2 + flashT * 5.0;
//       group.current?.children[0]?.scale.setScalar(scale);
//       flashMat.current.opacity = 1.0 - flashT; // плавное затухание
//     }

//     // SHOCKWAVE (кольцо по касательной к поверхности)
//     if (shockMat.current) {
//       const waveT = Math.min(1, tRef.current / 1.1);
//       const s = 0.5 + waveT * 6.0;
//       // Кольцо — дочерний элемент №1: масштаб по XZ, вдоль плоскости касания
//       const ring = group.current?.children[1] as THREE.Mesh;
//       ring?.scale.set(s, s, s);
//       shockMat.current.opacity = 0.9 * (1.0 - waveT);
//     }

//     // LIGHT
//     if (lightRef.current) {
//       const lt = tRef.current;
//       if (lt < 0.35) lightRef.current.intensity = 20 * (1 - lt / 0.35);
//       else lightRef.current.intensity = Math.max(0, 6 * (1 - (lt - 0.35) / 0.6));
//       lightRef.current.distance = 15;
//     }

//     // PARTICLES
//     if (instRef.current) {
//       for (let i = 0; i < particleCount; i++) {
//         // уменьшаем «жизнь»
//         lifes.current[i] -= delta;
//         // позиция частицы = интеграл скорости
//         const vel = velocities.current[i];
//         // простое сопротивление воздуха: экспоненциальное затухание
//         vel.multiplyScalar(Math.exp(-delta * 1.3));

//         // Смещение частицы в локальном пространстве группы
//         const pos = new THREE.Vector3().copy(vel).multiplyScalar(Math.max(0, lifes.current[i])); // чуть-чуть "сцепить" жизнь и путь
//         dummy.position.copy(pos);
//         dummy.scale.setScalar(0.04 + (1 - Math.max(0, lifes.current[i]) / 1.8) * 0.05);
//         dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
//         dummy.updateMatrix();
//         instRef.current.setMatrixAt(i, dummy.matrix);
//       }
//       instRef.current.instanceMatrix.needsUpdate = true;

//       // Прозрачность частиц
//       const mat = instRef.current.material as THREE.MeshBasicMaterial;
//       mat.opacity = Math.max(0, 1.0 - tRef.current / duration);
//     }

//     // Конец эффекта
//     if (tRef.current >= duration) {
//       onDone?.();
//     }
//   });

//   // Геометрии и материалы
//   const ringGeom = new THREE.RingGeometry(0.2, 0.23, 64);
//   const shockQuat = new THREE.Quaternion().setFromUnitVectors(
//     new THREE.Vector3(0, 1, 0),
//     normal.clone().normalize()
//   );

//   return (
//     <group ref={group} position={position}>
//       {/* FLASH SPHERE */}
//       <mesh>
//         <sphereGeometry args={[1, 32, 32]} />
//         <meshBasicMaterial ref={flashMat} color={0xffe08a} transparent opacity={1} blending={THREE.AdditiveBlending} />
//       </mesh>

//       {/* SHOCKWAVE RING: ориентируем плоскость по касательной */}
//       <mesh quaternion={shockQuat}>
//         <primitive object={ringGeom} attach="geometry" />
//         <meshBasicMaterial ref={shockMat} color={0xffa600} transparent opacity={0.9} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
//       </mesh>

//       {/* DEBRIS INSTANCED */}
//       <instancedMesh ref={instRef} args={[undefined as any, undefined as any, particleCount]}>
//         <sphereGeometry args={[0.03, 8, 8]} />
//         <meshBasicMaterial color={0xffc14d} transparent opacity={1} blending={THREE.AdditiveBlending} />
//       </instancedMesh>

//       {/* FLASH LIGHT */}
//       <pointLight ref={lightRef} color={0xffc77d} position={[0, 0, 0]} intensity={15} distance={10} />
//     </group>
//   );
// }

// /* ====== Сам астероид ====== */
// const Asteroid = forwardRef<THREE.Mesh, AsteroidProps>(({
//   missDistanceKm,
//   velocityKps,
//   time,
//   isPlaying,
//   setTime,
//   color = "red",
//   onImpact,
//   impactSite,
// }, forwardedRef) => {
//   const ref = useRef<THREE.Mesh>(null!);
//   useImperativeHandle(forwardedRef, () => ref.current, []);

//   const [hasImpacted, setHasImpacted] = useState(false);
//   const [impactPos, setImpactPos] = useState<THREE.Vector3 | null>(null);
//   const [impactNormal, setImpactNormal] = useState<THREE.Vector3 | null>(null);
//   const [showFX, setShowFX] = useState(false);

//   // Режим: flyby / dive
//   const mode = useRef<"flyby" | "dive">("flyby");

//   // Нырок по прямой
//   const diveStart = useRef(new THREE.Vector3());
//   const diveTarget = useRef(new THREE.Vector3());
//   const dir = useRef(new THREE.Vector3());
//   const totalDist = useRef(0);
//   const s = useRef(0);
//   const diveSpeed = useRef(5);

//   // Прямой flyby
//   const flybyDir = useRef(new THREE.Vector3(0, 0, 1));
//   const flybyStartZ = -30;

//   if (!missDistanceKm || !velocityKps || isNaN(missDistanceKm) || isNaN(velocityKps)) return null;

//   const v_units = velocityKps * 0.02;

//   useEffect(() => {
//     if (impactSite && !hasImpacted) {
//       const start = ref.current?.position?.clone()
//         ?? new THREE.Vector3(mapMissKmToScene(missDistanceKm), 0, flybyStartZ);

//       const target = toEarthPos(impactSite.lat, impactSite.lon);

//       diveStart.current.copy(start);
//       diveTarget.current.copy(target);
//       dir.current.copy(target).sub(start).normalize();
//       totalDist.current = start.distanceTo(target);
//       s.current = 0;

//       const unitsPerSec = Math.max(0.8, velocityKps * 0.04);
//       diveSpeed.current = unitsPerSec;

//       ref.current?.position.copy(start);
//       mode.current = "dive";
//     } else {
//       mode.current = "flyby";
//     }
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [impactSite]);

//   useFrame((_, delta) => {
//     if (!ref.current) return;

//     if (mode.current === "dive") {
//       s.current = Math.min(totalDist.current, s.current + diveSpeed.current * delta);
//       const pos = diveStart.current.clone().addScaledVector(dir.current, s.current);
//       ref.current.position.copy(pos);
//     } else {
//       const missScene = mapMissKmToScene(missDistanceKm);
//       if (isPlaying && !hasImpacted) setTime((p) => p + delta * 10);
//       const t = time * v_units;
//       const base = new THREE.Vector3(missScene, 0, flybyStartZ);
//       const pos = base.addScaledVector(flybyDir.current, t);
//       ref.current.position.copy(pos);
//     }

//     // Столкновение: остановка на поверхности + запуск FX
//     const distToCenter = ref.current.position.length();
//     const HIT = EARTH_RADIUS + ASTEROID_RADIUS;
//     if (!hasImpacted && distToCenter <= HIT) {
//       const surfacePos = ref.current.position.clone().setLength(HIT);
//       ref.current.position.copy(surfacePos);

//       const n = surfacePos.clone().normalize(); // нормаль поверхности
//       setHasImpacted(true);
//       setImpactPos(surfacePos.clone());
//       setImpactNormal(n);
//       setShowFX(true);

//       onImpact?.();
//     }
//   });

//   return (
//     <>
//       {/* сам астероид */}
//       <mesh ref={ref} visible={!hasImpacted /* спрячем после удара, чтобы не торчал над вспышкой */}>
//         <sphereGeometry args={[ASTEROID_RADIUS, 32, 32]} />
//         <meshStandardMaterial color={hasImpacted ? "orange" : (mode.current === "dive" ? "red" : color)} />
//       </mesh>

//       {/* эффект столкновения */}
//       {showFX && impactPos && impactNormal && (
//         <ImpactFX
//           position={impactPos}
//           normal={impactNormal}
//           onDone={() => setShowFX(false)}
//         />
//       )}
//     </>
//   );
// });

// export default Asteroid;
