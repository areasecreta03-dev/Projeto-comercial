// Módulo de Banco de Dados Local usando IndexedDB para o Editor de Tour Virtual
const DB_NAME = 'VirtualTourDB';
const DB_VERSION = 1;

let dbInstance = null;

export function initDB() {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('Erro ao abrir o IndexedDB:', event.target.error);
      reject(event.target.error);
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Armazena as imagens 360 (Blobs) indexadas pelo ID da cena
      if (!db.objectStoreNames.contains('images')) {
        db.createObjectStore('images');
      }

      // Armazena as configurações do tour (JSON)
      if (!db.objectStoreNames.contains('config')) {
        db.createObjectStore('config');
      }
    };
  });
}

// Salvar a configuração geral do Tour
export async function saveTourConfig(config) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['config'], 'readwrite');
    const store = transaction.objectStore('config');
    const request = store.put(config, 'current_tour');

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

// Obter a configuração geral do Tour
export async function getTourConfig() {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['config'], 'readonly');
    const store = transaction.objectStore('config');
    const request = store.get('current_tour');

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

// Salvar a imagem de uma cena específica (Blob ou File)
export async function saveSceneImage(sceneId, imageBlob) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['images'], 'readwrite');
    const store = transaction.objectStore('images');
    const request = store.put(imageBlob, sceneId);

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

// Obter a imagem de uma cena específica como Object URL
export async function getSceneImage(sceneId) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['images'], 'readonly');
    const store = transaction.objectStore('images');
    const request = store.get(sceneId);

    request.onsuccess = () => {
      if (request.result) {
        try {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(request.result);
        } catch (e) {
          console.error("Erro ao converter imagem do DB para DataURL", e);
          resolve(null);
        }
      } else {
        resolve(null);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

// Deletar a imagem de uma cena
export async function deleteSceneImage(sceneId) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['images'], 'readwrite');
    const store = transaction.objectStore('images');
    const request = store.delete(sceneId);

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

// Limpar banco de dados completo
export async function clearAll() {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['config', 'images'], 'readwrite');
    transaction.objectStore('config').clear();
    transaction.objectStore('images').clear();

    transaction.oncomplete = () => resolve(true);
    transaction.onerror = () => reject(transaction.error);
  });
}
