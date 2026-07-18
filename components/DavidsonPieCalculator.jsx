import React, { useMemo, useState } from 'react';
import { CONSTANTS, convertFlow, convertMass, REFERENCE_TABLE } from '../utils/unitConversions';

const SEGMENTS = {
  mass: { key: 'mass', label: 'Mass loading' },
  flow: { key: 'flow', label: 'Flow' },
  conc: { key: 'conc', label: 'Concentration' },
};

export default function DavidsonPieCalculator() {
  const [unitSystem, setUnitSystem] = useState('us');
  const [solveFor, setSolveFor] = useState('mass');
  const [inputs, setInputs] = useState({ mass: '', flow: '', conc: '150' });

  const labels =
    unitSystem === 'us'
      ? { mass: 'lb/day', flow: 'MGD', conc: 'mg/L', constant: CONSTANTS.DAVIDSON_CONSTANT_US }
      : { mass: 'kg/day', flow: 'm³/day', conc: 'mg/L', constant: CONSTANTS.DAVIDSON_CONSTANT_SI };

  const result = useMemo(() => {
    const mass = parseFloat(inputs.mass);
    const flow = parseFloat(inputs.flow);
    const conc = parseFloat(inputs.conc);
    const k = labels.constant;

    if (solveFor === 'mass') {
      if (!isFinite(flow) || !isFinite(conc)) return null;
      return flow * conc * k;
    }
    if (solveFor === 'flow') {
      if (!isFinite(mass) || !isFinite(conc) || conc === 0) return null;
      return mass / (conc * k);
    }
    if (solveFor === 'conc') {
      if (!isFinite(mass) || !isFinite(flow) || flow === 0) return null;
      return mass / (flow * k);
    }
    return null;
  }, [inputs, solveFor, labels.constant]);

  const setField = (field, value) => setInputs((prev) => ({ ...prev, [field]: value }));

  const crossCheck = useMemo(() => {
    if (result == null) return null;
    if (solveFor === 'flow') {
      return unitSystem === 'us'
        ? `${convertFlow(result, 'MGD').toFixed(1)} m³/day`
        : `${convertFlow(result, 'm3day').toFixed(4)} MGD`;
    }
    if (solveFor === 'mass') {
      return unitSystem === 'us'
        ? `${convertMass(result, 'lb').toFixed(2)} kg/day`
        : `${convertMass(result, 'kg').toFixed(2)} lb/day`;
    }
    return null;
  }, [result, solveFor, unitSystem]);

  return (
    <div style={s.app}>
      <div style={s.wrap}>
        <header style={s.header}>
          <p style={s.eyebrow}>SiteGuard / Dosing Instrument</p>
          <h1 style={s.title}>Davidson Pie Calculator</h1>
          <p style={s.subtitle}>
            Mass loading = Flow × Concentration × constant. Solve any one value from the other two.
          </p>
        </header>

        <div style={s.grid}>
          <div style={s.dialWrap}>
            <PieDial solveFor={solveFor} onSelect={setSolveFor} labels={labels} />
          </div>

          <div style={s.controls}>
            <UnitToggle unitSystem={unitSystem} onChange={setUnitSystem} />

            {Object.values(SEGMENTS).map((seg) => (
              <FieldRow
                key={seg.key}
                segment={seg}
                unit={labels[seg.key]}
                active={solveFor === seg.key}
                value={solveFor === seg.key ? '' : inputs[seg.key]}
                disabled={solveFor === seg.key}
                onChange={(v) => setField(seg.key, v)}
                onSelectSolve={() => setSolveFor(seg.key)}
              />
            ))}

            <ReadoutBox
              label={SEGMENTS[solveFor].label}
              unit={labels[solveFor]}
              value={result}
              crossCheck={crossCheck}
            />
          </div>
        </div>

        <ReferenceTable />
      </div>
    </div>
  );
}

