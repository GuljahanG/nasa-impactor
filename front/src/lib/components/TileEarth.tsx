// import { useEffect, useRef } from "react";
// import * as THREE from "three";

// interface TileEarthProps {
//   radius?: number;
//   zoom?: number;
//   onCoordinateClick?: (lat: number, lon: number) => void;
// }

// export default function TileEarth({ 
//   radius = 2, 
//   zoom = 2,
//   onCoordinateClick 
// }: TileEarthProps) {
//   const meshRef = useRef<THREE.Mesh>(null);
//   const sceneRef = useRef<THREE.Scene | null>(null);
//   const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
//   const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

//   useEffect(() => {
//     if (!meshRef.current) return;

//     const size = 512;
//     const canvas = document.createElement("canvas");
//     canvas.width = size;
//     canvas.height = size;
//     const ctx = canvas.getContext("2d");

//     if (!ctx) return;

//     const tilesX = Math.pow(2, zoom);
//     const tilesY = Math.pow(2, zoom);
//     let loaded = 0;

//     // Clear canvas first
//     ctx.fillStyle = "#000033";
//     ctx.fillRect(0, 0, size, size);

//     for (let x = 0; x < tilesX; x++) {
//       for (let y = 0; y < tilesY; y++) {
//         const img = new Image();
//         img.crossOrigin = "anonymous";
//         img.src = `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`;

//         img.onload = () => {
//           ctx.drawImage(
//             img,
//             (x * size) / tilesX,
//             (y * size) / tilesY,
//             size / tilesX,
//             size / tilesY
//           );

//           loaded++;
//           if (loaded === tilesX * tilesY) {
//             const texture = new THREE.CanvasTexture(canvas);
//             if (meshRef.current) {
//               (meshRef.current.material as THREE.MeshPhongMaterial).map = texture;
//               (meshRef.current.material as THREE.MeshPhongMaterial).needsUpdate = true;
//             }
//           }
//         };

//         img.onerror = () => {
//           console.warn(`Failed to load tile: ${zoom}/${x}/${y}`);
//           loaded++;
//         };
//       }
//     }
//   }, [zoom]);

//   // Set up Three.js scene and click handling
//   useEffect(() => {
//     if (!meshRef.current) return;

//     // Create scene if it doesn't exist
//     if (!sceneRef.current) {
//       sceneRef.current = new THREE.Scene();
      
//       // Add ambient light
//       const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
//       sceneRef.current.add(ambientLight);
      
//       // Add directional light
//       const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
//       directionalLight.position.set(5, 3, 5);
//       sceneRef.current.add(directionalLight);
      
//       sceneRef.current.add(meshRef.current);
//     }

//     // Set up camera
//     if (!cameraRef.current) {
//       cameraRef.current = new THREE.PerspectiveCamera(
//         75,
//         window.innerWidth / window.innerHeight,
//         0.1,
//         1000
//       );
//       cameraRef.current.position.z = 5;
//     }

//     // Set up renderer
//     if (!rendererRef.current) {
//       rendererRef.current = new THREE.WebGLRenderer({ antialias: true });
//       rendererRef.current.setSize(window.innerWidth, window.innerHeight);
//       document.body.appendChild(rendererRef.current.domElement);

//       // Add click event listener
//       rendererRef.current.domElement.addEventListener('click', handleClick);
//     }

//     // Animation loop
//     const animate = () => {
//       requestAnimationFrame(animate);
//       if (meshRef.current) {
//         meshRef.current.rotation.y += 0.001;
//       }
//       if (rendererRef.current && sceneRef.current && cameraRef.current) {
//         rendererRef.current.render(sceneRef.current, cameraRef.current);
//       }
//     };
//     animate();

//     // Cleanup
//     return () => {
//       if (rendererRef.current) {
//         rendererRef.current.domElement.removeEventListener('click', handleClick);
//         document.body.removeChild(rendererRef.current.domElement);
//       }
//     };
//   }, []);

//   const handleClick = (event: MouseEvent) => {
//     if (!meshRef.current || !cameraRef.current || !rendererRef.current) return;

//     const mouse = new THREE.Vector2();
//     const rect = rendererRef.current.domElement.getBoundingClientRect();
    
//     // Convert mouse position to normalized device coordinates (-1 to +1)
//     mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
//     mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

//     const raycaster = new THREE.Raycaster();
//     raycaster.setFromCamera(mouse, cameraRef.current);

//     const intersects = raycaster.intersectObject(meshRef.current);
    
//     if (intersects.length > 0) {
//       const point = intersects[0].point;
//       const latLon = cartesianToLatLon(point, radius);
      
//       if (onCoordinateClick) {
//         onCoordinateClick(latLon.lat, latLon.lon);
//       }
      
//       console.log(`Clicked at: Lat: ${latLon.lat.toFixed(6)}, Lon: ${latLon.lon.toFixed(6)}`);
//     }
//   };

//   // Convert Cartesian coordinates to latitude/longitude
//   const cartesianToLatLon = (point: THREE.Vector3, radius: number) => {
//     // Normalize the point to get direction vector
//     const normalized = point.clone().normalize();
    
//     // Calculate latitude (φ) - 90° at north pole, -90° at south pole
//     const lat = Math.asin(normalized.y) * (180 / Math.PI);
    
//     // Calculate longitude (λ) - -180° to 180°
//     const lon = Math.atan2(normalized.z, normalized.x) * (180 / Math.PI);
    
//     return { lat, lon };
//   };

//   return (
//     <mesh ref={meshRef}>
//       <sphereGeometry args={[radius, 64, 64]} />
//       <meshPhongMaterial />
//     </mesh>
//   );
// }

import { useEffect, useRef } from "react";
import * as THREE from "three";

interface TileEarthProps {
  radius?: number;
  zoom?: number; // map zoom level (0-5 is safe for global)
}

export default function TileEarth({ radius = 2, zoom = 2 }: TileEarthProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    const size = 512; // canvas size
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    const tilesX = Math.pow(2, zoom);
    const tilesY = Math.pow(2, zoom);
    let loaded = 0;

    for (let x = 0; x < tilesX; x++) {
      for (let y = 0; y < tilesY; y++) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`;

        img.onload = () => {
          ctx.drawImage(
            img,
            (x * size) / tilesX,
            (y * size) / tilesY,
            size / tilesX,
            size / tilesY
          );

          loaded++;
          if (loaded === tilesX * tilesY) {
            const texture = new THREE.CanvasTexture(canvas);
            if (meshRef.current) {
              (meshRef.current.material as THREE.MeshPhongMaterial).map =
                texture;
              (meshRef.current.material as THREE.MeshPhongMaterial).needsUpdate =
                true;
            }
          }
        };
      }
    }
  }, [zoom]);

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[radius, 64, 64]} />
      <meshPhongMaterial />
    </mesh>
  );
}
