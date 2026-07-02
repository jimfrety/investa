import React, { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { fetchPolicy, updatePolicy } from '../api/client'
import ShieldIcon from '@mui/icons-material/Shield'
import SaveIcon from '@mui/icons-material/Save'

export default function PolicyManager({ onPolicyUpdated }) {
  const { data: policy } = useQuery({
    queryKey: ['policy'],
    queryFn: fetchPolicy
  })

  const [primaryObj, setPrimaryObj] = useState('')
  const [secondaryObj, setSecondaryObj] = useState('')
  const [growthTarget, setGrowthTarget] = useState(35)
  const [maxRisk, setMaxRisk] = useState(4.5)
  const [maxSingle, setMaxSingle] = useState(7)
  const [minCoverage, setMinCoverage] = useState(1.3)
  const [minCap, setMinCap] = useState(2.0) // Billions
  const [avoidCuts, setAvoidCuts] = useState(true)
  const [maxSector, setMaxSector] = useState(20)
  const [cashAvailable, setCashAvailable] = useState(0)
  const [successMsg, setSuccessMsg] = useState('')

  // Sync state with query data
  useEffect(() => {
    if (policy) {
      setPrimaryObj(policy.primaryObjective || '')
      setSecondaryObj(policy.secondaryObjective || '')
      setGrowthTarget(Math.round((policy.growthSellTarget ?? 0.35) * 100))
      setMaxRisk(policy.maxRisk ?? 4.5)
      setMaxSingle(Math.round((policy.maxSingleHolding ?? 0.07) * 100))
      setMinCoverage(policy.minDividendCoverage ?? 1.3)
      setMinCap((policy.minMarketCap ?? 2.0e9) / 1.0e9)
      setAvoidCuts(policy.avoidDividendCuts !== false)
      setMaxSector(Math.round((policy.maxSectorExposure ?? 0.20) * 100))
      setCashAvailable(policy.cashAvailable ?? 0.0)
    }
  }, [policy])

  const policyMutation = useMutation({
    mutationFn: updatePolicy,
    onSuccess: () => {
      onPolicyUpdated()
      setSuccessMsg('Investment policy updated successfully!')
      setTimeout(() => setSuccessMsg(''), 4000)
    }
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    policyMutation.mutate({
      ...policy,
      primaryObjective: primaryObj,
      secondaryObjective: secondaryObj,
      growthSellTarget: growthTarget / 100.0,
      maxRisk: Number(maxRisk),
      maxSingleHolding: maxSingle / 100.0,
      minDividendCoverage: Number(minCoverage),
      minMarketCap: minCap * 1.0e9,
      avoidDividendCuts: avoidCuts,
      maxSectorExposure: maxSector / 100.0,
      cashAvailable: Number(cashAvailable)
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '800px' }}>
      
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <ShieldIcon style={{ color: 'var(--accent-indigo)', fontSize: '28px' }} />
          <div>
            <h3 style={{ fontSize: '20px', color: 'var(--text-primary)' }}>INVESTMENT POLICY ENGINE</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Configure safety boundaries. The AI portfolio manager operates within these rules.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Primary Objective</label>
              <input 
                type="text"
                value={primaryObj}
                onChange={(e) => setPrimaryObj(e.target.value)}
                className="investa-input"
              />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Secondary Objective</label>
              <input 
                type="text"
                value={secondaryObj}
                onChange={(e) => setSecondaryObj(e.target.value)}
                className="investa-input"
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Cash Available ($ NZD)</label>
              <input 
                type="number"
                value={cashAvailable}
                onChange={(e) => setCashAvailable(Number(e.target.value))}
                className="investa-input"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Max Portfolio Risk Rating ({maxRisk})</label>
              <input 
                type="range"
                min="1.0"
                max="7.0"
                step="0.1"
                value={maxRisk}
                onChange={(e) => setMaxRisk(Number(e.target.value))}
                style={{ accentColor: 'var(--accent-indigo)' }}
              />
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Scale 1 (low) to 7 (high)</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Max Single Holding Allocation ({maxSingle}%)</label>
              <input 
                type="range"
                min="1"
                max="25"
                value={maxSingle}
                onChange={(e) => setMaxSingle(Number(e.target.value))}
                style={{ accentColor: 'var(--accent-indigo)' }}
              />
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Capital limit per asset</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Max Sector Exposure ({maxSector}%)</label>
              <input 
                type="range"
                min="5"
                max="50"
                value={maxSector}
                onChange={(e) => setMaxSector(Number(e.target.value))}
                style={{ accentColor: 'var(--accent-indigo)' }}
              />
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Sector boundary limits</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Growth Profit Sell Trigger ({growthTarget}%)</label>
              <input 
                type="number"
                value={growthTarget}
                onChange={(e) => setGrowthTarget(Number(e.target.value))}
                className="investa-input"
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Min Dividend Coverage Ratio</label>
              <input 
                type="number"
                step="0.1"
                value={minCoverage}
                onChange={(e) => setMinCoverage(Number(e.target.value))}
                className="investa-input"
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Min Market Capitalisation ($B)</label>
              <input 
                type="number"
                step="0.5"
                value={minCap}
                onChange={(e) => setMinCap(Number(e.target.value))}
                className="investa-input"
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
            <input 
              type="checkbox"
              id="avoidCuts"
              checked={avoidCuts}
              onChange={(e) => setAvoidCuts(e.target.checked)}
              style={{ width: '18px', height: '18px', accentColor: 'var(--accent-indigo)' }}
            />
            <label htmlFor="avoidCuts" style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
              Avoid stocks with historical dividend cuts within the last 3 years
            </label>
          </div>

          {successMsg && (
            <div style={{ color: 'var(--accent-emerald)', fontSize: '13px', fontWeight: '700' }}>
              ✓ {successMsg}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button type="submit" className="investa-button" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <SaveIcon fontSize="small" /> SAVE POLICY
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
