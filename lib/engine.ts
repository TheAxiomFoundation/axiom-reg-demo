'use client';

/**
 * In-browser Axiom rules engine: compiles the shipped RuleSpec module once,
 * then executes requests locally via WASM. Nothing leaves the page.
 */
import init, {
  compile,
  execute,
  engine_version,
} from './pkg/axiom_rules_engine_wasm';

export const MODULE_TARGET = 'uk:statutes/ukpga/2006/46/382';
// Public assets fetched by absolute URL at runtime — Next's basePath does not
// rewrite hand-written strings, so the /gallery/reg-demo prefix is applied here.
const MODULE_URL = '/gallery/reg-demo/modules/382.yaml';
const WASM_URL = '/gallery/reg-demo/wasm/axiom_rules_engine_wasm_bg.wasm';

export type FactValue =
  | { kind: 'bool'; value: boolean }
  | { kind: 'integer'; value: number }
  | { kind: 'decimal'; value: string }
  | { kind: 'date'; value: string };

export interface InputRecord {
  name: string;
  entity: string;
  entity_id: string;
  interval: { start: string; end: string };
  value: FactValue;
}

export interface QueryRequest {
  entity_id: string;
  period: { period_kind: string; start: string; end: string; name?: string };
  outputs: string[];
}

export interface ExecutionRequest {
  mode: 'fast' | 'explain';
  dataset: { inputs: InputRecord[]; relations: unknown[] };
  queries: QueryRequest[];
}

export type OutputValue =
  | {
      kind: 'scalar';
      name: string;
      id: string;
      dtype: string;
      unit?: string | null;
      value: { kind: string; value: string | number | boolean };
    }
  | { kind: 'judgment'; name: string; id: string; unit?: string | null; outcome: 'holds' | 'not_holds' };

export interface ExecutionResponse {
  metadata: { requested_mode: string; actual_mode: string; fallback_reason: string | null };
  results: Array<{
    entity_id: string;
    period: { period_kind: string; start: string; end: string };
    outputs: Record<string, OutputValue>;
  }>;
}

interface EngineState {
  artifact: string;
  version: string;
  moduleText: string;
}

let state: Promise<EngineState> | null = null;

async function boot(): Promise<EngineState> {
  const [, moduleText] = await Promise.all([
    init({ module_or_path: WASM_URL }),
    fetch(MODULE_URL).then((r) => {
      if (!r.ok) throw new Error(`failed to fetch module: ${r.status}`);
      return r.text();
    }),
  ]);
  const artifact = compile(JSON.stringify({ [MODULE_TARGET]: moduleText }), MODULE_TARGET);
  return { artifact, version: engine_version(), moduleText };
}

export function getEngine(): Promise<EngineState> {
  if (!state) state = boot();
  return state;
}

export async function run(request: ExecutionRequest): Promise<ExecutionResponse> {
  const { artifact } = await getEngine();
  return JSON.parse(execute(artifact, JSON.stringify(request))) as ExecutionResponse;
}

/** Pull a parameter's dated versions (effective_from → numeric formula) from module text. */
export function extractParameterVersions(
  moduleText: string,
  ruleName: string,
): Array<{ effective_from: string; value: number }> {
  const lines = moduleText.split('\n');
  const out: Array<{ effective_from: string; value: number }> = [];
  let inRule = false;
  let pendingFrom: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nm = line.match(/^\s*-\s*name:\s*(\S+)\s*$/);
    if (nm) {
      if (inRule) break; // left our rule
      inRule = nm[1] === ruleName;
      continue;
    }
    if (!inRule) continue;
    const ef = line.match(/effective_from:\s*'?([0-9-]+)'?/);
    if (ef) pendingFrom = ef[1];
    if (pendingFrom && /^\s*formula:/.test(line)) {
      // value is on the following non-empty line(s) for block scalars, or inline
      const inline = line.match(/formula:\s*\|?-?\s*([0-9_.]+)\s*$/);
      let raw = inline?.[1];
      if (!raw) {
        for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
          const m = lines[j].match(/^\s*([0-9_.]+)\s*$/);
          if (m) {
            raw = m[1];
            break;
          }
        }
      }
      if (raw) out.push({ effective_from: pendingFrom, value: Number(raw.replace(/_/g, '')) });
      pendingFrom = null;
    }
  }
  return out.sort((a, b) => a.effective_from.localeCompare(b.effective_from));
}

/** Pick the version in force at a date (latest effective_from ≤ date). */
export function versionAt(
  versions: Array<{ effective_from: string; value: number }>,
  date: string,
): number | null {
  let v: number | null = null;
  for (const ver of versions) if (ver.effective_from <= date) v = ver.value;
  return v;
}

export interface Citation {
  /** Human citation string, e.g. "Companies Act 2006 s.382(3), as amended by …" */
  source: string;
  /** Axiom corpus path, e.g. "uk/statute/ukpga/2006/46/382" — links to the app page. */
  path: string | null;
}

export const AXIOM_APP_BASE = 'https://app.axiom-foundation.org';

/** The module's own corpus page (header `source_verification.corpus_citation_path`) —
 *  the one Axiom app URL guaranteed to exist for this encoding. Amendment SIs cited in
 *  proof atoms are not always indexed, so all citation links point here. */
export function extractModulePath(moduleText: string): string | null {
  let inPathsList = false;
  for (const line of moduleText.split('\n')) {
    if (/^\s*-\s*name:/.test(line)) break; // stop at the first rule
    if (inPathsList) {
      const item = line.match(/^\s*-\s*(\S+)\s*$/);
      if (item) return item[1]; // first entry is the provision itself
      inPathsList = false;
    }
    if (/^\s*corpus_citation_paths:\s*$/.test(line)) {
      inPathsList = true;
      continue;
    }
    const cp = line.match(/^\s*corpus_citation_path:\s*(\S+)\s*$/);
    if (cp) return cp[1];
  }
  return null;
}

/** Pull `name` → citation (source string + module corpus path) out of the module text. */
export function extractCitations(moduleText: string): Map<string, Citation> {
  const map = new Map<string, Citation>();
  const modulePath = extractModulePath(moduleText);
  const lines = moduleText.split('\n');
  let current: string | null = null;
  for (const line of lines) {
    const nm = line.match(/^\s*-\s*name:\s*(\S+)\s*$/);
    if (nm) current = nm[1];
    if (!current) continue;
    const src = line.match(/^\s*source:\s*(.+?)\s*$/);
    if (src && !map.has(current)) map.set(current, { source: src[1], path: modulePath });
  }
  return map;
}
