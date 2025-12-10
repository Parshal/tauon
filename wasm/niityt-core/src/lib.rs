use wasm_bindgen::prelude::*;

const WIDTH: u32 = 128;
const HEIGHT: u32 = 128;
const CONTROL_COST: f32 = 12.0;
const ENERGY_CAP: f32 = 120.0;
const BASE_CHARGE_RATE: f32 = 6.0;
const SPREAD_SAMPLES: f32 = 60.0;

#[wasm_bindgen]
pub struct GameConfig {
    seed: u32,
}

struct Rng {
    state: u32,
}

impl Rng {
    fn new(seed: u32) -> Self {
        let mut state = seed;
        if state == 0 {
            state = 0x1234_5678;
        }
        Self { state }
    }

    fn next_u32(&mut self) -> u32 {
        let mut x = self.state;
        x ^= x << 13;
        x ^= x >> 17;
        x ^= x << 5;
        self.state = x;
        x
    }

    fn next_f32(&mut self) -> f32 {
        (self.next_u32() as f32) / (u32::MAX as f32)
    }
}

#[wasm_bindgen]
pub struct GameState {
    width: u32,
    height: u32,
    control_band_height: u32,
    energy: f32,
    time: f32,
    grid: Vec<u8>,
    claimed: Vec<u32>,
    rng: Rng,
}

#[wasm_bindgen]
impl GameState {
    #[wasm_bindgen(constructor)]
    pub fn new(config: GameConfig) -> GameState {
        console_error_panic_hook::set_once();
        let width = WIDTH;
        let height = HEIGHT;
        let control_band_height = (height as f32 * 0.08).round() as u32;
        let energy = CONTROL_COST * 1.5;
        GameState {
            width,
            height,
            control_band_height,
            energy,
            time: 0.0,
            grid: vec![0; (width * height) as usize],
            claimed: Vec::new(),
            rng: Rng::new(config.seed),
        }
    }

    pub fn width(&self) -> u32 {
        self.width
    }

    pub fn height(&self) -> u32 {
        self.height
    }

    pub fn grid_ptr(&self) -> *const u8 {
        self.grid.as_ptr()
    }

    pub fn tick(&mut self, dt: f32) {
        let delta = dt.max(0.0);
        self.time += delta;
        let claimed_count = self.claimed.len() as f32;
        let bonus = 1.0 + claimed_count * 0.004;
        let gain = delta * BASE_CHARGE_RATE * bonus;
        self.energy = (self.energy + gain).min(ENERGY_CAP);

        let iterations = (SPREAD_SAMPLES * delta * bonus).max(1.0).floor() as u32;
        self.spread(iterations);
        self.heal_claimed(delta);
    }

    pub fn place_control(&mut self, x: u32, y: u32) -> bool {
        if x >= self.width || y >= self.height {
            return false;
        }
        let band_start = self.height.saturating_sub(self.control_band_height);
        if y < band_start {
            return false;
        }
        if self.energy < CONTROL_COST {
            return false;
        }

        let idx = self.index_from_coord(x, y);
        if self.grid[idx] != 0 {
            return false;
        }

        self.energy -= CONTROL_COST;
        self.grid[idx] = 255;
        self.claimed.push((y * self.width) + x);
        true
    }

    pub fn band_height_norm(&self) -> f32 {
        (self.control_band_height as f32 / self.height as f32).clamp(0.0, 1.0)
    }

    pub fn energy_norm(&self) -> f32 {
        (self.energy / ENERGY_CAP).clamp(0.0, 1.0)
    }

    pub fn time_seconds(&self) -> f32 {
        self.time
    }
}

impl GameState {
    fn index_from_coord(&self, x: u32, y: u32) -> usize {
        (y * self.width + x) as usize
    }

    fn coord_from_index(&self, index: u32) -> (u32, u32) {
        let x = index % self.width;
        let y = index / self.width;
        (x, y)
    }

    fn heal_claimed(&mut self, dt: f32) {
        if self.claimed.is_empty() {
            return;
        }
        let increment = (dt * 90.0).clamp(0.0, 6.0);
        if increment <= 0.0 {
            return;
        }
        for &index in &self.claimed {
            let idx = self.index_from_coord(index % self.width, index / self.width);
            let current = self.grid[idx] as f32;
            if current > 0.0 {
                let updated = (current + increment).min(255.0);
                self.grid[idx] = updated as u8;
            }
        }
    }

    fn spread(&mut self, iterations: u32) {
        if self.claimed.is_empty() {
            return;
        }
        for _ in 0..iterations {
            let Some(source_index) = self.random_claimed_index() else { continue };
            let source_coord = self.coord_from_index(source_index);
            let idx = self.index_from_coord(source_coord.0, source_coord.1);
            let source_value = self.grid[idx];
            if source_value == 0 {
                continue;
            }
            let Some(target_index) = self.random_neighbor(source_index) else { continue };
            let target_coord = self.coord_from_index(target_index);
            let target_idx = self.index_from_coord(target_coord.0, target_coord.1);
            let current_value = self.grid[target_idx];
            if current_value == 0 {
                if self.rng.next_f32() < 0.35 {
                    let spread_value = (source_value as i32 - 24).clamp(24, 255) as u8;
                    self.grid[target_idx] = spread_value;
                    self.claimed.push(target_index);
                }
            } else if self.rng.next_f32() < 0.1 {
                let boosted = (current_value as i32 + 4).clamp(0, 255) as u8;
                self.grid[target_idx] = boosted;
            }
        }
    }

    fn random_claimed_index(&mut self) -> Option<u32> {
        if self.claimed.is_empty() {
            return None;
        }
        let len = self.claimed.len() as u32;
        let choice = (self.rng.next_u32() % len) as usize;
        self.claimed.get(choice).copied()
    }

    fn random_neighbor(&mut self, index: u32) -> Option<u32> {
        let (x, y) = self.coord_from_index(index);
        let mut count = 0;
        let mut neighbors = [0u32; 4];
        let positions = [
            (x.wrapping_sub(1), y, x > 0),
            (x + 1, y, x + 1 < self.width),
            (x, y.wrapping_sub(1), y > 0),
            (x, y + 1, y + 1 < self.height),
        ];
        for (nx, ny, valid) in positions {
            if !valid {
                continue;
            }
            neighbors[count] = ny * self.width + nx;
            count += 1;
        }
        if count == 0 {
            return None;
        }
        let count_u32 = count as u32;
        let choice = (self.rng.next_u32() % count_u32) as usize;
        Some(neighbors[choice])
    }
}

#[wasm_bindgen]
impl GameConfig {
    #[wasm_bindgen(constructor)]
    pub fn new(seed: u32) -> GameConfig {
        GameConfig { seed }
    }
}
