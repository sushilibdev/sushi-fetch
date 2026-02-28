Ide untuk versi versi selanjutnya.

1. Interceptor
2. Data Transformation
3. Automatic JSON Handling
4. Request Cancellation
5. Form Serialization

Untuk v0.5.0 kita akan menambahkan fitur Automatic JSON Handling

Kenapa harus Automatic JSON Handling yang paling wajib diprioritaskan?

Ini adalah fitur "kenyamanan" nomor satu. Orang males kalau harus ngetik .json() tiap kali fetch atau manual JSON.stringify() tiap kirim data.

Untuk v0.6.0 kita akan menambahkan fitur Interceptor

Kenapa Interceptor?

Ini fitur "Pro". Berguna banget buat nambahin token login otomatis di setiap request, atau buat global error handling (misal: kalau 401 langsung logout).

Untuk fitur Request Cancellation dan Data Transformation akan kita tambahkan di v0.7.0 

Kenapa Request Cancellation dan Data Transformation yang kita tambahkan di v0.7.0?

Kegunaan untuk Request Cancellation:
Misal user klik tombol "Cari", terus dia berubah pikiran dan klik "Batal". Aplikasi lu harus bisa membatalkan request-nya biar nggak buang-buang kuota internet.

Kegunaan Data Transformation:
Berguna kalau user pengen ngubah format data dari API (misal: dari snake_case jadi camelCase).

Dan untuk v0.8.0 yang terakhir kita akan menambahkan fitur Form Serialization

Kenapa Serialization?

Kalau orang mau upload foto atau kirim data formulir, mereka nggak perlu repot-repot bikin new FormData(). Kita yang urusin di belakang layar.