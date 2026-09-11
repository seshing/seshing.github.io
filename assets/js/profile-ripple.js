// A standalone WebGL ripple grid inspired by reactbits.dev/backgrounds/ripple-grid.
// No React runtime is needed; the grid is decorative and has a CSS fallback.
(() => {
  const stage = document.querySelector('[data-profile-ripple]');
  if (!stage) return;
  const backdrop = stage.querySelector('.profile-ripple');
  const canvas = backdrop.querySelector('canvas');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const gl = canvas.getContext('webgl', { alpha: true, antialias: false });
  if (!gl) return;

  const vertexSource = `
    attribute vec2 position;
    void main() { gl_Position = vec4(position, 0.0, 1.0); }
  `;
  const fragmentSource = `
    precision mediump float;
    uniform vec2 resolution;
    uniform float time;
    uniform vec2 pointer;
    uniform float influence;
    uniform vec3 ink;
    void main() {
      vec2 uv = gl_FragCoord.xy / resolution;
      vec2 p = (uv - 0.5) * vec2(resolution.x / resolution.y, 1.0);
      float radius = length(p);
      vec2 warped = p * (1.0 + 0.045 * sin(radius * 15.0 - time));
      vec2 delta = p - pointer;
      float distance = length(delta);
      warped += delta / max(distance, 0.01) * 0.018 * influence
        * sin(distance * 22.0 - time * 1.6) * exp(-distance * 4.0);
      vec2 cell = abs(fract(warped * 12.0 + 0.5) - 0.5);
      float edge = min(cell.x, cell.y);
      float pixel = 12.0 / resolution.y;
      float line = 1.0 - smoothstep(pixel * 0.35, pixel * 1.5, edge);
      float glow = exp(-edge * 30.0) * 0.12;
      float fade = 1.0 - smoothstep(0.25, 0.76, length((uv - 0.5) * vec2(1.0, 1.25)));
      float alpha = (line * 0.75 + glow) * fade;
      gl_FragColor = vec4(ink * alpha, alpha);
    }
  `;
  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }
  const vertex = compile(gl.VERTEX_SHADER, vertexSource);
  const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
  if (!vertex || !fragment) return;
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const uniforms = Object.fromEntries(
    ['resolution', 'time', 'pointer', 'influence', 'ink'].map(name => [name, gl.getUniformLocation(program, name)])
  );
  let frame = 0;
  let visible = false;
  let lost = false;
  let elapsed = 0;
  let lastTime = 0;
  let strength = 0;
  let targetStrength = 0;
  let pointer = [0, 0];
  let targetPointer = [0, 0];
  let ink = [0.45, 0.45, 0.45];

  function draw() {
    if (lost) return;
    gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
    gl.uniform1f(uniforms.time, elapsed * 0.75);
    gl.uniform2fv(uniforms.pointer, pointer);
    gl.uniform1f(uniforms.influence, reducedMotion.matches ? 0 : strength);
    gl.uniform3fv(uniforms.ink, ink);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function animate(now) {
    elapsed += lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0;
    lastTime = now;
    pointer = pointer.map((value, i) => value + (targetPointer[i] - value) * 0.08);
    strength += (targetStrength - strength) * 0.06;
    draw();
    frame = requestAnimationFrame(animate);
  }
  function syncAnimation() {
    cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
    if (lost) return;
    draw();
    if (visible && !document.hidden && !reducedMotion.matches) {
      frame = requestAnimationFrame(animate);
    }
  }
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.max(1, Math.round(backdrop.clientWidth * dpr));
    canvas.height = Math.max(1, Math.round(backdrop.clientHeight * dpr));
    gl.viewport(0, 0, canvas.width, canvas.height);
    draw();
  }
  function updateTheme() {
    const value = document.documentElement.classList.contains('dark') ? 0.83 : 0.45;
    ink = [value, value, value];
    draw();
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(backdrop);
  const visibilityObserver = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    syncAnimation();
  });
  visibilityObserver.observe(stage);
  const themeObserver = new MutationObserver(updateTheme);
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  stage.addEventListener('pointermove', event => {
    if (reducedMotion.matches || event.pointerType === 'touch') return;
    const rect = backdrop.getBoundingClientRect();
    targetPointer = [(event.clientX - rect.left - rect.width / 2) / rect.height,
      0.5 - (event.clientY - rect.top) / rect.height];
    targetStrength = 1;
  });
  stage.addEventListener('pointerleave', () => { targetStrength = 0; });
  reducedMotion.addEventListener('change', syncAnimation);
  document.addEventListener('visibilitychange', syncAnimation);
  window.addEventListener('pagehide', () => { cancelAnimationFrame(frame); lastTime = 0; });
  window.addEventListener('pageshow', syncAnimation);
  canvas.addEventListener('webglcontextlost', () => {
    lost = true;
    cancelAnimationFrame(frame);
    backdrop.classList.remove('is-ready');
  });
  resize();
  updateTheme();
  backdrop.classList.add('is-ready');
})();
