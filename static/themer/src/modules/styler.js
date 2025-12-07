const BLOCK_TAGS = new Set(['section', 'article', 'div', 'li', 'main']);
const FORBIDDEN_TAGS = new Set(['script', 'style', 'noscript', 'template']);

const ROLE_FILL_OFFSETS = {
  card: 40,
  stats: -25,
};

export class Styler {
  constructor(options = {}) {
    this.rootSelector = options.rootSelector || 'main';
    this.minTextLength = options.minTextLength || 48;
    this.nodes = [];
    this.scanIntervalMs = options.scanIntervalMs || 5000;
    this.timeSinceScan = 0;
    this.scan();
  }

  scan() {
    const root = this.getRoot();
    if (!root) return;

    this.nodes = [];
    const queue = [root];

    while (queue.length) {
      const node = queue.shift();
      if (node !== root) this.handleNode(node);

      for (const child of node.children) {
        if (!this.shouldSkipSubtree(child)) {
          queue.push(child);
        }
      }
    }
  }

  tick() {
    // Intentionally left blank; CSS handles the live animation work.
  }

  rescan(delta = 0) {
    this.timeSinceScan += delta;
    if (this.timeSinceScan >= this.scanIntervalMs) {
      this.timeSinceScan = 0;
      this.scan();
    }
  }

  handleNode(node) {
    if (!this.isCandidate(node)) return;

    const profile = this.describe(node);
    if (!profile) return;

    const tracked = this.decorate(node, profile);
    if (tracked) this.nodes.push(tracked);
  }

  getRoot() {
    return document.querySelector(this.rootSelector) || document.body;
  }

  shouldSkipSubtree(node) {
    const tag = node.tagName?.toLowerCase();
    if (!tag) return true;
    if (FORBIDDEN_TAGS.has(tag)) return true;
    return false;
  }

  isCandidate(node) {
    if (node.dataset?.styler) return false;
    const tag = node.tagName?.toLowerCase();
    if (!tag) return false;
    if (FORBIDDEN_TAGS.has(tag)) return false;
    if (!BLOCK_TAGS.has(tag)) return false;

    const textLength = (node.textContent || '').trim().length;
    if (textLength < this.minTextLength) return false;
    return true;
  }

  describe(node) {
    const hasHeading = Boolean(node.querySelector('h1, h2, h3'));
    const hasList = Boolean(node.querySelector('ul, ol, dl'));
    const hasMetrics = Boolean(node.querySelector('code, pre, kbd, data'));

    let role = 'card';
    if (hasList || hasMetrics) role = 'stats';
    else if (!hasHeading) role = 'card';

    const hue = Math.random() * 360;
    const fillOffset = ROLE_FILL_OFFSETS[role] ?? 40;

    return {
      role,
      hue,
      fillOffset,
    };
  }

  decorate(node, profile) {
    node.dataset.styler = profile.role;
    node.style.setProperty('--hue-border', profile.hue.toFixed(1));
    const fillHue = (profile.hue + profile.fillOffset + 360) % 360;
    node.style.setProperty('--hue-fill', fillHue.toFixed(1));

    return {
      el: node,
      role: profile.role,
      hue: profile.hue,
      fillOffset: profile.fillOffset,
    };
  }
}
