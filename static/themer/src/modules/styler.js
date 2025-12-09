const BLOCK_TAGS = new Set(['section', 'article', 'div', 'li', 'main']);
const FORBIDDEN_TAGS = new Set(['script', 'style', 'noscript', 'template']);
const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6';
const HEADING_MIN_CHARS = 80;
const HEADING_WRAP_CLASS = 'cd-heading-card';
const ENABLE_FEATURE_CLUSTER = false;

let headingCardIdCounter = 0;

const CLASSIFIERS = [
  createHeadingClusterClassifier(),
  ...(ENABLE_FEATURE_CLUSTER
    ? [
        {
          id: 'jade-card',
          label: 'featureCluster',
          test(node) {
            const text = (node.textContent || '').trim();
            if (text.length < 120) return false;

            const heading = node.querySelector('h1, h2, h3, h4, h5, h6');
            const paragraphs = node.querySelectorAll('p');
            const lists = node.querySelectorAll('ul li, ol li');
            const emphasized = node.querySelector('strong, em, code, mark');

            const hasRichBody = paragraphs.length >= 2 || lists.length >= 3;
            return Boolean(heading && (hasRichBody || emphasized));
          },
          describe(node) {
            return {
              blockCount: node.children.length,
              paragraphs: node.querySelectorAll('p').length,
            };
          },
        },
      ]
    : []),
];

export class Styler {
  constructor(options = {}) {
    this.rootSelector = options.rootSelector || 'body';
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

    const descriptor = this.classify(node);
    if (!descriptor) return;
    const descriptors = Array.isArray(descriptor) ? descriptor : [descriptor];

    descriptors.forEach((entry) => {
      if (!entry) return;
      const target = entry.target || node;
      const tracked = this.style(target, entry);
      if (tracked) this.nodes.push(tracked);
    });
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

  classify(node) {
    for (const classifier of CLASSIFIERS) {
      if (typeof classifier.collect === 'function') {
        const descriptors = classifier.collect(node);
        if (descriptors && descriptors.length) {
          return descriptors.map((entry) => ({
            id: entry.id || classifier.id,
            label: entry.label || classifier.label,
            meta: entry.meta || {},
            target: entry.target,
          }));
        }
        continue;
      }

      if (classifier.test(node)) {
        return {
          id: classifier.id,
          label: classifier.label,
          meta: classifier.describe ? classifier.describe(node) : {},
        };
      }
    }
    return null;
  }

  style(node, descriptor) {
    if (!node || node.dataset?.styler) return null;
    node.dataset.styler = descriptor.id;
    return {
      el: node,
      descriptor,
    };
  }
}

function createHeadingClusterClassifier() {
  return {
    id: 'jade-card',
    label: 'headingCluster',
    collect(node) {
      const headings = node.querySelectorAll(HEADING_SELECTOR);
      if (!headings.length) return null;

      const descriptors = [];

      headings.forEach((heading) => {
        if (!isHeadingCandidate(heading)) return;
        const bundle = wrapHeadingGroup(heading);
        if (!bundle) return;

        descriptors.push({
          target: bundle.wrapper,
          meta: {
            headingTag: heading.tagName?.toLowerCase() || null,
            nodeCount: bundle.nodeCount,
            charCount: bundle.textLength,
          },
        });
      });

      return descriptors.length ? descriptors : null;
    },
  };
}

function isHeadingCandidate(heading) {
  if (!heading) return false;
  if (heading.closest('.cd-heading-card__header')) return false;
  const enclosingCard = heading.closest(`.${HEADING_WRAP_CLASS}`);
  if (enclosingCard && !heading.closest('.cd-heading-card__body')) return false;
  const level = getHeadingLevel(heading);
  if (!level) return false;
  return true;
}

function wrapHeadingGroup(heading) {
  const parent = heading.parentElement;
  if (!parent) return null;

  const level = getHeadingLevel(heading);
  if (!level) return null;

  const nodes = [heading];
  let cursor = heading.nextSibling;

  while (cursor) {
    if (isHeadingNode(cursor)) {
      const nextLevel = getHeadingLevel(cursor);
      if (nextLevel && nextLevel <= level) break;
    }

    nodes.push(cursor);
    cursor = cursor.nextSibling;
  }

  const textLength = nodes.reduce((acc, node) => acc + getNodeTextLength(node), 0);
  if (textLength < HEADING_MIN_CHARS) return null;

  const nodeCount = nodes.length;

  const wrapper = document.createElement('section');
  wrapper.classList.add(HEADING_WRAP_CLASS);
  if (heading.id) {
    wrapper.id = heading.id;
    heading.removeAttribute('id');
  }

  const { headerButton, body } = createHeadingCardChrome(heading, level);
  parent.insertBefore(wrapper, nodes[0]);
  wrapper.appendChild(headerButton);
  wrapper.appendChild(body);

  nodes.forEach((node, index) => {
    if (!node) return;
    if (index === 0) {
      node.remove();
      return;
    }
    body.appendChild(node);
  });

  attachHeadingCardBehavior(wrapper, body, headerButton);

  return {
    wrapper,
    textLength,
    nodeCount,
  };
}

function isHeadingNode(node) {
  if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
  return /^h[1-6]$/i.test(node.tagName);
}

function getHeadingLevel(node) {
  if (!isHeadingNode(node)) return null;
  const tag = node.tagName.toLowerCase();
  return parseInt(tag.slice(1), 10) || null;
}

function getNodeTextLength(node) {
  if (!node) return 0;
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent.trim().length;
  }
  if (node.nodeType === Node.ELEMENT_NODE) {
    return (node.textContent || '').trim().length;
  }
  return 0;
}

