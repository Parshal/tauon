import { ProtoState } from './state.js';
import { NiitytRenderer } from './renderer.js';
import { InputController } from './input.js';

const NIITYT_ATTR = 'niitytBound';

async function mountNiityt(canvas) {
  if (!canvas || canvas.dataset[NIITYT_ATTR]) return null;
  canvas.dataset[NIITYT_ATTR] = 'true';

  const mode = canvas?.dataset?.niitytMode === 'duel' ? 'duel' : 'sandbox';
  const state = new ProtoState(128, 128, { mode });
  const renderer = new NiitytRenderer(canvas);
  await renderer.init();

  const input = new InputController(canvas, state);
  let lastTime = performance.now();

  function frame(now) {
    const delta = Math.min((now - lastTime) * 0.001, 0.2);
    lastTime = now;

    state.tick(delta);
    renderer.render(state.getRenderPayload(state.time, input.pointerActive));

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);

  return { state, renderer, input };
}

async function bootstrapAll() {
  const canvases = document.querySelectorAll('.niityt-canvas');
  if (!canvases.length) return;

  const mounts = [];
  for (const canvas of canvases) {
    mounts.push(mountNiityt(canvas));
  }
  await Promise.allSettled(mounts);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapAll, { once: true });
} else {
  bootstrapAll();
}

export { mountNiityt };
