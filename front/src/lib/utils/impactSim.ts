export function simulateImpact({
  diameterKm,
  velocityKps,
  density = 3000,
  impactLat,
  impactLon,
}: {
  diameterKm: number;
  velocityKps: number;
  density?: number;
  impactLat?: number;
  impactLon?: number;
}) {
  const radiusM = (diameterKm * 1000) / 2;
  const mass = (4 / 3) * Math.PI * Math.pow(radiusM, 3) * density;

  const velocity = velocityKps * 1000; // to m/s
  const energyJ = 0.5 * mass * velocity * velocity;
  const tntKilotons = energyJ / 4.184e12;

  // Crater size estimate
  const rhoTarget = 2500; // Earth crust density
  const g = 9.81;
  const craterDiameterM =
    1.161 * Math.pow(energyJ / (rhoTarget * g), 0.294);

  // Seismic magnitude
  const magnitude = 0.67 * Math.log10(energyJ) - 5.87;

  // Impact location effects (if coordinates provided)
  let impactEffects = {};
  if (impactLat !== undefined && impactLon !== undefined) {
    // Determine impact environment
    const isOcean = isOceanImpact(impactLat, impactLon);
    const population = estimateLocalPopulation(impactLat, impactLon);
    
    impactEffects = {
      location: {
        latitude: impactLat,
        longitude: impactLon,
        environment: isOcean ? 'Ocean' : 'Land',
      },
      effects: {
        tsunamiRisk: isOcean && energyJ > 1e15, // Large ocean impacts can cause tsunamis
        populationAtRisk: population,
        devastationRadiusKm: Math.sqrt(energyJ / 1e12) * 10, // Rough estimate
      }
    };
  }

  return {
    mass,
    energyJ,
    tntKilotons,
    craterDiameterM,
    magnitude,
    ...impactEffects,
  };
}

// Helper function to determine if impact is in ocean (simplified)
function isOceanImpact(lat: number, lon: number): boolean {
  // Simplified ocean detection - in reality you'd use a coastline dataset
  // This is a rough approximation based on major landmasses
  
  // Major ocean areas (very simplified)
  if (Math.abs(lat) > 70) return true; // Polar regions mostly ocean/ice
  
  // Pacific Ocean rough bounds
  if (lon > 120 || lon < -60) {
    if (lat > -40 && lat < 60) return true;
  }
  
  // Atlantic Ocean rough bounds
  if (lon > -60 && lon < 20) {
    if ((lat > 40 && lat < 70) || (lat > -60 && lat < 10)) return true;
  }
  
  // Indian Ocean rough bounds
  if (lon > 20 && lon < 120) {
    if (lat > -60 && lat < 30) return true;
  }
  
  return false; // Default to land
}

// Helper function to estimate population density (simplified)
function estimateLocalPopulation(lat: number, lon: number): number {
  // Simplified population estimation based on known populated areas
  // In reality, you'd use actual population density data
  
  // Major population centers (very rough estimates)
  const populationCenters = [
    { lat: 40.7, lon: -74.0, pop: 8000000 }, // NYC area
    { lat: 51.5, lon: -0.1, pop: 9000000 }, // London area
    { lat: 35.7, lon: 139.7, pop: 14000000 }, // Tokyo area
    { lat: 55.8, lon: 37.6, pop: 12000000 }, // Moscow area
    { lat: 39.9, lon: 116.4, pop: 21000000 }, // Beijing area
    // Add more as needed
  ];
  
  // Find closest population center
  let closestDistance = Infinity;
  let estimatedPop = 100000; // Default rural population
  
  populationCenters.forEach(center => {
    const distance = Math.sqrt(
      Math.pow(lat - center.lat, 2) + Math.pow(lon - center.lon, 2)
    );
    
    if (distance < closestDistance) {
      closestDistance = distance;
      // Population decreases with distance from center
      estimatedPop = Math.max(
        10000, 
        center.pop * Math.exp(-distance * 10)
      );
    }
  });
  
  return Math.round(estimatedPop);
}