function createHeadingCardChrome(heading, level) {
  const headerButton = document.createElement('button');
  headerButton.type = 'button';
  headerButton.classList.add('cd-heading-card__header');
  headerButton.setAttribute('aria-expanded', 'true');

  const title = document.createElement('span');
  title.classList.add('cd-heading-card__title');
  title.setAttribute('role', 'heading');
  if (level) {
    title.setAttribute('aria-level', String(level));
  }
  title.innerHTML = heading.innerHTML || heading.textContent || '';
  headerButton.appendChild(title);

  const caret = document.createElement('span');
  caret.classList.add('cd-heading-card__caret');
  caret.setAttribute('aria-hidden', 'true');
  headerButton.appendChild(caret);

  const body = document.createElement('div');
  body.classList.add('cd-heading-card__body');
  const bodyId = `cd-heading-card-body-${++headingCardIdCounter}`;
  body.id = bodyId;
  body.setAttribute('aria-hidden', 'false');
  headerButton.setAttribute('aria-controls', bodyId);

  return { headerButton, body };
}

function attachHeadingCardBehavior(wrapper, body, headerButton) {
  if (!wrapper || !body || !headerButton) return;

  const getParentCard = () => wrapper.parentElement?.closest(`.${HEADING_WRAP_CLASS}`) || null;

  const setCollapsed = (collapsed) => {
    wrapper.classList.toggle('cd-heading-card--collapsed', collapsed);
    headerButton.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    body.setAttribute('aria-hidden', collapsed ? 'true' : 'false');
    if (collapsed) {
      const currentHeight = body.scrollHeight;
      body.style.maxHeight = `${currentHeight}px`;
      requestAnimationFrame(() => {
        body.style.maxHeight = '0px';
      });
    } else {
      body.style.maxHeight = `${body.scrollHeight}px`;
    }
  };

  requestAnimationFrame(() => {
    body.style.maxHeight = 'none';
  });

  headerButton.addEventListener('click', () => {
    const collapsed = !wrapper.classList.contains('cd-heading-card--collapsed');
    setCollapsed(collapsed);
    if (!collapsed) {
      const parent = getParentCard();
      if (parent) {
        const parentBody = parent.querySelector(':scope > .cd-heading-card__body');
        if (parentBody && parentBody.style.maxHeight === 'none') {
          parentBody.style.maxHeight = `${parentBody.scrollHeight}px`;
          requestAnimationFrame(() => {
            parentBody.style.maxHeight = 'none';
          });
        }
      }
    }
  });

  body.addEventListener('transitionend', (event) => {
    if (event.target !== body || event.propertyName !== 'max-height') return;
    if (wrapper.classList.contains('cd-heading-card--collapsed')) return;
    body.style.maxHeight = 'none';
  });
}
