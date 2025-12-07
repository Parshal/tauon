import { store } from './state.js';
import { BackgroundRenderer } from '../modules/renderer.js';
import { Styler } from '../modules/styler.js';
import { ControlPanel } from '../modules/ui.js';

export class ThemerEngine {
  constructor() {
    this.renderer = null;
    this.styler = null;
    this.ui = null;
    
    this.startTime = performance.now();
    this.isRunning = false;
    this.rafId = null;
    this.lastFrameTime = performance.now();
    this.fpsSamples = [];
  }

  init() {
    if (this.renderer) return; // prevent double init

    this.renderer = new BackgroundRenderer(store);
    this.styler = new Styler();
    this.ui = new ControlPanel(store);

    // Window Events
    window.addEventListener('resize', () => this.renderer.resize());
    this.renderer.resize(); // First sizing

    // Visibility API
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(e => {
            if (e.isIntersecting) this.start();
            else this.stop();
        });
    });
    
    // Observe the canvas specifically
    observer.observe(this.renderer.canvas);
    
    this.start();
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.loop();
  }

  stop() {
    this.isRunning = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }

  loop() {
    if (!this.isRunning) return;
    const now = performance.now();
    const t = (now - this.startTime) * 0.001;
    const delta = now - this.lastFrameTime;
    this.lastFrameTime = now;
    if (delta > 0) {
      const fps = 1000 / delta;
      this.fpsSamples.push(fps);
      if (this.fpsSamples.length > 30) this.fpsSamples.shift();
      const avgFps = this.fpsSamples.reduce((sum, val) => sum + val, 0) / this.fpsSamples.length;
      if (this.ui && this.ui.setFPS) {
        this.ui.setFPS(avgFps);
      }
    }
    
    this.renderer.render(t);
    if (this.styler) this.styler.tick(delta);

    this.rafId = requestAnimationFrame(() => this.loop());
  }
}
