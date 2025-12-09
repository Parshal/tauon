import { PARAMS, PASS_FLAG_KEYS } from '../data/config.js';

const STORAGE_KEY = 'themerConfig';
const STORAGE_KEY_HEIGHT = 'themerDockHeight';
const DEFAULT_DOCK_HEIGHT = 400;
const MIN_DOCK_HEIGHT = 240;

const GROUPS = [
  {
    title: 'Stars',
    description: 'Starfield intensity',
    flagKey: 'starEnabled',
    keys: ['starZoom','starDensity','starTwinkle'],
    extraToggles: [
      { key: 'seamDebugEnabled', label: 'SeamDbg' },
    ]
  },
  {
    title: 'CSS Styling',
    description: 'Quick visual perf toggles',
    note: 'Flip card animations & paint effects while profiling FPS.',
    extraToggles: [
      { key: 'stylerWobbleEnabled', label: 'Wobble' },
      { key: 'stylerGradientEnabled', label: 'Gradients' },
      { key: 'stylerGlowEnabled', label: 'Glow' },
      { key: 'stylerRoleJadeEnabled', label: 'Jade' },
      { key: 'hudDebugEnabled', label: 'HUD Debug' },
    ]
  }
];

export class ControlPanel {
  constructor(store) {
    this.store = store;
    this.dock = null;
    this.fpsEl = null;
    this.statusEl = null;
    this.savedHash = '';
    this.isDirty = false;
    this.statusTimeout = null;
    this.skipDirtyCheck = false;
    this.dockHeight = DEFAULT_DOCK_HEIGHT;

    this.render();
    this.markPreservedStylesheets();
    this.savedHash = this.hashState(this.store.data);
    this.bindEvents();
    this.subscribeToStore();
    this.setDirtyState(false);
    this.loadSavedConfig();
    this.restoreDockHeight();
    this.attachResizeHandle();
  }

  renderToggle(flagKey, labelText) {
    if (!flagKey) return '';
    const enabled = this.store.get(flagKey) !== false;
    const stateClass = enabled ? '' : 'off';
    const label = labelText ? `${labelText}: ${enabled ? 'ON' : 'OFF'}` : (enabled ? 'ON' : 'OFF');
    const labelAttr = labelText ? ` data-label="${labelText}"` : '';
    return `<button class="cd-toggle ${stateClass}" data-toggle="${flagKey}"${labelAttr}>${label}</button>`;
  }

  render() {
    if (document.querySelector('.cd-hud-dock')) return;

    const html = `
      <div class="cd-hud-dock minimized">
        <div class="cd-dock-handle" id="cd-dock-handle"></div>
        <div class="cd-hud-header">
          <div class="cd-hud-title">
            <span>SYS.CONFIG</span> <span style="opacity:0.4">//</span> <span>WEBGL2</span>
          </div>
          <div class="cd-hud-actions">
            <button class="cd-copy-btn" id="cd-btn-save">SAVE CONFIG</button>
            <button class="cd-copy-btn" id="cd-btn-copy">COPY JSON</button>
            <button class="cd-copy-btn" id="cd-btn-min">_</button>
          </div>
        </div>
        <div class="cd-hud-meta">
          <div class="cd-meta-item">
            <span>FPS</span>
            <strong id="cd-fps">--</strong>
          </div>
          <div class="cd-meta-item">
            <span>GPU MS</span>
            <strong id="cd-gpu">--</strong>
          </div>
          <div class="cd-meta-item cd-status" id="cd-status">CONFIG SAVED</div>
        </div>
        <div class="cd-control-groups">
          ${GROUPS.map(group => this.renderGroup(group)).join('')}
        </div>
      </div>
    `;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    this.dock = wrapper.firstElementChild;
    document.body.appendChild(this.dock);
  }

