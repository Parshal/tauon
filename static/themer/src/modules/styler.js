const BLOCK_TAGS = new Set(['section', 'article', 'div', 'li']);
const FORBIDDEN_TAGS = new Set(['script', 'style', 'noscript', 'template']);

export class Styler {
  constructor(options = {}) {
    this.rootSelector = options.rootSelector || 'main';
    this.minTextLength = options.minTextLength || 48;
    this.nodes = [];
    this.scan();
  }

  scan() {
    const root = this.#getRoot();
    if (!root) return;

    this.nodes = [];
    const queue = [root];

    while (queue.length) {
      const node = queue.shift();
      if (node !== root) this.#handleNode(node);

      for (const child of node.children) {
        if (!this.#shouldSkipSubtree(child)) {
          queue.push(child);
        }
      }
    }
  }

  tick(delta = 16) {
    if (!this.nodes.length) return;
    const step = Math.min(delta, 120) * 0.04;

    this.nodes = this.nodes.filter(entry => entry.el.isConnected);
    this.nodes.forEach(entry => {
      entry.hue = (entry.hue + entry.speed * step) % 360;
      const fillHue = (entry.hue + entry.fillOffset + 360) % 360;
      entry.el.style.setProperty('--hue-border', entry.hue.toFixed(1));
      entry.el.style.setProperty('--hue-fill', fillHue.toFixed(1));
    });
  }

  rescan() {
    this.scan();
  }

  #handleNode(node) {
    if (!this.#isCandidate(node)) return;

    const profile = this.#describe(node);
    if (!profile) return;

    const tracked = this.#skin(node, profile);
    if (tracked) this.nodes.push(tracked);
  }

  #getRoot() {
    return document.querySelector(this.rootSelector) || document.body;
  }

  #shouldSkipSubtree(node) {
    const tag = node.tagName?.toLowerCase();
    if (!tag) return true;
    if (FORBIDDEN_TAGS.has(tag)) return true;
    if (node.closest('.cd-hud-dock')) return true;
    return false;
  }

  #isCandidate(node) {
    if (node.dataset?.styler) return false;
    const tag = node.tagName?.toLowerCase();
    if (!tag) return false;
    if (FORBIDDEN_TAGS.has(tag)) return false;
    if (node.classList?.contains('cd-node-inner')) return true;
    if (!BLOCK_TAGS.has(tag)) return false;

    const textLength = (node.textContent || '').trim().length;
    if (textLength < this.minTextLength) return false;
    return true;
  }

  #describe(node) {
    const role = node.classList?.contains('log-stats') ? 'stats' : 'card';
    return {
      role,
      hue: Math.random() * 360,
      speed: 0.12 + Math.random() * 0.5,
      fillOffset: role === 'stats' ? -25 : 40,
    };
  }

  #skin(node, profile) {
    node.dataset.styler = profile.role;
    node.style.setProperty('--hue-border', profile.hue.toFixed(1));
    const fillHue = (profile.hue + profile.fillOffset + 360) % 360;
    node.style.setProperty('--hue-fill', fillHue.toFixed(1));

    return {
      el: node,
      role: profile.role,
      hue: profile.hue,
      fillOffset: profile.fillOffset,
      speed: profile.speed,
    };
  }
}
