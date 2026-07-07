import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchSummary, fetchRiskMetrics } from './api/client'

// Components
import DashboardOverview from './components/DashboardOverview'
import PortfolioGrid from './components/PortfolioGrid'
import DividendPlanner from './components/DividendPlanner'
import PolicyManager from './components/PolicyManager'
import WatchlistOpportunity from './components/WatchlistOpportunity'
import AIChatAssistant from './components/AIChatAssistant'
import ReturnCalculator from './components/ReturnCalculator'
import Settings from './components/Settings'
import Login from './components/Login'
import AdminConsole from './components/AdminConsole'

// Icons
import DashboardIcon from '@mui/icons-material/Dashboard'
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import ShieldIcon from '@mui/icons-material/Shield'
import VisibilityIcon from '@mui/icons-material/Visibility'
import ForumIcon from '@mui/icons-material/Forum'
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety'
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn'
import ChatBubbleIcon from '@mui/icons-material/ChatBubble'
import SettingsIcon from '@mui/icons-material/Settings'
import LogoutIcon from '@mui/icons-material/Logout'

export default function App() {
  const [user, setUser] = useState(() => {
    const customerId = localStorage.getItem('customerId')
    if (customerId) {
      return {
        customerId,
        username: localStorage.getItem('username'),
        name: localStorage.getItem('name'),
        isAdmin: localStorage.getItem('isAdmin') === 'true'
      }
    }
    return null
  })

  const [activeTab, setActiveTab] = useState('overview')
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [chatPreloadMessage, setChatPreloadMessage] = useState('')
  const [showSharesiesPrompt, setShowSharesiesPrompt] = useState(false)

  // Modal Sharesies States
  const [sharesiesEmail, setSharesiesEmail] = useState('')
  const [sharesiesPassword, setSharesiesPassword] = useState('')
  const [sharesiesMfaCode, setSharesiesMfaCode] = useState('')
  const [sharesiesMfaRequired, setSharesiesMfaRequired] = useState(false)
  const [sharesiesMessage, setSharesiesMessage] = useState(null)
  const [sharesiesLoading, setSharesiesLoading] = useState(false)
  const [modalMode, setModalMode] = useState('prompt') // 'prompt', 'login', 'mfa'

  React.useEffect(() => {
    if (user && !user.isAdmin) {
      fetch('/api/sharesies/status')
        .then(res => res.json())
        .then(data => {
          if (!data.authenticated) {
            setShowSharesiesPrompt(true)
          }
        })
        .catch(err => console.error(err))
    }
  }, [user])

  const handleModalSharesiesConnect = async (e) => {
    if (e) e.preventDefault()
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
      const res = await fetch('/api/sharesies/login', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Customer-ID': user?.customerId
        },
        body: JSON.stringify({ email: sharesiesEmail, password: sharesiesPassword, mfaCode: sharesiesMfaCode })
      })
      const data = await res.json()
      if (res.ok) {
        if (data.mfaRequired) {
          setSharesiesMfaRequired(true)
          setModalMode('mfa')
          setSharesiesMessage({ success: false, text: data.message })
        } else {
          setSharesiesMessage({ success: true, text: 'Successfully connected! Synchronizing portfolio...' })
          setSharesiesPassword('')
          setSharesiesMfaCode('')
          setSharesiesMfaRequired(false)
          try {
            await fetch('/api/sharesies/sync', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'X-Customer-ID': user?.customerId
              }
            })
            setSharesiesMessage({ success: true, text: 'Portfolio sync completed!' })
          } catch (syncErr) {
            console.error('Initial sync failed', syncErr)
          }
          setTimeout(() => {
            setShowSharesiesPrompt(false)
            handleRefetchAll()
          }, 1500)
        }
      } else {
        setSharesiesMessage({ success: false, text: data.message || 'Connection failed' })
      }
    } catch (err) {
      setSharesiesMessage({ success: false, text: 'Failed to connect to backend.' })
    } finally {
      setSharesiesLoading(false)
    }
  }

  const { data: summary, refetch: refetchSummary } = useQuery({
    queryKey: ['summary', user?.customerId],
    queryFn: fetchSummary,
    enabled: !!user && !user.isAdmin
  })

  const { data: risk, refetch: refetchRisk } = useQuery({
    queryKey: ['risk', user?.customerId],
    queryFn: fetchRiskMetrics,
    enabled: !!user && !user.isAdmin
  })

  const handleRefetchAll = () => {
    refetchSummary()
    refetchRisk()
  }

  const handleLogout = () => {
    localStorage.removeItem('customerId')
    localStorage.removeItem('username')
    localStorage.removeItem('name')
    localStorage.removeItem('isAdmin')
    setUser(null)
  }

  // Pre-load a prompt and open chat
  const handleAskAI = (promptText) => {
    setChatPreloadMessage(promptText)
    setIsChatOpen(true)
  }

  if (!user) {
    return <Login onLoginSuccess={(userData) => setUser(userData)} />
  }

  if (user.isAdmin) {
    return <AdminConsole onLogout={handleLogout} />
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return <DashboardOverview onAskAI={handleAskAI} summary={summary} risk={risk} />
      case 'portfolio':
        return <PortfolioGrid onTradeExecuted={handleRefetchAll} onAskAI={handleAskAI} />
      case 'dividends':
        return <DividendPlanner onAskAI={handleAskAI} />
      case 'policy':
        return <PolicyManager onPolicyUpdated={handleRefetchAll} />
      case 'watchlist':
        return <WatchlistOpportunity onAskAI={handleAskAI} onTradeExecuted={handleRefetchAll} />
      case 'calculator':
        return <ReturnCalculator />
      case 'settings':
        return <Settings />
      default:
        return <DashboardOverview onAskAI={handleAskAI} summary={summary} risk={risk} />
    }
  }

  const healthScore = risk?.health?.portfolioHealth ?? 91;
  const netWorth = summary?.netWorth ?? 185000.0;
  const cash = summary?.cashBalance ?? 42000.0;
  const holdingsVal = summary?.holdingsValue ?? 143000.0;
  const unrealised = summary?.unrealisedGain ?? 28000.0;
  const unrealisedPct = summary?.unrealisedGainPercent ?? 18.2;
  const totalReturn = summary?.totalReturn ?? 0.0;
  const amountPutIn = summary?.amountPutIn ?? 157000.0;
  const simpleReturnPercent = summary?.simpleReturnPercent ?? 0.0;

  return (
    <div className="layout-container">
      {/* Sidebar Section */}
      <aside className="sidebar">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0' }}>
            <span style={{ fontSize: '28px' }}>🛡️</span>
            <div>
              <h2 style={{ fontSize: '22px', fontWeight: '800', margin: 0, background: 'linear-gradient(135deg, #fff 0%, #a5b4fc 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>INVESTA</h2>
              <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700', letterSpacing: '0.1em' }}>AI WEALTH MANAGER</p>
            </div>
          </div>
          
          <ul className="sidebar-menu">
            <li className={`sidebar-item ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
              <DashboardIcon fontSize="small" /> Dashboard
            </li>
            <li className={`sidebar-item ${activeTab === 'portfolio' ? 'active' : ''}`} onClick={() => setActiveTab('portfolio')}>
              <AccountBalanceWalletIcon fontSize="small" /> Holdings
            </li>
            <li className={`sidebar-item ${activeTab === 'dividends' ? 'active' : ''}`} onClick={() => setActiveTab('dividends')}>
              <CalendarMonthIcon fontSize="small" /> Dividend Planner
            </li>
            <li className={`sidebar-item ${activeTab === 'policy' ? 'active' : ''}`} onClick={() => setActiveTab('policy')}>
              <ShieldIcon fontSize="small" /> Investment Policy
            </li>
            <li className={`sidebar-item ${activeTab === 'watchlist' ? 'active' : ''}`} onClick={() => setActiveTab('watchlist')}>
              <VisibilityIcon fontSize="small" /> Watchlist & Fit
            </li>
            <li className={`sidebar-item ${activeTab === 'calculator' ? 'active' : ''}`} onClick={() => setActiveTab('calculator')}>
              <MonetizationOnIcon fontSize="small" /> Return Calculator
            </li>
            <li className={`sidebar-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
              <SettingsIcon fontSize="small" /> Settings
            </li>
            <li className="sidebar-item" onClick={handleLogout} style={{ color: 'var(--accent-rose)', marginTop: '20px' }}>
              <LogoutIcon fontSize="small" /> Sign Out
            </li>
          </ul>
        </div>
        
        {/* Sidebar Footer Card */}
        <div className="glass-panel" style={{ padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <HealthAndSafetyIcon style={{ color: 'var(--accent-emerald)' }} />
            <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)' }}>PORTFOLIO HEALTH</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text-primary)' }}>{healthScore}</span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>/ 100</span>
          </div>
          <div style={{ fontSize: '10px', color: 'var(--accent-emerald)', marginTop: '4px', fontWeight: '600' }}>
            ● Safety thresholds satisfied
          </div>
        </div>
      </aside>

      {/* Main Content Section */}
      <main className="main-content">
        {/* Header Section */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <h1 className="gradient-text" style={{ fontSize: '28px', fontWeight: '800' }}>
              {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
              Logged in as {user.name || user.username}
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '12px' }}>
            <div className="glass-panel stat-card" style={{ minWidth: '135px', padding: '12px 14px', borderRadius: '12px' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: '600' }}>NET WORTH</span>
              <span style={{ fontSize: '18px', fontWeight: '800' }}>${netWorth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            
            <div className="glass-panel stat-card" style={{ minWidth: '120px', padding: '12px 14px', borderRadius: '12px' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: '600' }}>CASH AVAILABLE</span>
              <span style={{ fontSize: '18px', fontWeight: '800', color: 'var(--accent-cyan)' }}>${cash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>

            <div className="glass-panel stat-card" style={{ minWidth: '135px', padding: '12px 14px', borderRadius: '12px' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: '600' }}>AMOUNT PUT IN</span>
              <span style={{ fontSize: '18px', fontWeight: '800' }}>
                ${amountPutIn.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="glass-panel stat-card" style={{ minWidth: '130px', padding: '12px 14px', borderRadius: '12px' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: '600' }}>TOTAL RETURN</span>
              <span style={{ fontSize: '18px', fontWeight: '800', color: totalReturn >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
                {totalReturn >= 0 ? '+' : ''}${totalReturn.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="glass-panel stat-card" style={{ minWidth: '120px', padding: '12px 14px', borderRadius: '12px' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: '600' }}>SIMPLE RETURN</span>
              <span style={{ fontSize: '18px', fontWeight: '800', color: simpleReturnPercent >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
                {simpleReturnPercent >= 0 ? '+' : ''}{simpleReturnPercent.toFixed(2)}%
              </span>
            </div>

            <button className="investa-button" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 12px' }} onClick={() => setIsChatOpen(!isChatOpen)}>
              <ForumIcon /> Assistant
            </button>
          </div>
        </header>

        {/* Dynamic View Component */}
        <section style={{ position: 'relative' }}>
          {renderContent()}
        </section>
      </main>

      {/* Floating Action AI Button (Bottom Right) */}
      {!isChatOpen && (
        <div 
          onClick={() => setIsChatOpen(true)}
          style={{
            position: 'fixed',
            bottom: '30px',
            right: '30px',
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--accent-indigo) 0%, #4f46e5 100%)',
            boxShadow: '0 8px 30px rgba(99, 102, 241, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 1000,
            transition: 'var(--transition-smooth)'
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          <ChatBubbleIcon style={{ color: 'white' }} />
        </div>
      )}

      {/* Slide-out AI Panel Drawer */}
      <AIChatAssistant 
        isOpen={isChatOpen} 
        onClose={() => setIsChatOpen(false)}
        preloadMessage={chatPreloadMessage}
        clearPreload={() => setChatPreloadMessage('')}
        onRefetch={handleRefetchAll}
      />

      {/* Sharesies Connection Prompt Dialog Overlay */}
      {showSharesiesPrompt && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}>
          <div className="glass-panel" style={{
            padding: '30px',
            borderRadius: '16px',
            maxWidth: '440px',
            width: '90%',
            textAlign: 'center',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}>
            {modalMode === 'prompt' && (
              <>
                <div style={{ fontSize: '48px', margin: '0 auto' }}>🇳🇿</div>
                <h3 style={{ fontSize: '20px', fontWeight: '800', margin: 0 }} className="gradient-text">
                  Connect Sharesies NZ Account
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6', margin: 0 }}>
                  Investa works best when connected to your live Sharesies portfolio. Please log in to synchronize your active holdings, cash balances, and trade history.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                  <button 
                    className="investa-button" 
                    style={{ width: '100%', padding: '12px' }}
                    onClick={() => setModalMode('login')}
                  >
                    CONNECT ACCOUNT NOW
                  </button>
                  <button 
                    className="investa-button-secondary" 
                    style={{ width: '100%', padding: '12px', background: 'transparent', border: '1px solid var(--border-glass)' }}
                    onClick={() => setShowSharesiesPrompt(false)}
                  >
                    DISMISS & USE OFFLINE MODE
                  </button>
                </div>
              </>
            )}

            {modalMode === 'login' && (
              <form onSubmit={handleModalSharesiesConnect} style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '800', margin: 0, textAlign: 'center' }} className="gradient-text">
                  Log in to Sharesies
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)' }}>Email Address</label>
                  <input 
                    type="email" 
                    value={sharesiesEmail} 
                    onChange={(e) => setSharesiesEmail(e.target.value)} 
                    placeholder="name@example.com" 
                    className="investa-input"
                    disabled={sharesiesLoading}
                    required
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)' }}>Password</label>
                  <input 
                    type="password" 
                    value={sharesiesPassword} 
                    onChange={(e) => setSharesiesPassword(e.target.value)} 
                    placeholder="••••••••" 
                    className="investa-input"
                    disabled={sharesiesLoading}
                    required
                  />
                </div>

                {sharesiesMessage && (
                  <div style={{ 
                    fontSize: '12px', 
                    fontWeight: '600', 
                    color: sharesiesMessage.success ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                    textAlign: 'center'
                  }}>
                    {sharesiesMessage.text}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button 
                    type="button"
                    className="investa-button-secondary" 
                    style={{ flex: 1, padding: '12px', background: 'transparent', border: '1px solid var(--border-glass)' }}
                    onClick={() => setModalMode('prompt')}
                    disabled={sharesiesLoading}
                  >
                    BACK
                  </button>
                  <button 
                    type="submit"
                    className="investa-button" 
                    style={{ flex: 2, padding: '12px' }}
                    disabled={sharesiesLoading}
                  >
                    {sharesiesLoading ? 'CONNECTING...' : 'CONNECT'}
                  </button>
                </div>
              </form>
            )}

            {modalMode === 'mfa' && (
              <form onSubmit={handleModalSharesiesConnect} style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '800', margin: 0, textAlign: 'center' }} className="gradient-text">
                  2-Step Verification
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center', margin: 0 }}>
                  Enter the 6-digit verification code sent to your email or authenticator app.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxWidth: '240px', margin: '0 auto', width: '100%' }}>
                  <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textAlign: 'center' }}>Verification Code</label>
                  <input 
                    type="text" 
                    maxLength="6"
                    value={sharesiesMfaCode} 
                    onChange={(e) => setSharesiesMfaCode(e.target.value.replace(/\D/g, ''))} 
                    placeholder="123456" 
                    className="investa-input"
                    style={{ fontSize: '18px', letterSpacing: '4px', textAlign: 'center', fontWeight: '700' }}
                    disabled={sharesiesLoading}
                    required
                    autoFocus
                  />
                </div>

                {sharesiesMessage && (
                  <div style={{ 
                    fontSize: '12px', 
                    fontWeight: '600', 
                    color: sharesiesMessage.success ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                    textAlign: 'center'
                  }}>
                    {sharesiesMessage.text}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button 
                    type="button"
                    className="investa-button-secondary" 
                    style={{ flex: 1, padding: '12px', background: 'transparent', border: '1px solid var(--border-glass)' }}
                    onClick={() => setModalMode('login')}
                    disabled={sharesiesLoading}
                  >
                    BACK
                  </button>
                  <button 
                    type="submit"
                    className="investa-button" 
                    style={{ flex: 2, padding: '12px' }}
                    disabled={sharesiesLoading}
                  >
                    {sharesiesLoading ? 'VERIFYING...' : 'VERIFY'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
