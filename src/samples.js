// Amostras padrão para carregar no primeiro acesso se o IndexedDB estiver vazio
export const defaultTourConfig = {
  default: {
    firstScene: 'alma',
    author: 'Editor de Tour Virtual',
    sceneFadeDuration: 1000,
    crossOrigin: 'anonymous'
  },
  scenes: {
    alma: {
      title: 'Observatório ALMA (Atacama)',
      type: 'equirectangular',
      panorama: '/alma.jpg', // Caminho local (da pasta public)
      isSample: true, // Indica que é uma amostra local e não requer carregar do IndexedDB
      hotSpots: [
        {
          pitch: -5.0,
          yaw: 120.0,
          type: 'scene',
          text: 'Ir para o Telescópio Cerro Tololo',
          sceneId: 'cerro_tololo'
        },
        {
          pitch: 10.0,
          yaw: 0.0,
          type: 'info',
          text: 'Estações de antenas do rádio-observatório ALMA localizadas a 5.000 metros de altitude.'
        }
      ]
    },
    cerro_tololo: {
      title: 'Telescópio Cerro Tololo',
      type: 'equirectangular',
      panorama: '/cerro-tololo.jpg', // Caminho local (da pasta public)
      isSample: true,
      hotSpots: [
        {
          pitch: -2.0,
          yaw: -30.0,
          type: 'scene',
          text: 'Voltar ao Observatório ALMA',
          sceneId: 'alma'
        },
        {
          pitch: 15.0,
          yaw: 45.0,
          type: 'info',
          text: 'Telescópio Víctor M. Blanco de 4 metros no Observatório Interamericano de Cerro Tololo.'
        }
      ]
    }
  }
};
