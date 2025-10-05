import { Line } from "@react-three/drei";

export default function AsteroidFlybyOrbit({ missDistanceKm }: { missDistanceKm?: number }) {
  if (!missDistanceKm || isNaN(missDistanceKm)) return null;

  const EARTH_RADIUS = 2;
  const MAX_DISPLAY_DISTANCE = 20;
  const normalized = Math.log10(Math.max(1, missDistanceKm)) * 1.2;
  const missDist = Math.max(EARTH_RADIUS + 1, Math.min(MAX_DISPLAY_DISTANCE, normalized));

  const pts: [number, number, number][] = [];
  const n = 60;
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * 2 - 1;
    const z = t * 25;
    const x = missDist / Math.sqrt(1 + (z * z) / (missDist * missDist * 4));
    pts.push([x, 0, z]);
  }

  return <Line points={pts} lineWidth={2} opacity={0.5} transparent />;
}

// import { Line } from "@react-three/drei";

// interface Props {
//   missDistanceKm?: number;
// }

// export default function AsteroidFlybyOrbit({ missDistanceKm }: Props) {
//   if (!missDistanceKm || isNaN(missDistanceKm)) {
//     return null;
//   }

//   // ✅ Fixed scaling - normalize to a reasonable range for 3D scene
//   const EARTH_RADIUS = 2; // Earth radius in our 3D scene
//   const MAX_DISPLAY_DISTANCE = 20; // Maximum distance we want to show in scene
  
//   // Scale miss distance to fit our 3D scene (2-20 units range)
//   const normalizedDistance = Math.log10(missDistanceKm / 10000) * 3 + EARTH_RADIUS;
//   const missDist = Math.max(EARTH_RADIUS + 1, Math.min(MAX_DISPLAY_DISTANCE, normalizedDistance));

//   if (!isFinite(missDist)) return null;

//   // ✅ Create unique trajectory based on actual miss distance
//   const curveFactor = Math.min(missDist / 10, 1); // More distant = less curve
  
//   // Generate trajectory points
//   const points: [number, number, number][] = [];
//   const numPoints = 50;
  
//   for (let i = 0; i <= numPoints; i++) {
//     const t = (i / numPoints) * 2 - 1; // -1 to 1
//     const z = t * 25; // Start further back, end further forward
    
//     // Hyperbolic trajectory - closer asteroids curve more toward Earth
//     const x = missDist / Math.sqrt(1 + (z * z) / (missDist * missDist * 4));
//     const y = 0; // Keep in horizontal plane
    
//     points.push([x, y, z]);
//   }

//   // Color based on miss distance - closer = more red, farther = more yellow
//   const dangerLevel = Math.max(0, 1 - (missDist - EARTH_RADIUS) / 15);
//   const color = `hsl(${60 - dangerLevel * 60}, 100%, 50%)`; // Yellow to red

//   return (
//     <Line 
//       points={points} 
//       color={color} 
//       lineWidth={2}
//       transparent
//       opacity={0.8}
//     />
//   );
// }