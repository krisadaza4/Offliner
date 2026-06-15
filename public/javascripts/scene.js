/* ============================================================
   Atmospheric background — three.js fragment-shader clouds
   Drifting FBM mist over a sky→haze gradient, with gentle
   mouse parallax. Falls back to the CSS gradient if WebGL or
   reduced-motion is unavailable.
   ============================================================ */
(function () {
  "use strict";

  var canvas = document.getElementById("bg-canvas");
  if (!canvas || typeof THREE === "undefined") return;

  var reduceMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false, alpha: true });
  } catch (e) {
    canvas.style.display = "none"; // CSS gradient remains as fallback
    return;
  }
  renderer.setClearColor(0x000000, 0);

  var scene = new THREE.Scene();
  var camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  var uniforms = {
    u_time:   { value: 0 },
    u_res:    { value: new THREE.Vector2(1, 1) },
    u_mouse:  { value: new THREE.Vector2(0.5, 0.5) },
    u_scroll: { value: 0 }
  };

  var vert = [
    "varying vec2 vUv;",
    "void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }"
  ].join("\n");

  var frag = [
    "precision highp float;",
    "varying vec2 vUv;",
    "uniform vec2  u_res;",
    "uniform float u_time;",
    "uniform vec2  u_mouse;",
    "uniform float u_scroll;",

    "float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }",

    "float noise(vec2 p){",
    "  vec2 i = floor(p); vec2 f = fract(p);",
    "  vec2 u = f * f * (3.0 - 2.0 * f);",
    "  return mix(mix(hash(i), hash(i + vec2(1.0,0.0)), u.x),",
    "             mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);",
    "}",

    "float fbm(vec2 p){",
    "  float v = 0.0; float a = 0.5;",
    "  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);",
    "  for(int i = 0; i < 6; i++){ v += a * noise(p); p = m * p; a *= 0.5; }",
    "  return v;",
    "}",

    "void main(){",
    "  vec2 uv = gl_FragCoord.xy / u_res.xy;",
    "  float aspect = u_res.x / u_res.y;",
    "  vec2 p = uv; p.x *= aspect;",

    // sky gradient (top deeper blue -> bottom soft haze)
    "  vec3 skyTop = vec3(0.560, 0.706, 0.886);",
    "  vec3 skyMid = vec3(0.745, 0.847, 0.945);",
    "  vec3 skyLow = vec3(0.937, 0.965, 0.992);",
    "  float g = smoothstep(0.0, 0.85, uv.y);",
    "  vec3 col = mix(skyLow, skyMid, smoothstep(0.0, 0.6, uv.y));",
    "  col = mix(col, skyTop, smoothstep(0.55, 1.0, uv.y));",

    // drifting domain-warped clouds
    "  float t = u_time * 0.02;",
    "  vec2 mo = (u_mouse - 0.5) * 0.18;",
    "  vec2 q = vec2(fbm(p * 1.5 + vec2(t, 0.0) + mo),",
    "               fbm(p * 1.5 + vec2(5.2, 1.3) - t));",
    "  vec2 r = vec2(fbm(p * 1.5 + 1.8 * q + vec2(1.7, 9.2) + t * 0.6),",
    "               fbm(p * 1.5 + 1.8 * q + vec2(8.3, 2.8) - t * 0.6));",
    "  float clouds = fbm(p * 1.6 + 2.0 * r + vec2(t * 1.4, -t));",

    // keep clouds toward upper portion, thinning near the misty bottom
    "  float band = smoothstep(0.15, 0.95, uv.y + u_scroll * 0.15);",
    "  float density = smoothstep(0.42, 0.95, clouds) * band;",
    "  vec3 cloudCol = mix(vec3(0.98), vec3(1.0), clouds);",
    "  col = mix(col, cloudCol, density * 0.85);",

    // soft horizon haze + subtle radial light from upper-left
    "  float haze = smoothstep(0.5, 0.0, uv.y);",
    "  col = mix(col, vec3(0.965, 0.984, 1.0), haze * 0.55);",
    "  float light = 1.0 - distance(uv, vec2(0.28, 0.85)) * 0.55;",
    "  col += vec3(0.05, 0.06, 0.08) * clamp(light, 0.0, 1.0);",

    // gentle vignette
    "  float vig = smoothstep(1.25, 0.25, distance(uv, vec2(0.5)));",
    "  col *= mix(0.92, 1.0, vig);",

    "  gl_FragColor = vec4(col, 1.0);",
    "}"
  ].join("\n");

  var material = new THREE.ShaderMaterial({
    uniforms: uniforms,
    vertexShader: vert,
    fragmentShader: frag,
    depthTest: false,
    depthWrite: false
  });

  var quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  scene.add(quad);

  function resize() {
    var w = window.innerWidth || document.documentElement.clientWidth || 1;
    var h = window.innerHeight || document.documentElement.clientHeight || 1;
    var dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    uniforms.u_res.value.set(w * dpr, h * dpr);
    // keep the static (reduced-motion) frame correct after any resize
    if (reduceMotion) renderer.render(scene, camera);
  }
  resize();
  window.addEventListener("resize", resize, { passive: true });

  // smooth mouse parallax
  var mx = 0.5, my = 0.5, tx = 0.5, ty = 0.5;
  window.addEventListener("mousemove", function (e) {
    tx = e.clientX / window.innerWidth;
    ty = 1.0 - e.clientY / window.innerHeight;
  }, { passive: true });

  window.addEventListener("scroll", function () {
    var max = document.body.scrollHeight - window.innerHeight;
    uniforms.u_scroll.value = max > 0 ? Math.min(window.scrollY / max, 1) : 0;
  }, { passive: true });

  var start = performance.now();
  var running = true;

  function render(now) {
    if (!running) return;
    uniforms.u_time.value = (now - start) / 1000;
    mx += (tx - mx) * 0.05;
    my += (ty - my) * 0.05;
    uniforms.u_mouse.value.set(mx, my);
    renderer.render(scene, camera);
    requestAnimationFrame(render);
  }

  if (reduceMotion) {
    // render a static frame (no loop). rAF guarantees layout is settled,
    // and resize() re-renders if the viewport changes afterwards.
    uniforms.u_time.value = 12.0;
    requestAnimationFrame(function () { resize(); renderer.render(scene, camera); });
  } else {
    requestAnimationFrame(render);
    // pause when tab hidden to save the GPU
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        running = false;
      } else if (!running) {
        running = true;
        requestAnimationFrame(render);
      }
    });
  }
})();
