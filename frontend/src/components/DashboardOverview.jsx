import React from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'

export default function DashboardOverview({ onAskAI, summary, risk }) {
  // Demo historical data for AreaChart (represents portfolio snapshot history)
  const historicalData = [
    { name: 'W1', value: 175000 },
    { name: 'W2', value: 178500 },
    { name: 'W3', value: 181200 },
    { name: 'W4', value: 180500 },
    { name: 'W5', value: 183400 },
    { name: 'W6', value: 185600 },
    { name: 'W7', value: 187200 },
    { name: 'Today', value: summary?.netWorth ?? 185000 }
  ]

  // Sector Exposure Data for PieChart
  const sectorData = risk?.sectorExposure?.map(s => ({
    name: s.sector,
    value: s.value
  })) ?? [
    { name: 'Technology', value: 65000 },
    { name: 'ETFs / Index', value: 35000 },
    { name: 'Energy', value: 22000 },
    { name: 'Financials', value: 15000 },
    { name: 'Real Estate', value: 6000 }
  ]

  const COLORS = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#3b82f6']

  const health = risk?.health ?? {
    portfolioHealth: 91,
    dividendSafety: 95,
    growthPotential: 83,
    diversification: 92,
    valuation: 87,
    risk: 90
  }

  const quickQuestions = [
    "I have $4,000 to invest.",
    "Should I sell CrowdStrike now?",
    "How much annual income am I generating?",
    "Which holding has become the highest risk?",
    "Find replacements for AGNC."
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner Grid */}
      <div className="dashboard-main-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
        
        {/* Net Worth Chart Card */}
        <div className="glass-panel chart-card-span2" style={{ padding: '24px', gridColumn: 'span 2', minHeight: '320px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '18px', color: 'var(--text-primary)' }}>PORTFOLIO GROWTH</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Historical valuation over the last 8 weeks</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-emerald)', fontSize: '14px', fontWeight: '700' }}>
              <ArrowUpwardIcon fontSize="small" /> +6.8%
            </div>
          </div>
          
          <div style={{ width: '100%', height: '220px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={historicalData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent-indigo)" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="var(--accent-indigo)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v/1000}k`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-glass)', borderRadius: '8px', color: 'var(--text-primary)' }}
                  formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Valuation']}
                />
                <Area type="monotone" dataKey="value" stroke="var(--accent-indigo)" strokeWidth={2.5} fillOpacity={1} fill="url(#colorValue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sector Allocation Card */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '18px', color: 'var(--text-primary)', marginBottom: '8px' }}>SECTOR EXPOSURE</h3>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>Diversification breakdown</p>
          
          <div style={{ width: '100%', height: '180px', position: 'relative' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sectorData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {sectorData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `$${Number(value).toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px', marginTop: '12px', maxHeight: '70px', overflowY: 'auto' }}>
            {sectorData.slice(0, 8).map((entry, index) => (
              <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: COLORS[index % COLORS.length], flexShrink: 0 }}></div>
                <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Total Return Breakdown Section */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '18px', color: 'var(--text-primary)', marginBottom: '4px' }}>TOTAL PORTFOLIO RETURN</h3>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>Comprehensive returns accounting for asset growth, currency movements, dividends, and friction</p>
        
        <div className="return-breakdown-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '24px', alignItems: 'center' }}>
          {/* Main Return Card */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>NET TOTAL RETURN</span>
            <span style={{ 
              fontSize: '32px', 
              fontWeight: '800', 
              color: (summary?.totalReturn ?? 0) >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)' 
            }}>
              {(summary?.totalReturn ?? 0) >= 0 ? '▲ +' : '▼ -'}${Math.abs(summary?.totalReturn ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} NZD
            </span>
            <div style={{ display: 'flex', gap: '10px', fontSize: '11px', color: 'var(--text-muted)' }}>
              <span>Base Currency: NZD</span>
              <span>•</span>
              <span>All assets converted at current exchange rates</span>
            </div>
          </div>

          {/* Breakdown List */}
          <div className="return-breakdown-inner" style={{ gridColumn: 'span 2', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>📈 Unrealised Asset Gains</span>
                <span style={{ fontWeight: '700', color: (summary?.unrealisedAssetGains ?? 0) >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
                  {(summary?.unrealisedAssetGains ?? 0) >= 0 ? '+' : ''}${(summary?.unrealisedAssetGains ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>🤝 Realised Asset Gains</span>
                <span style={{ fontWeight: '700', color: (summary?.realisedAssetGains ?? 0) >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
                  {(summary?.realisedAssetGains ?? 0) >= 0 ? '+' : ''}${(summary?.realisedAssetGains ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>💰 Dividends Received</span>
                <span style={{ fontWeight: '700', color: 'var(--accent-emerald)' }}>
                  +${(summary?.dividendsReceived ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>💱 Unrealised Currency P&L</span>
                <span style={{ fontWeight: '700', color: (summary?.unrealisedCurrencyGains ?? 0) >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
                  {(summary?.unrealisedCurrencyGains ?? 0) >= 0 ? '+' : ''}${(summary?.unrealisedCurrencyGains ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>🏦 Realised Currency P&L</span>
                <span style={{ fontWeight: '700', color: (summary?.realisedCurrencyGains ?? 0) >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
                  {(summary?.realisedCurrencyGains ?? 0) >= 0 ? '+' : ''}${(summary?.realisedCurrencyGains ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>💸 Transaction Fees</span>
                <span style={{ fontWeight: '700', color: 'var(--accent-rose)' }}>
                  -${(summary?.transactionFees ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Health Sub-scores Section */}
      <div>
        <h3 style={{ fontSize: '20px', marginBottom: '16px', fontWeight: '700' }} className="gradient-text">Portfolio Diagnostics</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
          {[
            { title: 'Dividend Safety', score: health.dividendSafety, color: 'var(--accent-emerald)', desc: 'High payout sustainability' },
            { title: 'Growth Potential', score: health.growthPotential, color: 'var(--accent-cyan)', desc: 'Medium tech/ETF exposure' },
            { title: 'Diversification', score: health.diversification, color: 'var(--accent-indigo)', desc: 'Spread across 6 sectors' },
            { title: 'Valuation Entry', score: health.valuation, color: 'var(--accent-amber)', desc: 'Average 8% margin of safety' },
            { title: 'Volatility Risk', score: health.risk, color: 'var(--accent-emerald)', desc: 'Beta matches indexing' }
          ].map((item) => (
            <div key={item.title} className="glass-panel" style={{ padding: '20px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ width: '4px', height: '100%', position: 'absolute', left: 0, top: 0, backgroundColor: item.color }}></div>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>{item.title}</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', margin: '8px 0' }}>
                <span style={{ fontSize: '28px', fontWeight: '800' }}>{item.score}</span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>/100</span>
              </div>
              <p style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: '1.4' }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Alerts or Policy Status */}
      {risk?.alerts && risk.alerts.length > 0 && (
        <div className="glass-panel" style={{ padding: '20px', border: '1px solid rgba(244, 63, 94, 0.2)', backgroundColor: 'rgba(244, 63, 94, 0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-rose)', fontWeight: '700', marginBottom: '12px', fontSize: '14px' }}>
            <span style={{ fontSize: '18px' }}>⚠️</span> ACTIVE POLICY BREACHES ({risk.alerts.length})
          </div>
          <ul style={{ listStyleType: 'none', paddingLeft: '8px' }}>
            {risk.alerts.map((a, i) => (
              <li key={i} style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'var(--accent-rose)' }}></span> {a}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Ask AI Shortcuts Panel */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <HelpOutlineIcon style={{ color: 'var(--accent-indigo)' }} />
          <h3 style={{ fontSize: '18px', color: 'var(--text-primary)' }}>Ask the AI Portfolio Manager</h3>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px' }}>
          Investa knows your risk boundaries, active holdings, and objectives. Tap one of the inquiries below to launch fresh research:
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          {quickQuestions.map((q) => (
            <div 
              key={q} 
              onClick={() => onAskAI(q)}
              className="glass-panel-interactive"
              style={{
                padding: '10px 16px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: '600',
                border: '1px solid var(--border-glass)',
                backgroundColor: 'rgba(99, 102, 241, 0.04)',
                color: 'var(--text-primary)',
                transition: 'var(--transition-smooth)'
              }}
            >
              {q}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
