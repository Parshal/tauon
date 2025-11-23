const SHADER_URLS = {
  vertex: new URL('../shaders/fullscreen.vert.glsl', import.meta.url),
  nebula: new URL('../shaders/nebula.frag.glsl', import.meta.url),
  star: new URL('../shaders/star.frag.glsl', import.meta.url),
  star2: new URL('../shaders/star2.frag.glsl', import.meta.url),
  membrane: new URL('../shaders/membrane.frag.glsl', import.meta.url),
  composite: new URL('../shaders/composite.frag.glsl', import.meta.url),
};

const shaderCache = new Map();

function fetchShader(url) {
  const key = url.href;
  if (!shaderCache.has(key)) {
    const promise = fetch(url)
      .then((resp) => {
        if (!resp.ok) {
          throw new Error(`Failed to load shader ${url.pathname}: ${resp.status}`);
        }
        return resp.text();
      })
      .catch((err) => {
        shaderCache.delete(key);
        throw err;
      });
    shaderCache.set(key, promise);
  }
  return shaderCache.get(key);
}

export async function loadShaderSources() {
  const [vertex, nebula, star, star2, membrane, composite] = await Promise.all([
    fetchShader(SHADER_URLS.vertex),
    fetchShader(SHADER_URLS.nebula),
    fetchShader(SHADER_URLS.star),
    fetchShader(SHADER_URLS.star2),
    fetchShader(SHADER_URLS.membrane),
    fetchShader(SHADER_URLS.composite),
  ]);

  return { vertex, nebula, star, star2, membrane, composite };
}