function PieDial({ solveFor, onSelect, labels }) {
  const fill = (key) => (solveFor === key ? '#F5A623' : '#1C2321');

  return (
    <svg width="220" height="220" viewBox="0 0 220 220" role="img" aria-label="Davidson pie selector">
      <circle cx="110" cy="110" r="105" fill="#0F1412" stroke="#2A322F" strokeWidth="2" />
      <path
        d="M 10 110 A 100 100 0 0 1 210 110 Z"
        fill={fill('mass')}
        style={{ cursor: 'pointer' }}
        onClick={() => onSelect('mass')}
      />
      <path
        d="M 10 110 A 100 100 0 0 0 110 210 L 110 110 Z"
        fill={fill('flow')}
        style={{ cursor: 'pointer' }}
        onClick={() => onSelect('flow')}
      />
      <path
        d="M 110 210 A 100 100 0 0 0 210 110 L 110 110 Z"
        fill={fill('conc')}
        style={{ cursor: 'pointer' }}
        onClick={() => onSelect('conc')}
      />
      <line x1="10" y1="110" x2="210" y2="110" stroke="#0F1412" strokeWidth="2" />
      <line x1="110" y1="110" x2="110" y2="210" stroke="#0F1412" strokeWidth="2" />

      <text x="110" y="65" textAnchor="middle" fill="#ECE8E1" fontSize="13" fontFamily="'IBM Plex Mono', monospace">
        {labels.mass}
      </text>
      <text x="60" y="160" textAnchor="middle" fill="#ECE8E1" fontSize="13" fontFamily="'IBM Plex Mono', monospace">
        {labels.flow}
      </text>
      <text x="160" y="160" textAnchor="middle" fill="#ECE8E1" fontSize="13" fontFamily="'IBM Plex Mono', monospace">
        {labels.conc}
      </text>
      <text x="110" y="185" textAnchor="middle" fill="#7A8B85" fontSize="11" fontFamily="'IBM Plex Mono', monospace">
        ×{labels.constant}
      </text>
    </svg>
  );
}

function UnitToggle({ unitSystem, onChange }) {
  return (
    <div style={s.toggleRow}>
      <span style={s.toggleLabel}>Units</span>
      <div style={s.toggleGroup}>
        {['us', 'si'].map((u) => (
          <button
            key={u}
            onClick={() => onChange(u)}
            style={{
              ...s.toggleBtn,
              ...(unitSystem === u ? s.toggleBtnActive : {}),
            }}
          >
            {u === 'us' ? 'US (MGD/lb)' : 'SI (m³/kg)'}
          </button>
        ))}
      </div>
    </div>
  );
}

function FieldRow({ segment, unit, active, value, disabled, onChange, onSelectSolve }) {
  return (
    <div style={{ ...s.fieldRow, ...(active ? s.fieldRowActive : {}) }}>
      <div>
        <p style={s.fieldLabel}>{segment.label}</p>
        <p style={s.fieldUnit}>{unit}</p>
      </div>
      {active ? (
        <span style={s.solvingTag}>Solving</span>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="number"
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            style={s.input}
          />
          <button onClick={onSelectSolve} style={s.solveLink} title="Solve for this instead">
            solve
          </button>
        </div>
      )}
    </div>
  );
}

function ReadoutBox({ label, unit, value, crossCheck }) {
  return (
    <div style={s.readout}>
      <p style={s.readoutLabel}>{label} result</p>
      <p style={s.readoutValue}>
        {value == null ? '—' : value.toLocaleString(undefined, { maximumFractionDigits: 3 })}
        <span style={s.readoutUnit}> {unit}</span>
      </p>
      {crossCheck && <p style={s.crossCheck}>≈ {crossCheck}</p>}
    </div>
  );
}

