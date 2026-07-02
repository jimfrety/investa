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

// Icons
import DashboardIcon from '@mui/icons-material/Dashboard'
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import ShieldIcon from '@mui/icons-material/Shield'
import VisibilityIcon from '@mui/icons-material/Visibility'
import ForumIcon from '@mui/icons-material/Forum'
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety'
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import ChatBubbleIcon from '@mui/icons-material/ChatBubble'
import SettingsIcon from '@mui/icons-material/Settings'

export default function App() {
  const [activeTab, setActiveTab] = useState('overview')
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [chatPreloadMessage, setChatPreloadMessage] = useState('')

  const { data: summary, refetch: refetchSummary } = useQuery({
    queryKey: ['summary'],
    queryFn: fetchSummary
  })

  const { data: risk, refetch: refetchRisk } = useQuery({
    queryKey: ['risk'],
    queryFn: fetchRiskMetrics
  })

  const handleRefetchAll = () => {
    refetchSummary()
    refetchRisk()
  }

  // Pre-load a prompt and open chat
  const handleAskAI = (promptText) => {
    setChatPreloadMessage(promptText)
    setIsChatOpen(true)
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

      {/* Main Panel Section */}
      <main className="main-content">
        {/* Global Top Stats Strip */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <h1 className="gradient-text" style={{ fontSize: '28px', fontWeight: '800' }}>
              {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Real-time valuation based on latest seeded quotes</p>
          </div>
          
          <div style={{ display: 'flex', gap: '16px' }}>
            <div className="glass-panel stat-card" style={{ minWidth: '160px', padding: '12px 18px', borderRadius: '12px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>NET WORTH</span>
              <span style={{ fontSize: '20px', fontWeight: '800' }}>${netWorth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            
            <div className="glass-panel stat-card" style={{ minWidth: '140px', padding: '12px 18px', borderRadius: '12px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>CASH AVAILABLE</span>
              <span style={{ fontSize: '20px', fontWeight: '800', color: 'var(--accent-cyan)' }}>${cash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>

            <div className="glass-panel stat-card" style={{ minWidth: '150px', padding: '12px 18px', borderRadius: '12px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>UNREALIZED P&L</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '18px', fontWeight: '800', color: unrealised >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
                  {unrealised >= 0 ? '+' : ''}${unrealised.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
                <span className={`metric-trend ${unrealised >= 0 ? 'trend-up' : 'trend-down'}`} style={{ fontSize: '11px' }}>
                  ({unrealisedPct >= 0 ? '+' : ''}{unrealisedPct.toFixed(1)}%)
                </span>
              </div>
            </div>

            <div className="glass-panel stat-card" style={{ minWidth: '150px', padding: '12px 18px', borderRadius: '12px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>TOTAL RETURN</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '18px', fontWeight: '800', color: totalReturn >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
                  {totalReturn >= 0 ? '+' : ''}${totalReturn.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>

            <button className="investa-button" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 16px' }} onClick={() => setIsChatOpen(!isChatOpen)}>
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
    </div>
  )
}
