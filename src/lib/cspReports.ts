// What the Content Security Policy (firebase.json) blocked, or would block while it's report-only,
// kept on this device so it can be checked on a phone without developer tools: Settings lists them
// at the bottom when there are any. Each distinct directive and address is kept once, newest first.
const KEY = "cubeTimer.cspReports";
const MAX = 20;

export interface CspReport { directive: string; blocked: string; source: string; at: number }

let reports: CspReport[] = load();
const listeners = new Set<() => void>();

function load(): CspReport[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}

function set(next: CspReport[]) {
  reports = next;
  try { if (next.length) localStorage.setItem(KEY, JSON.stringify(next)); else localStorage.removeItem(KEY); } catch { /* ignore */ }
  listeners.forEach(l => l());
}

export const cspReports = {
  get: () => reports,
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
  clear: () => set([]),
};

export function watchCspReports() {
  document.addEventListener("securitypolicyviolation", e => {
    const r: CspReport = {
      directive: e.effectiveDirective || e.violatedDirective,
      blocked: e.blockedURI || "(inline)",
      source: e.sourceFile ? `${e.sourceFile}:${e.lineNumber}` : "",
      at: Date.now(),
    };
    console.warn(`[CSP] ${r.directive} blocked ${r.blocked}${r.source ? ` (from ${r.source})` : ""}`);
    set([r, ...reports.filter(x => x.directive !== r.directive || x.blocked !== r.blocked)].slice(0, MAX));
  });
}
