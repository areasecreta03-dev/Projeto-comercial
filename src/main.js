import './style.css';
import { 
  initDB, 
  saveTourConfig, 
  getTourConfig, 
  saveSceneImage, 
  getSceneImage, 
  deleteSceneImage, 
  clearAll 
} from './db.js';
import { defaultTourConfig } from './samples.js';
import { mountCamera3DIcon, destroyAllCamera3DIcons } from './camera3d.js';

// Estado global do aplicativo
let tourConfig = null;
let currentSceneId = '';
let viewer = null;
let isEditMode = false;
let selectedFile = null;
let objectUrls = new Map();
let mouseDownX = 0;
let mouseDownY = 0;

// Elementos da Interface
const appEl = document.getElementById('app');

// Injetar estrutura HTML principal
appEl.innerHTML = `
  <button id="sidebar-toggle" aria-label="Abrir Menu">☰</button>
  <aside id="sidebar">
    <div class="sidebar-header">
      <div class="logo-icon">✦</div>
      <h1>Editor Tour 360</h1>
    </div>
    <div class="sidebar-content">
      
      <!-- Seletor de Modo -->
      <div class="sidebar-section">
        <h2>Modo de Operação</h2>
        <div class="mode-selector">
          <button id="btn-preview-mode" class="mode-btn active">
            <span>👁</span> Visualizar
          </button>
          <button id="btn-edit-mode" class="mode-btn">
            <span>✏️</span> Editar
          </button>
        </div>
      </div>
      
      <!-- Configurações do Tour -->
      <div class="sidebar-section">
        <h2>Configurações do Tour</h2>
        <div class="form-group">
          <label for="tour-author">Autor do Tour</label>
          <input type="text" id="tour-author" class="form-input" placeholder="Nome do autor">
        </div>
        <div class="form-group">
          <label for="tour-first-scene">Cena Inicial</label>
          <select id="tour-first-scene" class="form-input"></select>
        </div>
        <div class="form-group">
          <label for="tour-fade">Transição Fade (ms)</label>
          <input type="number" id="tour-fade" class="form-input" min="0" max="5000" step="100">
        </div>
        <button id="btn-save-settings" class="btn btn-secondary" style="margin-top: 10px;">
          <span>💾</span> Salvar Configurações
        </button>
      </div>

      <!-- Gerenciamento de Cenas -->
      <div class="sidebar-section">
        <h2>Cenas do Tour</h2>
        <div class="scene-list" id="scene-list-container"></div>
        
        <!-- Formulário para Adicionar Cena -->
        <div style="margin-top: 15px; border-top: 1px solid var(--border-glass); padding-top: 15px;">
          <div class="form-group">
            <label for="new-scene-title">Título da Nova Cena</label>
            <input type="text" id="new-scene-title" class="form-input" placeholder="Ex: Entrada, Sala de Estar">
          </div>
          <div class="upload-area" id="upload-trigger">
            <div class="upload-area-icon">📸</div>
            <p style="font-size: 0.8rem; font-weight: 500;">Upload Imagem 360</p>
            <p style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 2px;">Clique para selecionar JPG/PNG</p>
            <input type="file" id="new-scene-file" accept="image/jpeg, image/png" style="display: none;">
            <div class="upload-file-info" id="upload-file-info" style="display: none;"></div>
          </div>
          <button id="btn-add-scene" class="btn" style="margin-top: 10px;">
            <span>➕</span> Adicionar Cena
          </button>
        </div>
      </div>

      <!-- Hotspots da Cena Atual (Visível apenas em Modo Edição) -->
      <div class="sidebar-section" id="hotspots-section" style="display: none;">
        <h2>Hotspots da Cena</h2>
        <div class="hotspot-list" id="hotspot-list-container"></div>
      </div>

    </div>
    
    <div class="sidebar-footer">
      <button id="btn-reset-tour" class="btn btn-danger">
        <span>🔄</span> Resetar Projeto
      </button>
    </div>
  </aside>

  <main id="main-viewer">
    <div id="panorama"></div>
    
    <!-- Painel Indicador de Modo Edição -->
    <div class="edit-status-panel" id="edit-indicator" style="display: none;">
      <div class="edit-status-pulse"></div>
      <span>Modo Edição Ativo: Clique no panorama para adicionar um Hotspot</span>
    </div>
    
    <div class="help-overlay">Arrastar para rotacionar. Scroll para Zoom.</div>
  </main>

  <!-- Modal para Criação de Hotspots -->
  <div class="modal-overlay" id="hotspot-modal">
    <div class="modal">
      <div class="modal-header">
        <h3>Adicionar Hotspot</h3>
        <button class="modal-close" id="btn-close-modal">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label for="hotspot-type">Tipo de Hotspot</label>
          <select id="hotspot-type" class="form-input">
            <option value="scene">Navegação (Ir para outra cena)</option>
            <option value="info">Informação (Exibir texto)</option>
            <option value="camera3d">📷 Câmera 3D (Informativo)</option>
          </select>
        </div>
        
        <div class="form-group">
          <label for="hotspot-text">Texto do Hotspot (Tooltip)</label>
          <input type="text" id="hotspot-text" class="form-input" placeholder="Ex: Ir para Cerro Tololo ou Texto informativo">
        </div>
        
        <div class="form-group" id="hotspot-target-scene-group">
          <label for="hotspot-target-scene">Cena de Destino</label>
          <select id="hotspot-target-scene" class="form-input"></select>
        </div>
        
        <!-- Controles exclusivos para Camera 3D -->
        <div id="camera3d-options-group" style="display:none; border-top:1px solid var(--border-glass); padding-top:14px; margin-top:4px;">
          <div style="font-size:0.8rem; font-weight:700; color:var(--accent); margin-bottom:12px; display:flex; align-items:center; gap:6px;">⚙️ Configurações do Modelo 3D</div>
          <div class="form-group">
            <label for="cam3d-rot-y" style="display:flex; justify-content:space-between;">Direção Horizontal <span id="cam3d-rot-y-val" style="color:var(--accent);">0°</span></label>
            <input type="range" id="cam3d-rot-y" min="-180" max="180" step="1" value="0" style="width:100%;">
          </div>
          <div class="form-group">
            <label for="cam3d-rot-x" style="display:flex; justify-content:space-between;">Inclinação Vertical <span id="cam3d-rot-x-val" style="color:var(--accent);">0°</span></label>
            <input type="range" id="cam3d-rot-x" min="-90" max="90" step="1" value="0" style="width:100%;">
          </div>
          <div class="form-group">
            <label for="cam3d-size" style="display:flex; justify-content:space-between;">Tamanho do Modelo <span id="cam3d-size-val" style="color:var(--accent);">80px</span></label>
            <input type="range" id="cam3d-size" min="30" max="220" step="5" value="80" style="width:100%;">
          </div>
        </div>
        
        <div style="display: flex; gap: 10px; margin-top: 12px;">
          <div class="form-group" style="flex: 1;">
            <label>Pitch (Lat.)</label>
            <input type="text" id="hotspot-pitch" class="form-input" readonly>
          </div>
          <div class="form-group" style="flex: 1;">
            <label>Yaw (Long.)</label>
            <input type="text" id="hotspot-yaw" class="form-input" readonly>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button id="btn-cancel-hotspot" class="btn btn-secondary">Cancelar</button>
        <button id="btn-save-hotspot" class="btn">Salvar</button>
      </div>
    </div>
  </div>

  <!-- Modal de Visualização da Câmera (Modo View) -->
  <div class="modal-overlay" id="camera-info-modal">
    <div class="modal" style="background: rgba(9, 9, 11, 0.85); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); border: 1px solid rgba(255, 255, 255, 0.05); box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5); width: 420px; border-radius: 12px; padding: 24px;">
      <div class="modal-header" style="border-bottom: 1px solid rgba(255, 255, 255, 0.05); padding-bottom: 16px; margin-bottom: 20px;">
        <h3 id="camera-info-title" style="display:flex; align-items:center; gap:10px; font-size: 1rem; font-weight: 600; letter-spacing: 0.02em; color: var(--text-primary);">📷 Informações da Câmera</h3>
        <button class="modal-close" id="btn-close-camera-info" style="color: var(--text-muted); font-size: 1.2rem; cursor: pointer; transition: color 0.2s;">×</button>
      </div>
      <div class="modal-body" style="padding: 0;">
        <div style="display: flex; flex-direction: column; gap: 20px;">
          <div style="padding: 16px; background: rgba(255, 255, 255, 0.02); border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.03);">
            <p id="camera-info-description" style="color: var(--text-secondary); font-size: 0.9rem; line-height: 1.6; margin: 0; font-weight: 400;">
              Nenhuma informação disponível.
            </p>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--text-muted); background: transparent; padding: 0 4px;">
            <span>Status: <strong style="color: #10b981; font-weight: 600;">🔴 Gravando (Online)</strong></span>
            <span>Sinal: <strong style="color: #10b981; font-weight: 600;">📶 Excelente</strong></span>
          </div>
        </div>
      </div>
    </div>
  </div>
`;

