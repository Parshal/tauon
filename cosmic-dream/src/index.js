import { CosmicEngine } from './core/engine.js';

const engine = new CosmicEngine();

// Auto-boot on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => engine.init());
} else {
  engine.init();
}

// Expose for debugging
window.CosmicDream = engine;
