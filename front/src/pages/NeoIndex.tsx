import { useLoaderData, type LoaderFunction } from "react-router";

interface CloseApproachData {
  relative_velocity: {
    kilometers_per_second: string;
  };
  miss_distance: {
    kilometers: string;
  };
  close_approach_date: string;
  orbiting_body: string;
}

interface EstimatedDiameter {
  kilometers: {
    estimated_diameter_min: number;
    estimated_diameter_max: number;
  };
}

interface NearEarthObject {
  id: string;
  name: string;
  estimated_diameter: EstimatedDiameter;
  close_approach_data: CloseApproachData[];
  is_potentially_hazardous_asteroid: boolean;
  nasa_jpl_url: string;
  orbiting_body: string;
}

interface NeoApiResponse {
  near_earth_objects: NearEarthObject[];
}

export const loader: LoaderFunction = async () => {
  try {
    const res = await fetch(`/api/neo/browse`);
    if (!res.ok) {
      throw new Response("Failed to fetch NEO data", { status: res.status });
    }
    
    const data: NeoApiResponse = await res.json();
    return data;
  } catch (error) {
    console.error("Error fetching NEO data:", error);
    throw new Response("Failed to load asteroid data", { status: 500 });
  }
};

// Helper function to safely get approach data
const getApproachData = (neo: NearEarthObject) => {
  const approachData = neo.close_approach_data?.[0];
  if (!approachData) {
    return {
      velocity: "N/A",
      missDistance: "N/A",
      date: "N/A",
      orbiting_body: "Earth"
    };
  }

  return {
    velocity: parseFloat(approachData.relative_velocity?.kilometers_per_second || "0").toFixed(2),
    missDistance: parseFloat(approachData.miss_distance?.kilometers || "0").toFixed(0),
    date: approachData.close_approach_date || "N/A",
    orbiting_body: approachData.orbiting_body || "Earth"
  };
};

// Helper function to get diameter info
const getDiameterInfo = (neo: NearEarthObject) => {
  const diameter = neo.estimated_diameter?.kilometers;
  if (!diameter) {
    return { min: "N/A", max: "N/A", avg: "N/A" };
  }

  const min = diameter.estimated_diameter_min?.toFixed(3) || "N/A";
  const max = diameter.estimated_diameter_max?.toFixed(3) || "N/A";
  const avg = diameter.estimated_diameter_min && diameter.estimated_diameter_max 
    ? ((diameter.estimated_diameter_min + diameter.estimated_diameter_max) / 2).toFixed(3)
    : "N/A";

  return { min, max, avg };
};

// Helper function to format large numbers
const formatDistance = (distance: string) => {
  const num = parseFloat(distance);
  if (isNaN(num)) return distance;
  
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M km`;
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K km`;
  }
  return `${num.toFixed(0)} km`;
};

