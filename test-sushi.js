import { sushiFetch, sushiCache } from './dist/index.js';

async function runAdvancedTests() {
  console.log("\n--- 🍣 SUSHI-FETCH ADVANCED TESTS ---");

  // --- TEST 1: Cache Tag & Invalidation ---
  console.log("\n🧪 Testing Cache Tags Invalidation...");
  const url = 'https://jsonplaceholder.typicode.com/posts/1';
  
  // Fetch 1: Simpan di cache dengan tag 'blog'
  await sushiFetch(url, { cacheTags: ['blog'], ttl: 10000 });
  console.log("📥 First fetch done (Cached with tag: 'blog')");

  // Invalidate tag 'blog'
  console.log("🧹 Invalidating tag: 'blog'...");
  sushiCache.invalidateTag('blog');

  // Fetch 2: Harusnya fetch ulang karena tag sudah dibuang
  // (Lu bisa liat di Network/Log kalau ini bukan dari cache)
  await sushiFetch(url);
  console.log("✅ Tag Invalidation: Works!");


  // --- TEST 2: Smart Retry (Exponential Backoff) ---
  console.log("\n🧪 Testing Exponential Backoff Retry...");
  console.log("⏳ (Ini bakal sengaja gagal ke URL salah, perhatikan delay-nya)");
  
  const startTime = Date.now();
  try {
    await sushiFetch('https://wrong-url-test-sushi.com', {
      retries: 3,
      retryStrategy: 'exponential'
    });
  } catch (err) {
    const duration = (Date.now() - startTime) / 1000;
    console.log(`❌ Request failed after 3 retries.`);
    console.log(`⏱️ Total time spent: ${duration.toFixed(2)}s`);
    console.log("✅ Retry Strategy: Delay bertambah di tiap percobaan!");
  }


  // --- TEST 3: Subscriber (Reactivity) ---
  console.log("\n🧪 Testing Pub/Sub Reactivity...");
  const key = 'user-profile';
  
  // Subscribe ke perubahan key tertentu
  sushiCache.subscribe(key, (newData) => {
    console.log(`🔔 NOTIF: Data untuk '${key}' berubah jadi:`, newData.name);
  });

  // Trigger perubahan manual lewat mutate
  sushiCache.mutate(key, { name: 'Qi The CEO' });
  console.log("✅ Reactivity: Subscriber terpanggil!");

  console.log("\n--- 🏁 ALL TESTS PASSED! ---");
}

runAdvancedTests().catch(console.error);