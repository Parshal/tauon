export function createVSlider({ key, label, min, max, step, value }) {
  return `
    <div class="cd-control" data-key="${key}">
      <div class="cd-control-layout">
        <div class="cd-control-left">
          <div class="cd-control-side">
            <div class="cd-control-stack cd-control-top">
              <div class="cd-field" data-field="max">
                <input type="number" class="cd-control-input inp-max" value="${max}" step="${step}">
              </div>
              <div class="cd-field" data-field="step">
                <input type="number" class="cd-control-input inp-step" value="${step}" min="0.0001" step="0.0001">
              </div>
            </div>
            <span class="cd-control-label-vertical">${label}</span>
            <div class="cd-control-stack cd-control-bottom">
              <div class="cd-field" data-field="value">
                <input type="number" class="cd-control-input main-val" value="${value}" step="${step}">
              </div>
              <div class="cd-field" data-field="min">
                <input type="number" class="cd-control-input inp-min" value="${min}" step="${step}">
              </div>
            </div>
          </div>
        </div>
        <div class="cd-control-slider-stack">
          <div class="cd-slider-pill">
            <button type="button" class="cd-control-arrow arrow-up" aria-label="Increase ${label}">&#9650;</button>
            <input type="range" class="cd-control-slider" 
              min="${min}" max="${max}" step="${step}" data-default-step="${step}" value="${value}" orient="vertical">
            <button type="button" class="cd-control-arrow arrow-down" aria-label="Decrease ${label}">&#9660;</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function bindVSlider(controlEl, store) {
  if (!controlEl || !store) return;
  const key = controlEl.dataset.key;
  if (!key) return;

  const slider = controlEl.querySelector('.cd-control-slider');
  const valInput = controlEl.querySelector('.main-val');
  const minInput = controlEl.querySelector('.inp-min');
  const maxInput = controlEl.querySelector('.inp-max');
  const stepInput = controlEl.querySelector('.inp-step');
  const arrowUp = controlEl.querySelector('.cd-control-arrow.arrow-up');
  const arrowDown = controlEl.querySelector('.cd-control-arrow.arrow-down');

  if (!slider || !valInput || !minInput || !maxInput || !stepInput) return;

  const applyStepValue = (rawValue) => {
    const defaultStep = Number(slider?.dataset?.defaultStep) || Number(slider?.step) || 1;
    let nextStep = Number(rawValue);
    if (!Number.isFinite(nextStep) || nextStep <= 0) {
      nextStep = defaultStep;
    }
    slider.step = nextStep;
    valInput.step = nextStep;
    minInput.step = nextStep;
    maxInput.step = nextStep;
    stepInput.value = nextStep;
    return nextStep;
  };

  applyStepValue(stepInput.value);
  stepInput.addEventListener('change', (e) => {
    applyStepValue(e.target.value);
  });

  slider.addEventListener('input', (e) => {
    const v = Number(e.target.value);
    valInput.value = v;
    store.set(key, v);
  });

  const adjustByStep = (direction) => {
    const current = Number(slider.value);
    const step = Number(slider.step) || Number(stepInput.value) || Number(slider.dataset?.defaultStep) || 1;
    const min = Number(slider.min);
    const max = Number(slider.max);
    const delta = direction === 'up' ? step : -step;
    const next = Math.max(min, Math.min(max, current + delta));
    slider.value = next;
    valInput.value = next;
    store.set(key, next);
  };

  arrowUp?.addEventListener('click', () => adjustByStep('up'));
  arrowDown?.addEventListener('click', () => adjustByStep('down'));

  valInput.addEventListener('change', (e) => {
    let v = Number(e.target.value);
    const min = Number(minInput.value);
    const max = Number(maxInput.value);
    v = Math.max(min, Math.min(max, v));
    valInput.value = v;
    slider.value = v;
    store.set(key, v);
  });

  minInput.addEventListener('change', (e) => {
    slider.min = e.target.value;
    if (Number(slider.value) < Number(e.target.value)) {
      store.set(key, Number(e.target.value));
      slider.value = e.target.value;
      valInput.value = e.target.value;
    }
  });

  maxInput.addEventListener('change', (e) => {
    slider.max = e.target.value;
    if (Number(slider.value) > Number(e.target.value)) {
      store.set(key, Number(e.target.value));
      slider.value = e.target.value;
      valInput.value = e.target.value;
    }
  });
}