  renderGroup(group) {
    const controls = (group.keys || []).map(key => {
      const param = PARAMS.find(p => p.key === key);
      return param ? this.renderControl(param) : '';
    }).join('');

    const toggles = [];
    if (group.flagKey) toggles.push(this.renderToggle(group.flagKey));
    if (group.extraToggles) {
      group.extraToggles.forEach(t => toggles.push(this.renderToggle(t.key, t.label)));
    }

    const groupClasses = ['cd-group'];
    const hasControls = controls.trim().length > 0;
    const note = group.note ? `<div class="cd-group-note">${group.note}</div>` : '';

    return `
      <div class="${groupClasses.join(' ')}" data-group="${group.title.toLowerCase()}">
        <div class="cd-group-header">
          <div class="cd-group-text">
            <div class="cd-group-title">${group.title}</div>
            <div class="cd-group-desc">${group.description}</div>
          </div>
          <div class="cd-group-toggles">${toggles.join('')}</div>
        </div>
        ${note}
        ${hasControls ? `<div class="cd-controls-scroll">${controls}</div>` : ''}
      </div>
    `;
  }

  renderControl(p) {
    const current = this.store.get(p.key);
    return `
      <div class="cd-control" data-key="${p.key}">
        <div class="cd-control-label">${p.label}</div>
        <input type="number" class="cd-control-input inp-max" value="${p.max}" step="${p.step}">
        <input type="range" class="cd-control-slider" 
           min="${p.min}" max="${p.max}" step="${p.step}" value="${current}" orient="vertical">
        <input type="number" class="cd-control-input inp-min" value="${p.min}" step="${p.step}">
        <input type="number" class="cd-control-input main-val" value="${current}" step="${p.step}">
      </div>
    `;
  }

  bindEvents() {
    this.fpsEl = this.dock.querySelector('#cd-fps');
    this.gpuEl = this.dock.querySelector('#cd-gpu');
    this.statusEl = this.dock.querySelector('#cd-status');

    this.setDockHeight(this.dockHeight, false);

    // Minimize
    this.dock.querySelector('#cd-btn-min').onclick = () => {
      this.dock.classList.toggle('minimized');
    };

    // Copy
    const copyBtn = this.dock.querySelector('#cd-btn-copy');
    copyBtn.onclick = () => {
      const json = JSON.stringify(this.store.data, null, 2);
      const onSuccess = (label) => {
        copyBtn.innerText = label;
        setTimeout(() => (copyBtn.innerText = 'COPY JSON'), 1500);
      };

      // Modern API path
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard
          .writeText(json)
          .then(() => onSuccess('COPIED!'))
          .catch(() => {
            // Fallback to legacy execCommand if permission / context fails
            try {
              const ta = document.createElement('textarea');
              ta.value = json;
              ta.style.position = 'fixed';
              ta.style.opacity = '0';
              document.body.appendChild(ta);
              ta.select();
              document.execCommand('copy');
              document.body.removeChild(ta);
              onSuccess('COPIED!');
            } catch (err) {
              onSuccess('FAILED');
            }
          });
        return;
      }

      // Directly use fallback in older environments
      try {
        const ta = document.createElement('textarea');
        ta.value = json;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        onSuccess('COPIED!');
      } catch (err) {
        onSuccess('FAILED');
      }
    };

    // Save Config
    const saveBtn = this.dock.querySelector('#cd-btn-save');
    saveBtn.onclick = () => this.saveConfig();

    // Inputs
    this.dock.querySelectorAll('.cd-control').forEach(el => {
      const key = el.dataset.key;
      const slider = el.querySelector('.cd-control-slider');
      const valInput = el.querySelector('.main-val');
      const minInput = el.querySelector('.inp-min');
      const maxInput = el.querySelector('.inp-max');

      // Slider Change
      slider.addEventListener('input', (e) => {
        const v = Number(e.target.value);
        valInput.value = v;
        this.store.set(key, v);
      });

      // Number Input Change
      valInput.addEventListener('change', (e) => {
        let v = Number(e.target.value);
        // visual clamp
        const min = Number(minInput.value);
        const max = Number(maxInput.value);
        v = Math.max(min, Math.min(max, v));
        
        valInput.value = v;
        slider.value = v;
        this.store.set(key, v);
      });

      // Min/Max Logic
      minInput.addEventListener('change', (e) => {
        slider.min = e.target.value;
        if (Number(slider.value) < Number(e.target.value)) {
          this.store.set(key, Number(e.target.value));
          slider.value = e.target.value;
          valInput.value = e.target.value;
        }
      });

      maxInput.addEventListener('change', (e) => {
        slider.max = e.target.value;
        if (Number(slider.value) > Number(e.target.value)) {
          this.store.set(key, Number(e.target.value));
          slider.value = e.target.value;
          valInput.value = e.target.value;
        }
      });
    });

