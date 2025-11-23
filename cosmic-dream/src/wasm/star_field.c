#include <stdint.h>
#include <stddef.h>

void *memset(void *dest, int value, size_t count) {
    unsigned char *ptr = (unsigned char *)dest;
    unsigned char byte = (unsigned char)value;
    for (size_t i = 0; i < count; i++) {
        ptr[i] = byte;
    }
    return dest;
}

#define MAX_LAYERS 4
#define LAYER_INFO_COMPONENTS 4
#define STAR_DESCRIPTOR_FLOATS 12
#define MAX_STARS 20000
#define MAX_STARS_PER_CELL 8
#define MAX_CELLS (24 * 24 + 36 * 36 + 48 * 48 + 64 * 64)
#define MAX_LOCAL_IDS MAX_STARS
#define MAX_SPILL_IDS (MAX_STARS * 24)

typedef struct {
    float scale;
    uint32_t cells;
} LayerSpec;

static const LayerSpec LAYER_SPECS[MAX_LAYERS] = {
    { 9.0f, 24 },
    { 18.0f, 36 },
    { 32.0f, 48 },
    { 54.0f, 64 },
};

static float star_descriptors[MAX_STARS * STAR_DESCRIPTOR_FLOATS];
static uint32_t local_offsets[MAX_CELLS];
static uint32_t local_counts[MAX_CELLS];
static uint32_t spill_offsets[MAX_CELLS];
static uint32_t spill_counts[MAX_CELLS];
static uint32_t local_ids[MAX_LOCAL_IDS];
static uint32_t spill_ids[MAX_SPILL_IDS];
static uint32_t spill_targets[MAX_SPILL_IDS];
static uint32_t spill_star_buffer[MAX_SPILL_IDS];
static uint32_t spill_write_heads[MAX_CELLS];
static float layer_info[MAX_LAYERS * LAYER_INFO_COMPONENTS];

static uint32_t star_count = 0;
static uint32_t local_id_count = 0;
static uint32_t spill_id_count = 0;
static uint32_t local_drop_count = 0;
static uint32_t spill_drop_count = 0;
static uint32_t layer_count = MAX_LAYERS;
static uint32_t cell_count = 0;
static uint8_t layer_info_initialized = 0;

static inline uint32_t mix_seed(uint32_t value) {
    value ^= value << 13;
    value ^= value >> 17;
    value ^= value << 5;
    return value;
}

static inline float rand_unit(uint32_t seed) {
    uint32_t mixed = mix_seed(seed);
    return (float)(mixed & 0x00FFFFFFu) / 16777215.0f;
}

static inline float mixf(float a, float b, float t) {
    return a + (b - a) * t;
}

static inline float clampf(float v, float minV, float maxV) {
    return v < minV ? minV : (v > maxV ? maxV : v);
}

static inline uint32_t wrap_index(int32_t value, uint32_t span) {
    int32_t mod = value % (int32_t)span;
    return (uint32_t)(mod < 0 ? mod + (int32_t)span : mod);
}

static void zero_u32(uint32_t* ptr, uint32_t count) {
    for (uint32_t i = 0; i < count; i++) {
        ptr[i] = 0;
    }
}

static void init_layer_info(void) {
    if (layer_info_initialized) return;
    cell_count = 0;
    for (uint32_t i = 0; i < MAX_LAYERS; i++) {
        const LayerSpec spec = LAYER_SPECS[i];
        uint32_t cells = spec.cells;
        uint32_t layer_cells = cells * cells;
        uint32_t base = i * LAYER_INFO_COMPONENTS;
        layer_info[base + 0] = (float)cells;
        layer_info[base + 1] = cells > 0 ? 1.0f / (float)cells : 1.0f;
        layer_info[base + 2] = spec.scale;
        layer_info[base + 3] = (float)cell_count;
        cell_count += layer_cells;
    }
    layer_info_initialized = 1;
}

static void push_id(
    uint32_t cell_index,
    uint32_t value,
    uint32_t* ids,
    uint32_t* count_ptr,
    uint32_t* offsets,
    uint32_t* counts,
    uint32_t max_ids,
    uint32_t* drop_counter
) {
    uint32_t current = *count_ptr;
    if (current >= max_ids) {
        if (drop_counter) {
            *drop_counter += 1;
        }
        return;
    }
    if (counts[cell_index] == 0) {
        offsets[cell_index] = current;
    }
    ids[current] = value;
    counts[cell_index] += 1;
    *count_ptr = current + 1;
}

