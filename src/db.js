import { createClient } from '@supabase/supabase-js';

// A chave anon do Supabase é PÚBLICA por design — pode ser exposta no frontend
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mgbsoldvgnsrkfojspdg.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_5krCmfGmayVh2hTIs_b1BA_XhXpI5Wo';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function initDB() {
  // Mantido para compatibilidade com o código existente
  return true;
}

// Salvar a configuração geral do Tour no Supabase
export async function saveTourConfig(config) {
  const { data, error } = await supabase
    .from('tour_config')
    .upsert({ id: 'default', config_data: config }, { onConflict: 'id' });
    
  if (error) {
    console.error('Erro ao salvar config no Supabase:', error);
    if (error.code === 'PGRST205' || error.code === '42P01') {
      throw new Error("TABLE_MISSING");
    }
    throw error;
  }
  return true;
}

// Obter a configuração geral do Tour do Supabase
export async function getTourConfig() {
  const { data, error } = await supabase
    .from('tour_config')
    .select('config_data')
    .eq('id', 'default')
    .single();
    
  // PGRST116: Sem registros; PGRST205/42P01: Tabela não existe
  if (error && !['PGRST116', 'PGRST205', '42P01'].includes(error.code)) {
    console.error('Erro ao buscar config no Supabase:', error);
    throw error;
  }
  return data ? data.config_data : null;
}

// Salvar a imagem de uma cena no Supabase Storage
export async function saveSceneImage(sceneId, imageBlob) {
  const { data, error } = await supabase
    .storage
    .from('tour_images')
    .upload(sceneId, imageBlob, {
      upsert: true,
      cacheControl: '3600'
    });
    
  if (error) {
    console.error('Erro ao fazer upload da imagem:', error);
    throw error;
  }
  return true;
}

// Obter a URL pública da imagem de uma cena
export async function getSceneImage(sceneId) {
  // Verificar se a imagem existe no bucket primeiro
  const { data: files, error } = await supabase.storage.from('tour_images').list('', {
    search: sceneId
  });
  
  const exists = files && files.find(f => f.name === sceneId);
  
  if (error || !exists) {
    return null;
  }
  
  const { data } = supabase.storage.from('tour_images').getPublicUrl(sceneId);
  return data.publicUrl;
}

// Deletar a imagem de uma cena
export async function deleteSceneImage(sceneId) {
  const { data, error } = await supabase
    .storage
    .from('tour_images')
    .remove([sceneId]);
    
  if (error) {
    console.error('Erro ao deletar imagem:', error);
    throw error;
  }
  return true;
}

// Limpar banco de dados completo (Reset)
export async function clearAll() {
  // Deleta as configs
  await supabase.from('tour_config').delete().eq('id', 'default');
  
  // Deleta todas as imagens do storage
  const { data: files } = await supabase.storage.from('tour_images').list();
  if (files && files.length > 0) {
    const fileNames = files.map(x => x.name);
    await supabase.storage.from('tour_images').remove(fileNames);
  }
  return true;
}
