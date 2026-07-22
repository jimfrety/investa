import React, { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchHoldings } from '../api/client'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'

export default function ReturnCalculator() {
  const { data: holdings = [] } = useQuery({
    queryKey: ['holdings'],
    queryFn: fetchHoldings
  })

  // State inputs
  const [selectedCode, setSelectedCode] = useState('ALL')
  const [mode, setMode] = useState('existing') // Default to existing since entire portfolio starts with active net worth
  const [newCash, setNewCash] = useState(5000)
  const [years, setYears] = useState(10)
  const [growthRate, setGrowthRate] = useState(8.0)
  const [divYield, setDivYield] = useState(3.5)
  const [drip, setDrip] = useState(true)

  // Selected asset details
  const [selectedAsset, setSelectedAsset] = useState(null)

  // Auto-select entire portfolio on load
  useEffect(() => {
    if (holdings.length > 0 && !selectedCode) {
      setSelectedCode('ALL')
    }
  }, [holdings, selectedCode])

  // Calculate weighted portfolio defaults
  const portfolioDefaults = useMemo(() => {
    if (!holdings || holdings.length === 0) return { yield: 3.5, growth: 8.0, value: 5000 }
    
    let totalValue = 0.0
    let weightedYield = 0.0
    let weightedGrowth = 0.0

    for (const h of holdings) {
      if (h.quantity && h.currentPrice) {
        totalValue += (h.quantity * h.currentPrice)
      }
    }

    if (totalValue === 0) return { yield: 3.5, growth: 8.0, value: 5000 }

    for (const h of holdings) {
      if (h.quantity && h.currentPrice) {
        const val = h.quantity * h.currentPrice
        const weight = val / totalValue

        // Yield
        let yieldVal = 0.0
        if (h.type === 'dividend') {
          yieldVal = h.code === 'JEPI' ? 7.5 : h.code === 'O' ? 5.8 : 5.5
        } else if (h.type === 'both') {
          yieldVal = h.code === 'ENB' ? 6.5 : 2.5
        }

        // Growth
        let growthVal = h.simpleReturn != null ? (h.simpleReturn - yieldVal) : 8.0
        if (growthVal < -20.0) growthVal = -20.0
        if (growthVal > 30.0) growthVal = 30.0

        weightedYield += weight * yieldVal
        weightedGrowth += weight * growthVal
      }
    }

    return {
      yield: Number(weightedYield.toFixed(1)),
      growth: Number(weightedGrowth.toFixed(1)),
      value: totalValue
    }
  }, [holdings])

  // Sync parameters when selected asset changes
  useEffect(() => {
    if (selectedCode === 'ALL') {
      setSelectedAsset({
        code: 'ALL',
        shareName: 'Entire Portfolio',
        currentPrice: portfolioDefaults.value,
        quantity: 1.0,
        type: 'both',
        simpleReturn: portfolioDefaults.growth + portfolioDefaults.yield
      })
      setGrowthRate(portfolioDefaults.growth)
      setDivYield(portfolioDefaults.yield)
    } else if (selectedCode && holdings.length > 0) {
      const asset = holdings.find(h => h.code === selectedCode)
      if (asset) {
        setSelectedAsset(asset)
        
        // Determine default current gross yield & past price growth as start point
        let yieldVal = 0.0
        if (asset.type === 'dividend') {
          yieldVal = asset.code === 'JEPI' ? 7.5 : asset.code === 'O' ? 5.8 : 5.5
        } else if (asset.type === 'both') {
          yieldVal = asset.code === 'ENB' ? 6.5 : 2.5
        }
        let growthVal = asset.simpleReturn != null ? (asset.simpleReturn - yieldVal) : 8.0

        setGrowthRate(Number(growthVal.toFixed(1)))
        setDivYield(Number(yieldVal.toFixed(1)))
      }
    }
  }, [selectedCode, holdings, portfolioDefaults])

  // Helper to retrieve original startup defaults
  const getAssetDefaults = () => {
    if (!selectedAsset) return { yield: 3.5, growth: 8.0 }
    if (selectedAsset.code === 'ALL') {
      return {
        yield: portfolioDefaults.yield,
        growth: portfolioDefaults.growth
      }
    }
    let yieldVal = 0.0
    if (selectedAsset.type === 'dividend') {
      yieldVal = selectedAsset.code === 'JEPI' ? 7.5 : selectedAsset.code === 'O' ? 5.8 : 5.5
    } else if (selectedAsset.type === 'both') {
      yieldVal = selectedAsset.code === 'ENB' ? 6.5 : 2.5
    }
    let growthVal = selectedAsset.simpleReturn != null ? (selectedAsset.simpleReturn - yieldVal) : 8.0
    return {
      yield: Number(yieldVal.toFixed(1)),
      growth: Number(growthVal.toFixed(1))
    }
  }

  const defaults = getAssetDefaults()

  // Perform financial simulation
  const simulateReturns = () => {
    if (!selectedAsset) return { chartData: [], summary: {} }

    let existingValue = (selectedAsset.quantity * selectedAsset.currentPrice)
    let initialCapital = mode === 'new' ? (existingValue + newCash) : existingValue
    let initialShares = mode === 'new' ? ((existingValue + newCash) / selectedAsset.currentPrice) : selectedAsset.quantity
    let currentPrice = selectedAsset.currentPrice
    
    let shares = initialShares
    let accumulatedCashDividends = 0.0
    let totalDividendsReceived = 0.0
    
    const chartData = []
    
    // Year 0 starting point
    chartData.push({
      year: 'Start',
      cost: Math.round(initialCapital),
      growth: 0,
      dividends: 0,
      total: Math.round(initialCapital)
    })

    const g = growthRate / 100.0
    const d = divYield / 100.0

    for (let year = 1; year <= years; year++) {
      // Stock price grows at the end of the year
      const nextPrice = currentPrice * (1 + g)
      const shareGrowthProfit = shares * (nextPrice - selectedAsset.currentPrice)
      
      // Calculate annual dividend paid on average year stock price
      const avgPrice = (currentPrice + nextPrice) / 2
      const dividendPaid = shares * avgPrice * d
      totalDividendsReceived += dividendPaid

      if (drip) {
        // Buy more shares at end of year price
        shares += (dividendPaid / nextPrice)
      } else {
        accumulatedCashDividends += dividendPaid
      }

      currentPrice = nextPrice
      
      // Portfolio valuation breakdown
      const stockAppreciationVal = shares * currentPrice - initialCapital
      
      chartData.push({
        year: `Yr ${year}`,
        cost: Math.round(initialCapital),
        growth: Math.round(Math.max(0, stockAppreciationVal)),
        dividends: Math.round(totalDividendsReceived),
        total: Math.round((shares * currentPrice) + (drip ? 0 : accumulatedCashDividends))
      })
    }

    const endingVal = (shares * currentPrice) + (drip ? 0 : accumulatedCashDividends)
    const totalProfit = endingVal - initialCapital
    const totalReturnPct = (totalProfit / initialCapital) * 100
    const cagr = (Math.pow(endingVal / initialCapital, 1 / years) - 1) * 100

    return {
      chartData,
      summary: {
        initialCapital,
        endingVal,
        totalProfit,
        totalDividendsReceived,
        totalReturnPct,
        cagr,
        endingShares: shares
      }
    }
  }

  const { chartData, summary: results } = simulateReturns()

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
      
      {/* Dynamic calculator interface split */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        
        {/* Left Side: Input Form Card */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUpIcon style={{ color: 'var(--accent-indigo)' }} />
            <h3 style={{ fontSize: '18px', fontWeight: '700' }}>Calculator Inputs</h3>
          </div>

          {/* Select Asset */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>Select Stock Asset</label>
            <select 
              value={selectedCode}
              onChange={(e) => setSelectedCode(e.target.value)}
              className="investa-input"
            >
              <option value="ALL">💼 Entire Portfolio — ${portfolioDefaults.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</option>
              {holdings.map(h => (
                <option key={h.code} value={h.code}>
                  {h.shareName} ({h.code}) — ${h.currentPrice?.toFixed(2)}
                </option>
              ))}
            </select>
          </div>

          {/* Investment Mode tabs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>Simulation Type</label>
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
              <button 
                onClick={() => setMode('new')}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '6px',
                  background: mode === 'new' ? 'var(--bg-glass-hover)' : 'transparent',
                  border: 'none',
                  color: 'var(--text-primary)',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Simulate New Cash
              </button>
              <button 
                onClick={() => setMode('existing')}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '6px',
                  background: mode === 'existing' ? 'var(--bg-glass-hover)' : 'transparent',
                  border: 'none',
                  color: 'var(--text-primary)',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Use Current Holding
              </button>
            </div>
          </div>

          {/* Cash Amount input (New Mode only) */}
          {mode === 'new' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>Simulated New Cash ($)</label>
              <input 
                type="number" 
                value={newCash}
                onChange={(e) => setNewCash(Math.max(100, Number(e.target.value)))}
                className="investa-input"
                min="100"
              />
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                This cash will be added directly on top of your existing position/portfolio value (${(selectedAsset?.quantity * selectedAsset?.currentPrice)?.toLocaleString(undefined, { minimumFractionDigits: 2 })}).
              </span>
            </div>
          )}

          {mode === 'existing' && selectedAsset && (
            <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.03)', fontSize: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-muted)' }}>
                  {selectedCode === 'ALL' ? 'Portfolio Status:' : 'Current Position size:'}
                </span>
                <strong>
                  {selectedCode === 'ALL' ? 'Aggregated Assets' : `${selectedAsset.quantity?.toFixed(2)} shares`}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>
                  {selectedCode === 'ALL' ? 'Total Holdings value:' : 'Current Position value:'}
                </span>
                <strong>${(selectedAsset.quantity * selectedAsset.currentPrice)?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
              </div>
            </div>
          )}

          {/* Sliders Horizon, Growth, Yield */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>Projection Timeframe</span>
                <strong>{years} Years</strong>
              </div>
              <input 
                type="range" 
                min="1" 
                max="30" 
                value={years}
                onChange={(e) => setYears(Number(e.target.value))}
                style={{ accentColor: 'var(--accent-indigo)' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>
                  Annual Price Growth <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '400' }}>(Default: {defaults.growth}%)</span>
                </span>
                <strong>{growthRate}%</strong>
              </div>
              <input 
                type="range" 
                min="-20" 
                max="30" 
                step="0.5"
                value={growthRate}
                onChange={(e) => setGrowthRate(Number(e.target.value))}
                style={{ accentColor: 'var(--accent-indigo)' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>
                  Annual Dividend Yield <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '400' }}>(Default: {defaults.yield}%)</span>
                </span>
                <strong>{divYield}%</strong>
              </div>
              <input 
                type="range" 
                min="0" 
                max="15" 
                step="0.1"
                value={divYield}
                onChange={(e) => setDivYield(Number(e.target.value))}
                style={{ accentColor: 'var(--accent-indigo)' }}
              />
            </div>

          </div>

          {/* Checkbox DRIP */}
          <FormControlLabel
            control={
              <Checkbox 
                checked={drip} 
                onChange={(e) => setDrip(e.target.checked)} 
                sx={{
                  color: 'rgba(255,255,255,0.3)',
                  '&.Mui-checked': { color: 'var(--accent-indigo)' }
                }}
              />
            }
            label={
              <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                <strong>Reinvest Dividends (DRIP)</strong>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>Compounds returns by purchasing fractional shares.</p>
              </div>
            }
          />

        </div>

        {/* Right Side: Projections Cards and Recharts Stacked Area */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Key Output Metrics cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
            
            <div className="glass-panel" style={{ padding: '16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>Projected Net Value</div>
              <div style={{ fontSize: '24px', fontWeight: '800', margin: '4px 0', color: 'var(--text-primary)' }}>
                ${results.endingVal?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--accent-emerald)', fontWeight: '600' }}>
                CAGR: {results.cagr?.toFixed(2)}%
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>Total Return (ROI)</div>
              <div style={{ fontSize: '24px', fontWeight: '800', margin: '4px 0', color: 'var(--accent-emerald)' }}>
                +{results.totalReturnPct?.toFixed(1)}%
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Profit: +${results.totalProfit?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>Dividends Earned</div>
              <div style={{ fontSize: '20px', fontWeight: '800', margin: '4px 0', color: 'var(--accent-amber)' }}>
                ${results.totalDividendsReceived?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Over {years} year horizon
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>Ending Shares</div>
              <div style={{ fontSize: '20px', fontWeight: '800', margin: '4px 0', color: 'var(--text-primary)' }}>
                {results.endingShares?.toFixed(2)} Shares
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Initial: {results.initialCapital && selectedAsset ? (results.initialCapital / selectedAsset.currentPrice).toFixed(2) : 0} shares
              </div>
            </div>

          </div>

          {/* Projection Stacked Area Chart */}
          <div className="glass-panel" style={{ padding: '20px', flex: 1 }}>
            <h4 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '16px', color: 'var(--text-secondary)' }}>Projected Growth Trajectory</h4>
            <div style={{ width: '100%', height: '240px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0}/>
                    </linearGradient>
                    <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                    </linearGradient>
                    <linearGradient id="divGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="year" stroke="var(--text-muted)" fontSize={10} tickLine={false} />
                  <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', borderRadius: '8px' }}
                    labelStyle={{ color: 'var(--text-primary)' }}
                  />
                  <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                  <Area type="monotone" name="Cost Basis" dataKey="cost" stackId="1" stroke="#6366f1" fill="url(#costGrad)" />
                  <Area type="monotone" name="Capital Growth" dataKey="growth" stackId="1" stroke="#10b981" fill="url(#growthGrad)" />
                  <Area type="monotone" name="Dividends" dataKey="dividends" stackId="1" stroke="#f59e0b" fill="url(#divGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

      </div>

    </div>
  )
}
