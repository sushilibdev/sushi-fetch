import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sushiFetch } from './fetcher'

// Mock globalThis.fetch
globalThis.fetch = vi.fn() as any

describe('sushi-fetch v0.5.0 "Smart JSON"', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should auto-stringify data object and set Content-Type', async () => {
    const mockRes = {
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ success: true }),
      ok: true
    }
    ;(globalThis.fetch as any).mockResolvedValueOnce(mockRes)

    const payload = { name: 'Haqqi', role: 'developer' }
    await sushiFetch.post('https://api.example.com/data', payload)

    const [url, options] = (globalThis.fetch as any).mock.calls[0]
    expect(url).toBe('https://api.example.com/data')
    expect(options.method).toBe('POST')
    expect(options.body).toBe(JSON.stringify(payload))
    expect(options.headers.get('Content-Type')).toBe('application/json')
  })

  it('should auto-parse JSON response if Content-Type is application/json', async () => {
    const responseData = { id: 1, message: 'Sushi is delicious' }
    const mockRes = {
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => responseData,
      ok: true
    }
    ;(globalThis.fetch as any).mockResolvedValueOnce(mockRes)

    const result = await sushiFetch.get('https://api.example.com/info')

    expect(result).toEqual(responseData)
    expect(typeof result).toBe('object')
  })

  it('should not auto-stringify if body is FormData', async () => {
    const mockRes = {
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ success: true }),
      ok: true
    }
    ;(globalThis.fetch as any).mockResolvedValueOnce(mockRes)

    const formData = new FormData()
    formData.append('file', 'test')

    await sushiFetch.post('https://api.example.com/upload', formData)

    const [, options] = (globalThis.fetch as any).mock.calls[0]
    expect(options.body).toBeInstanceOf(FormData)
    // Fetch usually sets the Content-Type for FormData automatically with boundary
    expect(options.headers.get('Content-Type')).toBeNull()
  })

  it('should still support manual stringification (backward compatibility)', async () => {
     const mockRes = {
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ success: true }),
      ok: true
    }
    ;(globalThis.fetch as any).mockResolvedValueOnce(mockRes)

    const manualBody = JSON.stringify({ old: 'school' })
    await sushiFetch('https://api.example.com/legacy', {
      method: 'POST',
      body: manualBody,
      headers: { 'Content-Type': 'application/json' }
    })

    const [, options] = (globalThis.fetch as any).mock.calls[0]
    expect(options.body).toBe(manualBody)
    expect(options.headers.get('Content-Type')).toBe('application/json')
  })
})
