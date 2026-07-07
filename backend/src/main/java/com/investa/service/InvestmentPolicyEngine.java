package com.investa.service;

import com.investa.model.Holding;
import com.investa.model.InvestmentPolicy;
import com.investa.repository.HoldingRepository;
import com.investa.repository.InvestmentPolicyRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class InvestmentPolicyEngine {

    private final HoldingRepository holdingRepository;
    private final InvestmentPolicyRepository policyRepository;

    public Map<String, Object> validateTradeProposal(String code, Double amount, String sector, int assetRisk) {
        InvestmentPolicy policy = policyRepository.findAll().stream().findFirst().orElse(null);
        List<Holding> holdings = holdingRepository.findAll();

        Map<String, Object> validation = new HashMap<>();
        if (policy == null) {
            validation.put("isValid", true);
            validation.put("message", "No active policy found.");
            return validation;
        }

        double totalVal = holdings.stream().mapToDouble(h -> (h.getInvestmentValue() != null && h.getInvestmentValue() > 0) ? h.getInvestmentValue() : (h.getQuantity() * h.getCurrentPrice())).sum();
        double newTotalVal = totalVal + amount;

        // 1. Max Single Holding Constraint
        double existingHoldingVal = holdings.stream()
                .filter(h -> h.getCode().equals(code))
                .mapToDouble(h -> (h.getInvestmentValue() != null && h.getInvestmentValue() > 0) ? h.getInvestmentValue() : (h.getQuantity() * h.getCurrentPrice()))
                .findFirst().orElse(0.0);
        
        double newHoldingPct = ((existingHoldingVal + amount) / newTotalVal) * 100.0;
        double maxSinglePct = policy.getMaxSingleHolding() * 100.0;

        if (newHoldingPct > maxSinglePct) {
            validation.put("isValid", false);
            validation.put("reason", String.format("Single holding limit exceeded: %s will make up %.1f%% of portfolio (Policy Max: %.1f%%)", code, newHoldingPct, maxSinglePct));
            return validation;
        }

        // 2. Max Sector Exposure Constraint
        double existingSectorVal = holdings.stream()
                .filter(h -> h.getSector() != null && h.getSector().equalsIgnoreCase(sector))
                .mapToDouble(h -> (h.getInvestmentValue() != null && h.getInvestmentValue() > 0) ? h.getInvestmentValue() : (h.getQuantity() * h.getCurrentPrice()))
                .sum();
        
        double newSectorPct = ((existingSectorVal + amount) / newTotalVal) * 100.0;
        double maxSectorPct = policy.getMaxSectorExposure() * 100.0;

        if (newSectorPct > maxSectorPct) {
            validation.put("isValid", false);
            validation.put("reason", String.format("Sector exposure limit exceeded: %s sector will reach %.1f%% of portfolio (Policy Max: %.1f%%)", sector, newSectorPct, maxSectorPct));
            return validation;
        }

        // 3. Max Risk Constraint
        double totalWeightedRisk = holdings.stream()
                .mapToDouble(h -> h.getQuantity() * h.getCurrentPrice() * h.getRisk())
                .sum();
        
        double newWeightedRisk = (totalWeightedRisk + (amount * assetRisk)) / newTotalVal;
        if (newWeightedRisk > policy.getMaxRisk()) {
            validation.put("isValid", false);
            validation.put("reason", String.format("Risk threshold exceeded: Weighted portfolio risk will be %.2f (Policy Max: %.2f)", newWeightedRisk, policy.getMaxRisk()));
            return validation;
        }

        validation.put("isValid", true);
        validation.put("reason", "Proposal satisfies all current Investment Policy rules.");
        return validation;
    }
}
