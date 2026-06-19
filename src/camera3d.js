/**
 * Módulo de renderização do modelo 3D da Câmera para uso como ícone de hotspot.
 * Modelo estático (sem giro), com rotação e tamanho configuráveis pelo usuário.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Pool de instâncias Three.js ativas (para limpeza)
const activeViewers = new Map();

/**
 * Cria um mini-renderizador Three.js dentro de um elemento DOM.
 * @param {HTMLElement} container - O elemento que vai receber o canvas
 * @param {string} hotspotId - Identificador único para este hotspot (para o pool)
 * @param {object} opts - Opções de aparência
 * @param {number} opts.rotX - Rotação no eixo X em graus (inclinação vertical)
 * @param {number} opts.rotY - Rotação no eixo Y em graus (direção horizontal)
 * @param {number} opts.rotZ - Rotação no eixo Z em graus (rolagem)
 * @param {number} opts.size - Tamanho do canvas em pixels CSS
 * @param {Function} opts.getHfov - Função para obter o Field of View atual do Pannellum
 * @param {Function} opts.getIsEditMode - Função para checar se está no modo edição
 */
export function mountCamera3DIcon(container, hotspotId, { rotX = 0, rotY = 0, rotZ = 0, size = 80, getHfov = null, getIsEditMode = null } = {}) {
  // Limpar instância anterior se houver
  destroyCamera3DIcon(hotspotId);

  // Dimensionar o container para o tamanho do modelo
  container.style.width = size + 'px';
  container.style.height = size + 'px';

  const scene = new THREE.Scene();

  // Câmera perspectiva com aspect 1:1
  const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 100);
  camera.position.set(0, 0.05, 0.4);
  camera.lookAt(0, 0, 0);

  // Renderer com fundo transparente
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(size, size);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.pointerEvents = 'none';
  container.appendChild(renderer.domElement);

  // Iluminação neutra para mostrar bem o modelo
  scene.add(new THREE.AmbientLight(0xffffff, 2.2));

  const keyLight = new THREE.DirectionalLight(0xffffff, 3.0);
  keyLight.position.set(2, 3, 4);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xc0d8ff, 1.2);
  fillLight.position.set(-3, -1, -2);
  scene.add(fillLight);

  const rimLight = new THREE.PointLight(0xa855f7, 1.5, 10);
  rimLight.position.set(-1, 2, -1);
  scene.add(rimLight);

  let animFrameId = null;
  let isDestroyed = false;
  let modelGroup = null;

  // --- Lógica para Arrastar e Girar no Modo de Edição ---
  let isDragging = false;
  let currentRotX = rotX;
  let currentRotY = rotY;

  container.addEventListener('mousedown', (e) => {
    if (getIsEditMode && getIsEditMode()) {
      isDragging = true;
      e.stopPropagation(); // Evita que o Pannellum arraste o panorama inteiro
    }
  });

  const onMouseMove = (e) => {
    if (isDragging && modelGroup) {
      currentRotY += e.movementX * 0.5;
      currentRotX += e.movementY * 0.5;
      currentRotX = Math.max(-90, Math.min(90, currentRotX)); // Limita inclinação

      modelGroup.rotation.x = THREE.MathUtils.degToRad(currentRotX);
      modelGroup.rotation.y = THREE.MathUtils.degToRad(currentRotY);
      
      // Avisa o main.js para atualizar os sliders no modal (se estiver aberto)
      container.dispatchEvent(new CustomEvent('camera3d-rotated', {
        detail: { rotX: currentRotX, rotY: currentRotY }
      }));
    }
  };

  const onMouseUp = () => {
    if (isDragging) {
      isDragging = false;
      // Avisa o main.js para salvar no banco de dados
      container.dispatchEvent(new CustomEvent('camera3d-rotate-end'));
    }
  };

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);

  // Loop de render (sem animação automática — cena estática ou girada pelo usuário)
  function render() {
    if (isDestroyed) return;
    animFrameId = requestAnimationFrame(render);
    
    // Compensar o zoom do Pannellum para o modelo ter "tamanho fixo" no mundo 3D
    if (getHfov) {
      const hfov = getHfov();
      // O Pannellum default tem base HFOV de ~100
      const scaleFactor = 100 / Math.max(10, hfov);
      renderer.domElement.style.transform = `scale(${scaleFactor})`;
    }
    
    renderer.render(scene, camera);
  }

  // Carregar o modelo GLB
  const loader = new GLTFLoader();
  loader.load(
    '/camera3d.glb',
    (gltf) => {
      if (isDestroyed) return;

      const model = gltf.scene;

      // Centralizar e escalar para caber no ícone
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const boxSize = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(boxSize.x, boxSize.y, boxSize.z);
      const scaleVal = 0.20 / maxDim;

      model.position.sub(center);
      model.scale.setScalar(scaleVal);

      // Aplicar rotação definida pelo usuário (em graus -> radianos)
      model.rotation.order = 'YXZ';
      model.rotation.x = THREE.MathUtils.degToRad(currentRotX);
      model.rotation.y = THREE.MathUtils.degToRad(currentRotY);
      model.rotation.z = THREE.MathUtils.degToRad(rotZ);

      modelGroup = model;
      scene.add(model);
      render();
    },
    undefined,
    (error) => {
      console.error('Erro ao carregar o modelo 3D da câmera:', error);
      if (!isDestroyed) {
        container.innerHTML = '';
        const fb = document.createElement('span');
        fb.textContent = '📷';
        fb.style.fontSize = Math.round(size * 0.5) + 'px';
        fb.style.lineHeight = size + 'px';
        container.appendChild(fb);
      }
    }
  );

  // Guardar referência para limpeza posterior
  activeViewers.set(hotspotId, {
    renderer,
    scene,
    stop: () => {
      isDestroyed = true;
      if (animFrameId) cancelAnimationFrame(animFrameId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      
      // Força a liberação do contexto WebGL para evitar o erro "too many active WebGL contexts"
      if (renderer) {
        const gl = renderer.getContext();
        if (gl) {
          const extension = gl.getExtension('WEBGL_lose_context');
          if (extension) extension.loseContext();
        }
        renderer.dispose();
      }
    }
  });
}

/**
 * Destrói uma instância do viewer 3D, liberando memória WebGL.
 * @param {string} hotspotId
 */
export function destroyCamera3DIcon(hotspotId) {
  if (activeViewers.has(hotspotId)) {
    activeViewers.get(hotspotId).stop();
    activeViewers.delete(hotspotId);
  }
}

/**
 * Destrói TODOS os viewers 3D ativos (usar ao reinicializar o Pannellum).
 */
export function destroyAllCamera3DIcons() {
  for (const [, instance] of activeViewers.entries()) {
    instance.stop();
  }
  activeViewers.clear();
}
