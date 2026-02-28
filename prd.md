# Product Requirements Document (PRD) - Sushi-Fetch v0.4.0

## 🎯 Tujuan Rilis (Goal)
Memperkuat pondasi `sushi-fetch` dengan mengimplementasikan fitur **Global Config** dan **Strict Rules**. Tujuannya agar library ini stabil, skalabel, dan siap menampung fitur-fitur kompleks di versi selanjutnya (seperti Auto JSON dan Interceptors).

## 🛠️ Fitur Terbaru v0.4.0
1. **Global Configuration:** User bisa mengatur *base URL* atau *default headers* sekali saja di awal, dan akan berlaku untuk semua request selanjutnya.
2. **Strict Error Handling:** Library harus bisa mendeteksi error dengan baik (termasuk HTTP status di luar 200-299) dan melemparkan error message yang informatif ke user.

## 🛑 Batasan Teknis (Strict Rules)
1. **Zero Dependencies:** Dilarang menggunakan library eksternal (seperti `axios` atau `node-fetch`). Harus murni menggunakan bawaan API `fetch` modern.
2. **Promise-Based:** Semua *return value* harus berupa Promise standar.
3. **Isomorphic/Universal:** Kode harus bisa berjalan di lingkungan Browser dan Node.js (v18+) tanpa modifikasi.

## 🤖 Instruksi untuk Asisten AI (Gemini)
Tolong audit kode `sushi-fetch` versi saat ini berdasarkan kriteria di atas:
- Apakah implementasi Global Config dan Strict Error Handling sudah efisien dan rapi?
- Apakah ada *bug* tersembunyi atau celah keamanan?
- Tolong lakukan *refactoring* jika ada bagian kode yang berantakan atau bisa dimaksimalkan performanya, dan berikan penjelasan perubahan kodenya.
TETAPI JANGAN LANGSUNG MENULIS CODE!! Mohon lakukan ini secara berurutan:
1. Analisis terlebih dahulu seluruh code sebelum melakukan peningkatan, beri tahu kepada saya bila ada bug dan langsung kamu benarkan bug nya
2. Bikin PLANNING step-by-step apa saja yang anda akan ubah/tambahkan.
3. Dan terakhir, sebelum anda menuliskan code yang meningkatkan sushi-fetch hingga bagus sekali dan menyaingi library data fetching besar, anda meminta persetujuan kepada saya, bila saya accept, baru anda menuliskan code untuk meningkatkan performa sushi-fetch.