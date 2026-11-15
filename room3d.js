// Комната «от бетона до готового». Модель собрана в Blender (models/room.glb), сцена — three.js.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const view = document.getElementById('room-view');

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) { return false; }
}

if (view && webglAvailable()) start().catch(() => { /* остаётся картинка из Blender */ });

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const backOut = (x) => { x = clamp01(x); const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };

async function start() {
  const gltf = await new GLTFLoader().loadAsync('models/room.glb');
  const root = gltf.scene;
  const node = (n) => root.getObjectByName(n);

  const mats = {};
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      if (o.material && o.material.name) mats[o.material.name] = o.material;
    }
  });
  if (mats.Glass) { mats.Glass.transparent = true; mats.Glass.opacity = 0.3; mats.Glass.depthWrite = false; }

  // акцентная стена красится в фирменный цвет компании
  const accent = window.SITE && window.SITE.accent;
  if (accent && mats.WallAccent) mats.WallAccent.color.set(accent);

  const CONCRETE = new THREE.Color('#8E908D');
  const wallFinal = mats.Wall ? mats.Wall.color.clone() : null;
  const accentFinal = mats.WallAccent ? mats.WallAccent.color.clone() : null;
  const shadeFinal = mats.Shade ? mats.Shade.emissiveIntensity : 0;

  const planks = [];
  root.traverse((o) => { if (/^Plank_\d+$/.test(o.name)) planks.push(o); });
  planks.sort((a, b) => a.name.localeCompare(b.name));
  planks.forEach((p) => { p.userData.y = p.position.y; });

  const props = ['Trestle', 'Bags', 'Bucket'].map(node).filter(Boolean);
  const furniture = [
    ['Rug', 0.64], ['Sofa', 0.69], ['SofaLegs', 0.69], ['Table', 0.75],
    ['Shelf', 0.80], ['Lamp', 0.85], ['Plant', 0.90], ['Art', 0.94]
  ].map(([n, at]) => ({ o: node(n), at })).filter((f) => f.o);
  const baseboard = node('Baseboard');

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.setAttribute('aria-label', 'Трёхмерная комната. Потяните, чтобы повернуть; ползунок ниже меняет этап ремонта.');

  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.6;
  scene.add(root);

  const sun = new THREE.DirectionalLight(0xffffff, 1.9);
  sun.position.set(6.5, 7.5, 6.0);
  sun.target.position.set(2, 0.8, 1.8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1536, 1536);
  const sc = sun.shadow.camera;
  sc.left = -4.5; sc.right = 4.5; sc.top = 4.5; sc.bottom = -4.5; sc.near = 1; sc.far = 24;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 6;
  scene.add(sun, sun.target);

  const camera = new THREE.PerspectiveCamera(26, 4 / 3, 0.1, 80);
  const target = new THREE.Vector3(2.05, 1.05, 1.78);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(target);
  controls.enableZoom = false;
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.55;
  controls.minAzimuthAngle = 0.12;
  controls.maxAzimuthAngle = 1.38;
  controls.minPolarAngle = 0.75;
  controls.maxPolarAngle = 1.3;
  renderer.domElement.style.touchAction = 'pan-y';

  let needsRender = true;
  controls.addEventListener('change', () => { needsRender = true; });

  function frame() {
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
    const radius = 3.25;
    const dist = radius / Math.sin(Math.min(vFov, hFov) / 2);
    const az = controls.getAzimuthalAngle();
    const pol = controls.getPolarAngle();
    camera.position.setFromSphericalCoords(dist, pol, az).add(target);
    controls.update();
  }

  function resize() {
    const w = view.clientWidth, h = view.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    frame();
    needsRender = true;
  }

  // p: 0 — бетонная коробка, 1 — готовая комната
  function setStage(p) {
    const paint = smooth((p - 0.12) / 0.3);
    if (wallFinal) mats.Wall.color.copy(CONCRETE).lerp(wallFinal, paint);
    if (accentFinal) mats.WallAccent.color.copy(CONCRETE).lerp(accentFinal, smooth((p - 0.2) / 0.26));

    planks.forEach((pl, i) => {
      const k = smooth((p - (0.34 + (i / planks.length) * 0.24)) / 0.035);
      pl.visible = k > 0.001;
      pl.position.y = pl.userData.y + (1 - k) * 0.35;
    });
    if (baseboard) {
      const k = smooth((p - 0.59) / 0.04);
      baseboard.visible = k > 0.001;
      baseboard.scale.y = Math.max(0.001, k);
    }
    props.forEach((o) => {
      const k = 1 - smooth((p - 0.55) / 0.07);
      o.visible = k > 0.001;
      o.scale.setScalar(Math.max(0.001, k));
    });
    furniture.forEach(({ o, at }) => {
      const k = backOut((p - at) / 0.06);
      o.visible = p > at;
      o.scale.setScalar(Math.max(0.001, k));
    });
    if (mats.Shade) mats.Shade.emissiveIntensity = shadeFinal * smooth((p - 0.9) / 0.08);
    needsRender = true;
  }

  camera.position.setFromSphericalCoords(18, 1.06, 0.66).add(target);
  controls.update();
  setStage(1);

  view.appendChild(renderer.domElement);
  resize();
  renderer.render(scene, camera);
  view.classList.add('is-live');

  document.addEventListener('room:stage', (e) => setStage(e.detail.p));
  new ResizeObserver(resize).observe(view);
  let visible = true;
  new IntersectionObserver((en) => { visible = en[0].isIntersecting; }).observe(view);

  renderer.setAnimationLoop(() => {
    if (!visible) return;
    controls.update();
    if (needsRender) { renderer.render(scene, camera); needsRender = false; }
  });

  document.dispatchEvent(new CustomEvent('room:ready'));
}
