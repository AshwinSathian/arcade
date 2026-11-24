// GLSL for the hall: one lit pass for every surface, a depth pass, light beams, and the post chain.
export const NL = 24; // point and spot lights
export const NF = 11; // cabinet footprints, for contact shadows on the floor

export const vsMain = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNrm; layout(location=2) in vec4 aAux;
uniform mat4 uVP; uniform mat4 uModel;
out vec3 vPos; out vec3 vNrm; out vec2 vUv; flat out int vMat; out float vFlag;
void main() {
  vec4 w = uModel * vec4(aPos, 1.0);
  vPos = w.xyz; vNrm = mat3(uModel) * aNrm; vUv = aAux.xy; vMat = int(aAux.z + 0.5); vFlag = aAux.w;
  gl_Position = uVP * w;
}`;

export const fsMain = `#version 300 es
precision highp float; precision highp sampler2DShadow;
in vec3 vPos; in vec3 vNrm; in vec2 vUv; flat in int vMat; in float vFlag;
uniform vec3 uCam; uniform float uTime; uniform float uNight;
uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uSky; uniform vec3 uGnd;
uniform mat4 uShadowVP; uniform sampler2DShadow uShadow; uniform float uShadowTexel;
uniform vec4 uLP[${NL}]; uniform vec4 uLC[${NL}]; uniform int uNL;
uniform vec4 uFoot[${NF}];
uniform vec3 uGround; uniform vec3 uBright; uniform sampler2D uArt; uniform sampler2D uScreen;
uniform vec4 uCrop; uniform float uPower; uniform float uGlow; uniform float uHover; uniform float uNeon;
uniform sampler2D uRefl; uniform float uReflOn; uniform vec2 uRes;
out vec4 o;

const float PI = 3.14159265;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
// The room as a reflection: a floor, walls, and by day the clerestory windows; by night, dark with the neon.
vec3 env(vec3 d, float r) {
  float up = d.y;
  vec3 day = mix(vec3(0.20, 0.18, 0.16), vec3(0.62, 0.64, 0.66), smoothstep(-0.3, 0.7, up));
  day += vec3(2.4, 2.25, 2.0) * smoothstep(0.55, 0.9, -d.z * 0.55 + up * 0.7) * (1.0 - r * 0.7);
  vec3 night = mix(vec3(0.006, 0.005, 0.01), vec3(0.02, 0.02, 0.045), smoothstep(-0.3, 0.7, up));
  night += vec3(1.0, 0.16, 0.42) * 0.3 * smoothstep(0.8, 0.98, dot(d, normalize(vec3(0.0, 0.45, -1.0)))) * uNeon * (1.0 - r);
  night += vec3(0.25, 0.35, 0.6) * 0.25 * smoothstep(0.3, 0.9, up);
  return mix(day, night, uNight);
}
vec3 brdf(vec3 N, vec3 V, vec3 L, vec3 diff, vec3 f0, float a) {
  vec3 H = normalize(L + V);
  float nl = max(dot(N, L), 0.0), nv = max(dot(N, V), 1e-3), nh = max(dot(N, H), 0.0), vh = max(dot(V, H), 0.0);
  float a2 = a * a, dd = nh * nh * (a2 - 1.0) + 1.0, D = a2 / (PI * dd * dd);
  float k = a * 0.5, Vis = 0.25 / ((nv * (1.0 - k) + k) * (nl * (1.0 - k) + k));
  vec3 F = f0 + (1.0 - f0) * pow(1.0 - vh, 5.0);
  return (diff / PI * (1.0 - F) + D * Vis * F) * nl;
}
float shadow(vec3 P, vec3 N) {
  vec4 s = uShadowVP * vec4(P + N * 0.02, 1.0);
  vec3 c = s.xyz / s.w * 0.5 + 0.5;
  if (c.x < 0.0 || c.x > 1.0 || c.y < 0.0 || c.y > 1.0) return 1.0;
  float sum = 0.0;
  float rot = hash(gl_FragCoord.xy) * 6.283;
  mat2 R = mat2(cos(rot), sin(rot), -sin(rot), cos(rot));
  vec2 taps[8] = vec2[](vec2(-0.94, -0.4), vec2(0.95, -0.77), vec2(-0.09, -0.93), vec2(0.34, 0.29), vec2(-0.82, 0.54), vec2(0.62, 0.95), vec2(-0.25, 0.1), vec2(0.1, 0.62));
  for (int i = 0; i < 8; i++) sum += texture(uShadow, vec3(c.xy + R * taps[i] * uShadowTexel * 2.2, c.z - 0.0015));
  return sum / 8.0;
}
float footAO(vec3 P) {
  float ao = 1.0;
  for (int i = 0; i < ${NF}; i++) {
    vec4 f = uFoot[i];
    vec2 q = abs(P.xz - f.xy) - f.zw;
    float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
    ao *= 1.0 - 0.62 * exp(-max(d, 0.0) * 9.0) * step(0.001, f.z);
  }
  return ao;
}
vec3 light(vec3 P, vec3 N, vec3 V, vec3 albedo, float metal, float rough, float ao, float specRefl) {
  vec3 f0 = mix(vec3(0.04), albedo, metal), diff = albedo * (1.0 - metal);
  float a = max(rough * rough, 0.002);
  vec3 c = vec3(0.0);
  float sunOn = dot(uSunCol, vec3(1.0));
  if (sunOn > 0.001) c += brdf(N, V, uSunDir, diff, f0, a) * uSunCol * shadow(P, N);
  for (int i = 0; i < ${NL}; i++) {
    if (i >= uNL) break;
    vec3 Lv = uLP[i].xyz - P; float d2 = dot(Lv, Lv), r = uLC[i].w;
    if (d2 > r * r) continue;
    vec3 L = Lv * inversesqrt(d2);
    float fall = 1.0 - d2 / (r * r);
    float att = fall * fall / (d2 + 0.12);
    // w = 1: a downlight with a soft cone; w = 2: a screen, which only lights what is in front of it.
    if (uLP[i].w > 1.5) att *= smoothstep(-0.2, 0.5, -L.z);
    else if (uLP[i].w > 0.5) att *= smoothstep(0.62, 0.9, L.y);
    c += brdf(N, V, L, diff, f0, a) * uLC[i].rgb * att;
  }
  float nv = max(dot(N, V), 1e-3);
  vec3 amb = mix(uGnd, uSky, N.y * 0.5 + 0.5);
  vec3 Fa = f0 + (max(vec3(1.0 - rough), f0) - f0) * pow(1.0 - nv, 5.0);
  c += diff * amb * ao;
  c += env(reflect(-V, N), rough) * Fa * ao * specRefl;
  return c;
}