// Individual NEO card component
function NeoCard({ neo, index }: { neo: NearEarthObject; index: number }) {
  console.log("neo", neo);
  const approachData = getApproachData(neo);
  const diameterInfo = getDiameterInfo(neo);
  return (
    <div 
      className="group bg-white rounded-xl p-5 shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 hover:border-gray-200 transform hover:-translate-y-1"
      style={{ animationDelay: `${index * 0.1}s` }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <a 
            href={`/neo/${neo.id}`} 
            className="block group-hover:scale-[1.02] transition-transform duration-200"
          >
            <h3 className="text-lg font-bold text-gray-900 mb-1 group-hover:text-gray-700 transition-colors leading-tight">
              {neo.name || "Unknown Asteroid"}
            </h3>
            <div className="flex flex-col items-start">
                <div className="flex items-center">
                    <span className="inline-block w-1.5 h-1.5 bg-gray-400 rounded-full mr-2"></span>
                    <p className="text-xs text-gray-500 font-medium tracking-wide">ID: {neo.id}</p>
                </div>
                <p className="text-xs text-gray-500 font-medium mt-1">
                    Orbiting body: {approachData.orbiting_body}
                </p>
            </div>
          </a>
        </div>
        
        <div className="flex flex-col items-end">
          {neo.is_potentially_hazardous_asteroid && (
            <span className="inline-flex items-center px-2.5 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full shadow-sm">
              <span className="w-1.5 h-1.5 bg-red-700 rounded-full mr-1.5 animate-pulse"></span>
              HAZARDOUS
            </span>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {/* Diameter */}
        <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
          <div className="flex items-center mb-2">
            <div className="w-6 h-6 bg-gray-800 rounded-lg flex items-center justify-center mr-2">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" strokeWidth="2"/>
              </svg>
            </div>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Diameter</span>
          </div>
          <div className="text-lg font-black text-gray-900">{diameterInfo.avg}</div>
          <div className="text-xs text-gray-400">km</div>
        </div>

        {/* Velocity */}
        <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
          <div className="flex items-center mb-2">
            <div className="w-6 h-6 bg-gray-700 rounded-lg flex items-center justify-center mr-2">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Velocity</span>
          </div>
          <div className="text-lg font-black text-gray-900">{approachData.velocity}</div>
          <div className="text-xs text-gray-400">km/s</div>
        </div>

        {/* Miss Distance */}
        <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
          <div className="flex items-center mb-2">
            <div className="w-6 h-6 bg-gray-600 rounded-lg flex items-center justify-center mr-2">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4" />
              </svg>
            </div>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Distance</span>
          </div>
          <div className="text-lg font-black text-gray-900">{formatDistance(approachData.missDistance)}</div>
          <div className="text-xs text-gray-400">from Earth</div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-200">
        <div className="flex items-center text-xs text-gray-600">
          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-2"></span>
          <span className="font-medium">Approach:</span>
          <span className="ml-1 font-mono">{approachData.date}</span>
        </div>
        
        <div className="flex items-center gap-2">
          <a 
            href={neo.nasa_jpl_url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-all duration-200"
          >
            NASA
            <svg className="w-2.5 h-2.5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
          
          <a 
            href={`/neo/${neo.id}`}
            className="inline-flex items-center px-3 py-1.5 bg-gray-300 text-gray-900 text-xs font-bold rounded-md hover:bg-gray-800 transform hover:scale-105 transition-all duration-200 shadow-sm hover:shadow-md"
          >
            Simulate
            <svg className="w-2.5 h-2.5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}

export default function NeosIndex() {
  const data = useLoaderData<NeoApiResponse>();
  const neos = data?.near_earth_objects || [];

  if (!neos.length) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center max-w-lg mx-auto px-8">
          <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center mx-auto mb-8 shadow-xl border border-indigo-200">
            <div className="text-6xl">🔭</div>
          </div>
          <h1 className="text-4xl font-black text-gray-900 mb-4">No Asteroids Found 🚀</h1>
          <p className="text-lg text-gray-600 mb-10 leading-relaxed">We couldn't find any asteroid data at the moment. This might be a temporary issue with our data source. 🌌</p>
          <button 
            onClick={() => window.location.reload()} 
            className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-full hover:from-indigo-700 hover:to-purple-700 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl uppercase tracking-wide"
          >
            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Reload Data
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-blue-50 to-purple-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 text-white">
        <div className="max-w-7xl mx-auto px-8 py-20">
          <div className="text-center max-w-6xl mx-auto">
            <h1 className="text-6xl md:text-7xl font-black mb-8 leading-none">
              Near-Earth Objects <span className="ml-4">🌍</span>
            </h1>
            <p className="text-xl text-indigo-100 mb-12 leading-relaxed max-w-3xl mx-auto">
              Explore near-Earth objects with data sourced from NASA/JPL, preview their close-approach trajectories, and run physics-based impact simulations. Configure entry parameters, assess potential effects, and compare mitigation ideas—all in an accessible, mission-focused interface.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-8 text-sm font-bold uppercase tracking-wider">
              <div className="flex items-center bg-white/20 backdrop-blur-sm px-4 py-3 rounded-full border border-white/30">
                <span className="w-3 h-3 bg-white rounded-full mr-3"></span>
                <span>{neos.length} Active Asteroids 🪨</span>
              </div>
              <div className="flex items-center bg-white/20 backdrop-blur-sm px-4 py-3 rounded-full border border-white/30">
                <span className="w-3 h-3 bg-indigo-200 rounded-full mr-3"></span>
                <span>Data from NASA 📊</span>
              </div>
              <div className="flex items-center bg-white/20 backdrop-blur-sm px-4 py-3 rounded-full border border-white/30">
                <span className="w-3 h-3 bg-purple-200 rounded-full mr-3"></span>
                <span>Impact Simulation 💥</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-black text-gray-900 mb-4">Cosmic Wanderers 🌌</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Each asteroid tells a story of our solar system's formation billions of years ago. Click on any card to explore detailed impact simulations. 🔬
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {neos.map((neo, index) => (
            <NeoCard key={neo.id} neo={neo} index={index} />
          ))}
        </div>
      </div>
    </div>
  );
}