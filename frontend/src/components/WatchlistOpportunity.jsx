import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchWatchlist } from '../api/client'
import AddIcon from '@mui/icons-material/Add'
import AssistantIcon from '@mui/icons-material/Assistant'

export default function WatchlistOpportunity({ onAskAI, onTradeExecuted }) {
  const { data: watchlist = [], refetch } = useQuery({
    queryKey: ['watchlist'],
    queryFn: fetchWatchlist
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontSize: '18px', fontWeight: '700' }} className="gradient-text">WATCHLIST & FIT RANKINGS</h3>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Top stock options evaluated against active portfolio allocations</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {watchlist.map((item) => (
          <div key={item.code} className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '220px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                  <h4 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>{item.shareName}</h4>
                  <span style={{ fontSize: '12px', color: 'var(--accent-cyan)', fontWeight: '700' }}>{item.code} · {item.market}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <span style={{ fontSize: '24px', fontWeight: '800', color: 'var(--accent-indigo)' }}>{item.overallScore}</span>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: '700' }}>FIT SCORE</span>
                </div>
              </div>

              {/* Score breakdown metrics grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', fontSize: '11px', marginBottom: '16px' }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '6px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.03)' }}>
                  <div style={{ color: 'var(--text-muted)' }}>Gross Yield</div>
                  <strong style={{ color: 'var(--accent-cyan)' }}>{item.dividendYield != null ? `${item.dividendYield.toFixed(2)}%` : '0.00%'}</strong>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '6px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.03)' }}>
                  <div style={{ color: 'var(--text-muted)' }}>Div Quality</div>
                  <strong style={{ color: 'var(--accent-emerald)' }}>{item.dividendQuality}</strong>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '6px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.03)' }}>
                  <div style={{ color: 'var(--text-muted)' }}>Growth</div>
                  <strong>{item.growth}</strong>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '6px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.03)' }}>
                  <div style={{ color: 'var(--text-muted)' }}>Value</div>
                  <strong>{item.valueScore}</strong>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '6px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.03)' }}>
                  <div style={{ color: 'var(--text-muted)' }}>Risk</div>
                  <strong style={{ color: item.risk >= 7 ? 'var(--accent-rose)' : 'var(--text-primary)' }}>{item.risk}/7</strong>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '6px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.03)' }}>
                  <div style={{ color: 'var(--text-muted)' }}>Port. Fit</div>
                  <strong style={{ color: 'var(--accent-indigo)' }}>{item.portfolioFit}</strong>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '6px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.03)' }}>
                  <div style={{ color: 'var(--text-muted)' }}>Momentum</div>
                  <strong>{item.momentum}</strong>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border-glass)', paddingTop: '12px' }}>
              <button 
                className="investa-button" 
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: '6px 12px', fontSize: '12px' }}
                onClick={() => onAskAI(`Generate a DCF valuation and policy fit analysis for watchlisted ticker ${item.code}`)}
              >
                <AssistantIcon fontSize="small" /> AI Research
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
