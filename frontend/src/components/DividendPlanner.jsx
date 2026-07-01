import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchDividendMetrics, fetchDividendCalendar } from '../api/client'
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
