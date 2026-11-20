// Solmar Heat — keyboard and mouse input.
// Tracks held keys, edge-triggered presses (cleared once per game step),
// the mouse position in screen space, and the mouse position in world space.

import { CONFIG } from './config.js';

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressedKeys = new Set();
    this.mouseX = CONFIG.VIEW_W / 2;
    this.mouseY = CONFIG.VIEW_H / 2;
    this.mouseDown = false;
    this.clicked = false;
    this.onFirstGesture = null;
    this._attach();
  }

  _attach() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      if (!e.repeat) this.pressedKeys.add(e.code);
      this.keys.add(e.code);
      if (this.onFirstGesture) this.onFirstGesture();
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
    window.addEventListener('blur', () => {
      // Losing the window must also release the mouse: otherwise a held
      // click keeps firing (or driving) after alt-tabbing back.
      this.keys.clear();
      this.mouseDown = false;
    });
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = CONFIG.VIEW_W / rect.width;
      const scaleY = CONFIG.VIEW_H / rect.height;
      this.mouseX = (e.clientX - rect.left) * scaleX;
      this.mouseY = (e.clientY - rect.top) * scaleY;
    });
    this.canvas.addEventListener('mousedown', (e) => {
      this.mouseDown = true;
      this.clicked = true;
      if (this.onFirstGesture) this.onFirstGesture();
    });
    window.addEventListener('mouseup', () => {
      this.mouseDown = false;
    });
  }

  down(code) {
    return this.keys.has(code);
  }

  // True only on the step right after the key went down. Consuming: the
  // first read takes the press, so one press is never acted on twice — a
  // slow frame that runs several steps used to read the same E press in
  // every step (steal a car, exit it, steal it again, once per extra step,
  // each steal adding a wanted star).
  pressed(code) {
    if (!this.pressedKeys.has(code)) return false;
    this.pressedKeys.delete(code);
    return true;
  }

  // Call once per step, after the world has read the presses.
  clearPressed() {
    this.pressedKeys.clear();
    this.clicked = false;
  }

  // Mouse position converted into world coordinates through the camera.
  mouseWorld(G) {
    return {
      x: this.mouseX + G.camera.x,
      y: this.mouseY + G.camera.y,
    };
  }
}
