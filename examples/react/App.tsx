import React, { useEffect, useState, useCallback } from "react"
import { sushiFetch, sushiCache } from "sushi-fetch"

// ==========================================
// 🎣 CUSTOM HOOK: useSushi
// (Biasanya ini ditaruh di file terpisah misal: hooks/useSushi.ts)
// ==========================================
function useSushi<T>(url: string, options = {}) {
  // Cek apakah ada data lama di cache buat nampilin UI instan (SWR concept)
  const [data, setData] = useState<T | null>(() => sushiCache.peek(url) as T | null)
  const [isValidating, setIsValidating] = useState(!data) // Loading cuma kalau cache kosong

  const fetcher = useCallback(() => {
    setIsValidating(true)
    sushiFetch<T>(url, { ...options, cacheTags: ["react-api"] })
      .catch((err) => console.error("Fetch error:", err))
      .finally(() => setIsValidating(false))
  }, [url]) // Opsi sederhana, mengabaikan deep equality options demi contoh

  useEffect(() => {
    // 1. Jalankan fetch saat komponen di-mount
    fetcher()

    // 2. Berlangganan (Subscribe) ke perubahan Cache!
    // Kalau ada komponen lain yang mengubah cache URL ini, state di sini otomatis ikut berubah.
    const unsubscribe = sushiCache.subscribe<T>(url, (newData) => {
      if (newData !== null) {
        setData(newData)
      }
    })

    // Bersihkan langganan saat komponen di-unmount
    return () => unsubscribe()
  }, [fetcher, url])

  return { data, isValidating, revalidate: fetcher }
}

// ==========================================
// 🍣 MAIN COMPONENT
// ==========================================
export default function App() {
  const apiUrl = "https://jsonplaceholder.typicode.com/users"
  
  // Tinggal panggil hook-nya! Elegan banget kan?
  const { data: users, isValidating, revalidate } = useSushi<any[]>(apiUrl, {
    ttl: 30000,        // Cache 30 detik
    revalidate: true,  // Aktifkan Stale-While-Revalidate di latar belakang
  })

  // Fitur Pamer: Optimistic Update!
  const handleOptimisticUpdate = () => {
    // Kita manipulasi data langsung di dalam cache (tanpa nembak API)
    // Berkat fitur 'subscribe' di custom hook, UI akan langsung merespons!
    sushiCache.mutate(apiUrl, (oldData: any[] | null) => {
      if (!oldData) return []
      const fakeUser = { id: 999, name: "🚀 Sushi Ninja (Optimistic)" }
      return [fakeUser, ...oldData]
    })
  }

  // Fitur Pamer: Hapus Cache Global
  const handleClearCache = () => {
    sushiCache.invalidateTag("react-api")
    alert("Cache cleared! Try clicking Revalidate now.")
  }

  return (
    <div style={{ fontFamily: "sans-serif", padding: "20px", maxWidth: "600px" }}>
      <h1>🍣 Sushi Fetch React Demo</h1>
      
      <div style={{ marginBottom: "20px", display: "flex", gap: "10px" }}>
        <button onClick={revalidate} disabled={isValidating}>
          {isValidating ? "⏳ Reloading..." : "🔄 Revalidate (Bypass Cache)"}
        </button>
        <button onClick={handleOptimisticUpdate}>
          ✨ Add Instant User (Mutate)
        </button>
        <button onClick={handleClearCache} style={{ color: "red" }}>
          🗑️ Clear Cache
        </button>
      </div>

      <div style={{
        opacity: isValidating && users ? 0.5 : 1, // Efek visual saat revalidasi background
        transition: "opacity 0.2s"
      }}>
        {!users && isValidating ? (
          <p>Loading data from server...</p>
        ) : (
          <ul style={{ background: "#f4f4f4", padding: "20px", borderRadius: "8px" }}>
            {users?.map((u) => (
              <li key={u.id} style={{ padding: "5px 0" }}>
                <strong>{u.name}</strong> 
              </li>
            ))}
          </ul>
        )}
      </div>
      
      <p style={{ fontSize: "12px", color: "gray" }}>
        * Try clicking "Add Instant User", the UI will change immediately without loading the server!
      </p>
    </div>
  )
}