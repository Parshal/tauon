import { getDefaults } from '../data/config.js';

class State {
  constructor() {
    this.data = getDefaults();
    this.listeners = new Set();
  }

  get(key) {
    return this.data[key];
  }

  set(key, value) {
    this.data[key] = value;
    this.notify();
  }

  // Bulk update without notifying every single time
  setAll(obj) {
    this.data = { ...this.data, ...obj };
    this.notify();
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify() {
    this.listeners.forEach(cb => cb(this.data));
  }
}

export const store = new State();
