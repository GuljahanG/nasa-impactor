// src/lib/components/BigShatterFX.tsx
import * as THREE from "three";
import React, { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";

type BigShatterFXProps = {
  position: THREE.Vector3;     // точка удара на астероиде
  normal: THREE.Vector3;       // нормаль поверхности (из центра к точке)
  duration?: number;           // длительность жизни эффекта (сек)
  debrisCount?: number;        // крупных осколков
  sparkCount?: number;         // искр
  onDone?: () => void;
};

export default function BigShatterFX({
  position,
  normal,
  duration = 5.0,
  debrisCount = 120,
  sparkCount = 260,
  onDone,
}: BigShatterFXProps) {
  const group = useRef<THREE.Group>(null);
  const qBasis = useRef(new THREE.Quaternion());
  const tRef = useRef(0);

  // крупные осколки
  const debrisInst = useRef<THREE.InstancedMesh>(null);
  const debrisVel = useRef<THREE.Vector3[]>([]);
  const debrisAng = useRef<THREE.Vector3[]>([]); // угл. скорость
  const debrisLife = useRef<number[]>([]);

  // искры
  const sparkInst = useRef<THREE.InstancedMesh>(null);
  const sparkVel = useRef<THREE.Vector3[]>([]);
  const sparkLife = useRef<number[]>([]);

  const flashMat = useRef<THREE.MeshBasicMaterial>(null);
  const shockMat = useRef<THREE.MeshBasicMaterial>(null);
  const smokeMat = useRef<THREE.MeshBasicMaterial>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  // геометрии
  const chunkGeom = useMemo(() => {
    // неровные «камушки»
    const g = new THREE.IcosahedronGeometry(0.09, 0);
    g.computeVertexNormals();
    return g;
  }, []);
  const sparkGeom = useMemo(() => new THREE.SphereGeometry(0.03, 6, 6), []);

  useEffect(() => {
    // локальная система: +Y = normal
    const from = new THREE.Vector3(0, 1, 0);
    qBasis.current.setFromUnitVectors(from, normal.clone().normalize());

    // осколки
    debrisVel.current = [];
    debrisAng.current = [];
    debrisLife.current = [];
    for (let i = 0; i < debrisCount; i++) {
      // конус = вверх по нормали + разброс
      const dir = new THREE.Vector3(
        (Math.random() * 2 - 1) * 0.5,
        Math.random(), // больше в +Y
        (Math.random() * 2 - 1) * 0.5
      ).normalize();
      dir.applyQuaternion(qBasis.current);

      const speed = 4.0 + Math.random() * 9.0; // пинок
      debrisVel.current.push(dir.multiplyScalar(speed));

      const ang = new THREE.Vector3(
        (Math.random() * 2 - 1) * 4,
        (Math.random() * 2 - 1) * 4,
        (Math.random() * 2 - 1) * 4
      );
      debrisAng.current.push(ang);

      debrisLife.current.push(2.0 + Math.random() * 2.8); // позже тускнеют
    }

    // искры
    sparkVel.current = [];
    sparkLife.current = [];
    for (let i = 0; i < sparkCount; i++) {
      const dir = new THREE.Vector3(
        (Math.random() * 2 - 1) * 1.2,
        Math.random() * 1.3,
        (Math.random() * 2 - 1) * 1.2
      ).normalize();
      dir.applyQuaternion(qBasis.current);
      const speed = 6 + Math.random() * 14;
      sparkVel.current.push(dir.multiplyScalar(speed));
      sparkLife.current.push(0.7 + Math.random() * 0.7);
    }
  }, [debrisCount, sparkCount, normal]);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((_, dt) => {
    tRef.current += dt;

    // FLASH
    if (flashMat.current) {
      const f = Math.min(1, tRef.current / 0.35);
      flashMat.current.opacity = 1 - f;
    }

    // SHOCKWAVE
    if (shockMat.current && group.current) {
      const wave = Math.min(1, tRef.current / 0.9);
      const s = 0.6 + wave * 10.0;
      const ring = group.current.children[1] as THREE.Mesh; // [0]=flash, [1]=ring
      ring.scale.set(s, s, s);
      shockMat.current.opacity = 0.9 * (1 - wave);
    }

    // LIGHT
    if (lightRef.current) {
      // быстро вспыхнула, потом тлеет
      const a = tRef.current;
      const base = a < 0.25 ? THREE.MathUtils.lerp(25, 8, a / 0.25) : THREE.MathUtils.lerp(8, 0, (a - 0.25) / 1.5);
      lightRef.current.intensity = Math.max(0, base);
      lightRef.current.distance = 16;
    }

    // DEBRIS update (drag + spin + fade)
    if (debrisInst.current) {
      for (let i = 0; i < debrisCount; i++) {
        debrisLife.current[i] -= dt * 0.4; // дольше живут
        // слабая «гравитация» наружу вдоль нормали + сопротивление
        debrisVel.current[i].multiplyScalar(Math.exp(-dt * 0.5));
        const pos = debrisVel.current[i].clone().multiplyScalar(Math.max(0, 2.4 - debrisLife.current[i])); // дальше — медленнее
        dummy.position.copy(position).add(pos);

        // вращение
        const ang = debrisAng.current[i];
        dummy.rotation.x += ang.x * dt;
        dummy.rotation.y += ang.y * dt;
        dummy.rotation.z += ang.z * dt;

        // масштаб — чуть уменьшается
        const sc = 0.9 + Math.max(0, debrisLife.current[i]) * 0.12;
        dummy.scale.set(sc, sc, sc);
        dummy.updateMatrix();
        debrisInst.current.setMatrixAt(i, dummy.matrix);

        // альфа каждого куска
        const m = debrisInst.current.material as THREE.MeshStandardMaterial;
        m.opacity = Math.max(0, Math.min(1, debrisLife.current[i]));
      }
      debrisInst.current.instanceMatrix.needsUpdate = true;
    }

    // SPARKS update (быстро тухнут)
    if (sparkInst.current) {
      for (let i = 0; i < sparkCount; i++) {
        sparkLife.current[i] -= dt;
        sparkVel.current[i].multiplyScalar(Math.exp(-dt * 2.0));
        const pos = sparkVel.current[i].clone().multiplyScalar(Math.max(0, sparkLife.current[i]) * 1.3);
        dummy.position.copy(position).add(pos);
        const sc = 0.05 + (sparkLife.current[i]) * 0.08;
        dummy.scale.setScalar(Math.max(0.01, sc));
        dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        dummy.updateMatrix();
        sparkInst.current.setMatrixAt(i, dummy.matrix);
      }
      sparkInst.current.instanceMatrix.needsUpdate = true;

      const mat = sparkInst.current.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 1.0 - tRef.current / 1.4);
    }

    // SMOKE — плавное исчезновение
    if (smokeMat.current) {
      const k = Math.min(1, tRef.current / 2.0);
      smokeMat.current.opacity = 0.35 * (1 - k);
    }

    if (tRef.current >= duration) onDone?.();
  });

  // гео: кольцо в плоскости удара
  const ringGeom = useMemo(() => new THREE.RingGeometry(0.25, 0.3, 80), []);
  const ringQuat = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal.clone().normalize()),
    [normal]
  );

  return (
    <group ref={group}>
      {/* FLASH */}
      <mesh position={position}>
        <sphereGeometry args={[0.6, 24, 24]} />
        <meshBasicMaterial ref={flashMat} color={0xfff2b0} transparent opacity={1} blending={THREE.AdditiveBlending} />
      </mesh>

      {/* SHOCKWAVE */}
      <mesh position={position} quaternion={ringQuat}>
        <primitive object={ringGeom} attach="geometry" />
        <meshBasicMaterial
          ref={shockMat}
          color={0xffa640}
          transparent
          opacity={0.9}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* DEBRIS (крупные камни) */}
      <instancedMesh ref={debrisInst} args={[chunkGeom, undefined as any, debrisCount]}>
        <meshStandardMaterial color={0x9c8770} roughness={0.95} metalness={0} transparent opacity={1} />
      </instancedMesh>

      {/* SPARKS (горячие искры) */}
      <instancedMesh ref={sparkInst} args={[sparkGeom, undefined as any, sparkCount]}>
        <meshBasicMaterial color={0xffd08a} transparent opacity={1} blending={THREE.AdditiveBlending} />
      </instancedMesh>

      {/* SMOKE (полупрозрачный шар) */}
      <mesh position={position}>
        <sphereGeometry args={[0.9, 20, 20]} />
        <meshBasicMaterial ref={smokeMat} color={0x111111} transparent opacity={0.25} />
      </mesh>

      {/* LIGHT */}
      <pointLight ref={lightRef} color={0xffcc88} position={position} intensity={18} distance={15} />
    </group>
  );
}
