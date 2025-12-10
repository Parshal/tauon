import { computeSquareLayout, mapScreenToSquare } from './layout.js';

export class InputController {
  constructor(canvas, state) {
    this.canvas = canvas;
    this.state = state;
    this.pointerDown = false;
    this.pointerActive = false;

    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    this.handleLeave = this.handleLeave.bind(this);
    this.handleWheel = this.handleWheel.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);

    this.canvas.addEventListener('pointermove', this.handlePointerMove);
    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    window.addEventListener('pointerup', this.handlePointerUp);
    this.canvas.addEventListener('pointerleave', this.handleLeave);
    this.canvas.addEventListener('wheel', this.handleWheel, { passive: false });
    window.addEventListener('keydown', this.handleKeyDown);
  }

  destroy() {
    this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    window.removeEventListener('pointerup', this.handlePointerUp);
    this.canvas.removeEventListener('pointerleave', this.handleLeave);
    this.canvas.removeEventListener('wheel', this.handleWheel, { passive: false });
    window.removeEventListener('keydown', this.handleKeyDown);
  }

  handlePointerMove(event) {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      this.resetPointer();
      return;
    }

    const rawU = (event.clientX - rect.left) / rect.width;
    const rawV = (event.clientY - rect.top) / rect.height;
    const layout = computeSquareLayout(rect.width, rect.height);
    const mapped = mapScreenToSquare(rawU, rawV, layout);
    if (!mapped || !mapped.inside) {
      this.resetPointer();
      return;
    }

    const pointerCell = this.state.setPointerFromUV(mapped.u, mapped.v);
    this.pointerActive = !!pointerCell;
    if (this.pointerDown && pointerCell) {
      this.state.placeControl(pointerCell.x, pointerCell.y);
    }
  }

  handlePointerDown(event) {
    if (event.button !== 0) return;
    this.pointerDown = true;
    this.handlePointerMove(event);
    this.state.attemptPlaceActivePointer();
  }

  handlePointerUp() {
    this.pointerDown = false;
  }

  handleLeave() {
    this.resetPointer();
  }

  resetPointer() {
    this.pointerActive = false;
    this.state.clearPointer();
  }

  handleWheel(event) {
    if (!Number.isFinite(event?.deltaY)) return;
    event.preventDefault();
    const direction = event.deltaY > 0 ? 1 : -1;
    if (direction !== 0) {
      this.state.shiftActiveSlot(direction);
    }
  }

  handleKeyDown(event) {
    if (event.defaultPrevented) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const key = event.key;
    if (key >= '1' && key <= '8') {
      const slotIndex = parseInt(key, 10) - 1;
      this.state.setActiveSlot(slotIndex);
    } else if (key === 'q' || key === 'Q') {
      this.state.shiftActiveSlot(-1);
    } else if (key === 'e' || key === 'E') {
      this.state.shiftActiveSlot(1);
    }
  }
}
