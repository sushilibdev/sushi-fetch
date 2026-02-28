import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSushi, sushiFetch } from './core/fetcher'

// Mock globalThis.fetch
globalThis.fetch = vi.fn() as any

describe('sushi-fetch Global Config & Strict Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should apply baseUrl correctly', async () => {
    const mockRes = {
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ data: 'ok' })
    }
    ;(globalThis.fetch as any).mockResolvedValueOnce(mockRes)

    const sushi = createSushi({ baseUrl: 'https://api.example.com/v1' })
    
    await sushi('/users')
    
    expect(globalThis.fetch).toHaveBeenCalledWith('https://api.example.com/v1/users', expect.any(Object))
  })

  it('should ignore baseUrl if url is absolute', async () => {
    const mockRes = {
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ data: 'ok' })
    }
    ;(globalThis.fetch as any).mockResolvedValueOnce(mockRes)

    const sushi = createSushi({ baseUrl: 'https://api.example.com/v1' })
    
    await sushi('http://other-api.com/users')
    
    expect(globalThis.fetch).toHaveBeenCalledWith('http://other-api.com/users', expect.any(Object))
  })

  it('should extract error data from response body on non-2xx status', async () => {
    const mockRes = {
      status: 400,
      statusText: 'Bad Request',
      headers: new Headers({ 'content-type': 'application/json' }),
      clone: () => ({
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ message: 'Email already exists' })
      })
    }
    ;(globalThis.fetch as any).mockResolvedValueOnce(mockRes)

    try {
      await sushiFetch('https://api.example.com/register', { method: 'POST' })
    } catch (error: any) {
      expect(error.status).toBe(400)
      expect(error.message).toBe('Email already exists')
      expect(error.data).toEqual({ message: 'Email already exists' })
    }
  })
})
