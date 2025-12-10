/* tslint:disable */
/* eslint-disable */

export class GameConfig {
  free(): void;
  [Symbol.dispose](): void;
  constructor(seed: number);
}

export class GameState {
  free(): void;
  [Symbol.dispose](): void;
  energy_norm(): number;
  time_seconds(): number;
  place_control(x: number, y: number): boolean;
  band_height_norm(): number;
  constructor(config: GameConfig);
  tick(dt: number): void;
  width(): number;
  height(): number;
  grid_ptr(): number;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_gameconfig_free: (a: number, b: number) => void;
  readonly __wbg_gamestate_free: (a: number, b: number) => void;
  readonly gamestate_band_height_norm: (a: number) => number;
  readonly gamestate_energy_norm: (a: number) => number;
  readonly gamestate_grid_ptr: (a: number) => number;
  readonly gamestate_height: (a: number) => number;
  readonly gamestate_new: (a: number) => number;
  readonly gamestate_place_control: (a: number, b: number, c: number) => number;
  readonly gamestate_tick: (a: number, b: number) => void;
  readonly gamestate_time_seconds: (a: number) => number;
  readonly gamestate_width: (a: number) => number;
  readonly gameconfig_new: (a: number) => number;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_externrefs: WebAssembly.Table;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
