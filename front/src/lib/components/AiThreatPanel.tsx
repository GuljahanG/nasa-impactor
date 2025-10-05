import React from "react";

type Item = { label: string; value: string };
type Section = { title: string; items: Item[] };

function parseAiSummary(text: string): Section[] {
  if (!text) return [];
  // Normalize line endings
  const t = text.replace(/\r\n/g, "\n").trim();

  // Split by headers like: "1. POPULATION RISK:" (case-insensitive)
  const parts = t.split(/\n(?=\d+\.\s+.+?:)/g);
  const sections: Section[] = [];

  for (const block of parts) {
    const headerMatch = block.match(/^\d+\.\s+(.+?):\s*$/im);
    const title = headerMatch ? headerMatch[1].trim() : "Section";

    // Collect "- Key: Value" lines
    const lines = block.split("\n").slice(1);
    const items: Item[] = [];

    for (const ln of lines) {
      const m = ln.match(/^\s*-\s*([^:]+?)\s*:\s*(.+?)\s*$/);
      if (m) {
        items.push({ label: m[1].trim(), value: m[2].trim() });
      }
    }
    if (items.length) sections.push({ title, items });
  }

  // Fallback: if parser failed, show everything as one section
  if (!sections.length) {
    return [{ title: "AI Assessment", items: [{ label: "Details", value: text }] }];
  }
  return sections;
}

function riskBadgeColor(value: string) {
  const v = value.toLowerCase();
  if (v.includes("critical")) return "bg-red-600/10 text-red-700 ring-red-600/20";
  if (v.includes("high")) return "bg-orange-500/10 text-orange-700 ring-orange-500/20";
  if (v.includes("moderate") || v.includes("medium"))
    return "bg-amber-500/10 text-amber-700 ring-amber-500/20";
  if (v.includes("low")) return "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20";
  return "bg-slate-500/10 text-slate-700 ring-slate-500/20";
}

export function AiThreatPanel({ text }: { text: string }) {
  const sections = parseAiSummary(text);

  if (!text) return null;

  return (
    <div className="mt-4 space-y-3">
      {sections.map((sec) => {
        // special-case: highlight Risk level badge if present
        const risk = sec.items.find((i) => i.label.toLowerCase().includes("risk level"));
        return (
          <div
            key={sec.title}
            className="rounded-xl border border-slate-200 bg-white/80 shadow-sm"
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900">
                {sec.title.replaceAll("_", " ")}
              </h3>
              {risk && (
                <span
                  className={
                    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 " +
                    riskBadgeColor(risk.value)
                  }
                  title="Overall risk level"
                >
                  {risk.value}
                </span>
              )}
            </div>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 p-3">
              {sec.items.map((it) => {
                const isRisk = it.label.toLowerCase().includes("risk level");
                if (isRisk) return null; // already shown as a badge
                return (
                  <div key={it.label} className="flex flex-col">
                    <dt className="text-[11px] uppercase tracking-wide text-slate-500">
                      {it.label}
                    </dt>
                    <dd className="text-sm text-slate-900">{it.value}</dd>
                  </div>
                );
              })}
            </dl>
          </div>
        );
      })}
    </div>
  );
}
