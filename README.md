# axiom-reg-demo

UK regulation, computed — a demo that runs an Axiom RuleSpec encoding **entirely in the
browser** via the axiom-rules-engine WebAssembly build. Nothing the user enters leaves
the page.

**Live calculator:** Small company checker — Companies Act 2006 s.382. Enter turnover,
balance sheet total, and average employees, pick the financial year start date, and the
engine computes whether the company qualifies as small — with the two-of-three logic,
the first-year / consecutive-years rules, and **time-aware thresholds** (the SI 2024/1303
uprating applies to financial years beginning on or after 6 April 2025 — move the date
across the boundary and watch the regime, and the verdict, flip). Every threshold is
cited to its statutory source, extracted from the encoding itself.

## How it works

```
rulespec-uk/uk/statutes/ukpga/2006/46/382.yaml   (the encoding, synced → public/modules/)
        │
        ▼  compile() at page load            axiom-rules-engine WASM (vendored pkg)
CompiledProgramArtifact (in memory)
        │
        ▼  execute() on every input change   — all in the browser
verdict + per-condition judgments + thresholds
```

- `lib/pkg/` — vendored wasm-pack output (web target) of `axiom-rules-engine/wasm`.
  One patch: the static `new URL(..._bg.wasm)` fallback is removed so bundlers don't
  try to resolve the binary; we always pass the explicit `/wasm/...` URL.
- `public/modules/382.yaml` — the encoding, synced verbatim from rulespec-uk
  (see `public/modules/PROVENANCE.txt` for the commit).
- Citations and the employees-threshold versions are parsed from the module text, so
  the UI displays only what the encoding says — no hand-copied values.

## Develop

```bash
bun install
bun dev          # http://localhost:3000
bun run build    # static export → out/
```

## Sync a newer encoding

Copy the module from rulespec-uk into `public/modules/382.yaml`, update
`PROVENANCE.txt`, and rebuild the wasm pkg if the engine changed:

```bash
cd rulespec-uk/_axiom/axiom-rules-engine/wasm && wasm-pack build --target web --release
```
