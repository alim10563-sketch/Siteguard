export const FLOW = {
  MGD_to_m3day: 3785.411784,
  m3day_to_Ls: 1 / 86.4,
  MGD_to_Ls: 43.8126,
  MGD_to_m3s: 0.0438126,
};

export const MASS = {
  lb_to_kg: 0.45359237,
  kg_to_lb: 1 / 0.45359237,
};

export const CONSTANTS = {
  DAVIDSON_CONSTANT_US: 8.34,
  DAVIDSON_CONSTANT_SI: 0.001,
};

export function convertFlow(value, fromUnit) {
  if (fromUnit === 'MGD') return value * FLOW.MGD_to_m3day;
  if (fromUnit === 'm3day') return value / FLOW.MGD_to_m3day;
  throw new Error(`Unknown flow unit: ${fromUnit}`);
}

export function convertMass(value, fromUnit) {
  if (fromUnit === 'lb') return value * MASS.lb_to_kg;
  if (fromUnit === 'kg') return value * MASS.kg_to_lb;
  throw new Error(`Unknown mass unit: ${fromUnit}`);
}

export const REFERENCE_TABLE = [
  { label: 'MGD → m³/day', factor: 3785.41 },
  { label: 'MGD → L/s', factor: 43.81 },
  { label: 'lb → kg', factor: 0.4536 },
  { label: 'US gal → L', factor: 3.785 },
  { label: 'mg/L → kg/m³', factor: 0.001 },
];
