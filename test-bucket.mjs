import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://mgbsoldvgnsrkfojspdg.supabase.co',
  'sb_publishable_5krCmfGmayVh2hTIs_b1BA_XhXpI5Wo'
);

async function testBucket() {
  console.log('🧪 Testando upload no bucket tour_images...');
  
  const testContent = new Blob(['test-ok'], { type: 'text/plain' });
  const { data, error } = await supabase.storage
    .from('tour_images')
    .upload('_test_connection.txt', testContent, { upsert: true });

  if (error) {
    console.log('❌ Erro no bucket:', error.message);
    console.log('   Código:', error.statusCode || error.code);
  } else {
    console.log('✅ Bucket tour_images OK! Upload de teste funcionou.');
    // limpar o arquivo de teste
    await supabase.storage.from('tour_images').remove(['_test_connection.txt']);
    console.log('🧹 Arquivo de teste removido.');
  }
}

testBucket().catch(console.error);
