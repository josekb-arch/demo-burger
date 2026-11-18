// Tree-shaken Three.js r170 build for this page (only the classes the scene uses) + the procedural combo food.
export {
  WebGLRenderer, Scene, PerspectiveCamera, HemisphereLight, DirectionalLight, TextureLoader, Group, Mesh, PlaneGeometry, BoxGeometry,
  MeshBasicMaterial, MeshStandardMaterial, CanvasTexture, SRGBColorSpace, Box3, Vector3, Quaternion, Object3D, MathUtils,
  PCFSoftShadowMap, PCFShadowMap, ACESFilmicToneMapping, AgXToneMapping, PMREMGenerator, EquirectangularReflectionMapping, NoToneMapping, Euler, Matrix4, CylinderGeometry, CircleGeometry, SphereGeometry,
} from 'three';
export * from './combo3d.js';
export { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
export * from './relief.js';
