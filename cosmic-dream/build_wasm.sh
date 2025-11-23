#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_FILE="$ROOT_DIR/src/wasm/star_field.c"
OUT_FILE="$ROOT_DIR/src/wasm/star_field.wasm"

if [[ ! -f "$SRC_FILE" ]]; then
  echo "Source file not found: $SRC_FILE" >&2
  exit 1
fi

EXPORTS=(
  "_generate_star_field"
  "_get_star_count"
  "_get_local_id_count"
  "_get_spill_id_count"
  "_get_local_drop_count"
  "_get_spill_drop_count"
  "_get_layer_count"
  "_get_cell_count"
  "_get_star_descriptor_ptr"
  "_get_local_ids_ptr"
  "_get_spill_ids_ptr"
  "_get_local_offsets_ptr"
  "_get_local_counts_ptr"
  "_get_spill_offsets_ptr"
  "_get_spill_counts_ptr"
  "_get_layer_info_ptr"
)

if command -v emcc >/dev/null 2>&1; then
  echo "[build] Using emcc"
  emcc "$SRC_FILE" -O3 -s STANDALONE_WASM=1 \
    -s EXPORTED_FUNCTIONS="[$(printf '%s,' "${EXPORTS[@]}") ]" \
    -s ERROR_ON_UNDEFINED_SYMBOLS=0 \
    -o "$OUT_FILE"
  exit 0
fi

if command -v clang >/dev/null 2>&1; then
  echo "[build] Using clang --target=wasm32"
  export_flags=()
  for fn in "${EXPORTS[@]}"; do
    export_flags+=("-Wl,--export=$(echo "$fn" | sed 's/^_//')")
  done
  clang --target=wasm32 -O3 -nostdlib -Wl,--no-entry -Wl,--allow-undefined \
    "${export_flags[@]}" "$SRC_FILE" -o "$OUT_FILE"
  exit 0
fi

echo "Neither emcc nor clang (with wasm target) was found in PATH." >&2
exit 1
