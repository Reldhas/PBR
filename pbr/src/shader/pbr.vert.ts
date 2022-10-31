export default `

precision highp float;

in vec3 in_position;
in vec3 in_normal;
in vec2 in_uv;

/**
 * Varyings.
 */

out vec3 vNormal;
out vec3 viewDirection;
out vec3 position;
out vec2 vUv;

/**
 * Uniforms List
 */

struct Model
{
  mat4 localToProjection;
};

uniform Model uModel;
uniform vec3 cameraPos;
uniform vec3 offset;

void
main()
{
  vec3 pos = offset + in_position;
  vec4 positionLocal = vec4(pos, 1.0);
  gl_Position = uModel.localToProjection * positionLocal;
  vNormal = normalize(in_normal);
  viewDirection = normalize(cameraPos - positionLocal.xyz);
  position = in_position;
  vUv = in_uv;
}
`;
