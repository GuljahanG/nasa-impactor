import { Link, Outlet } from "react-router";
import { useEffect, useState } from "react"

export default function App() {
  const [stats, setStats] = useState(null);
  const [todayApproaches, setTodayApproaches] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

   useEffect(() => {

    (async () => {
      try {
        // /api/home/stats
        const a = await fetch(`/api/home/stats`, {
          headers: { Accept: "application/json" },
        });
        if (!a.ok) throw new Error(`stats ${a.status}`);
        const ajson = await a.json();
        setStats(ajson);

        // /api/home/today_stats
        const b = await fetch(`/api/home/today_stats`, {
          headers: { Accept: "application/json" },
        });
        if (!b.ok) throw new Error(`today_stats ${b.status}`);
        const bjson = await b.json();
        setTodayApproaches(bjson?.element_count ?? 0);
      } catch (e) {
        setErr(e.message || "Failed to load stats");
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  // return (
  //   <div style={{ fontFamily: "system-ui, sans-serif" }}>
  //     <header style={{ display: "flex", gap: 12, padding: 16, borderBottom: "1px solid #eee" }}>
  //       <Link to="/">Home</Link>
  //       <Link to="/neo">NEO Index</Link>
  //       <Link to="/neo/3014110">Sample NEO Detail</Link>
  //     </header>
  //     <main style={{ padding: 16 }}>
  //       <Outlet />
  //     </main>
  //   </div>
  // );
   return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
      {/* Subtle background elements */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-purple-500 rounded-full blur-3xl"></div>
      </div>

      {/* Minimal stars */}
      <div className="absolute inset-0">
        {[...Array(50)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full opacity-60"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
          />
        ))}
      </div>

      {/* Main content */}
      <div className="relative z-10 flex items-center justify-center min-h-screen px-6 py-10">
        <div className="text-center max-w-5xl mx-auto">
          
          {/* Hero section */}
          <div className="mb-16">
            {/* Clean astronaut and earth */}
            <div className="flex items-center justify-center gap-8 mb-12">
              <div className="text-6xl">👨‍🚀</div>
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 via-green-500 to-blue-600 shadow-xl relative overflow-hidden">
                {/* Simple continents */}
                <div className="absolute top-3 left-3 w-6 h-4 bg-green-600 rounded-full opacity-80"></div>
                <div className="absolute bottom-4 right-2 w-4 h-3 bg-green-700 rounded-full opacity-70"></div>
                <div className="absolute top-6 right-4 w-3 h-2 bg-green-500 rounded-full opacity-60"></div>
              </div>
            </div>

            {/* Clean typography */}
            <h1 className="text-3xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 mb-6 tracking-tight">
              Asteroid Impact & Intercept
            </h1>
            
            <h2 className="text-3xl md:text-4xl text-slate-300 mb-8 font-light tracking-wide">
              2025
            </h2>
            
            <p className="text-xl md:text-2xl text-slate-400 mb-16 max-w-3xl mx-auto leading-relaxed font-light">
              Explore near-Earth objects + 3D Earth + AI threat brief + simulated interceptor swarm to deflect or shatter NEO safely. 
            </p>

            {/* Clean CTA button */}

            <Link
              to="/neo"
              className="group inline-flex items-center px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-lg font-medium rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
            >
              <span className="mr-3">🚀</span>
              Launch Mission
              <span className="ml-3 group-hover:translate-x-1 transition-transform duration-300">→</span>
            </Link>
          </div>

          {/* Feature grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-20">
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 hover:border-slate-600/50 transition-colors duration-300">
              <div className="text-3xl mb-4">🌌</div>
              <h3 className="text-xl font-semibold text-white mb-2">NEO Mission Watch</h3>
              <p className="text-slate-400">Monitor near-Earth objects relevant to NASA mission planning and planetary defense.</p>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 hover:border-slate-600/50 transition-colors duration-300">
              <div className="text-3xl mb-4">📊</div>
              <h3 className="text-xl font-semibold text-white mb-2">Impact Modeling & Risk</h3>
              <p className="text-slate-400">Analyze orbits, entry parameters, and impact probabilities to inform mission decisions.</p>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 hover:border-slate-600/50 transition-colors duration-300">
              <div className="text-3xl mb-4">🛰️</div>
              <h3 className="text-xl font-semibold text-white mb-2">NEO Data Explorer</h3>
              <p className="text-slate-400">Browse cataloged near-Earth objects and visualize sampled trajectories based on NASA/JPL datasets.</p>
          </div>
          </div>

          {/* Stats section */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-16">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-400 mb-2">
                {stats?.near_earth_object_count?.toLocaleString() ?? '—'}
              </div>
              <div className="text-slate-400">Known Near-Earth Objects</div>
            </div>

            <div className="text-center">
              <div className="text-3xl font-bold text-purple-400 mb-2">
                {todayApproaches?.toLocaleString() ?? '0'}
              </div>
              <div className="text-slate-400">Close Approaches — Today</div>
            </div>

            <div className="text-center">
              <div className="text-3xl font-bold text-cyan-400 mb-2">
                {stats?.close_approach_count?.toLocaleString() ?? '—'}
              </div>
              <div className="text-slate-400">Close Approaches — Next 7 Days</div>
            </div>

            <div className="text-center">
              <div className="text-3xl font-bold text-green-400 mb-2">
                {stats?.last_updated ? new Date(stats.last_updated).toUTCString().replace(' GMT','') : '—'}
              </div>
              <div className="text-slate-400">Data Last Updated (UTC)</div>
            </div>
          </div>
        </div>
      </div>

      {/* Clean footer gradient */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-slate-900 to-transparent"></div>
    </div>
  );
}