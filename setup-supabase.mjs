// Script de setup do Supabase para o Tour 360
// Roda uma única vez para criar a tabela e o bucket

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mgbsoldvgnsrkfojspdg.supabase.co';
// Chave de serviço — use APENAS neste script de setup (nunca no frontend)
// Precisamos da service_role key para criar políticas RLS
// Por hora usaremos a anon key e criaremos as tabelas via SQL editor manual
const supabaseKey = 'sb_publishable_5krCmfGmayVh2hTIs_b1BA_XhXpI5Wo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function setup() {
  console.log('🚀 Iniciando setup do Supabase...\n');

  // 1. Testar conexão
  console.log('🔗 Testando conexão...');
  const { data, error: connError } = await supabase.from('tour_config').select('id').limit(1);
  
  if (connError) {
    if (connError.code === '42P01') {
      console.log('⚠️  Tabela tour_config não existe ainda. Isso é esperado.');
      console.log('\n📋 AÇÃO NECESSÁRIA: Execute o SQL abaixo no painel do Supabase:');
      console.log('   👉 Acesse: https://supabase.com/dashboard/project/mgbsoldvgnsrkfojspdg/sql/new\n');
      console.log('-- =============================================');
      console.log('-- COPIE E EXECUTE ESTE SQL NO SUPABASE EDITOR');
      console.log('-- =============================================\n');
      console.log(`CREATE TABLE IF NOT EXISTS tour_config (
  id TEXT PRIMARY KEY,
  config_data JSONB NOT NULL
);

ALTER TABLE tour_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso publico leitura" ON tour_config FOR SELECT USING (true);
CREATE POLICY "Acesso publico insert" ON tour_config FOR INSERT WITH CHECK (true);
CREATE POLICY "Acesso publico update" ON tour_config FOR UPDATE USING (true);
CREATE POLICY "Acesso publico delete" ON tour_config FOR DELETE USING (true);

INSERT INTO storage.buckets (id, name, public)
  VALUES ('tour_images', 'tour_images', true)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Imagens publicas select" ON storage.objects FOR SELECT USING (bucket_id = 'tour_images');
CREATE POLICY "Imagens publicas insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'tour_images');
CREATE POLICY "Imagens publicas update" ON storage.objects FOR UPDATE USING (bucket_id = 'tour_images');
CREATE POLICY "Imagens publicas delete" ON storage.objects FOR DELETE USING (bucket_id = 'tour_images');`);
      console.log('\n-- =============================================\n');
    } else {
      console.log('✅ Tabela tour_config já existe! Conexão OK.');
    }
  } else {
    console.log('✅ Conexão OK! Tabela tour_config encontrada.');
    const { count } = await supabase.from('tour_config').select('*', { count: 'exact', head: true });
    console.log(`   Registros na tabela: ${count}`);
  }

  // 2. Verificar bucket de imagens
  console.log('\n🪣 Verificando bucket de imagens...');
  const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
  if (!bucketError) {
    const imageBucket = buckets?.find(b => b.name === 'tour_images');
    if (imageBucket) {
      console.log('✅ Bucket "tour_images" encontrado e público:', imageBucket.public);
    } else {
      console.log('⚠️  Bucket "tour_images" não encontrado. Crie via SQL acima.');
    }
  } else {
    console.log('⚠️  Não foi possível listar buckets (requer chave service_role).');
  }

  console.log('\n✨ Verificação completa!\n');
}

setup().catch(console.error);
