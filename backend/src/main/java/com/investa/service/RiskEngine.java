package com.investa.service;

import com.investa.model.Holding;
import com.investa.model.InvestmentPolicy;
import com.investa.repository.HoldingRepository;
import com.investa.repository.InvestmentPolicyRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
@RequiredArgsConstructor
public class RiskEngine {

    private final HoldingRepository holdingRepository;
    private final InvestmentPolicyRepository policyRepository;

    public Map<String, Object> calculateRiskMetrics() {
        List<Holding> holdings = holdingRepository.findAll();
        InvestmentPolicy policy = policyRepository.findAll().stream().findFirst().orElse(null);

        double totalValue = 0.0;
        Map<String, Double> sectorValues = new HashMap<>();
        Map<String, Double> countryValues = new HashMap<>();
        Map<String, Double> currencyValues = new HashMap<>();

        double weightedRisk = 0.0;
        
        for (Holding h : holdings) {
            double currentVal = h.getQuantity() * h.getCurrentPrice();
            totalValue += currentVal;

            sectorValues.put(h.getSector(), sectorValues.getOrDefault(h.getSector(), 0.0) + currentVal);
            countryValues.put(h.getCountry(), countryValues.getOrDefault(h.getCountry(), 0.0) + currentVal);
            currencyValues.put(h.getCurrency(), currencyValues.getOrDefault(h.getCurrency(), 0.0) + currentVal);

            weightedRisk += (h.getRisk() != null ? h.getRisk() : 5) * currentVal;
        }

        double averageRisk = totalValue > 0 ? (weightedRisk / totalValue) : 0.0;
        
        // Calculate percentages
        List<Map<String, Object>> sectorExposure = new ArrayList<>();
        for (Map.Entry<String, Double> entry : sectorValues.entrySet()) {
            Map<String, Object> item = new HashMap<>();
            item.put("sector", entry.getKey());
            item.put("value", entry.getValue());
            item.put("percentage", totalValue > 0 ? (entry.getValue() / totalValue) * 100.0 : 0.0);
            sectorExposure.add(item);
        }

        List<Map<String, Object>> countryExposure = new ArrayList<>();
        for (Map.Entry<String, Double> entry : countryValues.entrySet()) {
            Map<String, Object> item = new HashMap<>();
            item.put("country", entry.getKey());
            item.put("value", entry.getValue());
            item.put("percentage", totalValue > 0 ? (entry.getValue() / totalValue) * 100.0 : 0.0);
            countryExposure.add(item);
        }

        // Check if any rule violated
        List<String> riskAlerts = new ArrayList<>();
        if (policy != null) {
            double maxSector = policy.getMaxSectorExposure() * 100.0;
            for (Map<String, Object> item : sectorExposure) {
                double pct = (double) item.get("percentage");
                if (pct > maxSector) {
                    riskAlerts.add("Sector Exposure Alert: " + item.get("sector") + " is at " + String.format("%.1f", pct) + "% (Policy Max: " + maxSector + "%)");
                }
            }

            double maxRisk = policy.getMaxRisk();
            if (averageRisk > maxRisk) {
                riskAlerts.add("Portfolio Risk Alert: Average risk is " + String.format("%.2f", averageRisk) + " (Policy Max: " + maxRisk + ")");
            }

            double maxSingle = policy.getMaxSingleHolding() * 100.0;
            for (Holding h : holdings) {
                double holdingPct = totalValue > 0 ? ((h.getQuantity() * h.getCurrentPrice()) / totalValue) * 100.0 : 0.0;
                if (holdingPct > maxSingle) {
                    riskAlerts.add("Concentration Alert: Holding " + h.getCode() + " is at " + String.format("%.1f", holdingPct) + "% (Policy Max: " + maxSingle + "%)");
                }
            }
        }

        // Compile portfolio health score metrics
        int divSafety = 92;
        int growthScore = 81;
        int divScore = 88;
        int valScore = 85;
        int riskScore = 90;

        if (averageRisk > 6.0) riskScore -= 15;
        else if (averageRisk > 5.0) riskScore -= 8;

        if (sectorValues.size() < 4) divScore -= 15;
        else if (sectorValues.size() < 6) divScore -= 5;

        // Health Score (Composite out of 100)
        int overallHealth = (divSafety + growthScore + divScore + valScore + riskScore) / 5;

        Map<String, Object> healthSummary = new HashMap<>();
        healthSummary.put("portfolioHealth", overallHealth);
        healthSummary.put("dividendSafety", divSafety);
        healthSummary.put("growthPotential", growthScore);
        healthSummary.put("diversification", divScore);
        healthSummary.put("valuation", valScore);
        healthSummary.put("risk", riskScore);

        Map<String, Object> metrics = new HashMap<>();
        metrics.put("averageRisk", averageRisk);
        metrics.put("portfolioBeta", 1.05 + (averageRisk - 5.0) * 0.1);
        metrics.put("sectorExposure", sectorExposure);
        metrics.put("countryExposure", countryExposure);
        metrics.put("currencyExposure", currencyValues);
        metrics.put("alerts", riskAlerts);
        metrics.put("health", healthSummary);

        return metrics;
    }
}
