
type RocketProfile = {
  id: string; count: number; speed: number; deltaV_kps: number;
  hitRadius?: number; delaySec?: number;
};

type RocketPlan = {
  summary: string;
  rocketCount: number;
  profiles: RocketProfile[];
  postShatter: {
    targetRadial_dv_kps: number;
    minimumSafePerigee_km: number;
    suggestExtraInterceptors?: boolean;
  };
};

export default function PlanPanel({ plan }: { plan: RocketPlan }) {
  if (!plan) return null;

  const totalProfiles = plan.profiles?.reduce((n, p) => n + (p.count ?? 0), 0) ?? 0;

  return (
    <div className="mt-3 rounded-lg border border-gray-200 bg-white/80 p-3 text-gray-900 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Interception Plan</h3>
        <span className="rounded bg-blue-600/10 px-2 py-0.5 text-xs font-medium text-blue-700">
          {plan.rocketCount} rockets
        </span>
      </div>

      {/* Summary */}
      {plan.summary && (
        <p className="mb-3 text-sm leading-snug text-gray-700 whitespace-pre-wrap">
          {plan.summary}
        </p>
      )}

      {/* Profiles */}
      <div className="space-y-2">
        {(plan.profiles ?? []).map((p) => (
          <div
            key={p.id}
            className="rounded-md bg-gray-50 px-2 py-2 text-xs grid grid-cols-2 gap-x-3 gap-y-1"
          >
            <div className="col-span-2 font-medium">
              Profile <span className="font-semibold">{p.id}</span> • {p.count} rockets
            </div>
            <div>Speed: <b>{p.speed}</b> u/s</div>
            <div>Δv: <b>{p.deltaV_kps}</b> km/s</div>
            <div>Hit radius: <b>{p.hitRadius ?? 0.4}</b> u</div>
            <div>Launch delay: <b>{p.delaySec ?? 0}</b> s</div>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="mt-2 text-xs text-gray-600">
        Profiles total: <b>{totalProfiles}</b> • Expected rockets: <b>{plan.rocketCount}</b>
      </div>

      {/* Post-shatter guidance */}
      {plan.postShatter && (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs">
          <div className="mb-1 font-semibold text-amber-800">Post-shatter guidance</div>
          <ul className="ml-4 list-disc space-y-1 text-amber-900">
            <li>
              Radial Δv outward: <b>{plan.postShatter.targetRadial_dv_kps}</b> km/s
            </li>
            <li>
              Minimum safe perigee: <b>{plan.postShatter.minimumSafePerigee_km}</b> km
            </li>
            <li>
              Extra cleanup sweep:{" "}
              <b>{plan.postShatter.suggestExtraInterceptors ? "Yes" : "No"}</b>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
