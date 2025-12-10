import { store } from './state.js';
import { BackgroundRenderer } from '../modules/renderer.js';
import { Styler } from '../modules/styler.js';
import { ControlPanel } from '../modules/ui.js';

export class ThemerEngine {
  constructor() {
    this.renderer = null;
    this.styler = null;
    this.ui = null;
    this.unsubscribeTimingDebug = null;
    this.handleTimingDebugUpdate = null;
    
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
    
    this.handleTimingDebugUpdate = (data) => {
      if (!this.renderer?.setTimingDebugEnabled) return;
      const enabled = data?.timingDebugEnabled === true;
      if (this.renderer.isTimingDebugEnabled?.() === enabled) return;
      this.renderer.setTimingDebugEnabled(enabled);
    };

    this.handleTimingDebugUpdate(store.data);
    this.ensureTimingDebugSubscription();

    this.start();
  }

  start() {
    this.ensureTimingDebugSubscription();
    this.handleTimingDebugUpdate?.(store.data);
    if (this.isRunning) return;
    this.isRunning = true;
    this.loop();
  }

  stop() {
    this.isRunning = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.unsubscribeTimingDebug) {
      this.unsubscribeTimingDebug();
      this.unsubscribeTimingDebug = null;
    }
  }

  ensureTimingDebugSubscription() {
    if (this.unsubscribeTimingDebug || !this.handleTimingDebugUpdate) return;
    this.unsubscribeTimingDebug = store.subscribe(this.handleTimingDebugUpdate);
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
    if (this.ui?.setGpuTime && this.renderer?.getStarPassMs) {
      const gpuTime = this.renderer.getStarPassMs();
      const timingMode = this.renderer.getTimingMode?.();
      if (this.renderer.isTimingDebugEnabled?.() === true) {
        console.log('[Themer][Timing] HUD pipeline sample', {
          timingMode,
          gpuTime,
        });
      }
      this.ui.setGpuTime(gpuTime, timingMode);
    }
    if (this.styler) {
      this.styler.tick(delta);
      this.styler.rescan(delta);
    }

    this.rafId = requestAnimationFrame(() => this.loop());
  }
}
