import { ThemerEngine } from './core/engine.js';

const engine = new ThemerEngine();

// Auto-boot on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => engine.init());
} else {
  engine.init();
}

// Expose for debugging
window.Themer = engine;