static void record_spill(uint32_t cell_index, uint32_t star_id) {
    if (cell_index >= cell_count) {
        return;
    }
    if (spill_id_count >= MAX_SPILL_IDS) {
        spill_drop_count += 1;
        return;
    }
    spill_targets[spill_id_count] = cell_index;
    spill_star_buffer[spill_id_count] = star_id;
    spill_counts[cell_index] += 1;
    spill_id_count += 1;
}

static void finalize_spill_lists(void) {
    uint32_t running = 0;
    for (uint32_t i = 0; i < cell_count; i++) {
        spill_offsets[i] = running;
        spill_write_heads[i] = 0;
        running += spill_counts[i];
    }
    if (running > MAX_SPILL_IDS) {
        running = MAX_SPILL_IDS;
    }
    for (uint32_t i = 0; i < spill_id_count; i++) {
        uint32_t cell_index = spill_targets[i];
        if (cell_index >= cell_count) continue;
        uint32_t head = spill_write_heads[cell_index];
        uint32_t dest = spill_offsets[cell_index] + head;
        spill_write_heads[cell_index] = head + 1;
        if (dest < MAX_SPILL_IDS) {
            spill_ids[dest] = spill_star_buffer[i];
        }
    }
    spill_id_count = running;
}

static float compute_size(float seed, float softness) {
    float curve = seed * seed;
    float shaped = mixf(curve, seed, softness);
    return mixf(0.012f, 0.08f, shaped);
}

__attribute__((export_name("generate_star_field")))
void generate_star_field(float density, float softness, float glow, float hero_bias, float time) {
    (void)time;
    init_layer_info();

    zero_u32(local_counts, cell_count);
    zero_u32(spill_counts, cell_count);

    star_count = 0;
    local_id_count = 0;
    spill_id_count = 0;
    local_drop_count = 0;
    spill_drop_count = 0;

    float density_norm = clampf(density / 200.0f, 0.0f, 1.0f);
    float glow_mix = clampf(glow / 2.0f, 0.0f, 1.0f);
    float heroChance = mixf(0.01f, 0.08f, clampf(hero_bias / 1.2f, 0.0f, 1.0f));

    uint32_t cell_base = 0;
    for (uint32_t layer = 0; layer < MAX_LAYERS; layer++) {
        const LayerSpec spec = LAYER_SPECS[layer];
        uint32_t cells = spec.cells;
        for (uint32_t y = 0; y < cells; y++) {
            for (uint32_t x = 0; x < cells; x++) {
                uint32_t cellIndex = cell_base + y * cells + x;
                uint32_t hashSeed = layer * 73856093u ^ x * 19349663u ^ y * 83492791u;
                float variance = rand_unit(hashSeed + 0x9e3779b9u);
                float budgetF = density_norm * 3.0f + variance * 2.3f;
                uint32_t budget = (uint32_t)budgetF;
                if (budget > MAX_STARS_PER_CELL) budget = MAX_STARS_PER_CELL;
                if (budget == 0) continue;

                for (uint32_t s = 0; s < budget; s++) {
                    if (star_count >= MAX_STARS) break;
                    uint32_t starSeed = hashSeed + s * 374761393u + 0x7feb352du;
                    float jitterX = rand_unit(starSeed + 0x68bc21ebu) - 0.5f;
                    float jitterY = rand_unit(starSeed + 0x0284589fu) - 0.5f;
                    jitterX *= 0.9f;
                    jitterY *= 0.9f;
                    float heroRand = rand_unit(starSeed + 0x1badf00du);
                    uint32_t isHero = heroRand < heroChance ? 1u : 0u;
                    float sizeSeed = rand_unit(starSeed + 0x1234567u);
                    float baseSize = compute_size(sizeSeed, clampf(softness, 0.0f, 1.0f));
                    float size = isHero ? baseSize * mixf(1.35f, 2.2f, hero_bias) : baseSize;
                    float coreScale = isHero ? mixf(1.3f, 2.1f, glow_mix) : mixf(0.9f, 1.5f, glow_mix);
                    float haloScale = isHero ? mixf(2.0f, 3.4f, glow_mix) : mixf(1.4f, 2.4f, glow_mix);
                    float sparklePhase = rand_unit(starSeed + 0x5151f00fu) * 6.28318f;
                    float intensity = isHero ? 1.15f : 0.85f;
                    float tintSeed = rand_unit(starSeed + 0x0cc0ffeeu);
                    float tintR = mixf(0.82f, 1.0f, tintSeed);
                    float tintG = mixf(0.92f, 0.82f, tintSeed);
                    float tintB = mixf(1.0f, 0.7f, tintSeed);

                    float cellsF = (float)cells;
                    float px = ((float)x + 0.5f + jitterX) / cellsF - 0.5f;
                    float py = ((float)y + 0.5f + jitterY) / cellsF - 0.5f;
                    float worldX = px * spec.scale;
                    float worldY = py * spec.scale;
                    float localX = 0.5f + jitterX;
                    float localY = 0.5f + jitterY;

                    uint32_t descriptorOffset = star_count * STAR_DESCRIPTOR_FLOATS;
                    star_descriptors[descriptorOffset + 0] = worldX;
                    star_descriptors[descriptorOffset + 1] = worldY;
                    star_descriptors[descriptorOffset + 2] = (float)layer;
                    star_descriptors[descriptorOffset + 3] = size;
                    star_descriptors[descriptorOffset + 4] = coreScale;
                    star_descriptors[descriptorOffset + 5] = haloScale;
                    star_descriptors[descriptorOffset + 6] = tintR;
                    star_descriptors[descriptorOffset + 7] = tintG;
                    star_descriptors[descriptorOffset + 8] = tintB;
                    star_descriptors[descriptorOffset + 9] = sparklePhase;
                    star_descriptors[descriptorOffset + 10] = intensity;
                    star_descriptors[descriptorOffset + 11] = (float)isHero;

                    push_id(cellIndex, star_count, local_ids, &local_id_count, local_offsets, local_counts, MAX_LOCAL_IDS, &local_drop_count);

                    float worldToCell = spec.scale > 0.0f ? ((float)cells) / spec.scale : 1.0f;
                    float rawSpill = size * haloScale * worldToCell * 4.0f;
                    if (rawSpill > 0.0f) {
                        if (rawSpill > 2.0f) rawSpill = 2.0f;
                        int32_t spillRadius = (int32_t)rawSpill;
                        if ((float)spillRadius < rawSpill) {
                            spillRadius += 1;
                        }
                        if (spillRadius > 0) {
                            for (int32_t dy = -spillRadius; dy <= spillRadius; dy++) {
                                for (int32_t dx = -spillRadius; dx <= spillRadius; dx++) {
                                    if (dx == 0 && dy == 0) continue;
                                    uint32_t nx = wrap_index((int32_t)x + dx, cells);
                                    uint32_t ny = wrap_index((int32_t)y + dy, cells);
                                    uint32_t neighborIndex = cell_base + ny * cells + nx;
                                    record_spill(neighborIndex, star_count);
                                }
                            }
                        }
                    }

                    star_count += 1;
                }
            }
        }
        cell_base += spec.cells * spec.cells;
    }

    finalize_spill_lists();
}

