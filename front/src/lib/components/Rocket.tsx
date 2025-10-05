// Rocket.tsx (фрагмент)
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import React, { useRef, useEffect } from "react";

type RocketProps = {
  id: number;
  start: THREE.Vector3;
  targetRef: React.RefObject<THREE.Object3D>;
  order?: { waypoint?: THREE.Vector3 | null; delay?: number } | null;
  speed?: number;
  turnRate?: number;
  hitRadius?: number;
  onHit?: (rocketId: number, hitPoint: THREE.Vector3) => void;
};

export default function Rocket({
  id, start, targetRef, order,
  speed = 2.5, turnRate = 3.5, hitRadius = 0.32, onHit
}: RocketProps) {
  const mesh = useRef<THREE.Mesh>(null);
  const vel = useRef(new THREE.Vector3());
  const dir = useRef(new THREE.Vector3(1,0,0));
  const tAcc = useRef(0);
  const ready = useRef(false);       // ← по умолчанию НЕ готова (ждём приказ)
  const lastDist = useRef<number>(Infinity);
  const noImproveTime = useRef(0);

  useEffect(() => {
    mesh.current?.position.copy(start);
    dir.current.set(1, 0, 0);
  }, [start]);

  // ✅ при получении нового приказа — сбрасываем задержку и режим готовности
  useEffect(() => {
    if (order) {
      tAcc.current = 0;
      ready.current = (order.delay ?? 0) <= 0;
      // ориентировать нос в сторону цели на старте — меньше первоначальной дуги
      const t = targetRef.current;
      if (mesh.current && t) {
        const tp = new THREE.Vector3();
        t.getWorldPosition(tp);
        dir.current.copy(tp.sub(mesh.current.position).normalize());
      }
    } else {
      ready.current = false;
    }
  }, [order, targetRef]);

  const getTargetState = () => {
    const t = targetRef.current;
    if (!t) return null;
    const pos = new THREE.Vector3();
    const prev = (t.userData?.prevPos as THREE.Vector3) || t.getWorldPosition(new THREE.Vector3());
    t.getWorldPosition(pos);
    const v = pos.clone().sub(prev);
    return { pos, vel: v };
  };

  useFrame((_, dt) => {
    if (!mesh.current) return;

    // ⛔️ НЕТ ПРИКАЗА — вообще ничего не делаем (висят «на базе»)
    if (!order) return;

    // волновой старт по delay
    if (!ready.current) {
      tAcc.current += dt;
      if (tAcc.current < (order.delay ?? 0)) return;
      ready.current = true;
    }

    // —— дальше всё как у тебя: упреждение, разворот, движение, антизастревание, hit-check — —— //
    const tgt = getTargetState();
    let aimPoint: THREE.Vector3 | null = null;

    if (order.waypoint) {
      const dWP = mesh.current.position.distanceTo(order.waypoint);
      if (dWP > 0.8) aimPoint = order.waypoint;
    }
    if (!aimPoint && tgt) {
      const rel = tgt.pos.clone().sub(mesh.current.position);
      const closing = Math.max(0.2, rel.length() / (speed + 1e-6));
      const lead = tgt.vel.clone().multiplyScalar(closing * 0.9);
      aimPoint = tgt.pos.clone().add(lead);
    }
    if (!aimPoint) return;

    const d = mesh.current.position.distanceTo(tgt?.pos ?? aimPoint);
    let localTurn = turnRate, localHit = hitRadius, localSpeed = speed;
    if (d < 1.2) { localTurn *= 1.8; localSpeed *= 1.15; localHit = Math.max(localHit, 0.45); }
    else if (d < 2) { localTurn *= 1.4; localHit = Math.max(localHit, 0.38); }

    const desiredDir = aimPoint.clone().sub(mesh.current.position).normalize();
    const cur = dir.current.clone().normalize();
    const dot = THREE.MathUtils.clamp(cur.dot(desiredDir), -1, 1);
    const angle = Math.acos(dot);
    if (angle > 1e-4) {
      const maxStep = localTurn * dt;
      const t = Math.min(1, maxStep / angle);
      dir.current.copy(cur.lerp(desiredDir, t).normalize());
    }

    vel.current.copy(dir.current).multiplyScalar(localSpeed);
    mesh.current.position.add(vel.current.clone().multiplyScalar(dt));
    mesh.current.lookAt(mesh.current.position.clone().add(dir.current));

    const distNow = tgt ? mesh.current.position.distanceTo(tgt.pos) : mesh.current.position.distanceTo(aimPoint);
    if (distNow < lastDist.current - 0.001) {
      noImproveTime.current = 0; lastDist.current = distNow;
    } else {
      noImproveTime.current += dt;
      if (noImproveTime.current > 1.8) {
        dir.current.lerp(desiredDir, 0.6).normalize();
        vel.current.add(desiredDir.clone().multiplyScalar(0.7));
        lastDist.current = distNow;
        noImproveTime.current = 0.3;
      }
    }

    if (tgt && distNow <= localHit) {
      onHit?.(id, tgt.pos.clone());
    }
  });

  return (
    <mesh ref={mesh}>
      <coneGeometry args={[0.08, 0.28, 12]} />
      <meshStandardMaterial color="#fff" metalness={0.2} roughness={0.5} />
    </mesh>
  );
}


// import React, { useEffect, useRef } from "react";
// import * as THREE from "three";
// import { useFrame } from "@react-three/fiber";

// type Phase = "idle" | "toWaypoint" | "home";

// export interface RocketOrder {
//   waypoint?: THREE.Vector3 | null;
//   delay?: number;
// }