void main() {
  vec3 N = normalize(vNrm);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(uCam - vPos);
  vec3 albedo = uGround; float metal = 0.0, rough = 0.5, spec = 1.0;
  vec3 emit = vec3(0.0);
  float ao = mix(0.5, 1.0, smoothstep(0.0, 0.5, vPos.y));
  int m = vMat;
  if (m == 0) { // body paint; the two sides carry the art
    albedo = vFlag > 0.5 ? texture(uArt, vUv).rgb : uGround;
    rough = 0.32;
  } else if (m == 1) { // T-moulding
    albedo = uBright; rough = 0.28; emit = uBright * uGlow * 0.12;
  } else if (m == 2) { // black plastic
    albedo = vec3(0.018); rough = 0.45;
  } else if (m == 3) { // control panel art
    albedo = texture(uArt, vUv).rgb; rough = 0.22;
  } else if (m == 4) { // the screen, behind curved glass
    vec2 c = vUv * 2.0 - 1.0;
    c *= 1.0 + 0.045 * vec2(c.y * c.y, c.x * c.x);
    vec2 uv = c * 0.5 + 0.5;
    float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
    vec3 img = texture(uScreen, uCrop.xy + uv * uCrop.zw).rgb;
    float lines = 360.0 * uCrop.w;
    float fw = fwidth(uv.y * lines);
    float scan = mix(0.86 + 0.14 * sin(uv.y * lines * 6.2831), 0.93, clamp(fw * 1.2, 0.0, 1.0));
    float vig = smoothstep(1.45, 0.55, length(c));
    float roll = 0.97 + 0.03 * sin(uv.y * 9.0 - uTime * 2.4);
    emit = img * scan * vig * roll * inside * uPower * mix(1.25, 1.65, uNight) * (1.0 + uHover * 0.15);
    emit += vec3(0.005, 0.01, 0.008) * (1.0 - uPower) * inside;
    albedo = vec3(0.004); rough = 0.06; ao = 1.0;
  } else if (m == 5) { // backlit marquee
    vec3 t = texture(uArt, vUv).rgb;
    albedo = t * 0.8; rough = 0.2;
    emit = t * (0.06 + uGlow * 1.35 + uHover * 0.25);
  } else if (m == 6) { // chrome
    albedo = vec3(0.86, 0.85, 0.82); metal = 1.0; rough = 0.16;
  } else if (m == 7) { // a lit button
    albedo = uBright; rough = 0.25; emit = uBright * (0.05 + uGlow * 0.6);
  } else if (m == 8) { // the coin slot lamps
    float pulse = 0.55 + 0.45 * sin(uTime * 3.0 + vPos.x * 4.0);
    albedo = vec3(0.6, 0.08, 0.04); emit = vec3(2.2, 0.32, 0.1) * pulse * (0.25 + uGlow);
  } else if (m == 9) { // white plastic
    albedo = vec3(0.82, 0.8, 0.76); rough = 0.3;
  } else if (m == 10) { // polished concrete with terrazzo
    vec2 p = vPos.xz;
    float n = noise(p * 2.7) * 0.5 + noise(p * 10.0) * 0.3 + noise(p * 41.0) * 0.2;
    albedo = vec3(0.36, 0.35, 0.33) * (0.82 + 0.34 * n);
    float fl = step(0.97, hash(floor(p * 140.0)));
    albedo = mix(albedo, vec3(0.62, 0.6, 0.55), fl * 0.4);
    vec2 g = abs(fract(p / 1.6) - 0.5);
    float seam = smoothstep(0.494, 0.5, max(g.x, g.y));
    albedo *= 1.0 - seam * 0.55;
    rough = 0.16 + 0.28 * noise(p * 1.3 + 4.0) + seam * 0.4;
    ao = footAO(vPos);
    spec = 1.0 - uReflOn;
  } else if (m == 11) { // slatted back wall, dado below
    float sl = fract(vPos.x * 7.0);
    float groove = smoothstep(0.0, 0.06, sl) * smoothstep(1.0, 0.94, sl);
    albedo = vPos.y < 1.05 ? vec3(0.09, 0.085, 0.08) : vec3(0.36, 0.33, 0.30) * (0.7 + 0.3 * groove);
    rough = vPos.y < 1.05 ? 0.4 : 0.7;
    ao = mix(0.55, 1.0, smoothstep(0.0, 0.8, vPos.y));
  } else if (m == 12) { // neon sign
    vec3 t = texture(uArt, vUv).rgb;
    float fl = 0.92 + 0.08 * sin(uTime * 37.0) * sin(uTime * 3.1);
    albedo = vec3(0.04) + t * 0.25; rough = 0.3;
    emit = t * uNeon * fl * 4.0;
  } else if (m == 13) { // clerestory window
    vec2 w = vUv;
    vec3 sky = mix(vec3(1.9, 2.3, 2.9), vec3(3.6, 3.4, 3.0), w.y);
    float stars = step(0.9975, hash(floor(w * vec2(900.0, 150.0)))) * 1.2;
    vec3 nsky = mix(vec3(0.004, 0.008, 0.03), vec3(0.015, 0.02, 0.06), w.y) + stars;
    float frame = step(0.035, fract(w.x * 6.0)) * step(0.06, w.y) * step(w.y, 0.94);
    emit = mix(sky, nsky, uNight) * frame;
    albedo = vec3(0.03); rough = 0.5;
  } else if (m == 14) { // ceiling and dark matte
    albedo = vec3(0.05, 0.05, 0.055); rough = 0.8;
  } else if (m == 15) { // downlight lens
    albedo = vec3(0.9); emit = vec3(5.0, 4.2, 3.4) * uGlow;
  }
  vec3 col = light(vPos, N, V, albedo, metal, rough, ao, spec) + emit;
  if (m == 10 && uReflOn > 0.5) {
    vec2 suv = gl_FragCoord.xy / uRes;
    vec2 p = vPos.xz;
    suv += (vec2(noise(p * 7.0), noise(p * 7.0 + 9.0)) - 0.5) * 0.012;
    vec3 refl = textureLod(uRefl, suv, rough * 5.5).rgb;
    float nv = max(dot(N, V), 0.0);
    float fr = 0.04 + 0.96 * pow(1.0 - nv, 5.0);
    col += refl * mix(0.12, 0.9, fr) * (1.0 - rough * 0.9);
  }
  float dist = length(uCam - vPos);
  col = mix(col, mix(vec3(0.5, 0.5, 0.52), vec3(0.008, 0.006, 0.014), uNight), (1.0 - exp(-dist * 0.018)) * 0.6);
  o = vec4(col, 1.0);
}`;

export const vsDepth = `#version 300 es
layout(location=0) in vec3 aPos;
uniform mat4 uVP; uniform mat4 uModel;
void main() { gl_Position = uVP * uModel * vec4(aPos, 1.0); }`;
export const fsDepth = `#version 300 es
precision mediump float; out vec4 o; void main() { o = vec4(1.0); }`;

// Light you can see in the air: downlight cones at night, sun shafts by day. Additive, depth-tested, no depth write.
export const vsBeam = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNrm; layout(location=2) in vec4 aAux;
uniform mat4 uVP; uniform mat4 uModel;
out vec3 vPos; out vec3 vNrm; out vec2 vUv;
void main() { vec4 w = uModel * vec4(aPos, 1.0); vPos = w.xyz; vNrm = mat3(uModel) * aNrm; vUv = aAux.xy; gl_Position = uVP * w; }`;
export const fsBeam = `#version 300 es
precision highp float;
in vec3 vPos; in vec3 vNrm; in vec2 vUv;
uniform vec3 uCam; uniform vec3 uColor; uniform float uTime;
out vec4 o;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
void main() {
  vec3 V = normalize(uCam - vPos);
  float edge = pow(abs(dot(normalize(vNrm), V)), 1.6);
  float along = vUv.y; // 0 at the source, 1 at the floor
  float dust = 0.75 + 0.25 * noise(vPos.xy * 3.0 + vec2(0.0, uTime * 0.15)) * noise(vPos.zy * 5.0 - uTime * 0.1);
  float fade = (1.0 - along) * smoothstep(0.0, 0.08, along) + 0.12 * (1.0 - along);
  float side = vUv.x < 0.0 ? 1.0 : sin(3.14159 * clamp(vUv.x, 0.0, 1.0));
  o = vec4(uColor * edge * fade * dust * side * side, 1.0);
}`;

