export default `
precision highp float;

#define M_PI 3.1415926535897932384626433832795
#define RECIPROCAL_PI 0.31830988618
#define RECIPROCAL_PI2 0.15915494

in vec3 position;
in vec3 vNormal;
in vec3 viewDirection;
in vec2 vUv;

out vec4 outFragColor;

struct Material
{
  vec3 albedo;
};

struct Light
{
  vec3 position;
};

struct RenderMethod
{
  bool ponctualLights;
  bool texture;
};

uniform Material uMaterial;
uniform float alpha;
uniform float roughnessLevel;
uniform float metallic;
uniform Light lights[4];
uniform RenderMethod renderMethod;
uniform sampler2D uTexDiffuse;
uniform sampler2D uTexSpecular;
uniform sampler2D uTexBRDF;

// From three.js
vec4 sRGBToLinear( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}

// From three.js
vec4 LinearTosRGB( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}

float clamp_dot(vec3 a, vec3 b) {
  float res = dot(a, b);
  res = clamp(res, 0.00001, 1.);
  return res;
}

float D(vec3 n, vec3 h, float alpha) {
  float nh = clamp_dot(n,h);
  return alpha * alpha / (M_PI * pow((nh * nh)*(alpha*alpha - 1.) + 1., 2.));
}

vec3 Fresnel(vec3 v, vec3 h, vec3 f_0) {
  float A = (1. - clamp_dot(v,h));
  return f_0 + (1. - f_0) * pow(A, 5.);
}

float G(vec3 n, vec3 v, float k) {
  float nv = clamp_dot(n, v);
  return nv / (nv * (1. - k) + k);
}

float f_s(vec3 n, vec3 w_i, vec3 w_o) {
  vec3 h = normalize(w_i + w_o);
  float roughness = alpha * alpha; //clamp(alpha, 0.01, 1.);
  float D_s = D(n, h, roughness);
  D_s = max(D_s, 0.);
  float G_s = G(n, w_o, roughness) * G(n, w_i, roughness);
  G_s = max(G_s, 0.);
  return D_s * G_s / (4. * clamp_dot(w_o, n) * clamp_dot(w_i, n));
}

vec3 f_d(vec3 albedo) {
  return albedo / M_PI;
}

float sampleLight(vec3 n, vec3 w_i) {
  return clamp_dot(n, w_i) * 1. / (4. * M_PI);
}

vec3 renderPonctualLights(vec3 albedo, vec3 normal, vec3 w_o) {
  vec3 f0 = mix(vec3(0.04), albedo, metallic);
  vec3 radiance = vec3(0.);
  for (int i = 0; i < 4; i++) {
    vec3 lighPos = lights[i].position;
    vec3 w_i = normalize(lighPos - position);
    vec3 h = normalize(w_i + w_o);
    
    vec3 ks = Fresnel(w_o, h, f0);
    // ks = vec3(.5);
    vec3 specular = ks * f_s(normal, w_i, w_o);
    vec3 diffuse = (1. - ks) * f_d(albedo) * (1. - metallic);

    float cosTheta = clamp_dot(normal, w_i);
    radiance += (diffuse + specular) * 2. * cosTheta;
  }
  return radiance;
}

vec3 RGBMDecode(vec4 rgbm) {
  return 6.0 * rgbm.rgb * rgbm.a;
}

vec2 cartesianToPolar(vec3 n) {
    vec2 uv;
    uv.x = atan(n.z, n.x) * RECIPROCAL_PI2 + 0.5;
    uv.y = asin(n.y) * RECIPROCAL_PI + 0.5;
    return uv;
}

vec3 fetchPrefilteredSpec(float roughness, vec2 reflectPolar) {
  float x = reflectPolar.x / pow(2., roughness);
  float y = reflectPolar.y / pow(2., roughness + 1.) + 1. - 1. / pow(2., roughness);
  vec3 texSpecular = RGBMDecode(texture(uTexSpecular, vec2(x, y)));
  return texSpecular;
}

vec3 renderTexture(vec3 normal, vec3 f0, vec3 w_o, vec3 albedo,float roughness) {
  vec2 uv = cartesianToPolar(normal);

  // DIFFUSE
  vec3 ks = Fresnel(w_o, normal, f0);
  vec3 texDiffuse = RGBMDecode(texture(uTexDiffuse, uv));
  vec3 kD = (1. - ks) * albedo * (1. - metallic);
  vec3 diffuse = kD * texDiffuse;

  vec3 reflected = reflect(w_o, normal);
  vec2 reflectPolar = cartesianToPolar(reflected);
  vec3 preFilteredSpec = fetchPrefilteredSpec(roughnessLevel, reflectPolar);
  vec2 brdf = texture(uTexBRDF, vec2(clamp_dot(normal, w_o), roughness)).xy;
  // SPECULAR
  vec3 specular = preFilteredSpec * (ks * brdf.x + brdf.y);
  
  return (diffuse + specular);
}

void
main()
{
  // **DO NOT** forget to do all your computation in linear space.
  vec3 color = uMaterial.albedo / (uMaterial.albedo + 1.);
  vec3 albedo = sRGBToLinear(vec4(color, 1.0)).rgb;

  vec3 w_o = normalize(viewDirection);
  vec3 normal = normalize(vNormal);
  vec3 f0 = mix(vec3(0.04), albedo, metallic);
  float roughness = alpha * alpha;

  vec3 radiance = vec3(1.);
  if (renderMethod.ponctualLights) {
    radiance = renderPonctualLights(albedo, normal, w_o);
  }
  else if (renderMethod.texture) {
    radiance = renderTexture(normal, f0, w_o, albedo, roughness);
  }
  // **DO NOT** forget to apply gamma correction as last step.
  outFragColor.rgba = LinearTosRGB(vec4(radiance, 1.0));
}
`;
