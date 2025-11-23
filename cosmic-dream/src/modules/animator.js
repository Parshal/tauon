export class HueAnimator {
  constructor(selector = '.cd-node-inner') {
    this.nodes = [];
    this.selector = selector;
    this.scan();
  }

  scan() {
    const els = document.querySelectorAll(this.selector);
    this.nodes = Array.from(els).map(el => ({
      el,
      hue: Math.random() * 360,
      speed: (Math.random() * 0.8) + 0.2
    }));
  }

  update() {
    this.nodes.forEach(node => {
      node.hue = (node.hue + node.speed * 0.5) % 360;
      node.el.style.setProperty('--hue-border', node.hue.toFixed(1));
    });
  }
}
