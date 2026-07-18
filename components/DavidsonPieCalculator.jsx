import React, { useMemo, useState } from 'react';
import { CONSTANTS, convertFlow, convertMass, REFERENCE_TABLE } from '../utils/unitConversions';

const SEGMENTS = {
  mass: { key: 'mass', label: 'Mass loading' },
  flow: { key: 'flow', label: 'Flow' },
  conc: { key: 'conc', label: 'Concentration' },
};

export default function DavidsonPieCalculator() {
  const [unitSystem, setUnitSystem] = useState('us'); // 'us' | 'si'
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

    try {
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
    } catch {
      return null;
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
    <div className="min-h-screen bg-[#10161D] text-[#E7EAEE] font-sans p-6 flex flex-col items-center">
      <div className="w-full max-w-3xl">
        <header className="mb-6 border-b border-[#2A3441] pb-4">
          <p className="text-xs tracking-[0.25em] uppercase text-[#E8A33D] font-mono">
            SiteGuard / Dosing Instrument
          </p>
          <h1 className="text-2xl font-semibold mt-1">Davidson Pie Calculator</h1>
          <p className="text-sm text-[#8B98A8] mt-1">
            Mass loading = Flow × Concentration × constant. Solve any one value from the other two.
          </p>
        </header>

        <div className="flex flex-col md:flex-row gap-8">
          <div className="flex-shrink-0 mx-auto">
            <PieDial solveFor={solveFor} onSelect={setSolveFor} labels={labels} />
          </div>

          <div className="flex-1 space-y-5">
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
  const isActive = (key) => solveFor === key;
  const seg = (key) =>
    `cursor-pointer transition-colors duration-150 ${
      isActive(key) ? 'fill-[#E8A33D]' : 'fill-[#1B2530] hover:fill-[#243040]'
    }`;

  return (
    <svg width="220" height="220" viewBox="0 0 220 220" role="img" aria-label="Davidson pie selector">
      <circle cx="110" cy="110" r="105" fill="#0C1116" stroke="#2A3441" strokeWidth="2" />
      <path
        d="M 10 110 A 100 100 0 0 1 210 110 Z"
        className={seg('mass')}
        onClick={() => onSelect('mass')}
      />
      <path
        d="M 10 110 A 100 100 0 0 0 110 210 L 110 110 Z"
        className={seg('flow')}
        onClick={() => onSelect('flow')}
      />
      <path
        d="M 110 210 A 100 100 0 0 0 210 110 L 110 110 Z"
        className={seg('conc')}
        onClick={() => onSelect('conc')}
      />
      <line x1="10" y1="110" x2="210" y2="110" stroke="#0C1116" strokeWidth="2" />
      <line x1="110" y1="110" x2="110" y2="210" stroke="#0C1116" strokeWidth="2" />

      <text x="110" y="65" textAnchor="middle" fill="#E7EAEE" fontSize="13" fontFamily="ui-monospace, monospace">
        {labels.mass}
      </text>
      <text x="60" y="160" textAnchor="middle" fill="#E7EAEE" fontSize="13" fontFamily="ui-monospace, monospace">
        {labels.flow}
      </text>
      <text x="160" y="160" textAnchor="middle" fill="#E7EAEE" fontSize="13" fontFamily="ui-monospace, monospace">
        {labels.conc}
      </text>
      <text x="110" y="185" textAnchor="middle" fill="#8B98A8" fontSize="11" fontFamily="ui-monospace, monospace">
        ×{labels.constant}
      </text>
    </svg>
  );
}

function UnitToggle({ unitSystem, onChange }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-[#8B98A8] font-mono uppercase text-xs tracking-wide">Units</span>
      <div className="flex rounded-md overflow-hidden border border-[#2A3441]">
        {['us', 'si'].map((u) => (
          <button
            key={u}
            onClick={() => onChange(u)}
            className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wide ${
              unitSystem === u ? 'bg-[#E8A33D] text-[#10161D]' : 'bg-[#161D25] text-[#8B98A8]'
            }`}
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
    <div className={`flex items-center justify-between gap-3 rounded-md px-3 py-2 border ${
      active ? 'border-[#E8A33D] bg-[#1B1610]' : 'border-[#2A3441] bg-[#141A21]'
    }`}>
      <div>
        <p className="text-sm">{segment.label}</p>
        <p className="text-xs text-[#8B98A8] font-mono">{unit}</p>
      </div>
      {active ? (
        <span className="text-xs font-mono text-[#E8A33D] uppercase">Solving</span>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            className="w-28 bg-[#0C1116] border border-[#2A3441] rounded px-2 py-1 text-right font-mono text-sm focus:outline-none focus:border-[#E8A33D]"
          />
          <button
            onClick={onSelectSolve}
            className="text-xs text-[#8B98A8] hover:text-[#E8A33D] font-mono"
            title="Solve for this instead"
          >
            solve
          </button>
        </div>
      )}
    </div>
  );
}

function ReadoutBox({ label, unit, value, crossCheck }) {
  return (
    <div className="rounded-md border border-[#2A3441] bg-[#0C1116] px-4 py-3">
      <p className="text-xs text-[#8B98A8] font-mono uppercase tracking-wide">{label} result</p>
      <p className="text-3xl font-mono text-[#E8A33D] mt-1">
        {value == null ? '—' : value.toLocaleString(undefined, { maximumFractionDigits: 3 })}
        <span className="text-base text-[#8B98A8] ml-2">{unit}</span>
      </p>
      {crossCheck && (
        <p className="text-xs text-[#8B98A8] font-mono mt-1">≈ {crossCheck}</p>
      )}
    </div>
  );
}

function ReferenceTable() {
  return (
    <div className="mt-8 border-t border-[#2A3441] pt-4">
      <p className="text-xs text-[#8B98A8] font-mono uppercase tracking-wide mb-2">
        Worldwide conversion reference
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-mono text-[#8B98A8]">
        {REFERENCE_TABLE.map((row) => (
          <div key={row.label} className="flex justify-between border-b border-[#1B2530] pb-1">
            <span>{row.label}</span>
            <span className="text-[#E7EAEE]">×{row.factor}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