    // Group Toggles
    this.dock.querySelectorAll('.cd-toggle').forEach(btn => {
      const key = btn.dataset.toggle;
      if (!key) return;
      btn.addEventListener('click', () => {
        const current = this.store.get(key) !== false;
        this.store.set(key, !current);
      });
    });
  }

  subscribeToStore() {
    this.unsubscribe = this.store.subscribe((data) => this.onStoreUpdate(data));
    this.onStoreUpdate(this.store.data);
  }

  onStoreUpdate(data) {
    this.syncControls(data);
    this.syncToggles(data);
    this.applyGlobalFlags(data);
    if (!this.skipDirtyCheck) {
      const dirty = this.hashState(data) !== this.savedHash;
      this.setDirtyState(dirty);
    }
  }

  applyGlobalFlags(data) {
    const flagClasses = [
      ['stylerWobbleEnabled', 'cd-styler-wobble-off'],
      ['stylerGradientEnabled', 'cd-styler-gradient-off'],
      ['stylerGlowEnabled', 'cd-styler-glow-off'],
      ['stylerRoleJadeEnabled', 'cd-styler-role-jade-off'],
    ];

    flagClasses.forEach(([key, className]) => {
      const enabled = data[key] !== false;
      document.body?.classList.toggle(className, !enabled);
    });

    const hudDebug = data.hudDebugEnabled === true;
    document.body?.classList.toggle('cd-hud-debug', hudDebug);
    this.toggleHostStyles(hudDebug);
  }

  syncControls(data) {
    if (!this.dock) return;
    this.dock.querySelectorAll('.cd-control').forEach(el => {
      const key = el.dataset.key;
      if (!(key in data)) return;
      const value = data[key];
      const slider = el.querySelector('.cd-control-slider');
      const valInput = el.querySelector('.main-val');
      if (slider && Number(slider.value) !== Number(value)) {
        slider.value = value;
      }
      if (valInput && Number(valInput.value) !== Number(value)) {
        valInput.value = value;
      }
    });
  }

  syncToggles(data) {
    if (!this.dock) return;
    this.dock.querySelectorAll('.cd-toggle').forEach(btn => {
      const key = btn.dataset.toggle;
      if (!key) return;
      const enabled = data[key] !== false;
      btn.classList.toggle('off', !enabled);
      const baseLabel = btn.dataset.label;
      btn.textContent = baseLabel ? `${baseLabel}: ${enabled ? 'ON' : 'OFF'}` : (enabled ? 'ON' : 'OFF');
    });
  }

  hashState(data) {
    const paramHash = PARAMS.map(p => `${p.key}:${data[p.key] ?? ''}`).join('|');
    const flagHash = PASS_FLAG_KEYS.map(key => `${key}:${data[key] !== false}`).join('|');
    return `${paramHash}|${flagHash}`;
  }

  setDirtyState(isDirty) {
    this.isDirty = isDirty;
    if (!this.statusEl) return;
    this.statusEl.classList.toggle('dirty', isDirty);
    if (!this.statusTempActive) {
      this.statusEl.textContent = isDirty ? 'UNSAVED CONFIG' : 'CONFIG SAVED';
    }
  }

  setFPS(value) {
    if (!this.fpsEl) return;
    if (!value || !isFinite(value)) {
      this.fpsEl.textContent = '--';
      return;
    }
    this.fpsEl.textContent = Math.round(value).toString();
  }

  setGpuTime(value) {
    if (!this.gpuEl) return;
    if (typeof value !== 'number' || !isFinite(value)) {
      this.gpuEl.textContent = '--';
      return;
    }
    this.gpuEl.textContent = value.toFixed(2);
  }

  flashStatus(text, isError = false) {
    if (!this.statusEl) return;
    this.statusTempActive = true;
    this.statusEl.textContent = text;
    this.statusEl.classList.toggle('dirty', isError || this.isDirty);
    clearTimeout(this.statusTimeout);
    this.statusTimeout = setTimeout(() => {
      this.statusTempActive = false;
      this.setDirtyState(this.isDirty);
    }, 1500);
  }

  saveConfig() {
    const snapshot = this.store.data;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      this.savedHash = this.hashState(snapshot);
      this.setDirtyState(false);
      this.flashStatus('CONFIG SAVED');
    } catch (err) {
      console.warn('Failed to save config', err);
      this.flashStatus('SAVE FAILED', true);
    }
  }

  loadSavedConfig() {
    let raw = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (err) {
      console.warn('Config storage unavailable', err);
      return;
    }
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      this.skipDirtyCheck = true;
      this.store.setAll(parsed);
      this.skipDirtyCheck = false;
      this.savedHash = this.hashState(this.store.data);
      this.setDirtyState(false);
      this.flashStatus('CONFIG LOADED');
    } catch (err) {
      console.warn('Failed to parse saved config', err);
      this.skipDirtyCheck = false;
    }
  }

  attachResizeHandle() {
    const handle = this.dock?.querySelector('#cd-dock-handle');
    if (!handle) return;

    let isDragging = false;
    let startY = 0;
    let startHeight = this.dockHeight;

    const onPointerMove = (event) => {
      if (!isDragging) return;
      const clientY = event.clientY ?? (event.touches && event.touches[0]?.clientY);
      if (clientY === undefined) return;
      const delta = startY - clientY;
      const maxHeight = Math.max(MIN_DOCK_HEIGHT, window.innerHeight - 80);
      const newHeight = Math.min(Math.max(MIN_DOCK_HEIGHT, startHeight + delta), maxHeight);
      this.setDockHeight(newHeight, false);
    };

    const endDrag = () => {
      if (!isDragging) return;
      isDragging = false;
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', endDrag);
      this.persistDockHeight();
    };

    handle.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      isDragging = true;
      startY = event.clientY;
      startHeight = this.dockHeight;
      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', endDrag);
    });
  }

  setDockHeight(height, persist = true) {
    this.dockHeight = height;
    if (this.dock) {
      this.dock.style.height = `${height}px`;
    }
    if (persist) this.persistDockHeight();
  }

  persistDockHeight() {
    try {
      localStorage.setItem(STORAGE_KEY_HEIGHT, String(this.dockHeight));
    } catch (err) {
      console.warn('Failed to persist dock height', err);
    }
  }

  restoreDockHeight() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_HEIGHT);
      if (!saved) return;
      const parsed = Number(saved);
      if (!Number.isFinite(parsed)) return;
      const maxHeight = Math.max(MIN_DOCK_HEIGHT, window.innerHeight - 80);
      this.setDockHeight(Math.min(Math.max(MIN_DOCK_HEIGHT, parsed), maxHeight), false);
    } catch (err) {
      console.warn('Failed to restore dock height', err);
    }
  }

  markPreservedStylesheets() {
    document.querySelectorAll('link[rel~="stylesheet"]').forEach(link => {
      const href = link.getAttribute('href') || '';
      if (href.includes('/themer/css/')) {
        link.dataset.hudPreserve = 'true';
      }
    });
  }

  toggleHostStyles(disableHostStyles) {
    const selector = '[data-hud-style-disabled="true"]';
    if (!disableHostStyles) {
      document.querySelectorAll(selector).forEach(node => {
        node.disabled = false;
        node.removeAttribute('data-hud-style-disabled');
      });
      return;
    }

    document.querySelectorAll('link[rel~="stylesheet"], style').forEach(node => {
      if (node.dataset?.hudPreserve === 'true') return;
      if (node.dataset?.hudStyleDisabled === 'true') return;

      if (node.tagName === 'LINK') {
        const href = node.getAttribute('href') || '';
        if (href.includes('/themer/css/')) {
          node.dataset.hudPreserve = 'true';
          return;
        }
      }

      node.dataset.hudStyleDisabled = 'true';
      node.disabled = true;
    });
  }
}