export const vsQuad = `#version 300 es
out vec2 vUv;
void main() { vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); vUv = p; gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;

// Bloom: a threshold and a mip chain down, a tent filter back up (the Call of Duty method, cut down).
export const fsDown = `#version 300 es
precision highp float;
in vec2 vUv; uniform sampler2D uTex; uniform vec2 uTexel; uniform float uThreshold; out vec4 o;
void main() {
  vec3 a = texture(uTex, vUv + uTexel * vec2(-1, -1)).rgb, b = texture(uTex, vUv + uTexel * vec2(1, -1)).rgb;
  vec3 c = texture(uTex, vUv + uTexel * vec2(-1, 1)).rgb, d = texture(uTex, vUv + uTexel * vec2(1, 1)).rgb;
  vec3 e = texture(uTex, vUv).rgb;
  vec3 s = (a + b + c + d) * 0.125 + e * 0.5;
  if (uThreshold > 0.0) {
    float br = max(s.r, max(s.g, s.b));
    float k = smoothstep(uThreshold, uThreshold * 2.2, br);
    s = min(s * k, vec3(40.0));
  }
  o = vec4(s, 1.0);
}`;
export const fsUp = `#version 300 es
precision highp float;
in vec2 vUv; uniform sampler2D uTex; uniform vec2 uTexel; uniform float uWeight; out vec4 o;
void main() {
  vec3 s = texture(uTex, vUv).rgb * 4.0;
  s += (texture(uTex, vUv + uTexel * vec2(-1, 0)).rgb + texture(uTex, vUv + uTexel * vec2(1, 0)).rgb + texture(uTex, vUv + uTexel * vec2(0, -1)).rgb + texture(uTex, vUv + uTexel * vec2(0, 1)).rgb) * 2.0;
  s += texture(uTex, vUv + uTexel * vec2(-1, -1)).rgb + texture(uTex, vUv + uTexel * vec2(1, -1)).rgb + texture(uTex, vUv + uTexel * vec2(-1, 1)).rgb + texture(uTex, vUv + uTexel * vec2(1, 1)).rgb;
  o = vec4(s / 16.0 * uWeight, 1.0);
}`;
export const fsComposite = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uHdr; uniform sampler2D uBloom; uniform float uBloomK; uniform float uExposure;
uniform float uTime; uniform vec3 uFadeCol; uniform float uFade; uniform vec2 uRes;
out vec4 o;
vec3 neutral(vec3 c) {
  float x = min(c.r, min(c.g, c.b));
  float off = x < 0.08 ? x - 6.25 * x * x : 0.04;
  c -= off;
  float peak = max(c.r, max(c.g, c.b));
  if (peak < 0.76) return c;
  float d = 0.24, np = 1.0 - d * d / (peak + d - 0.76);
  c *= np / peak;
  float g = 1.0 - 1.0 / (0.15 * (peak - np) + 1.0);
  return mix(c, vec3(np), g);
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 d = vUv - 0.5;
  float r2 = dot(d, d);
  // A touch of lens: colour fringes and fall-off towards the corners.
  vec3 c;
  c.r = texture(uHdr, vUv - d * r2 * 0.012).r;
  c.g = texture(uHdr, vUv).g;
  c.b = texture(uHdr, vUv + d * r2 * 0.012).b;
  c += texture(uBloom, vUv).rgb * uBloomK;
  c *= uExposure * (1.0 - r2 * 0.75);
  c = neutral(c);
  c = mix(c, uFadeCol, uFade);
  c = pow(max(c, 0.0), vec3(1.0 / 2.2));
  c += (hash(vUv * uRes + fract(uTime) * 91.0) - 0.5) * 0.022;
  o = vec4(c, 1.0);
}`;
