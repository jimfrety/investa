import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchSnapshots } from '../api/client'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import ShowChartIcon from '@mui/icons-material/ShowChart'

export default function DashboardOverview({ onAskAI, summary, risk }) {
  // Fetch real portfolio snapshots
  const { data: rawSnapshots = [] } = useQuery({
    queryKey: ['snapshots'],
    queryFn: fetchSnapshots,
    staleTime: 5 * 60 * 1000 // 5 min
  })

  // Format snapshots for the chart — label with "Mon DD" or "Today"
  const historicalData = React.useMemo(() => {
    if (rawSnapshots.length === 0) return []
    
    // Filter out any snapshots with invalid, zero, or negative total values
    const validSnapshots = rawSnapshots.filter(s => s.totalValue && s.totalValue > 0)
    
    // Explicitly sort snapshots chronologically (ascending by date)
    const sortedSnapshots = [...validSnapshots].sort((a, b) => {
      if (!a.snapshotDate || !b.snapshotDate) return 0
      return a.snapshotDate.localeCompare(b.snapshotDate)
    })
    
    const today = new Date().toISOString().slice(0, 10)
    return sortedSnapshots.map((s) => {
      const date = s.snapshotDate // 'YYYY-MM-DD' string from Spring
      const isToday = date === today
      const label = isToday
        ? 'Today'
        : new Date(date + 'T00:00:00').toLocaleDateString('en-NZ', { month: 'short', day: 'numeric' })
      return { name: label, value: s.totalValue ?? 0 }
    })
  }, [rawSnapshots])

  // Growth % from first to latest snapshot
  const growthPct = React.useMemo(() => {
    if (historicalData.length < 2) return null
    const first = historicalData[0].value
    const last = historicalData[historicalData.length - 1].value
    if (first === 0) return null
    return ((last - first) / first) * 100
  }, [historicalData])

  const hasEnoughData = historicalData.length >= 2

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
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {hasEnoughData
                  ? `${historicalData.length} data point${historicalData.length !== 1 ? 's' : ''} · net portfolio value over time`
                  : 'Tracking starts today — come back tomorrow to see your first data point'}
              </p>
            </div>
            {growthPct !== null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: growthPct >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)', fontSize: '14px', fontWeight: '700' }}>
                {growthPct >= 0 ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />}
                {growthPct >= 0 ? '+' : ''}{growthPct.toFixed(2)}%
              </div>
            )}
          </div>
          
          <div style={{ width: '100%', height: '220px' }}>
            {hasEnoughData ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={historicalData}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent-indigo)" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="var(--accent-indigo)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-glass)', borderRadius: '8px', color: 'var(--text-primary)' }}
                    formatter={(value) => [`$${Number(value).toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Net Worth']}
                  />
                  <Area type="monotone" dataKey="value" stroke="var(--accent-indigo)" strokeWidth={2.5} fillOpacity={1} fill="url(#colorValue)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              /* No-data placeholder */
              <div style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                color: 'var(--text-muted)'
              }}>
                <ShowChartIcon style={{ fontSize: '48px', opacity: 0.3 }} />
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)', margin: 0 }}>Building your history</p>
                  <p style={{ fontSize: '12px', margin: '4px 0 0' }}>Today's value has been recorded. Your growth chart will appear once you have multiple data points.</p>
                </div>
                <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--accent-indigo)' }}>
                  ${(summary?.netWorth ?? 0).toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} today
                </div>
              </div>
            )}
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
                <span style={{ color: 'var(--text-secondary)' }}>📈 Unrealised Gain/Loss</span>
                <span style={{ fontWeight: '700', color: (summary?.unrealisedGain ?? 0) >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
                  {(summary?.unrealisedGain ?? 0) >= 0 ? '+' : ''}${(summary?.unrealisedGain ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
