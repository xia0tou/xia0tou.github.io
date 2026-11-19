/* ============================================================
   背景着色器 —— 流动的极光幕布
   基于域扭曲 fbm 噪声，低亮度、低饱和，保证正文可读性。
   特性：30fps 限帧、隐藏时暂停、降低动态偏好时静态渲染、
        无 WebGL 时退回 CSS 渐变。
   ============================================================ */
(function () {
  "use strict";

  var canvas = document.getElementById("bg-canvas");
  if (!canvas) return;

  var body = document.body;
  var gl =
    canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "low-power",
    }) || canvas.getContext("experimental-webgl");

  if (!gl) {
    body.classList.add("no-shader");
    canvas.parentNode && canvas.parentNode.removeChild(canvas);
    return;
  }

  var VERT = [
    "attribute vec2 a_pos;",
    "void main(){ gl_Position = vec4(a_pos, 0.0, 1.0); }",
  ].join("\n");

  var FRAG = [
    "precision highp float;",
    "uniform vec2 u_res;",
    "uniform float u_time;",
    "uniform float u_light;",
    "uniform vec2 u_mouse;",
    "",
    "float hash21(vec2 p){",
    "  p = fract(p * vec2(123.34, 456.21));",
    "  p += dot(p, p + 45.32);",
    "  return fract(p.x * p.y);",
    "}",
    "",
    "float noise(vec2 p){",
    "  vec2 i = floor(p);",
    "  vec2 f = fract(p);",
    "  vec2 u = f * f * (3.0 - 2.0 * f);",
    "  float a = hash21(i);",
    "  float b = hash21(i + vec2(1.0, 0.0));",
    "  float c = hash21(i + vec2(0.0, 1.0));",
    "  float d = hash21(i + vec2(1.0, 1.0));",
    "  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);",
    "}",
    "",
    "float fbm(vec2 p){",
    "  float v = 0.0;",
    "  float a = 0.5;",
    "  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);",
    "  for (int i = 0; i < 5; i++) {",
    "    v += a * noise(p);",
    "    p = m * p;",
    "    a *= 0.5;",
    "  }",
    "  return v;",
    "}",
    "",
    "void main(){",
    "  vec2 res = u_res;",
    "  vec2 uv = (gl_FragCoord.xy - 0.5 * res) / res.y;",
    "  float t = u_time * 0.045;",
    "",
    "  vec2 p = uv * 1.45;",
    "  p += u_mouse * 0.10;",
    "  p.x += 0.10 * sin(uv.y * 1.6 + t * 0.9);",
    "",
    "  vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, 1.3) - t));",
    "  vec2 r = vec2(",
    "    fbm(p + 2.0 * q + vec2(1.7, 9.2) + t * 0.7),",
    "    fbm(p + 2.0 * q + vec2(8.3, 2.8) - t * 0.6)",
    "  );",
    "  float f = fbm(p + 2.4 * r);",
    "",
    "  // 中心稍暗、边缘稍暗，给正文留出安静的底",
    "  float center = exp(-pow(uv.x * 1.45, 2.0) - pow(uv.y * 0.8, 2.0));",
    "  float edge = smoothstep(0.55, 1.40, length(uv));",
    "  float mask = (1.0 - 0.34 * center) * (1.0 - 0.28 * edge);",
    "",
    "  vec3 col;",
    "",
    "  if (u_light > 0.5) {",
    "    // 浅色：宣纸上的淡彩",
    "    col = vec3(0.956, 0.966, 0.980);",
    "    float m1 = smoothstep(0.38, 0.86, f);",
    "    float m2 = smoothstep(0.32, 0.92, q.x);",
    "    float m3 = smoothstep(0.42, 0.96, q.y);",
    "    col = mix(col, vec3(0.80, 0.86, 0.99), m1 * 0.55);",
    "    col = mix(col, vec3(0.90, 0.83, 0.99), m2 * 0.40);",
    "    col = mix(col, vec3(0.82, 0.94, 0.93), m3 * 0.35);",
    "    float glow = exp(-length((uv - vec2(0.0, 0.62)) * vec2(0.85, 1.7)) * 2.0);",
    "    col -= vec3(0.05, 0.06, 0.09) * glow * 0.25;",
    "    col = mix(vec3(0.956, 0.966, 0.980), col, mask);",
    "  } else {",
    "    // 深色：极光",
    "    col = vec3(0.018, 0.022, 0.036);",
    "    float m1 = smoothstep(0.34, 0.92, f);",
    "    float m2 = smoothstep(0.30, 0.95, q.x);",
    "    float m3 = smoothstep(0.40, 1.0, q.y);",
    "",
    "    col += vec3(0.07, 0.18, 0.50) * m1 * 1.05;",
    "    col += vec3(0.20, 0.10, 0.42) * m2 * 0.35;",
    "    col += vec3(0.03, 0.32, 0.34) * m3 * 0.45;",
    "",
    "    // 细亮丝带",
    "    float ribbon = pow(clamp((f - 0.60) / 0.14, 0.0, 1.0), 3.0);",
    "    col += vec3(0.32, 0.48, 0.86) * ribbon * 0.38;",
    "",
    "    // 顶部与左下角的微光",
    "    float g1 = exp(-length((uv - vec2(-0.45, 0.72)) * vec2(0.95, 1.5)) * 2.1);",
    "    float g2 = exp(-length((uv - vec2(0.78, -0.62)) * vec2(1.1, 1.35)) * 2.4);",
    "    col += vec3(0.10, 0.20, 0.42) * g1 * 0.70;",
    "    col += vec3(0.16, 0.10, 0.30) * g2 * 0.50;",
    "",
    "    col *= mask;",
    "  }",
    "",
    "  // 细微噪点，消除色带",
    "  col += (hash21(gl_FragCoord.xy * 0.7 + fract(u_time) * 13.0) - 0.5) / 160.0;",
    "",
    "  gl_FragColor = vec4(col, 1.0);",
    "}",
  ].join("\n");

  function compile(type, source) {
    var s = gl.createShader(type);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn("shader compile error:", gl.getShaderInfoLog(s));
      gl.deleteShader(s);
      return null;
    }
    return s;
  }

  var vs = compile(gl.VERTEX_SHADER, VERT);
  var fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) {
    body.classList.add("no-shader");
    return;
  }

  var program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn("shader link error:", gl.getProgramInfoLog(program));
    body.classList.add("no-shader");
    return;
  }
  gl.useProgram(program);

  var buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW
  );
  var aPos = gl.getAttribLocation(program, "a_pos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  var uRes = gl.getUniformLocation(program, "u_res");
  var uTime = gl.getUniformLocation(program, "u_time");
  var uLight = gl.getUniformLocation(program, "u_light");
  var uMouse = gl.getUniformLocation(program, "u_mouse");

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
    .matches;
  var width = 1;
  var height = 1;
  var start = performance.now();
  var last = 0;
  var running = true;
  var frame = 0;

  var mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  var currentLight = null;

  function resize() {
    var w = window.innerWidth;
    var h = window.innerHeight;
    // 控制像素总量：最高约 110 万，避免高分屏烧 GPU
    var budget = 1100000;
    var scale = Math.min(1, Math.sqrt(budget / Math.max(1, w * h)));
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var ratio = Math.min(scale * dpr, 1.25);
    width = Math.max(1, Math.floor(w * ratio));
    height = Math.max(1, Math.floor(h * ratio));
    canvas.width = width;
    canvas.height = height;
    gl.viewport(0, 0, width, height);
    gl.uniform2f(uRes, width, height);
    if (reduceMotion) draw(0);
  }

  function draw(time) {
    var light =
      document.documentElement.getAttribute("data-theme") === "light" ? 1 : 0;
    if (light !== currentLight) {
      currentLight = light;
      gl.uniform1f(uLight, currentLight);
    }
    gl.uniform1f(uTime, time);
    gl.uniform2f(uMouse, mouse.x, mouse.y);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function loop(now) {
    if (!running) return;
    frame = requestAnimationFrame(loop);
    if (now - last < 33) return; // ~30fps
    last = now;
    mouse.x += (mouse.tx - mouse.x) * 0.045;
    mouse.y += (mouse.ty - mouse.y) * 0.045;
    draw((now - start) / 1000);
  }

  function startLoop() {
    if (reduceMotion) {
      draw(0);
      return;
    }
    if (!running) return;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(loop);
  }

  window.addEventListener("resize", resize, { passive: true });

  window.addEventListener(
    "pointermove",
    function (e) {
      if (reduceMotion) return;
      mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2;
    },
    { passive: true }
  );

  document.addEventListener("visibilitychange", function () {
    running = !document.hidden;
    if (running) startLoop();
    else cancelAnimationFrame(frame);
  });

  window.addEventListener("themechange", function () {
    if (reduceMotion) draw(0);
  });

  resize();
  startLoop();
})();
