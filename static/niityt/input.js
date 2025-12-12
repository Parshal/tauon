import { computeSquareLayout, mapScreenToSquare } from './layout.js';

const HUD_ICON_LIMIT = 4;
const TOOLBELT_SLOTS_PER_SIDE = HUD_ICON_LIMIT;

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
    if (this.handleToolbeltClick(event)) {
      return;
    }
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

  handleToolbeltClick(event) {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return false;
    }

    const rawU = (event.clientX - rect.left) / rect.width;
    const rawV = (event.clientY - rect.top) / rect.height;
    const layout = computeSquareLayout(rect.width, rect.height);

    const insideVertical = rawV >= layout.playMinY && rawV <= layout.playMaxY;
    if (!insideVertical) {
      return false;
    }

    const gutterLeft = layout.gutterLeft;
    const gutterRight = layout.gutterRight;

    let isRight = false;
    let railU = 0;
    let railV = (rawV - layout.playMinY) / layout.playSizeY;

    if (gutterLeft > 0 && rawU < layout.playMinX) {
      railU = gutterLeft > 0 ? rawU / gutterLeft : 0;
    } else if (gutterRight > 0 && rawU > layout.playMaxX) {
      isRight = true;
      railU = gutterRight > 0 ? (rawU - layout.playMaxX) / gutterRight : 0;
    } else {
      return false;
    }

    if (!Number.isFinite(railU) || !Number.isFinite(railV)) {
      return false;
    }

    const u = Math.min(Math.max(railU, 0), 1);
    const v = Math.min(Math.max(railV, 0), 1);

    const row = Math.floor(v * HUD_ICON_LIMIT);
    const clampedRow = Math.min(Math.max(row, 0), HUD_ICON_LIMIT - 1);

    const baseIndex = isRight ? TOOLBELT_SLOTS_PER_SIDE : 0;
    const slotIndex = baseIndex + clampedRow;
    this.state.setActiveSlot(slotIndex);
    return true;
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
    if (key === 'q' || key === 'Q') {
      if (this.state && typeof this.state.setViewMode === 'function') {
        this.state.setViewMode(0);
      }
    } else if (key === 'w' || key === 'W') {
      if (this.state && typeof this.state.setViewMode === 'function') {
        this.state.setViewMode(1);
      }
    } else if (key === 'e' || key === 'E') {
      if (this.state && typeof this.state.setViewMode === 'function') {
        this.state.setViewMode(2);
      }
    } else if (key === 'r' || key === 'R') {
      if (this.state && typeof this.state.setViewMode === 'function') {
        this.state.setViewMode(3);
      }
    } else if (key >= '1' && key <= '8') {
      const slotIndex = parseInt(key, 10) - 1;
      this.state.setActiveSlot(slotIndex);
    } else if (key === 'a' || key === 'A') {
      this.state.shiftActiveSlot(-1);
    } else if (key === 'd' || key === 'D') {
      this.state.shiftActiveSlot(1);
    } else if (key === 'f' || key === 'F') {
      this.state.attemptDropFertilizerAtPointer();
    }
  }
}