__attribute__((export_name("get_star_count")))
uint32_t get_star_count(void) {
    return star_count;
}

__attribute__((export_name("get_local_id_count")))
uint32_t get_local_id_count(void) {
    return local_id_count;
}

__attribute__((export_name("get_spill_id_count")))
uint32_t get_spill_id_count(void) {
    return spill_id_count;
}

__attribute__((export_name("get_local_drop_count")))
uint32_t get_local_drop_count(void) {
    return local_drop_count;
}

__attribute__((export_name("get_spill_drop_count")))
uint32_t get_spill_drop_count(void) {
    return spill_drop_count;
}

__attribute__((export_name("get_layer_count")))
uint32_t get_layer_count(void) {
    init_layer_info();
    return layer_count;
}

__attribute__((export_name("get_cell_count")))
uint32_t get_cell_count(void) {
    init_layer_info();
    return cell_count;
}

__attribute__((export_name("get_star_descriptor_ptr")))
uint32_t get_star_descriptor_ptr(void) {
    return (uint32_t)(uintptr_t)star_descriptors;
}

__attribute__((export_name("get_local_ids_ptr")))
uint32_t get_local_ids_ptr(void) {
    return (uint32_t)(uintptr_t)local_ids;
}

__attribute__((export_name("get_spill_ids_ptr")))
uint32_t get_spill_ids_ptr(void) {
    return (uint32_t)(uintptr_t)spill_ids;
}

__attribute__((export_name("get_local_offsets_ptr")))
uint32_t get_local_offsets_ptr(void) {
    return (uint32_t)(uintptr_t)local_offsets;
}

__attribute__((export_name("get_local_counts_ptr")))
uint32_t get_local_counts_ptr(void) {
    return (uint32_t)(uintptr_t)local_counts;
}

__attribute__((export_name("get_spill_offsets_ptr")))
uint32_t get_spill_offsets_ptr(void) {
    return (uint32_t)(uintptr_t)spill_offsets;
}

__attribute__((export_name("get_spill_counts_ptr")))
uint32_t get_spill_counts_ptr(void) {
    return (uint32_t)(uintptr_t)spill_counts;
}

__attribute__((export_name("get_layer_info_ptr")))
uint32_t get_layer_info_ptr(void) {
    init_layer_info();
    return (uint32_t)(uintptr_t)layer_info;
}
