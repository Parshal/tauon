export const PARAMS = [
  { key: 'contrast',    label: 'Contrst', min: 0.5, max: 3.0, step: 0.01, default: 2.69 },
  { key: 'starZoom',    label: 'St Zoom', min: 0.25, max: 4.0, step: 0.01, default: 1.0 },
  { key: 'starDensity', label: 'Density', min: 0.0, max: 200.0, step: 0.1, default: 184.0 },
  { key: 'starTwinkle', label: 'Twinkl',  min: 0.0, max: 1.0, step: 0.01, default: 0.5 },
];

export const PASS_FLAGS = {
  starEnabled: true,
  seamDebugEnabled: false,
};

export const PASS_FLAG_KEYS = Object.keys(PASS_FLAGS);

// Helper to generate initial state object
export const getDefaults = () => {
  const base = PARAMS.reduce((acc, item) => {
    acc[item.key] = item.default;
    return acc;
  }, {});
  return { ...base, ...PASS_FLAGS };
};
