# 📄 Final PRD: Sushi-Fetch v0.7.0 (The Interceptor Implementation)

1. Arsitektur: "The Chain of Command"

Kita akan memasukkan Interceptor langsung ke dalam Main Request Flow.

- Request Interceptor: Akan menjadi async function yang membungkus fetch. Jika ada, dia akan memodifikasi options sebelum fetch ditembakkan.
- Response Interceptor: Akan memproses hasil fetch sebelum datanya di-return ke user. Ini memungkinkan user melakukan "Global Error Handling" (misal: cek status 401).

2. Decision: "Minimalist Logic"

- Async by Default: ✅ YES. User butuh ini untuk ambil token dari storage yang asinkron.
- Error Interceptor: ❌ NO. Kita satukan di response. Jika !res.ok, user bisa langsung throw atau redirect di dalam response interceptor. Ini menghemat sekitar 100 bytes.
- Implementation: Langsung di dalam createSushi.

## 💻 Draft Kode v0.7.0 (Preview)

Ini adalah bocoran logika yang akan saya tanam. Sangat clean dan tidak ada pengulangan kode:

```js
// Di dalam core sushi-fetch
async function request(url, options = {}) {
  // 1. Request Interceptor (The Gatekeeper)
  if (config.interceptors?.request) {
    options = await config.interceptors.request(url, options) || options;
  }

  try {
    let response = await fetch(url, options);

    // 2. Response Interceptor (The Filter)
    if (config.interceptors?.response) {
      response = await config.interceptors.response(response) || response;
    }

    // 3. Existing Logic (Deduplication & SWR)
    // ... logic lu yang lama tetep aman di sini ...

    return response;
  } catch (err) {
    throw err;
  }
}
```
