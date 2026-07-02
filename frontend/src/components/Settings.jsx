import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchPolicy, updatePolicy } from '../api/client'
import SettingsIcon from '@mui/icons-material/Settings'
import SaveIcon from '@mui/icons-material/Save'
import KeyIcon from '@mui/icons-material/Key'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'

export default function Settings() {
  const queryClient = useQueryClient()
  const { data: policy } = useQuery({
    queryKey: ['policy'],
    queryFn: fetchPolicy
  })

  const [geminiKey, setGeminiKey] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [showKey, setShowKey] = useState(false)

  const [seedUnrealisedGains, setSeedUnrealisedGains] = useState(0)
  const [seedRealisedGains, setSeedRealisedGains] = useState(0)
  const [seedUnrealisedCurrencyGains, setSeedUnrealisedCurrencyGains] = useState(0)
  const [seedRealisedCurrencyGains, setSeedRealisedCurrencyGains] = useState(0)
  const [seedTransactionFees, setSeedTransactionFees] = useState(0)
  const [seedDividendsReceived, setSeedDividendsReceived] = useState(0)

  // Sync with current API key on load
  useEffect(() => {
    if (policy) {
      setGeminiKey(policy.geminiApiKey || '')
      setSeedUnrealisedGains(policy.seedUnrealisedGains ?? 0.0)
      setSeedRealisedGains(policy.seedRealisedGains ?? 0.0)
      setSeedUnrealisedCurrencyGains(policy.seedUnrealisedCurrencyGains ?? 0.0)
      setSeedRealisedCurrencyGains(policy.seedRealisedCurrencyGains ?? 0.0)
      setSeedTransactionFees(policy.seedTransactionFees ?? 0.0)
      setSeedDividendsReceived(policy.seedDividendsReceived ?? 0.0)
    }
  }, [policy])

  const settingsMutation = useMutation({
    mutationFn: updatePolicy,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policy'] })
      setSuccessMsg('Settings updated successfully! Investa AI will now use this key.')
      setTimeout(() => setSuccessMsg(''), 5000)
    }
  })

  const handleSave = (e) => {
    e.preventDefault()
    if (!policy) return

    settingsMutation.mutate({
      ...policy,
      geminiApiKey: geminiKey,
      seedUnrealisedGains: Number(seedUnrealisedGains),
      seedRealisedGains: Number(seedRealisedGains),
      seedUnrealisedCurrencyGains: Number(seedUnrealisedCurrencyGains),
      seedRealisedCurrencyGains: Number(seedRealisedCurrencyGains),
      seedTransactionFees: Number(seedTransactionFees),
      seedDividendsReceived: Number(seedDividendsReceived)
    })
  }

  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)

  const handleTestKey = async () => {
    if (!geminiKey.trim()) {
      setTestResult({ success: false, message: 'Please enter an API key to test.' })
      return
    }
    setIsTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/policy/test-gemini-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: geminiKey })
      })
      const data = await res.json()
      setTestResult(data)
    } catch (err) {
      setTestResult({ success: false, message: 'Network error connecting to backend.' })
    } finally {
      setIsTesting(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '650px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <SettingsIcon style={{ color: 'var(--accent-indigo)' }} />
        <h3 style={{ fontSize: '18px', fontWeight: '700' }} className="gradient-text">System & AI Settings</h3>
      </div>

      <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px' }}>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <KeyIcon fontSize="small" style={{ color: 'var(--text-secondary)' }} />
              <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                Gemini API Key
              </label>
            </div>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              <input 
                type={showKey ? "text" : "password"} 
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder="Paste your Gemini API Key (e.g. AIzaSy...)"
                className="investa-input"
                style={{ flex: 1 }}
              />
              <button 
                type="button" 
                className="investa-button"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-glass)', boxShadow: 'none' }}
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? "Hide" : "Show"}
              </button>
              <button 
                type="button" 
                className="investa-button"
                style={{ 
                  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(79, 70, 229, 0.2) 100%)',
                  border: '1px solid var(--border-glass)'
                }}
                onClick={handleTestKey}
                disabled={isTesting}
              >
                {isTesting ? "Testing..." : "Test Connection"}
              </button>
            </div>
            {testResult && (
              <div style={{ 
                fontSize: '12px', 
                fontWeight: '600', 
                color: testResult.success ? 'var(--accent-emerald)' : 'var(--accent-rose)' 
              }}>
                {testResult.success ? '● ' : '▲ '} {testResult.message}
              </div>
            )}
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Get an API key from <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-indigo)', textDecoration: 'underline' }}>Google AI Studio</a>. Keys are stored securely in your local SQLite/H2 database.
            </span>
          </div>

          <h4 style={{ fontSize: '13px', color: 'var(--text-primary)', marginTop: '16px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '6px', letterSpacing: '0.05em' }}>
            PORTFOLIO PERFORMANCE SEEDS / HISTORICAL OVERRIDES
          </h4>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)' }}>Seed Unrealised P&L ($)</label>
              <input 
                type="number"
                step="0.01"
                value={seedUnrealisedGains}
                onChange={(e) => setSeedUnrealisedGains(Number(e.target.value))}
                className="investa-input"
              />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)' }}>Seed Realised P&L ($)</label>
              <input 
                type="number"
                step="0.01"
                value={seedRealisedGains}
                onChange={(e) => setSeedRealisedGains(Number(e.target.value))}
                className="investa-input"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)' }}>Seed Unrealised Currency P&L ($)</label>
              <input 
                type="number"
                step="0.01"
                value={seedUnrealisedCurrencyGains}
                onChange={(e) => setSeedUnrealisedCurrencyGains(Number(e.target.value))}
                className="investa-input"
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)' }}>Seed Realised Currency P&L ($)</label>
              <input 
                type="number"
                step="0.01"
                value={seedRealisedCurrencyGains}
                onChange={(e) => setSeedRealisedCurrencyGains(Number(e.target.value))}
                className="investa-input"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)' }}>Seed Transaction Fees ($)</label>
              <input 
                type="number"
                step="0.01"
                value={seedTransactionFees}
                onChange={(e) => setSeedTransactionFees(Number(e.target.value))}
                className="investa-input"
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)' }}>Seed Dividends Received ($)</label>
              <input 
                type="number"
                step="0.01"
                value={seedDividendsReceived}
                onChange={(e) => setSeedDividendsReceived(Number(e.target.value))}
                className="investa-input"
              />
            </div>
          </div>

          {successMsg && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-emerald)', fontSize: '13px', fontWeight: '600' }}>
              <CheckCircleIcon fontSize="small" /> {successMsg}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '10px' }}>
            <button 
              type="submit" 
              className="investa-button"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              disabled={settingsMutation.isPending}
            >
              <SaveIcon fontSize="small" /> 
              {settingsMutation.isPending ? 'SAVING...' : 'SAVE SETTINGS'}
            </button>
          </div>

        </form>
      </div>

      <div className="glass-panel" style={{ padding: '20px', borderRadius: '16px', border: '1px dashed var(--border-glass)' }}>
        <h4 style={{ fontSize: '13px', fontWeight: '700', marginBottom: '8px', color: 'var(--text-secondary)' }}>AI Engine Status</h4>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5', margin: 0 }}>
          {geminiKey.trim() 
            ? "✅ Gemini API is configured as your active intelligence engine." 
            : "ℹ️ No custom key provided. The system falls back to your local mock intelligence matching engine unless GEMINI_API_KEY is defined in your environment."}
        </p>
      </div>
    </div>
  )
}
