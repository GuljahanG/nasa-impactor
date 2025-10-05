import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { InstancedRigidBodies, RigidBody } from '@react-three/rapier';
import { Vector3 } from 'three';

import { calculateInitialPosition, calculateInitialVelocity } from '../utils/planetCalculations';
import { useExplosion } from '../context/Explosions';
import { useTrails } from '../context/Trails';

import Planet from './Planet';
import Globe from './Globe';
import TileEarth from './TileEarth'; // ← твой компонент текстурированной Земли

type InstRef = any; // упростим типы для краткости
type PlanetsProps = {
  count?: number;
  onEarthSelect?: (lat: number, lon: number) => void; // ← NEW
};
const EARTH_KEY = 'earth';

const Planets = ({ count = 14, onEarthSelect }: PlanetsProps) => {
  const { triggerExplosion } = useExplosion();
  const { addTrailPoint, clearTrail } = useTrails();

  const planetsRef = useRef<InstRef>(null);
  const earthRef = useRef<InstRef>(null);

  const [planetCount, setPlanetCount] = useState(count);

  // фабрика одной "обычной" планеты
  const newPlanet = (respawn = false) => {
    const key = 'instance_' + Math.random();
    const position = calculateInitialPosition(respawn);
    const linearVelocity = calculateInitialVelocity(position, respawn);
    const scale = 0.5 + Math.random() * 1.5;
    return { key, position, linearVelocity, scale, userData: { type: 'Planet', key } };
  };

  // данные для инстансов (все кроме "земли")
  const planetData = useMemo(() => {
    const planets = [];
    const instances = Math.max(0, count - 1); // один слот оставим под Землю
    for (let i = 0; i < instances; i++) {
      planets.push(newPlanet());
    }
    return planets;
  }, [count]);

  // инициализация спина инстансов
  useEffect(() => {
    if (!planetsRef.current) return;
    setPlanetCount(planetsRef.current.length);
    planetsRef.current.forEach((planet: any) => {
      planet.setAngvel(new Vector3(0, Math.random() - 0.5, 0));
    });
  }, [planetsRef.current]);

  // инициализация Земли (позиция/скорость как у обычных планет)
  useEffect(() => {
    if (!earthRef.current) return;
    const pos = calculateInitialPosition(false);
    const vel = calculateInitialVelocity(pos, false);
    earthRef.current.setTranslation(pos, true);
    earthRef.current.setLinvel(vel, true);
    earthRef.current.setAngvel({ x: 0, y: 0.2, z: 0 }, true); // лёгкое вращение
  }, [earthRef.current]);

  // обновление trail'ов
  useFrame(() => {
    // инстансы
    planetsRef.current?.forEach((planet: any) => {
      const p = planet.translation();
      addTrailPoint(planet.userData.key, new Vector3(p.x, p.y, p.z));
    });
    // земля
    if (earthRef.current) {
      const p = earthRef.current.translation();
      addTrailPoint(EARTH_KEY, new Vector3(p.x, p.y, p.z));
    }
  });

  // коллизии для инстанс-планет
  const handleCollision = ({ manifold, target, other }: any) => {
    // масса
    const targetMass = target.rigidBody.mass();
    const otherMass = other.rigidBody.mass();

    if (otherMass > targetMass) {
      const targetPosition = target.rigidBody.translation();
      const collisionWorldPosition = manifold.solverContactPoint(0);
      const targetVelocity = target.rigidBody.linvel();
      const otherVelocity = other.rigidBody.linvel();

      const combinedMass = targetMass + otherMass;
      const combinedVelocity = new Vector3()
        .addScaledVector(new Vector3(targetVelocity.x, targetVelocity.y, targetVelocity.z), targetMass)
        .addScaledVector(new Vector3(otherVelocity.x, otherVelocity.y, otherVelocity.z), otherMass)
        .divideScalar(combinedMass);

      if (other.rigidBody.userData.type === 'Planet' || other.rigidBody.userData.type === 'Earth') {
        other.rigidBody.setLinvel(combinedVelocity, true);
      }

      clearTrail(target.rigidBody.userData.key);

      triggerExplosion(
        new Vector3(collisionWorldPosition.x, collisionWorldPosition.y, collisionWorldPosition.z),
        new Vector3(targetPosition.x, targetPosition.y, targetPosition.z)
      );

      // респаун цели (только если это инстанс)
      const newPlanetData = newPlanet(true);
      target.rigidBody.userData.key = newPlanetData.key;
      target.rigidBody.setTranslation(newPlanetData.position, true);
      target.rigidBody.setLinvel(newPlanetData.linearVelocity, true);
    }
  };

  // коллизии для Земли (похожая логика)
  const handleEarthCollision = ({ manifold, target, other }: any) => {
    const targetMass = target.rigidBody.mass();
    const otherMass = other.rigidBody.mass();

    if (otherMass > targetMass) {
      const targetPosition = target.rigidBody.translation();
      const collisionWorldPosition = manifold.solverContactPoint(0);
      const targetVelocity = target.rigidBody.linvel();
      const otherVelocity = other.rigidBody.linvel();

      const combinedMass = targetMass + otherMass;
      const combinedVelocity = new Vector3()
        .addScaledVector(new Vector3(targetVelocity.x, targetVelocity.y, targetVelocity.z), targetMass)
        .addScaledVector(new Vector3(otherVelocity.x, otherVelocity.y, otherVelocity.z), otherMass)
        .divideScalar(combinedMass);

      if (other.rigidBody.userData.type === 'Planet') {
        other.rigidBody.setLinvel(combinedVelocity, true);
      }

      clearTrail(EARTH_KEY);

      triggerExplosion(
        new Vector3(collisionWorldPosition.x, collisionWorldPosition.y, collisionWorldPosition.z),
        new Vector3(targetPosition.x, targetPosition.y, targetPosition.z)
      );

      // Землю не «респауним», просто чуть толкнём назад и вернём скорость
      const pos = calculateInitialPosition(true);
      const vel = calculateInitialVelocity(pos, true);
      target.rigidBody.setTranslation(pos, true);
      target.rigidBody.setLinvel(vel, true);
    }
  };

  return (
    <>
      {/* Земля (глобус) — отдельный RigidBody */}
      {/* <RigidBody
        ref={earthRef}
        colliders="ball"
        userData={{ type: 'Earth', key: EARTH_KEY }}
        mass={5}                // можно сделать тяжелее обычной планеты
        onCollisionEnter={handleEarthCollision}
      >
        <Globe
            radius={2}
            position={[0, 0, 0]}   // the RigidBody controls translation; keep [0,0,0] inside
            onImpactSelect={(lat, lon) => {
            // e.g. redirect asteroid, set impact site, etc.
            // setImpactSite({ lat, lon });
              onEarthSelect?.(lat, lon);
            }}
        />
      </RigidBody> */}

      {/* Остальные планеты — инстансы */}
      <InstancedRigidBodies
        ref={planetsRef}
        instances={planetData}
        colliders="ball"
        onCollisionEnter={handleCollision}
      >
        <Planet count={planetData.length} />
      </InstancedRigidBodies>
    </>
  );
};