// interface RocketProps {
//   id: number;
//   start: THREE.Vector3;
//   targetRef: React.RefObject<THREE.Object3D>;
//   order?: RocketOrder | null;
//   speed?: number;
//   turnRate?: number;
//   hitRadius?: number;
//   onHit: (id: number, hitPoint: THREE.Vector3) => void;
// }

// export default function Rocket({
//   id,
//   start,
//   targetRef,
//   order,
//   speed = 7,
//   turnRate = 3.5,
//   hitRadius = 0.35,
//   onHit,
// }: RocketProps) {
//   const ref = useRef<THREE.Mesh>(null);
//   const vel = useRef(new THREE.Vector3()); 
//   const dir = useRef(new THREE.Vector3(0, 1, 0));
//   const phase = useRef<Phase>("idle");
//   const tAcc = useRef(0); // таймер для delay
//   const alive = useRef(true);

//   // стартовая позиция
//   useEffect(() => {
//     if (!ref.current) return;
//     ref.current.position.copy(start);
//   }, [start]);

//   useFrame((_, dt) => {
//     const m = ref.current;
//     if (!m || !alive.current) return;

//     // ожидание старта
//     if (order?.delay && phase.current === "idle") {
//       tAcc.current += dt;
//       if (tAcc.current < order.delay) return;
//       phase.current = order?.waypoint ? "toWaypoint" : "home";
//     }
//     if (!order && phase.current === "idle") {
//       // нет приказа — красиво «висим» на месте
//       return;
//     }

//     // цель (астероид) в мире
//     const target = new THREE.Vector3();
//     targetRef.current?.getWorldPosition(target);

//     // текущая цель по фазе
//     const dest =
//       phase.current === "toWaypoint" && order?.waypoint
//         ? order.waypoint
//         : target;

//     // поворот к цели
//     const toDest = dest.clone().sub(m.position).normalize();
//     const angle = dir.current.angleTo(toDest);
//     const maxStep = turnRate * dt;
//     const t = angle < 1e-6 ? 1 : Math.min(1, maxStep / angle);
//     dir.current.lerp(toDest, t).normalize();

//     // движение
//     m.position.addScaledVector(dir.current, speed * dt);

//     // ориентация носом вперёд
//     const z = dir.current.clone();
//     const x = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), z).normalize();
//     const y = new THREE.Vector3().crossVectors(z, x).normalize();
//     const mat = new THREE.Matrix4().makeBasis(x, y, z);
//     m.quaternion.setFromRotationMatrix(mat);

//     // переход к фазе home (как только достигли waypoint)
//     if (phase.current === "toWaypoint" && order?.waypoint) {
//       if (m.position.distanceTo(order.waypoint) < 0.15) {
//         phase.current = "home";
//       }
//     }

//     // перехват
//     const dist = m.position.distanceTo(target);
//     if (phase.current === "home" && dist < hitRadius) {
//       alive.current = false;
//       onHit(id, m.position.clone());
//     }
//   });

//   return (
//     <mesh ref={ref}>
//       <coneGeometry args={[0.05, 0.16, 12]} />
//       <meshStandardMaterial emissive="#ffffff" emissiveIntensity={0.7} metalness={0.2} roughness={0.35} />
//     </mesh>
//   );
// }


// import React, { useEffect, useRef } from 'react'
// import * as THREE from 'three'
// import { useFrame } from '@react-three/fiber'

// type RocketProps = {
//   start: THREE.Vector3
//   targetRef: React.RefObject<THREE.Object3D>
//   onHit: (hitPoint: THREE.Vector3) => void
//   speed?: number         // ед/с
//   turnRate?: number      // рад/с
//   hitRadius?: number     // радиус перехвата
// }

// export default function Rocket({
//   start,
//   targetRef,
//   onHit,
//   speed = 6,
//   turnRate = 4,
//   hitRadius = 0.25,
// }: RocketProps) {
//   const ref = useRef<THREE.Mesh>(null)
//   const dir = useRef(new THREE.Vector3(0, 1, 0))
//   const alive = useRef(true)

//   useEffect(() => {
//     if (!ref.current) return
//     ref.current.position.copy(start)
//     // начальное направление на цель
//     const tgt = new THREE.Vector3()
//     if (targetRef.current) {
//       targetRef.current.getWorldPosition(tgt)
//       dir.current.copy(tgt.sub(start).normalize())
//     }
//   }, [start, targetRef])

//   useFrame((_, dt) => {
//     const m = ref.current
//     if (!m || !alive.current) return

//     // позиция цели
//     const tgt = new THREE.Vector3()
//     if (targetRef.current) targetRef.current.getWorldPosition(tgt)

//     // поворот к цели с ограничением угловой скорости
//     const toTarget = tgt.clone().sub(m.position).normalize()
//     const angle = dir.current.angleTo(toTarget)
//     const maxStep = turnRate * dt
//     const t = angle < 1e-6 ? 1 : Math.min(1, maxStep / angle)
//     dir.current.lerp(toTarget, t).normalize()

//     // движение
//     m.position.addScaledVector(dir.current, speed * dt)

//     // ориентируем «нос» по направлению
//     const z = dir.current.clone().normalize()
//     const x = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), z).normalize()
//     const y = new THREE.Vector3().crossVectors(z, x).normalize()
//     const mat = new THREE.Matrix4().makeBasis(x, y, z)
//     m.quaternion.setFromRotationMatrix(mat)

//     // попадание
//     if (m.position.distanceTo(tgt) < hitRadius) {
//       alive.current = false
//       onHit(m.position.clone())
//     }
//   })

//   return (
//     <mesh ref={ref}>
//       <coneGeometry args={[0.05, 0.15, 12]} />
//       <meshStandardMaterial emissive="#ffffff" emissiveIntensity={0.6} metalness={0.2} roughness={0.4} />
//     </mesh>
//   )
// }
