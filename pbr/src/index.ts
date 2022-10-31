import { GUI } from 'dat.gui';
import { mat4, vec3 } from 'gl-matrix';
import { Camera } from './camera';
import { TriangleGeometry } from './geometries/triangle';
import { SphereGeometry } from './geometries/sphere';
import { GLContext } from './gl';
import { PBRShader } from './shader/pbr-shader';
import { Texture, Texture2D } from './textures/texture';
import { UniformType } from './types';
import { PointLight } from './lights/lights';

interface GUIProperties {
  albedo: number[];
  ponctualLights: boolean;
  texture: boolean;
}

/**
 * Class representing the current application with its state.
 *
 * @class Application
 */
class Application {
  /**
   * Context used to draw to the canvas
   *
   * @private
   */
  private _context: GLContext;

  private _shader: PBRShader;
  private _geometry: TriangleGeometry | SphereGeometry;
  private _uniforms: Record<string, UniformType | Texture>;

  private _textureDiffuse: Texture2D<HTMLElement> | null;
  private _textureSpecular: Texture2D<HTMLElement> | null;
  private _textureBRDF: Texture2D<HTMLElement> | null;

  private _camera: Camera;

  private _light: PointLight;

  /**
   * Object updated with the properties from the GUI
   *
   * @private
   */
  private _guiProperties: GUIProperties;

  constructor(canvas: HTMLCanvasElement) {
    this._context = new GLContext(canvas);
    this._camera = new Camera();
    this._light = new PointLight();
    var radius = 0.75;

    this._geometry = new SphereGeometry(radius, 25, 25);
    this._uniforms = {
      'uMaterial.albedo': vec3.create(),
      'uModel.localToProjection': mat4.create(),
      'cameraPos': vec3.create(),
      'lightPos': vec3.create(),
      'offset': vec3.create(),
      'alpha': 0.,
      'metallic': 1.,
      'lights[0].position': vec3.create(),
      'lights[1].position': vec3.create(),
      'lights[2].position': vec3.create(),
      'lights[3].position': vec3.create(),
      'renderMethod.ponctualLights': false,
      'renderMethod.texture': true,
      'roughnessLevel': 0.,
    };

    this._shader = new PBRShader();
    this._textureDiffuse = null;
    this._textureSpecular = null;
    this._textureBRDF = null;

    this._guiProperties = {
      albedo: [255, 255, 255],
      ponctualLights: false,
      texture: true,
    };

    this._createGUI();
  }

  /**
   * Initializes the application.
   */
  async init() {
    this._context.uploadGeometry(this._geometry);
    this._context.compileProgram(this._shader);

    // Example showing how to load a texture and upload it to GPU.
    this._textureDiffuse = await Texture2D.load(
      'assets/env/Alexs_Apt_2k-diffuse-RGBM.png'
    );
    if (this._textureDiffuse !== null) {
      this._context.uploadTexture(this._textureDiffuse);
      this._uniforms.uTexDiffuse = this._textureDiffuse;
    }

    this._textureSpecular = await Texture2D.load(
      'assets/env/Alexs_Apt_2k-specular-RGBM.png'
    );
    if (this._textureSpecular !== null) {
      this._context.uploadTexture(this._textureSpecular);
      this._uniforms.uTexSpecular = this._textureSpecular;
    }

    this._textureBRDF = await Texture2D.load(
      'assets/ggx-brdf-integrated.png'
    );
    if (this._textureBRDF !== null) {
      this._context.uploadTexture(this._textureBRDF);
      this._uniforms.uTexBRDF = this._textureBRDF;
    }
  }

  /**
   * Called at every loop, before the [[Application.render]] method.
   */
  update() {
    /** Empty. */
  }

  /**
   * Called when the canvas size changes.
   */
  resize() {
    this._context.resize();
  }

  /**
   * Called at every loop, after the [[Application.update]] method.
   */
  render() {
    this._context.clear();
    this._context.setDepthTest(true);
    // this._context.setCulling(WebGL2RenderingContext.BACK);

    const aspect =
      this._context.gl.drawingBufferWidth /
      this._context.gl.drawingBufferHeight;

    const camera = this._camera;
    vec3.set(camera.transform.position, 0.0, 0.0, 15.0);
    camera.setParameters(aspect);
    camera.update();

    this._uniforms['cameraPos'] = camera.transform.position;

    const props = this._guiProperties;

    this._uniforms['renderMethod.ponctualLights'] = this._guiProperties.ponctualLights;
    this._uniforms['renderMethod.texture'] = this._guiProperties.texture;

    // Set the color from the GUI into the uniform list.
    vec3.set(
      this._uniforms['uMaterial.albedo'] as vec3,
      props.albedo[0] / 255,
      props.albedo[1] / 255,
      props.albedo[2] / 255
    );
    // Sets the viewProjection matrix.
    // **Note**: if you want to modify the position of the geometry, you will
    // need to take the matrix of the mesh into account here.
    mat4.copy(
      this._uniforms['uModel.localToProjection'] as mat4,
      camera.localToProjection
    );

    vec3.set(
      this._uniforms['lights[0].position'] as vec3,
      7,
      -8,
      8
    )

    vec3.set(
      this._uniforms['lights[1].position'] as vec3,
      -5,
      3,
      8
    )

    vec3.set(
      this._uniforms['lights[2].position'] as vec3,
      -5,
      -9,
      8
    )

    vec3.set(
      this._uniforms['lights[3].position'] as vec3,
      9,
      2,
      8
    )

    // Draws.
    var metallic = 0.;
    for (var y = -2 ; y <= 2; y++) {
      this._uniforms["metallic"] = metallic;
      metallic += 1./4.;
      var alpha = 0.1;
      var alphaLevel = 0.;
      for (var x = -2; x <= 2; x++) {
        vec3.set(this._uniforms["offset"] as vec3, x * 2, y * 2, 0);
        this._uniforms["alpha"] = alpha;
        this._uniforms['roughnessLevel'] = alphaLevel;
        this._context.draw(this._geometry, this._shader, this._uniforms);
        alpha += 1./5.;
        alphaLevel++;
      }
    }
  }

  /**
   * Creates a GUI floating on the upper right side of the page.
   *
   * ## Note
   *
   * You are free to do whatever you want with this GUI. It's useful to have
   * parameters you can dynamically change to see what happens.
   *
   *
   * @private
   */
  private _createGUI(): GUI {
    const gui = new GUI();
    gui.addColor(this._guiProperties, 'albedo');
    gui.add(this._guiProperties, "ponctualLights", true);
    gui.add(this._guiProperties, "texture", true);
    return gui;
  }
}

const canvas = document.getElementById('main-canvas') as HTMLCanvasElement;
const app = new Application(canvas as HTMLCanvasElement);
app.init();

function animate() {
  app.update();
  app.render();
  window.requestAnimationFrame(animate);
}
animate();

/**
 * Handles resize.
 */

const resizeObserver = new ResizeObserver((entries) => {
  if (entries.length > 0) {
    const entry = entries[0];
    canvas.width = window.devicePixelRatio * entry.contentRect.width;
    canvas.height = window.devicePixelRatio * entry.contentRect.height;
    app.resize();
  }
});

resizeObserver.observe(canvas);
