export const PARAMS = [
  { key: 'layers',      label: 'Layers',  min: 1,   max: 5,   step: 1,    default: 5 },
  { key: 'hueBase',     label: 'Hue',     min: 0,   max: 360, step: 1,    default: 220 },
  { key: 'hueSpeed',    label: 'Hue Cyc', min: -2,  max: 2,   step: 0.01, default: 1.37 },
  { key: 'rotFlow',     label: 'Rot Spd', min: -1.0,max: 1.0, step: 0.01, default: 0.06 },
  { key: 'flow',        label: 'Flow',    min: 0,   max: 3,   step: 0.01, default: 0.06 },
  { key: 'zoom',        label: 'Zoom',    min: 0.5, max: 3.0, step: 0.01, default: 0.5 },
  { key: 'nebulaScale', label: 'Cld Size',min: 0.1, max: 3.0, step: 0.01, default: 0.71 },
  { key: 'detailScale', label: 'Detail',  min: 0.0, max: 10.0,step: 0.01, default: 4.8 },
  { key: 'brightness',  label: 'Bright',  min: 0.0, max: 3.0, step: 0.05, default: 1.35 },
  { key: 'contrast',    label: 'Contrst', min: 0.5, max: 3.0, step: 0.01, default: 2.69 },
  { key: 'voidCut',     label: 'Void',    min: 0.0, max: 0.9, step: 0.01, default: 0.0 },
  { key: 'colorSpread', label: 'C. Sprd', min: 0,   max: 360, step: 1,    default: 141 },
  { key: 'layerDecay',  label: 'Fade',    min: 0.1, max: 1.0, step: 0.01, default: 0.58 },
  // Starfield-specific params:
  // Increased max density for "dusty" look; adjusted max glow for blooms
  { key: 'starDensity', label: 'Density', min: 0.0, max: 200.0, step: 0.1, default: 184.0 },
  { key: 'starTwinkle', label: 'Twinkl',  min: 0.0, max: 1.0, step: 0.01, default: 0.5 },
  { key: 'starSize',    label: 'Sz',      min: 0.25, max: 2.0, step: 0.01, default: 1.0 },
  
  // Controls the blend between a sharp pinprick and a soft light
  { key: 'starSoft',    label: 'Softnss', min: 0.0, max: 1.0, step: 0.01, default: 0.19 },
  
  // Controls the intensity of the outer halo
  { key: 'starGlow',    label: 'Glow',    min: 0.0, max: 2.0, step: 0.01, default: 0.15 },
  
  // Controls the physical radius of the light falloff
  { key: 'starGlowRad', label: 'Radius',  min: 0.0, max: 1.2, step: 0.001, default: 1.2 },
  
  // Global brightness multiplier
  { key: 'starBright',  label: 'Exposr',  min: 0.0, max: 5.0, step: 0.05, default: 1.0 },

  // Minimal background grid resolution (cells per axis)
  { key: 'gridCells',   label: 'GridSz',  min: 2,   max: 64,   step: 1,    default: 16 },

  // Fast star shader params (decoupled so tweaking slow stars preserves look)
  { key: 'starFastDensity', label: 'FastDen',   min: 0.0, max: 200.0, step: 0.1,  default: 140.0 },
  { key: 'starFastTwinkle', label: 'FastTwn',   min: 0.0, max: 1.0,   step: 0.01, default: 0.45 },
  { key: 'starFastSoft',    label: 'FastSft',   min: 0.0, max: 1.0,   step: 0.01, default: 0.32 },
  { key: 'starFastGlow',    label: 'FastGlw',   min: 0.0, max: 2.0,   step: 0.01, default: 0.28 },
  { key: 'starFastGlowRad', label: 'FastRad',   min: 0.0, max: 1.2,   step: 0.001,default: 0.85 },
  { key: 'starFastBright',  label: 'FastExp',   min: 0.0, max: 2.0,   step: 0.05, default: 1.0 },

  // Star + nebula blend mode selector (0-3)
  { key: 'starBlend',   label: 'Blend',   min: 0,   max: 3,    step: 1,    default: 0 },

  // Chromatic Distance membrane controls
  { key: 'membraneStrength',     label: 'Mem Str',   min: 0.0, max: 1.0, step: 0.01, default: 0.6 },
  { key: 'membraneFlow',         label: 'Mem Flow',  min: 0.0, max: 4.0, step: 0.01, default: 1.25 },
  { key: 'membraneFringe',       label: 'Fringe',    min: 0.0, max: 3.0, step: 0.01, default: 1.1 },
  { key: 'momentumPersistence',  label: 'Mom Hold',  min: 0.0, max: 1.0, step: 0.01, default: 0.72 },
  { key: 'permissionBloom',      label: 'Perm Blm',  min: 0.0, max: 2.0, step: 0.01, default: 0.95 },
  { key: 'permissionGate',       label: 'Perm Gate', min: 0.0, max: 1.0, step: 0.01, default: 0.42 },
];

export const PASS_FLAGS = {
  starEnabled: true,
  gridEnabled: true,
  gridBordersEnabled: true,
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
