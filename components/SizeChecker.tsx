'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AXIOM_APP_BASE,
  MODULE_TARGET,
  getEngine,
  run,
  extractCitations,
  extractParameterVersions,
  versionAt,
  type Citation,
  type ExecutionResponse,
  type InputRecord,
  type OutputValue,
} from '@/lib/engine';

const ID = (name: string) => `${MODULE_TARGET}#${name}`;
const INPUT = (name: string) => ID(`input.${name}`);
const FIRM = 'firm:1';

const OUTPUTS = {
  qualifies: ID('company_qualifies_as_small'),
  turnoverCond: ID('small_company_turnover_condition_met'),
  balanceCond: ID('small_company_balance_sheet_total_condition_met'),
  employeesCond: ID('small_company_number_of_employees_condition_met'),
  turnoverThreshold: ID('small_company_turnover_threshold_for_financial_year'),
  balanceThresholdAmount: ID('small_company_balance_sheet_total_threshold_amount'),
};

function fyEnd(startIso: string): string {
  const d = new Date(startIso + 'T00:00:00Z');
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

const GBP = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 });

function scalarNumber(v: OutputValue | undefined): number | null {
  if (!v || v.kind !== 'scalar') return null;
  const n = Number(v.value.value);
  return Number.isFinite(n) ? n : null;
}
function holds(v: OutputValue | undefined): boolean | null {
  if (!v || v.kind !== 'judgment') return null;
  return v.outcome === 'holds';
}