function ReferenceTable() {
  return (
    <div style={s.refWrap}>
      <p style={s.refTitle}>Worldwide conversion reference</p>
      <div style={s.refGrid}>
        {REFERENCE_TABLE.map((row) => (
          <div key={row.label} style={s.refRow}>
            <span>{row.label}</span>
            <span style={{ color: '#ECE8E1' }}>×{row.factor}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const s = {
  app: {
    fontFamily: "'Inter', sans-serif",
    background: '#161B19',
    color: '#ECE8E1',
    minHeight: '100vh',
    padding: 20,
  },
  wrap: { maxWidth: 760, margin: '0 auto' },
  header: { marginBottom: 24, borderBottom: '1px solid #2A322F', paddingBottom: 14 },
  eyebrow: {
    fontSize: 11,
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
    color: '#F5A623',
    fontFamily: "'IBM Plex Mono', monospace",
    margin: 0,
  },
  title: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: 24,
    fontWeight: 700,
    margin: '6px 0 4px 0',
  },
  subtitle: { fontSize: 13, color: '#7A8B85', margin: 0 },
  grid: { display: 'flex', flexWrap: 'wrap', gap: 28, marginBottom: 24 },
  dialWrap: { flexShrink: 0, margin: '0 auto' },
  controls: { flex: 1, minWidth: 260, display: 'flex', flexDirection: 'column', gap: 14 },
  toggleRow: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 },
  toggleLabel: {
    color: '#7A8B85',
    fontFamily: "'IBM Plex Mono', monospace",
    textTransform: 'uppercase',
    fontSize: 11,
    letterSpacing: '0.05em',
  },
  toggleGroup: { display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid #2A322F' },
  toggleBtn: {
    padding: '7px 12px',
    fontSize: 11.5,
    fontFamily: "'IBM Plex Mono', monospace",
    textTransform: 'uppercase',
    background: '#1C2321',
    color: '#7A8B85',
    border: 'none',
    cursor: 'pointer',
  },
  toggleBtnActive: { background: '#F5A623', color: '#2A2005', fontWeight: 700 },
  fieldRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: 8,
    padding: '10px 14px',
    border: '1px solid #2A322F',
    background: '#1C2321',
  },
  fieldRowActive: { borderColor: '#F5A623', background: '#241D12' },
  fieldLabel: { fontSize: 13.5, margin: 0, color: '#ECE8E1' },
  fieldUnit: { fontSize: 11.5, margin: '2px 0 0 0', color: '#7A8B85', fontFamily: "'IBM Plex Mono', monospace" },
  solvingTag: {
    fontSize: 11,
    fontFamily: "'IBM Plex Mono', monospace",
    color: '#F5A623',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  input: {
    width: 110,
    background: '#0F1412',
    border: '1px solid #2A322F',
    borderRadius: 6,
    padding: '6px 8px',
    textAlign: 'right',
    color: '#ECE8E1',
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 13,
  },
  solveLink: {
    fontSize: 11,
    color: '#7A8B85',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontFamily: "'IBM Plex Mono', monospace",
  },
  readout: {
    borderRadius: 8,
    border: '1px solid #2A322F',
    background: '#0F1412',
    padding: '14px 16px',
  },
  readoutLabel: {
    fontSize: 11,
    color: '#7A8B85',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    fontFamily: "'IBM Plex Mono', monospace",
    margin: 0,
  },
  readoutValue: {
    fontSize: 30,
    fontFamily: "'IBM Plex Mono', monospace",
    color: '#F5A623',
    margin: '6px 0 0 0',
  },
  readoutUnit: { fontSize: 15, color: '#7A8B85' },
  crossCheck: { fontSize: 11.5, color: '#7A8B85', fontFamily: "'IBM Plex Mono', monospace", margin: '4px 0 0 0' },
  refWrap: { marginTop: 26, borderTop: '1px solid #2A322F', paddingTop: 14 },
  refTitle: {
    fontSize: 11,
    color: '#7A8B85',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    fontFamily: "'IBM Plex Mono', monospace",
    marginBottom: 8,
  },
  refGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, fontSize: 11.5, color: '#7A8B85', fontFamily: "'IBM Plex Mono', monospace" },
  refRow: { display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1F2624', paddingBottom: 4 },
};