// Sistema de Notificações Toast
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container') || (() => {
    const el = document.createElement('div');
    el.id = 'toast-container';
    document.body.appendChild(el);
    return el;
  })();
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${message}</span>
    <button style="background:transparent;border:none;color:inherit;cursor:pointer;font-weight:bold;margin-left:15px;font-size:1.1rem;">×</button>
  `;
  
  const closeBtn = toast.querySelector('button');
  closeBtn.onclick = () => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100px)';
    setTimeout(() => toast.remove(), 300);
  };
  
  container.appendChild(toast);
  
  setTimeout(() => {
    if (toast.parentNode) {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100px)';
      setTimeout(() => toast.remove(), 300);
    }
  }, 4000);
}

// Preparar Configuração do Pannellum (Preencher caminhos de arquivos das imagens do IndexedDB)
async function preparePannellumConfig() {
  const preparedConfig = JSON.parse(JSON.stringify(tourConfig));
  
  if (!preparedConfig.default) preparedConfig.default = {};
  preparedConfig.default.crossOrigin = 'anonymous'; // Forçar CORS globalmente
  
  for (const sceneId in preparedConfig.scenes) {
    const scene = preparedConfig.scenes[sceneId];
    if (scene.isSample) {
      scene.panorama = scene.panorama; // Mantém caminho relativo (/alma.jpg)
    } else {
      const dataUrl = await getSceneImage(sceneId);
      if (dataUrl) {
        scene.panorama = dataUrl + '?v=' + Date.now(); // Evita cache CORS do navegador
        scene.crossOrigin = 'anonymous'; // Garante CORS por cena
      } else {
        console.warn(`Imagem não encontrada no DB para a cena ${sceneId}. Usando fallback.`);
        scene.panorama = '/alma.jpg';
      }
    }
    
    // Configurar classes de estilo e callbacks customizados nos hotspots
    if (scene.hotSpots) {
      scene.hotSpots.forEach((hs, index) => {
        if (hs.type === 'camera3d') {
          hs.type = 'info';
          hs.cssClass = 'custom-hotspot-camera3d';
          hs.createTooltipArgs = hs.text;
          hs.createTooltipFunc = (container, text) => {
            const id = `cam3d-${Math.random().toString(36).slice(2)}`;
            container.dataset.cam3dId = id;
            requestAnimationFrame(() => mountCamera3DIcon(container, id, { 
              rotX: hs.rotX || 0, 
              rotY: hs.rotY || 0, 
              rotZ: hs.rotZ || 0, 
              size: hs.modelSize || 80,
              getHfov: () => (viewer ? viewer.getHfov() : 100),
              getIsEditMode: () => isEditMode
            }));
            
            // Ouvinte para atualizar os sliders do modal se o usuário arrastar a câmera
            container.addEventListener('camera3d-rotated', (e) => {
              // Atualiza no config preparado em memória
              hs.rotX = e.detail.rotX;
              hs.rotY = e.detail.rotY;
              
              // CRÍTICO: Atualiza também no tourConfig original para ser salvo
              const originalHs = tourConfig.scenes[sceneId].hotSpots[index];
              if (originalHs) {
                originalHs.rotX = hs.rotX;
                originalHs.rotY = hs.rotY;
              }

              const rotXInput = document.getElementById('cam3d-rot-x');
              const rotYInput = document.getElementById('cam3d-rot-y');
              // Atualiza o modal se estiver aberto e mostrando essa cena
              if (rotXInput && rotYInput && container.classList.contains('pnlm-hotspot')) {
                rotXInput.value = hs.rotX;
                rotYInput.value = hs.rotY;
                document.getElementById('cam3d-rot-x-val').textContent = Math.round(hs.rotX) + '°';
                document.getElementById('cam3d-rot-y-val').textContent = Math.round(hs.rotY) + '°';
              }
            });

            // Ouvinte para salvar as novas rotações permanentemente
            container.addEventListener('camera3d-rotate-end', async () => {
              try {
                await saveTourConfig(tourConfig);
              } catch(err) {
                if (err.message === "TABLE_MISSING") {
                  showToast("ATENÇÃO: Crie a tabela no Supabase para salvar.", "error");
                }
              }
            });

            // Lógica de clique na câmera: Em modo visualização, dar zoom e exibir modal
            container.addEventListener('click', (e) => {
              if (!isEditMode && viewer) {
                // Dar zoom focado na câmera
                viewer.lookAt(hs.pitch, hs.yaw, 40, 1500); // 40 HFOV = zoom alto, 1500ms anim
                
                // Exibir modal de info transparente
                setTimeout(() => {
                  document.getElementById('camera-info-title').innerHTML = `📷 ${hsText || 'Câmera 3D'}`;
                  document.getElementById('camera-info-description').textContent = hsText 
                    ? `Aqui você pode adicionar informações e transmissões ao vivo da ${hsText}.` 
                    : 'Ponto de visualização da câmera de segurança. Tudo normal no ambiente.';
                  document.getElementById('camera-info-modal').classList.add('active');
                }, 500); // Aguarda a animação começar para abrir o modal
              }
            });

            // Tooltip de texto ao passar o mouse
            const span = document.createElement('span');
            span.className = 'pnlm-tooltip';
            span.innerHTML = text;
            container.appendChild(span);
          };
        } else if (hs.type === 'scene') {
          hs.cssClass = 'custom-hotspot-nav';
        } else {
          hs.cssClass = 'custom-hotspot-info';
        }
      });
    }
  }
  
  return preparedConfig;
}

// Inicializar ou Atualizar o Visualizador Pannellum
async function initViewer(startSceneId) {
  const preparedConfig = await preparePannellumConfig();
  
  // Se já houver um visualizador ativo, destruí-lo e limpar renderers 3D
  if (viewer) {
    destroyAllCamera3DIcons();
    try {
      viewer.destroy();
    } catch (e) {
      console.error("Erro ao destruir visualizador anterior:", e);
    }
    viewer = null;
  }
  
  // Definir primeira cena
  if (startSceneId && preparedConfig.scenes[startSceneId]) {
    preparedConfig.default.firstScene = startSceneId;
  } else if (!preparedConfig.scenes[preparedConfig.default.firstScene]) {
    preparedConfig.default.firstScene = Object.keys(preparedConfig.scenes)[0];
  }
  
  currentSceneId = preparedConfig.default.firstScene;
  
  // Instanciar Pannellum
  try {
    viewer = window.pannellum.viewer('panorama', preparedConfig);
  } catch (e) {
    console.error("Erro ao iniciar Pannellum:", e);
    showToast("Erro ao carregar o visualizador 360", "error");
    return;
  }
  
  // Registrar escutadores de eventos do visualizador
  viewer.on('scenechange', (newSceneId) => {
    destroyAllCamera3DIcons(); // IMPORTANTÍSSIMO: Limpar renderizadores 3D da cena anterior para evitar WebGL context loss!
    currentSceneId = newSceneId;
    updateSidebarActiveScene();
    renderHotspotsList();
  });
  
  viewer.on('load', () => {
    renderHotspotsList();
  });

  updateSidebarActiveScene();
  renderHotspotsList();
}

// Atualizar classe ativa na barra lateral para a cena atual
function updateSidebarActiveScene() {
  document.querySelectorAll('.scene-item').forEach(item => {
    if (item.dataset.id === currentSceneId) {
      item.classList.add('active');
      // Scrollar suavemente até o item ativo
      item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      item.classList.remove('active');
    }
  });
}

// Renderizar a lista de cenas na barra lateral
function renderSceneList() {
  const container = document.getElementById('scene-list-container');
  container.innerHTML = '';
  
  const sceneIds = Object.keys(tourConfig.scenes);
  
  sceneIds.forEach(sceneId => {
    const scene = tourConfig.scenes[sceneId];
    const item = document.createElement('div');
    item.className = 'scene-item';
    item.dataset.id = sceneId;
    
    // Evitar que cliques no botão de deletar propaguem para a seleção da cena
    item.onclick = (e) => {
      if (e.target.closest('.delete-btn')) return;
      if (currentSceneId !== sceneId) {
        if (viewer) {
          try {
            viewer.loadScene(sceneId);
          } catch (err) {
            initViewer(sceneId);
          }
        } else {
          initViewer(sceneId);
        }
      }
    };
    
    const isSample = scene.isSample;
    const badgeText = isSample ? 'Amostra' : 'Upload';
    const badgeClass = isSample ? 'scene-badge' : 'scene-badge user-scene';
    
    item.innerHTML = `
      <div class="scene-info">
        <span class="scene-title" title="${scene.title}">${scene.title}</span>
        <span class="${badgeClass}">${badgeText}</span>
      </div>
      <button class="delete-btn" title="Deletar cena" ${sceneIds.length <= 1 ? 'disabled style="opacity:0.3; cursor:not-allowed;"' : ''}>
        🗑️
      </button>
    `;
    
    const deleteBtn = item.querySelector('.delete-btn');
    if (sceneIds.length > 1) {
      deleteBtn.onclick = async () => {
        if (confirm(`Deseja realmente deletar a cena "${scene.title}"?`)) {
          await removeScene(sceneId);
        }
      };
    }
    
    container.appendChild(item);
  });
  
  updateSidebarActiveScene();
}

// Remover uma cena do tour
async function removeScene(sceneId) {
  const scene = tourConfig.scenes[sceneId];
  if (!scene) return;
  
  // Se for uma cena de upload, limpar imagem no IndexedDB
  if (!scene.isSample) {
    await deleteSceneImage(sceneId);
  }
  
  // Limpar hotspots de outras cenas que apontam para esta
  for (const sId in tourConfig.scenes) {
    const s = tourConfig.scenes[sId];
    if (s.hotSpots) {
      s.hotSpots = s.hotSpots.filter(hs => hs.sceneId !== sceneId);
    }
  }
  
  // Remover a cena do config
  delete tourConfig.scenes[sceneId];
  
  // Se a cena deletada for a inicial, definir outra
  if (tourConfig.default.firstScene === sceneId) {
    tourConfig.default.firstScene = Object.keys(tourConfig.scenes)[0];
  }
  
  // Salvar alterações
  await saveTourConfig(tourConfig);
  showToast("Cena removida do tour.");
  
  // Recarregar UI
  renderSceneList();
  populateDropdowns();
  
  // Se a cena deletada era a ativa, mudar para outra
  if (currentSceneId === sceneId) {
    initViewer(tourConfig.default.firstScene);
  } else {
    initViewer(currentSceneId);
  }
}

// Preencher selects dropdowns da interface
function populateDropdowns() {
  const firstSceneSelect = document.getElementById('tour-first-scene');
  const targetSceneSelect = document.getElementById('hotspot-target-scene');
  
  const originalFirstScene = firstSceneSelect.value || tourConfig.default.firstScene;
  
  firstSceneSelect.innerHTML = '';
  targetSceneSelect.innerHTML = '';
  
  for (const sceneId in tourConfig.scenes) {
    const scene = tourConfig.scenes[sceneId];
    
    // Dropdown de primeira cena
    const opt1 = document.createElement('option');
    opt1.value = sceneId;
    opt1.textContent = scene.title;
    firstSceneSelect.appendChild(opt1);
    
    // Dropdown de cena alvo para hotspot
    const opt2 = document.createElement('option');
    opt2.value = sceneId;
    opt2.textContent = scene.title;
    targetSceneSelect.appendChild(opt2);
  }
  
  if (tourConfig.scenes[originalFirstScene]) {
    firstSceneSelect.value = originalFirstScene;
  }
}

// Renderizar lista de hotspots da cena atual (modo de edição)
function renderHotspotsList() {
  const container = document.getElementById('hotspot-list-container');
  if (!container) return;
  
  container.innerHTML = '';
  
  const scene = tourConfig.scenes[currentSceneId];
  if (!scene || !scene.hotSpots || scene.hotSpots.length === 0) {
    container.innerHTML = '<div style="font-size: 0.75rem; color: var(--text-muted); text-align: center; padding: 10px;">Nenhum hotspot nesta cena.</div>';
    return;
  }
  
  scene.hotSpots.forEach((hs, index) => {
    const item = document.createElement('div');
    item.className = 'hotspot-item';
    
    let icon;
    if (hs.type === 'scene') icon = '🔗';
    else if (hs.type === 'camera3d') icon = '📷';
    else icon = 'ℹ️';

    const detail = (hs.type === 'scene')
      ? `Ir para: ${tourConfig.scenes[hs.sceneId]?.title || hs.sceneId}` 
      : 'Texto informativo';
      
    item.innerHTML = `
      <div style="min-width: 0; flex-grow: 1; margin-right: 10px;">
        <div style="font-weight: 600; font-size: 0.75rem; color: var(--text-primary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
          ${icon} ${hs.text || '(Sem texto)'}
        </div>
        <div style="font-size: 0.7rem; color: var(--text-secondary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
          ${detail} (P: ${Math.round(hs.pitch)}°, Y: ${Math.round(hs.yaw)}°)
        </div>
      </div>
      <button class="delete-btn" title="Remover Hotspot">
        🗑️
      </button>
    `;
    
    item.querySelector('.delete-btn').onclick = async () => {
      if (confirm("Deseja realmente remover este hotspot?")) {
        scene.hotSpots.splice(index, 1);
        await saveTourConfig(tourConfig);
        showToast("Hotspot removido!");
        initViewer(currentSceneId);
      }
    };
    
    container.appendChild(item);
  });
}

// Abrir Modal de Hotspot
function openHotspotModal(pitch, yaw) {
  document.getElementById('hotspot-pitch').value = pitch.toFixed(2);
  document.getElementById('hotspot-yaw').value = yaw.toFixed(2);
  document.getElementById('hotspot-text').value = '';
  
  // Limpar e popular cenas disponíveis excluindo a atual (opcional, mas recomendado)
  const targetSceneSelect = document.getElementById('hotspot-target-scene');
  targetSceneSelect.innerHTML = '';
  
  let hasOtherScenes = false;
  for (const sceneId in tourConfig.scenes) {
    if (sceneId === currentSceneId) continue;
    
    hasOtherScenes = true;
    const scene = tourConfig.scenes[sceneId];
    const opt = document.createElement('option');
    opt.value = sceneId;
    opt.textContent = scene.title;
    targetSceneSelect.appendChild(opt);
  }
  
  const typeSelect = document.getElementById('hotspot-type');
  const targetGroup = document.getElementById('hotspot-target-scene-group');
  const cam3dGroup = document.getElementById('camera3d-options-group');
  
  // Resetar sliders da câmera 3D para padrão
  document.getElementById('cam3d-rot-y').value = 0;
  document.getElementById('cam3d-rot-x').value = 0;
  document.getElementById('cam3d-size').value = 80;
  document.getElementById('cam3d-rot-y-val').textContent = '0°';
  document.getElementById('cam3d-rot-x-val').textContent = '0°';
  document.getElementById('cam3d-size-val').textContent = '80px';
  
  // Se não houver outras cenas, desabilitar navegação (scene)
  if (!hasOtherScenes) {
    typeSelect.value = 'info';
    typeSelect.options[0].disabled = true; // Desabilita 'scene'
    targetGroup.style.display = 'none';
    cam3dGroup.style.display = 'none';
  } else {
    typeSelect.options[0].disabled = false;
    typeSelect.value = 'scene';
    targetGroup.style.display = 'block';
    cam3dGroup.style.display = 'none';
  }
  // Câmera 3D é informativa e sempre fica disponível
  typeSelect.options[2].disabled = false;
  
  document.getElementById('hotspot-modal').classList.add('active');
}

// Fechar Modal de Hotspot
function closeHotspotModal() {
  document.getElementById('hotspot-modal').classList.remove('active');
}

// Salvar Novo Hotspot
async function saveNewHotspot() {
  const type = document.getElementById('hotspot-type').value;
  const text = document.getElementById('hotspot-text').value.trim();
  const pitch = parseFloat(document.getElementById('hotspot-pitch').value);
  const yaw = parseFloat(document.getElementById('hotspot-yaw').value);
  const sceneId = document.getElementById('hotspot-target-scene').value;
  
  if (!text) {
    showToast("Por favor, insira o texto da dica do hotspot.", "error");
    return;
  }
  
  if (type === 'scene' && !sceneId) {
    showToast("Por favor, selecione uma cena de destino.", "error");
    return;
  }
  
  const activeScene = tourConfig.scenes[currentSceneId];
  if (!activeScene.hotSpots) {
    activeScene.hotSpots = [];
  }

  const newHs = {
    pitch,
    yaw,
    type,
    text
  };
  
  if (type === 'scene') {
    newHs.sceneId = sceneId;
  }
  
  // Salvar parâmetros extras da Câmera 3D
  if (type === 'camera3d') {
    newHs.rotX = parseFloat(document.getElementById('cam3d-rot-x').value) || 0;
    newHs.rotY = parseFloat(document.getElementById('cam3d-rot-y').value) || 0;
    newHs.rotZ = 0;
    newHs.modelSize = parseInt(document.getElementById('cam3d-size').value) || 80;
  }
  
  activeScene.hotSpots.push(newHs);
  
  try {
    await saveTourConfig(tourConfig);
    closeHotspotModal();
    showToast("Hotspot criado com sucesso!");
    initViewer(currentSceneId);
  } catch(err) {
    console.error("Erro ao salvar hotspot:", err);
    if (err.message === "TABLE_MISSING") {
      showToast("ATENÇÃO: A tabela 'tour_config' não existe no Supabase.", "error");
    } else {
      showToast("Erro ao salvar hotspot.", "error");
    }
  }
}

// Atualizar Interface baseado no Modo (Edição vs Visualização)
function updateEditModeUI() {
  const editIndicator = document.getElementById('edit-indicator');
  const hotspotsSection = document.getElementById('hotspots-section');
  const btnPreview = document.getElementById('btn-preview-mode');
  const btnEdit = document.getElementById('btn-edit-mode');
  
  if (isEditMode) {
    editIndicator.style.display = 'flex';
    hotspotsSection.style.display = 'block';
    btnEdit.classList.add('active');
    btnPreview.classList.remove('active');
  } else {
    editIndicator.style.display = 'none';
    hotspotsSection.style.display = 'none';
    btnPreview.classList.add('active');
    btnEdit.classList.remove('active');
  }
  
  renderHotspotsList();
}

// Adicionar Nova Cena (Formulário)
async function handleAddScene() {
  const titleInput = document.getElementById('new-scene-title');
  const title = titleInput.value.trim();
  
  if (!title) {
    showToast("Escreva um título para a nova cena.", "error");
    return;
  }
  
  if (!selectedFile) {
    showToast("Selecione um arquivo de imagem panorâmica 360°.", "error");
    return;
  }
  
  let ext = 'jpg';
  if (selectedFile.name.includes('.')) {
    ext = selectedFile.name.split('.').pop().toLowerCase();
  }
  const sceneId = 'scene_' + Date.now() + '.' + ext;
  
  // Criar registro na configuração do tour
  tourConfig.scenes[sceneId] = {
    title: title,
    type: 'equirectangular',
    panorama: null, // Será obtido como blob URL
    hotSpots: []
  };
  
  try {
    // Salvar imagem no banco IndexedDB
    await saveSceneImage(sceneId, selectedFile);
    
    // Salvar configuração atualizada no IndexedDB
    await saveTourConfig(tourConfig);
    
    showToast(`Cena "${title}" adicionada com sucesso!`);
    
    // Resetar campos
    titleInput.value = '';
    selectedFile = null;
    const fileInfo = document.getElementById('upload-file-info');
    fileInfo.style.display = 'none';
    fileInfo.textContent = '';
    
    // Recarregar UI e Visualizador na nova cena
    renderSceneList();
    populateDropdowns();
    await initViewer(sceneId);
    
  } catch (err) {
    console.error("Erro ao salvar nova cena:", err);
    if (err.message === "TABLE_MISSING") {
      showToast("ATENÇÃO: A tabela 'tour_config' não existe no Supabase. Por favor, execute o SQL do arquivo setup-supabase.mjs no painel do Supabase.", "error");
    } else {
      showToast("Falha ao salvar a nova cena.", "error");
    }
  }
}

// Salvar Configurações Globais
async function saveGlobalSettings() {
  const author = document.getElementById('tour-author').value.trim();
  const firstScene = document.getElementById('tour-first-scene').value;
  const fade = parseInt(document.getElementById('tour-fade').value) || 0;
  
  tourConfig.default.author = author;
  tourConfig.default.firstScene = firstScene;
  tourConfig.default.sceneFadeDuration = fade;
  
  try {
    await saveTourConfig(tourConfig);
    showToast("Configurações do tour salvas!");
    initViewer(currentSceneId);
  } catch (err) {
    console.error(err);
    if (err.message === "TABLE_MISSING") {
      showToast("ATENÇÃO: A tabela 'tour_config' não existe no Supabase. Por favor, execute o SQL do arquivo setup-supabase.mjs no painel do Supabase.", "error");
    } else {
      showToast("Erro ao salvar as configurações.", "error");
    }
  }
}

// Resetar o Projeto Completo
async function handleResetProject() {
  if (confirm("Isso apagará permanentemente todas as suas cenas de upload e hotspots adicionados. Deseja redefinir o projeto para os valores padrão?")) {
    try {
      await clearAll();
      tourConfig = JSON.parse(JSON.stringify(defaultTourConfig));
      await saveTourConfig(tourConfig);
      
      showToast("Projeto resetado para os valores padrão.");
      
      // Resetar estados
      selectedFile = null;
      document.getElementById('new-scene-title').value = '';
      document.getElementById('upload-file-info').style.display = 'none';
      
      // Inicializar
      renderSceneList();
      populateDropdowns();
      
      document.getElementById('tour-author').value = tourConfig.default.author;
      document.getElementById('tour-fade').value = tourConfig.default.sceneFadeDuration;
      
      await initViewer('alma');
    } catch (err) {
      console.error(err);
      showToast("Erro ao resetar o projeto.", "error");
    }
  }
}

// Inicializar tudo ao carregar a página
async function initApp() {
  try {
    await initDB();
    
    // Tentar obter configuração existente
    let savedConfig = await getTourConfig();
    if (!savedConfig) {
      // Usar amostras padrão se estiver vazio
      savedConfig = JSON.parse(JSON.stringify(defaultTourConfig));
      try {
        await saveTourConfig(savedConfig);
      } catch(saveErr) {
        // Se a tabela ainda não existe, continua em memória mesmo assim
        console.warn('Tabela tour_config não encontrada — usando config padrão em memória.', saveErr.message);
      }
    }
    
    tourConfig = savedConfig;
    
    // Preencher campos de input nas configurações
    document.getElementById('tour-author').value = tourConfig.default.author || '';
    document.getElementById('tour-fade').value = tourConfig.default.sceneFadeDuration || 1000;
    
    // Renderizar componentes estáticos e dinâmicos
    renderSceneList();
    populateDropdowns();
    
    // Iniciar visualizador com a primeira cena
    await initViewer(tourConfig.default.firstScene);
    
    // Registrar eventos dos botões de Modo
    document.getElementById('btn-preview-mode').onclick = () => {
      isEditMode = false;
      updateEditModeUI();
    };
    
    document.getElementById('btn-edit-mode').onclick = () => {
      isEditMode = true;
      updateEditModeUI();
    };
    
    // Configurações do Tour
    document.getElementById('btn-save-settings').onclick = saveGlobalSettings;
    
    // Eventos do Upload de Arquivo
    const fileInput = document.getElementById('new-scene-file');
    const uploadTrigger = document.getElementById('upload-trigger');
    const fileInfo = document.getElementById('upload-file-info');
    
    uploadTrigger.onclick = () => fileInput.click();
    
    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        selectedFile = file;
        fileInfo.textContent = `Selecionado: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
        fileInfo.style.display = 'block';
      }
    };
    
    // Adicionar Cena
    document.getElementById('btn-add-scene').onclick = handleAddScene;
    
    // Resetar Projeto
    document.getElementById('btn-reset-tour').onclick = handleResetProject;
    
    // Eventos do Modal de Hotspot
    document.getElementById('btn-close-modal').onclick = closeHotspotModal;
    document.getElementById('btn-cancel-hotspot').onclick = closeHotspotModal;
    document.getElementById('btn-save-hotspot').onclick = saveNewHotspot;
    
    // Eventos do Modal de Info da Câmera
    document.getElementById('btn-close-camera-info').onclick = () => {
      document.getElementById('camera-info-modal').classList.remove('active');
    };
    
    // Tratar exibição condicional no Modal baseado no tipo
    document.getElementById('hotspot-type').onchange = (e) => {
      const targetGroup = document.getElementById('hotspot-target-scene-group');
      const cam3dGroup = document.getElementById('camera3d-options-group');
      const val = e.target.value;
      targetGroup.style.display = (val === 'scene') ? 'block' : 'none';
      cam3dGroup.style.display = (val === 'camera3d') ? 'block' : 'none';
    };
    
    // Atualizar labels dos sliders da Câmera 3D em tempo real
    const sliders = [
      { id: 'cam3d-rot-y', label: 'cam3d-rot-y-val', suffix: '°' },
      { id: 'cam3d-rot-x', label: 'cam3d-rot-x-val', suffix: '°' },
      { id: 'cam3d-size',  label: 'cam3d-size-val',  suffix: 'px' },
    ];
    sliders.forEach(({ id, label, suffix }) => {
      document.getElementById(id).addEventListener('input', (e) => {
        document.getElementById(label).textContent = e.target.value + suffix;
      });
    });
    
    // Clique no panorama para adicionar hotspot (Apenas em Modo Edição)
    const panoramaEl = document.getElementById('panorama');
    panoramaEl.addEventListener('mousedown', (e) => {
      mouseDownX = e.clientX;
      mouseDownY = e.clientY;
    });
    
    panoramaEl.addEventListener('mouseup', (e) => {
      if (!isEditMode) return;
      
      const diffX = Math.abs(e.clientX - mouseDownX);
      const diffY = Math.abs(e.clientY - mouseDownY);
      
      // Se moveu mais que 5 pixels, assumimos que foi uma rotação e não um clique limpo
      if (diffX < 5 && diffY < 5) {
        if (viewer) {
          const coords = viewer.mouseEventToCoords(e);
          if (coords) {
            const pitch = coords[0];
            const yaw = coords[1];
            
            // Garantir que não clicamos em cima de um hotspot existente
            if (e.target.closest('.pnlm-hotspot-layer') || e.target.closest('.custom-hotspot-nav') || e.target.closest('.custom-hotspot-info') || e.target.closest('.custom-hotspot-camera3d')) {
              return; 
            }
            
            openHotspotModal(pitch, yaw);
          }
        }
      }
    });
    
    // Evento de Toggle da Sidebar (Dispositivos Móveis)
    const toggleBtn = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    
    toggleBtn.onclick = () => {
      sidebar.classList.toggle('open');
      toggleBtn.textContent = sidebar.classList.contains('open') ? '✕' : '☰';
    };
    
  } catch (err) {
    console.error("Erro na inicialização da aplicação:", err);
    showToast("Falha geral ao iniciar o aplicativo.", "error");
  }
}

// Executar após carregamento do DOM
window.addEventListener('DOMContentLoaded', initApp);