export default Planets;



// import React, { useRef, useState, useEffect, useMemo } from 'react'
// import { useFrame } from '@react-three/fiber'
// import { InstancedRigidBodies } from '@react-three/rapier'
// import { Vector3 } from 'three'

// import { calculateInitialPosition, calculateInitialVelocity } from '../utils/planetCalculations'
// import { useExplosion } from '../context/Explosions'
// import { useTrails } from '../context/Trails'

// import Planet from './Planet'

// // Planets component
// const Planets = ({ count = 14 }) => {
//     const { triggerExplosion } = useExplosion()
//     const { addTrailPoint, clearTrail } = useTrails()

//     const planetsRef = useRef()
//     const [planetCount, setPlanetCount] = useState(count)

//     // Planet props
//     const newPlanet = (respawn = false) => {
//         const key = 'instance_' + Math.random()
//         const position = calculateInitialPosition(respawn)
//         const linearVelocity = calculateInitialVelocity(position, respawn)
//         const scale = 0.5 + Math.random() * 1.5

//         return { key, position, linearVelocity, scale, userData: { type: 'Planet', key } }
//     }

//     // Set up the initial planet data
//     const planetData = useMemo(() => {
//         const planets = []
//         for (let i = 0; i < count; i++) {
//             planets.push(newPlanet())
//         }
//         return planets
//     }, [count])

//     // Update the planet count
//     useEffect(() => {
//         // Set the planet count
//         setPlanetCount(planetsRef.current.length)

//         // add some initial spin to the planets
//         planetsRef.current.forEach((planet) => {
//             planet.setAngvel(new Vector3(0, Math.random() - 0.5, 0))
//         })
//     }, [planetsRef.current])

//     // Add a trail point for each planet
//     useFrame(() => {
//         planetsRef.current?.forEach((planet) => {
//             const position = planet.translation()
//             addTrailPoint(planet.userData.key, new Vector3(position.x, position.y, position.z))
//         })
//     })

//     // Handle collisions
//     const handleCollision = ({ manifold, target, other }) => {
//         console.log('Planet collision')

//         // get the mass of both objects
//         const targetMass = target.rigidBody.mass()
//         const otherMass = other.rigidBody.mass()

//         // If other object is more massive
//         if (otherMass > targetMass) {
//             // Get the collision and target positions
//             const targetPosition = target.rigidBody.translation()
//             const collisionWorldPosition = manifold.solverContactPoint(0)

//             // Get the velocities of both objects
//             const targetVelocity = target.rigidBody.linvel()
//             const otherVelocity = other.rigidBody.linvel()

//             // Calculate the combined velocity using conservation of momentum
//             const combinedMass = targetMass + otherMass
//             const combinedVelocity = new Vector3().addScaledVector(targetVelocity, targetMass).addScaledVector(otherVelocity, otherMass).divideScalar(combinedMass)

//             // Set the combined velocity to the other
//             if (other.rigidBody.userData.type === 'Planet') {
//                 other.rigidBody.setLinvel(combinedVelocity)
//             }

//             // Clear trail of the target planet
//             clearTrail(target.rigidBody.userData.key)

//             // Trigger explosion.
//             triggerExplosion(
//                 new Vector3(collisionWorldPosition.x, collisionWorldPosition.y, collisionWorldPosition.z),
//                 new Vector3(targetPosition.x, targetPosition.y, targetPosition.z)
//             )

//             // Respawn the target planet
//             const newPlanetData = newPlanet(true)

//             target.rigidBody.userData.key = newPlanetData.key
//             target.rigidBody.setTranslation(newPlanetData.position)
//             target.rigidBody.setLinvel(newPlanetData.linearVelocity)
//         }
//     }

//     return (
//         <InstancedRigidBodies ref={planetsRef} instances={planetData} colliders='ball' onCollisionEnter={handleCollision}>
//             <Planet count={planetCount} />
//         </InstancedRigidBodies>
//     )
// }

// export default Planets