import React, { useState } from 'react'
import { loginUser } from '../api/client'

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) {
      setError('Please fill in all fields.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await loginUser(username.trim(), password.trim())
      if (data.success) {
        localStorage.setItem('customerId', data.customerId)
        localStorage.setItem('username', data.username)
        localStorage.setItem('name', data.name)
        localStorage.setItem('isAdmin', data.isAdmin ? 'true' : 'false')
        onLoginSuccess(data)
      } else {
        setError(data.message || 'Invalid username or password.')
      }
    } catch (err) {
      setError(err.message || 'Authentication service unavailable.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      width: '100vw',
      background: 'radial-gradient(circle at center, #111827 0%, #030712 100%)',
      padding: '24px'
    }}>
      {/* Decorative Blur Orbs */}
      <div style={{
        position: 'absolute',
        top: '20%',
        left: '30%',
        width: '300px',
        height: '300px',
        background: 'rgba(99, 102, 241, 0.15)',
        filter: 'blur(80px)',
        borderRadius: '50%',
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute',
        bottom: '20%',
        right: '30%',
        width: '350px',
        height: '350px',
        background: 'rgba(6, 182, 212, 0.1)',
        filter: 'blur(90px)',
        borderRadius: '50%',
        pointerEvents: 'none'
      }} />

      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '440px',
        padding: '40px',
        position: 'relative',
        zIndex: 1,
        border: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, var(--accent-indigo) 0%, var(--accent-cyan) 100%)',
            boxShadow: 'var(--shadow-glow)',
            marginBottom: '16px',
            color: '#fff',
            fontSize: '32px',
            fontWeight: 'bold',
            fontFamily: 'var(--font-title)'
          }}>
            I
          </div>
          <h2 className="gradient-text" style={{ fontSize: '28px', marginBottom: '8px' }}>Welcome to Investa</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Multi-Tenant Portfolio Intelligence Engine
          </p>
        </div>

        {error && (
          <div style={{
            background: 'rgba(244, 63, 94, 0.1)',
            border: '1px solid rgba(244, 63, 94, 0.2)',
            borderRadius: '12px',
            padding: '12px 16px',
            color: 'var(--accent-rose)',
            fontSize: '14px',
            marginBottom: '24px',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              color: 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: 500,
              marginBottom: '8px',
              fontFamily: 'var(--font-title)'
            }}>
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. customer1 or admin"
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '10px',
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid var(--border-glass)',
                color: '#fff',
                fontSize: '15px',
                outline: 'none',
                transition: 'var(--transition-smooth)'
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--accent-indigo)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border-glass)'}
            />
          </div>

          <div style={{ marginBottom: '32px' }}>
            <label style={{
              display: 'block',
              color: 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: 500,
              marginBottom: '8px',
              fontFamily: 'var(--font-title)'
            }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '10px',
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid var(--border-glass)',
                color: '#fff',
                fontSize: '15px',
                outline: 'none',
                transition: 'var(--transition-smooth)'
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--accent-indigo)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border-glass)'}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, var(--accent-indigo) 0%, #4f46e5 100%)',
              color: '#fff',
              fontSize: '15px',
              fontWeight: '600',
              border: 'none',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-glow)',
              transition: 'var(--transition-smooth)'
            }}
            onMouseOver={(e) => e.target.style.transform = 'translateY(-1px)'}
            onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
