import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchDividendMetrics, fetchDividendCalendar, fetchDividendPayments } from '../api/client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn'
import QueryStatsIcon from '@mui/icons-material/QueryStats'
import SavingsIcon from '@mui/icons-material/Savings'
import AutorenewIcon from '@mui/icons-material/Autorenew'

export default function DividendPlanner({ onAskAI }) {
  const { data: metrics } = useQuery({
    queryKey: ['divMetrics'],
    queryFn: fetchDividendMetrics
  })

  const { data: calendar = [] } = useQuery({
    queryKey: ['divCalendar'],
    queryFn: fetchDividendCalendar
  })

  const { data: payments = [] } = useQuery({
    queryKey: ['divPayments'],
    queryFn: fetchDividendPayments
  })

  const annualIncome = metrics?.annualIncome ?? 18200.0;
  const monthlyAverage = metrics?.monthlyAverage ?? 1516.0;
  const projected2030 = metrics?.projectedIncome2030 ?? 42000.0;
  const growthRate = metrics?.growthRate ?? 8.4;
  const yieldPct = metrics?.portfolioYield ?? 5.4;

  // Render tooltip formatted
  const formatTooltip = (val) => [`$${Number(val).toFixed(2)}`, 'Payout'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* 4 Core Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '24px' }}>
        
        <div className="glass-panel stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>CURRENT ANNUAL INCOME</span>
            <MonetizationOnIcon style={{ color: 'var(--accent-emerald)' }} />
          </div>
          <span className="stat-val">${annualIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Portfolio yield of {yieldPct.toFixed(2)}%</p>
        </div>
        
        <div className="glass-panel stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>MONTHLY AVERAGE</span>
            <SavingsIcon style={{ color: 'var(--accent-cyan)' }} />
          </div>
          <span className="stat-val">${monthlyAverage.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Consistent monthly cashflows</p>
        </div>

        <div className="glass-panel stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>INCOME GROWTH RATE</span>
            <AutorenewIcon style={{ color: 'var(--accent-indigo)' }} />
          </div>
          <span className="stat-val">{growthRate}%</span>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Aggregate dividend CAGR</p>
        </div>

        <div className="glass-panel stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>PROJECTED INCOME (2030)</span>
            <QueryStatsIcon style={{ color: 'var(--accent-amber)' }} />
          </div>
          <span className="stat-val">${projected2030.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Compounding reinvested payouts</p>
        </div>
      </div>

      {/* Bar Chart Calendar */}
      <div className="glass-panel" style={{ padding: '24px', minHeight: '340px' }}>
        <h3 style={{ fontSize: '18px', color: 'var(--text-primary)', marginBottom: '8px' }}>DIVIDEND CALENDAR</h3>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>Expected monthly cash flow distributions</p>
        
        <div style={{ width: '100%', height: '230px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={calendar}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
              <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-glass)', borderRadius: '8px', color: 'var(--text-primary)' }}
                formatter={formatTooltip}
              />
              <Bar dataKey="amount" fill="var(--accent-emerald)" radius={[4, 4, 0, 0]} maxBarSize={45} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detailed Payouts Table */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '18px', color: 'var(--text-primary)', marginBottom: '8px' }}>DETAILED DIVIDEND PAYMENTS</h3>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>Actual and declared historical payouts for your holdings</p>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-glass)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '12px 8px' }}>Symbol</th>
                <th style={{ padding: '12px 8px' }}>Company</th>
                <th style={{ padding: '12px 8px', textAlign: 'right' }}>Ex-Dividend Date</th>
                <th style={{ padding: '12px 8px', textAlign: 'right' }}>Payment Date</th>
                <th style={{ padding: '12px 8px', textAlign: 'right' }}>Currency</th>
                <th style={{ padding: '12px 8px', textAlign: 'right' }}>Per Share</th>
                <th style={{ padding: '12px 8px', textAlign: 'right' }}>Shares Held</th>
                <th style={{ padding: '12px 8px', textAlign: 'right' }}>Total (Base NZD)</th>
                <th style={{ padding: '12px 8px', textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', color: 'var(--text-primary)' }}>
                  <td style={{ padding: '12px 8px', fontWeight: '700', color: 'var(--accent-indigo)' }}>{p.code}</td>
                  <td style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>{p.shareName}</td>
                  <td style={{ padding: '12px 8px', textAlign: 'right' }}>{p.exDividendDate}</td>
                  <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: '600' }}>{p.paymentDate}</td>
                  <td style={{ padding: '12px 8px', textAlign: 'right', color: 'var(--text-muted)' }}>{p.currency}</td>
                  <td style={{ padding: '12px 8px', textAlign: 'right' }}>${p.amount.toFixed(4)}</td>
                  <td style={{ padding: '12px 8px', textAlign: 'right' }}>{p.quantity.toLocaleString()}</td>
                  <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: '700', color: 'var(--accent-emerald)' }}>
                    ${p.totalPayoutBase.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '10px',
                      fontWeight: '700',
                      backgroundColor: p.status === 'PAID' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                      color: p.status === 'PAID' ? 'var(--accent-emerald)' : 'var(--accent-amber)'
                    }}>
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr>
                  <td colSpan="9" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No dividend payments recorded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Retirment Planning shortcuts */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontSize: '18px', color: 'var(--text-primary)', marginBottom: '6px' }}>Retirement Planning Modeling</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Find out if you can sustain your lifestyle or achieve financial freedom using your current portfolio yield.
          </p>
        </div>
        <button 
          className="investa-button"
          onClick={() => onAskAI("Can I retire on these dividends?")}
        >
          Model Retirement
        </button>
      </div>
    </div>
  )
}
