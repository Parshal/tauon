const SHADER_URLS = {
  vertex: new URL('../shaders/fullscreen.vert.glsl', import.meta.url),
  star: new URL('../shaders/stars.frag.glsl', import.meta.url),
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
  const [vertex, star, composite] = await Promise.all([
    fetchShader(SHADER_URLS.vertex),
    fetchShader(SHADER_URLS.star),
    fetchShader(SHADER_URLS.composite),
  ]);

  return { vertex, star, composite };
}