export default function SizeChecker() {
  const [ready, setReady] = useState(false);
  const [version, setVersion] = useState('');
  const [citations, setCitations] = useState<Map<string, Citation>>(new Map());
  const [employeeVersions, setEmployeeVersions] = useState<Array<{ effective_from: string; value: number }>>([]);
  const [error, setError] = useState<string | null>(null);

  const [turnover, setTurnover] = useState(12_000_000);
  const [balance, setBalance] = useState(6_000_000);
  const [employees, setEmployees] = useState(45);
  const [fyStart, setFyStart] = useState('2025-04-06');
  const [firstYear, setFirstYear] = useState(true);
  const [prevQualified, setPrevQualified] = useState(false);
  const [prevConditionsMet, setPrevConditionsMet] = useState(false);

  const [response, setResponse] = useState<ExecutionResponse | null>(null);

  useEffect(() => {
    getEngine()
      .then((s) => {
        setVersion(s.version);
        setCitations(extractCitations(s.moduleText));
        setEmployeeVersions(extractParameterVersions(s.moduleText, 'small_company_number_of_employees_threshold'));
        setReady(true);
      })
      .catch((e) => setError(String(e)));
  }, []);

  const compute = useCallback(async () => {
    if (!ready) return;
    try {
      setError(null);
      const interval = { start: fyStart, end: fyEnd(fyStart) };
      const bool = (value: boolean) => ({ kind: 'bool' as const, value });
      const dec = (value: number) => ({ kind: 'decimal' as const, value: String(value) });
      const int = (value: number) => ({ kind: 'integer' as const, value });
      const rec = (name: string, value: InputRecord['value']): InputRecord => ({
        name: INPUT(name),
        entity: 'Firm',
        entity_id: FIRM,
        interval,
        value,
      });
      const request = {
        mode: 'explain' as const,
        dataset: {
          inputs: [
            rec('company_turnover', dec(turnover)),
            rec('company_balance_sheet_total', dec(balance)),
            rec('company_average_number_of_employees', int(employees)),
            rec('company_is_in_first_financial_year', bool(firstYear)),
            rec('financial_year_proportion_of_year', dec(1)),
            rec('company_qualified_as_small_in_previous_financial_year', bool(prevQualified)),
            rec('small_company_qualifying_conditions_met_in_previous_financial_year', bool(prevConditionsMet)),
          ],
          relations: [],
        },
        queries: [
          {
            entity_id: FIRM,
            period: { period_kind: 'custom', name: 'financial_year', ...interval },
            outputs: Object.values(OUTPUTS),
          },
        ],
      };
      setResponse(await run(request));
    } catch (e) {
      setError(String(e));
    }
  }, [ready, turnover, balance, employees, fyStart, firstYear, prevQualified, prevConditionsMet]);

  useEffect(() => {
    void compute();
  }, [compute]);

  const out = response?.results[0]?.outputs ?? {};
  const qualifies = holds(out[OUTPUTS.qualifies]);
  const conds = useMemo(
    () => [
      {
        key: 'turnover',
        label: 'Turnover not more than the threshold',
        pass: holds(out[OUTPUTS.turnoverCond]),
        value: GBP.format(turnover),
        threshold: (() => {
          const m = scalarNumber(out[OUTPUTS.turnoverThreshold]);
          return m != null ? GBP.format(m) : '—';
        })(),
      },
      {
        key: 'balance',
        label: 'Balance sheet total not more than the threshold',
        pass: holds(out[OUTPUTS.balanceCond]),
        value: GBP.format(balance),
        threshold: (() => {
          const a = scalarNumber(out[OUTPUTS.balanceThresholdAmount]);
          return a != null ? GBP.format(a) : '—';
        })(),
      },
      {
        key: 'employees',
        label: 'Average employees not more than the threshold',
        pass: holds(out[OUTPUTS.employeesCond]),
        value: String(employees),
        threshold: (() => {
          const n = versionAt(employeeVersions, fyStart);
          return n != null ? String(n) : '—';
        })(),
      },
    ],
    [out, turnover, balance, employees, employeeVersions, fyStart],
  );

  const newRegime = fyStart >= '2025-04-06';

  return (
    <div className="grid">
      <section className="card">
        <div className="tag">Inputs · Firm</div>
        <h2>The company&apos;s year</h2>

        <label htmlFor="fy">Financial year start</label>
        <input id="fy" type="date" value={fyStart} onChange={(e) => setFyStart(e.target.value)} />
        <p className="hint">
          The thresholds are time-aware: SI 2024/1303 applies to financial years beginning on or after 6 April 2025.
          Move the date either side to watch the regime change.
        </p>

        <div className="row">
          <div>
            <label htmlFor="turnover">Annual turnover (£)</label>
            <input
              id="turnover"
              type="number"
              min={0}
              step={100000}
              value={turnover}
              onChange={(e) => setTurnover(Number(e.target.value))}
            />
          </div>
          <div>
            <label htmlFor="balance">Balance sheet total (£)</label>
            <input
              id="balance"
              type="number"
              min={0}
              step={100000}
              value={balance}
              onChange={(e) => setBalance(Number(e.target.value))}
            />
          </div>
        </div>

        <label htmlFor="employees">Average number of employees</label>
        <input
          id="employees"
          type="number"
          min={0}
          step={1}
          value={employees}
          onChange={(e) => setEmployees(Number(e.target.value))}
        />

        <div className="check">
          <input id="first" type="checkbox" checked={firstYear} onChange={(e) => setFirstYear(e.target.checked)} />
          <label htmlFor="first" style={{ margin: 0 }}>
            This is the company&apos;s first financial year
          </label>
        </div>
        {!firstYear && (
          <>
            <div className="check">
              <input
                id="prevq"
                type="checkbox"
                checked={prevQualified}
                onChange={(e) => setPrevQualified(e.target.checked)}
              />
              <label htmlFor="prevq" style={{ margin: 0 }}>
                Qualified as small in the previous financial year
              </label>
            </div>
            <div className="check">
              <input
                id="prevc"
                type="checkbox"
                checked={prevConditionsMet}
                onChange={(e) => setPrevConditionsMet(e.target.checked)}
              />
              <label htmlFor="prevc" style={{ margin: 0 }}>
                Qualifying conditions were met in the previous financial year
              </label>
            </div>
          </>
        )}
      </section>

      <section className="card">
        <div className="tag">Computed · s.382 Companies Act 2006</div>
        {!ready && !error && <div className="loading">Compiling the encoding in your browser…</div>}
        {error && <div className="error-box">{error}</div>}
        {ready && !error && qualifies != null && (
          <>
            <div className={`verdict ${qualifies ? 'small' : 'notsmall'}`}>
              <span className="v">{qualifies ? 'Qualifies as small' : 'Does not qualify as small'}</span>
              <span className="why">
                {qualifies
                  ? 'the qualifying conditions are met for this financial year'
                  : 'the qualifying conditions are not met for this financial year'}
              </span>
            </div>

            <div className="conds">
              {conds.map((c) => (
                <div key={c.key} className={`cond ${c.pass ? 'pass' : 'fail'}`}>
                  <span className="dot" />
                  <span className="nm">{c.label}</span>
                  <span className="val">
                    {c.value} vs ≤ {c.threshold}
                  </span>
                </div>
              ))}
            </div>

            <div className="regime">
              Financial year beginning <b>{fyStart}</b> —{' '}
              {newRegime ? (
                <>
                  thresholds as <b>uprated by SI 2024/1303</b>, in force for financial years beginning on or after 6
                  April 2025.
                </>
              ) : (
                <>thresholds as they stood before the SI 2024/1303 uprating took effect.</>
              )}{' '}
              A company must meet at least two of the three conditions (s.382(3)–(4)).
            </div>

            <div className="cites">
              <h3>Cited to source</h3>
              <ul>
                {[
                  'small_company_annual_turnover_threshold',
                  'small_company_balance_sheet_total_threshold',
                  'small_company_number_of_employees_threshold',
                  'company_qualifies_as_small',
                ].map((rule) => {
                  const c = citations.get(rule);
                  const text = c?.source ?? 'Companies Act 2006, s.382';
                  return (
                    <li key={rule}>
                      {c?.path ? (
                        <a href={`${AXIOM_APP_BASE}/${c.path}`} target="_blank" rel="noreferrer">
                          {text}
                        </a>
                      ) : (
                        text
                      )}
                    </li>
                  );
                })}
              </ul>
              <p className="hint" style={{ marginTop: 10 }}>
                Computed by axiom-rules-engine v{version} (WebAssembly) from the rulespec-uk encoding.
              </p>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
