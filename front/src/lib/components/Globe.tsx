import React, { useRef } from "react";
import * as THREE from "three";
import TileEarth from "./TileEarth";

type GlobeProps = {
  radius?: number;
  position?: [number, number, number];
  onImpactSelect?: (lat: number, lon: number) => void;
};

export default function Globe({
  radius = 2,
  position = [0, 0, 0],
  onImpactSelect,
}: GlobeProps) {
  const meshRef = useRef<THREE.Mesh>(null!);

  const handlePointerDown = (e: THREE.Event) => {
    // intersection point on the sphere in world space
    const pWorld = e.point.clone();

    // convert to sphere-local coords (accounts for position/rotation/scale)
    const pLocal = meshRef.current.worldToLocal(pWorld);

    // unit vector from sphere center to hit point
    const v = pLocal.clone().normalize();

    // latitude in degrees: +90 at +Y, -90 at -Y
    const lat = THREE.MathUtils.radToDeg(
      Math.asin(THREE.MathUtils.clamp(v.y, -1, 1))
    );

    // CORRECTED longitude calculation:
    // Use atan2(v.z, v.x) to match OpenStreetMap coordinate system
    // This gives: 0° at +X axis (right), 90° at +Z axis (into screen)
    // Then adjust by -90° to align with geographic coordinates
    let lon = THREE.MathUtils.radToDeg(Math.atan2(v.z, v.x)) - 90;
    
    // Normalize to [-180, 180] range
    lon = ((lon + 180) % 360) - 180;
    
    // Alternative simpler approach that might work better:
    // const lon = THREE.MathUtils.radToDeg(Math.atan2(v.x, -v.z));

    onImpactSelect?.(lat, lon);
    e.stopPropagation();
    
    console.log(`Selected: Lat: ${lat.toFixed(6)}, Lon: ${lon.toFixed(6)}`);
  };

  return (
    <group position={position}>
      <TileEarth
        ref={meshRef}
        radius={radius} 
        zoom={2} 
        onPointerDown={handlePointerDown}
        onPointerOver={() => (document.body.style.cursor = "crosshair")}
        onPointerOut={() => (document.body.style.cursor = "auto")}
        castShadow
        receiveShadow
      />
    </group>
  );
}

// import React, { useRef } from "react";
// import * as THREE from "three";
// import TileEarth from "./TileEarth";

// type GlobeProps = {
//   radius?: number;
//   position?: [number, number, number];
//   onImpactSelect?: (lat: number, lon: number) => void;
// };

// export default function Globe({
//   radius = 2,
//   position = [0, 0, 0],
//   onImpactSelect,
// }: GlobeProps) {
//   const meshRef = useRef<THREE.Mesh>(null!);

//   const handlePointerDown = (e) => {
//     // intersection point on the sphere in world space
//     const pWorld = e.point.clone();

//     // convert to sphere-local coords (accounts for position/rotation/scale)
//     const pLocal = meshRef.current.worldToLocal(pWorld);

//     // unit vector from sphere center to hit point
//     const v = pLocal.clone().normalize();

//     // latitude in degrees: +90 at +Y, -90 at -Y
//     const lat = THREE.MathUtils.radToDeg(
//       Math.asin(THREE.MathUtils.clamp(v.y, -1, 1))
//     );

//     // longitude aligned with typical equirectangular/OSM mapping:
//     // 0° at Greenwich, increasing eastward, range [-180, 180]
//     // NOTE the -v.x in atan2 fixes the 90° yaw mismatch you saw.
//     const lon = ((Math.atan2(-v.x, v.z) * 180) / Math.PI + 180) % 360 - 180;

//     onImpactSelect?.(lat, lon);
//     e.stopPropagation();
//   };

//   return (
//     <group position={position}>
//       <TileEarth
//         ref={meshRef}
//         radius={2} 
//         zoom={2} 
//         onPointerDown={handlePointerDown}
//         onPointerOver={() => (document.body.style.cursor = "crosshair")}
//         onPointerOut={() => (document.body.style.cursor = "auto")}
//         castShadow
//         receiveShadow
//       />
//     </group>
//   );
// }
