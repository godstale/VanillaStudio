// Draws the canvases and flags readiness (fonts + image + canvases).
import '@fontsource/instrument-serif/400.css';
import * as THREE from 'three';

const c2d = document.getElementById('c2d').getContext('2d');
const grad = c2d.createLinearGradient(0, 0, 400, 300);
grad.addColorStop(0, '#1b2566');
grad.addColorStop(1, '#e26b4a');
c2d.fillStyle = grad;
c2d.fillRect(0, 0, 400, 300);
c2d.fillStyle = '#fff';
c2d.font = '40px Arial';
c2d.fillText('2D canvas', 110, 160);

const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('gl'), preserveDrawingBuffer: true, antialias: true });
const scene = new THREE.Scene();
scene.background = new THREE.Color('#dcd6c4');
const camera = new THREE.PerspectiveCamera(45, 4 / 3, 0.1, 100);
camera.position.z = 5;
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const light = new THREE.DirectionalLight(0xffffff, 2);
light.position.set(3, 4, 2);
scene.add(light);
const mesh = new THREE.Mesh(new THREE.TorusKnotGeometry(1, 0.3, 160, 20), new THREE.MeshStandardMaterial({ color: '#1b2566' }));
mesh.rotation.set(0.4, 0.6, 0);
scene.add(mesh);
renderer.render(scene, camera);

const img = document.getElementById('photo');
Promise.all([
  document.fonts.load('160px "Instrument Serif"').then(() => document.fonts.ready),
  img.complete ? Promise.resolve() : new Promise((r) => (img.onload = r)),
]).then(() => {
  window.__vanillaReady = true;
});
