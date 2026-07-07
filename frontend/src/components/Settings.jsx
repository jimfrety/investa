import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchPolicy, updatePolicy, updateProfile, API_BASE } from '../api/client'
import SettingsIcon from '@mui/icons-material/Settings'
import SaveIcon from '@mui/icons-material/Save'
import KeyIcon from '@mui/icons-material/Key'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import LockIcon from '@mui/icons-material/Lock'

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

  // Profile Update State
  const [profileUsername, setProfileUsername] = useState(() => localStorage.getItem('username') || '')
  const [profileName, setProfileName] = useState(() => localStorage.getItem('name') || '')
  const [profilePassword, setProfilePassword] = useState('')
  const [profileMessage, setProfileMessage] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)

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
      const res = await fetch(`${API_BASE}/policy/test-gemini-key`, {
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

  // Handle profile update
  const handleUpdateProfile = async (e) => {
    e.preventDefault()
    if (!profileUsername.trim()) {
      setProfileMessage({ success: false, text: 'Username is required.' })
      return
    }
    setProfileLoading(true)
    setProfileMessage(null)
    try {
      const payload = { username: profileUsername.trim(), name: profileName.trim() }
      if (profilePassword.trim()) payload.password = profilePassword.trim()
      const data = await updateProfile(payload)
      localStorage.setItem('username', data.username)
      localStorage.setItem('name', data.name)
      setProfileUsername(data.username)
      setProfileName(data.name)
      setProfilePassword('')
      setProfileMessage({ success: true, text: 'Account settings updated successfully.' })
      setTimeout(() => setProfileMessage(null), 5000)
    } catch (err) {
      setProfileMessage({ success: false, text: err.message || 'Failed to update profile.' })
    } finally {
      setProfileLoading(false)
    }
  }

  // Sharesies Integration State
  const [sharesiesEmail, setSharesiesEmail] = useState('')
  const [sharesiesPassword, setSharesiesPassword] = useState('')
  const [sharesiesStatus, setSharesiesStatus] = useState({ authenticated: false, email: null, userId: null })
  const [sharesiesLoading, setSharesiesLoading] = useState(false)
  const [sharesiesMessage, setSharesiesMessage] = useState(null)
  const [sharesiesMfaRequired, setSharesiesMfaRequired] = useState(false)
  const [sharesiesMfaCode, setSharesiesMfaCode] = useState('')

  const fetchSharesiesStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/sharesies/status`)
      if (res.ok) {
        const data = await res.json()
        setSharesiesStatus(data)
        if (data.email) {
          setSharesiesEmail(data.email)
        }
      }
    } catch (e) {
      console.error('Failed to load Sharesies connection status', e)
    }
  }

  useEffect(() => {
    fetchSharesiesStatus()
  }, [])

  const handleSharesiesConnect = async (e) => {
    if (!sharesiesEmail.trim() || !sharesiesPassword.trim()) {
      setSharesiesMessage({ success: false, text: 'Please enter both email and password.' })
      return
    }
    if (sharesiesMfaRequired && !sharesiesMfaCode.trim()) {
      setSharesiesMessage({ success: false, text: 'Please enter the 6-digit verification code.' })
      return
    }
    setSharesiesLoading(true)
    setSharesiesMessage(null)
    try {
      const res = await fetch(`${API_BASE}/sharesies/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: sharesiesEmail, password: sharesiesPassword, mfaCode: sharesiesMfaCode })
      })
      const data = await res.json()
      if (res.ok) {
        if (data.mfaRequired) {
          setSharesiesMfaRequired(true)
          setSharesiesMessage({ success: false, text: data.message })
        } else {
          setSharesiesMessage({ success: true, text: 'Successfully connected! Synchronizing portfolio...' })
          setSharesiesPassword('')
          setSharesiesMfaCode('')
          setSharesiesMfaRequired(false)
          fetchSharesiesStatus()
          handleSharesiesSync()
        }
      } else {
        setSharesiesMessage({ success: false, text: data.message || 'Login failed' })
      }
    } catch (err) {
      setSharesiesMessage({ success: false, text: 'Failed to connect to backend server.' })
    } finally {
      setSharesiesLoading(false)
    }
  }

  const handleSharesiesDisconnect = async () => {
    setSharesiesLoading(true)
    try {
      const res = await fetch(`${API_BASE}/sharesies/logout`, { method: 'POST' })
      if (res.ok) {
        setSharesiesStatus({ authenticated: false, email: null, userId: null })
        setSharesiesMessage({ success: true, text: 'Disconnected from Sharesies.' })
        setSharesiesEmail('')
        setSharesiesPassword('')
        setSharesiesMfaRequired(false)
        setSharesiesMfaCode('')
      }
    } catch (e) {
      setSharesiesMessage({ success: false, text: 'Failed to disconnect.' })
    } finally {
      setSharesiesLoading(false)
    }
  }

  const handleSharesiesSync = async () => {
    setSharesiesLoading(true)
    setSharesiesMessage(null)
    try {
      const res = await fetch(`${API_BASE}/sharesies/sync`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setSharesiesMessage({ success: true, text: data.message })
        queryClient.invalidateQueries({ queryKey: ['policy'] })
        queryClient.invalidateQueries({ queryKey: ['holdings'] })
        queryClient.invalidateQueries({ queryKey: ['watchlist'] })
      } else {
        setSharesiesMessage({ success: false, text: data.message })
      }
    } catch (err) {
      setSharesiesMessage({ success: false, text: 'Sync failed. Backend error.' })
    } finally {
      setSharesiesLoading(false)
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
              <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)' }}>Unrealised gains/losses ($)</label>
              <input 
                type="number"
                step="0.01"
                value={seedUnrealisedGains}
                onChange={(e) => setSeedUnrealisedGains(Number(e.target.value))}
                className="investa-input"
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)' }}>Unrealised Currency gains/losses ($)</label>
              <input 
                type="number"
                step="0.01"
                value={seedUnrealisedCurrencyGains}
                onChange={(e) => setSeedUnrealisedCurrencyGains(Number(e.target.value))}
                className="investa-input"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)' }}>Transaction Fees ($)</label>
              <input 
                type="number"
                step="0.01"
                value={seedTransactionFees}
                onChange={(e) => setSeedTransactionFees(Number(e.target.value))}
                className="investa-input"
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)' }}>Dividends Received ($)</label>
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

      {/* Account Settings Card */}
      <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px' }}>
        <h4 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
          <LockIcon style={{ color: 'var(--accent-indigo)' }} fontSize="small" />
          Account & Profile Settings
        </h4>

        <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)' }}>Username</label>
              <input 
                type="text" 
                value={profileUsername} 
                onChange={(e) => setProfileUsername(e.target.value)} 
                placeholder="e.g. client_alpha" 
                className="investa-input"
                disabled={profileLoading}
              />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)' }}>Full Name</label>
              <input 
                type="text" 
                value={profileName} 
                onChange={(e) => setProfileName(e.target.value)} 
                placeholder="e.g. Client Alpha" 
                className="investa-input"
                disabled={profileLoading}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxWidth: '300px' }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)' }}>New Password</label>
            <input 
              type="password" 
              value={profilePassword} 
              onChange={(e) => setProfilePassword(e.target.value)} 
              placeholder="•••••••• (leave blank to keep current)" 
              className="investa-input"
              disabled={profileLoading}
            />
          </div>

          {profileMessage && (
            <div style={{ 
              fontSize: '13px', 
              fontWeight: '600', 
              color: profileMessage.success ? 'var(--accent-emerald)' : 'var(--accent-rose)' 
            }}>
              {profileMessage.text}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '6px' }}>
            <button 
              type="submit" 
              className="investa-button"
              disabled={profileLoading}
            >
              {profileLoading ? 'UPDATING...' : 'UPDATE PROFILE'}
            </button>
          </div>
        </form>
      </div>

      {/* Sharesies Connection Card */}
      <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px' }}>
        <h4 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
          <span style={{
            display: 'inline-block',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: sharesiesStatus.authenticated ? 'var(--accent-emerald)' : 'var(--text-muted)',
            boxShadow: sharesiesStatus.authenticated ? '0 0 8px var(--accent-emerald)' : 'none',
            transition: 'all 0.3s ease'
          }} />
          Sharesies Integration (NZ/AU)
        </h4>

        {sharesiesStatus.authenticated ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
              Connected to active account: <strong>{sharesiesStatus.email}</strong> (User ID: {sharesiesStatus.userId})
            </p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
              <button 
                type="button" 
                onClick={handleSharesiesSync} 
                className="investa-button"
                style={{ backgroundColor: 'var(--accent-emerald)' }}
                disabled={sharesiesLoading}
              >
                {sharesiesLoading ? 'SYNCING...' : 'SYNC NOW'}
              </button>
              <button 
                type="button" 
                onClick={handleSharesiesDisconnect} 
                className="investa-button-secondary"
                disabled={sharesiesLoading}
              >
                DISCONNECT
              </button>
            </div>
          </div>
        ) : sharesiesMfaRequired ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'var(--bg-card-hover)', border: '1px solid var(--accent-amber)' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '600', margin: '0 0 4px 0' }}>
                2-Step Verification Required
              </p>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                Sharesies has sent a 6-digit verification code to <strong>{sharesiesEmail}</strong> or your authenticator app. Enter it below to finish connecting.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxWidth: '240px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)' }}>6-Digit Verification Code</label>
              <input 
                type="text"
                maxLength="6"
                placeholder="123456"
                value={sharesiesMfaCode}
                onChange={(e) => setSharesiesMfaCode(e.target.value.replace(/\D/g, ''))}
                className="investa-input"
                style={{ fontSize: '16px', letterSpacing: '4px', textAlign: 'center', fontWeight: '700' }}
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button 
                type="button" 
                onClick={handleSharesiesConnect} 
                className="investa-button"
                disabled={sharesiesLoading || !sharesiesMfaCode.trim()}
              >
                {sharesiesLoading ? 'VERIFYING...' : 'VERIFY & CONNECT'}
              </button>
              <button
                type="button"
                onClick={() => { setSharesiesMfaRequired(false); setSharesiesMfaCode(''); setSharesiesMessage(null); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
              Connect your NZ Sharesies trading profile to automatically import holdings, cash balances, and favourite symbols.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)' }}>Email</label>
                <input 
                  type="email"
                  placeholder="name@example.com"
                  value={sharesiesEmail}
                  onChange={(e) => setSharesiesEmail(e.target.value)}
                  className="investa-input"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)' }}>Password</label>
                <input 
                  type="password"
                  placeholder="••••••••"
                  value={sharesiesPassword}
                  onChange={(e) => setSharesiesPassword(e.target.value)}
                  className="investa-input"
                />
              </div>
            </div>
            <div>
              <button 
                type="button" 
                onClick={handleSharesiesConnect} 
                className="investa-button"
                disabled={sharesiesLoading}
              >
                {sharesiesLoading ? 'CONNECTING...' : 'CONNECT ACCOUNT'}
              </button>
            </div>
          </div>
        )}

        {sharesiesMessage && (
          <div style={{ 
            marginTop: '12px', 
            fontSize: '12px', 
            color: sharesiesMessage.success ? 'var(--accent-emerald)' : 'var(--accent-crimson)',
            fontWeight: '600'
          }}>
            {sharesiesMessage.text}
          </div>
        )}
      </div>

      <div className="glass-panel" style={{ padding: '20px', borderRadius: '16px', border: '1px dashed var(--border-glass)' }}>
        <h4 style={{ fontSize: '13px', fontWeight: '700', marginBottom: '8px', color: 'var(--text-secondary)' }}>AI Engine Status</h4>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5', margin: 0 }}>
          {geminiKey.trim() 
            ? "✅ Gemini API is configured as your custom active intelligence engine." 
            : "ℹ️ Using default system Gemini Key or environmental fallback. You may enter your own custom Gemini API Key above to override the system default."}
        </p>
      </div>
    </div>
  )
}
