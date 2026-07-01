package com.investa.controller;

import com.investa.model.InvestmentPolicy;
import com.investa.repository.InvestmentPolicyRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/policy")
@RequiredArgsConstructor
@CrossOrigin
public class PolicyController {

    private final InvestmentPolicyRepository policyRepository;

    @GetMapping
    public ResponseEntity<InvestmentPolicy> getPolicy() {
        InvestmentPolicy policy = policyRepository.findAll().stream().findFirst()
                .orElseGet(() -> InvestmentPolicy.builder()
                        .primaryObjective("Maximise long-term dividend income")
                        .secondaryObjective("Grow capital")
                        .growthSellTarget(0.35)
                        .maxRisk(4.5)
                        .maxSingleHolding(0.07)
                        .minDividendCoverage(1.3)
                        .minMarketCap(2.0e9)
                        .avoidDividendCuts(true)
                        .maxSectorExposure(0.20)
                        .cashAvailable(0.0)
                        .seedUnrealisedGains(2516.01)
                        .seedRealisedGains(-107.56)
                        .seedUnrealisedCurrencyGains(563.53)
                        .seedRealisedCurrencyGains(0.70)
                        .seedTransactionFees(228.33)
                        .seedDividendsReceived(691.28)
                        .build());
        return ResponseEntity.ok(policy);
    }

    @PutMapping
    public ResponseEntity<InvestmentPolicy> updatePolicy(@RequestBody InvestmentPolicy updatedPolicy) {
        InvestmentPolicy existing = policyRepository.findAll().stream().findFirst().orElse(null);
        if (existing != null) {
            updatedPolicy.setId(existing.getId());
        }
        InvestmentPolicy saved = policyRepository.save(updatedPolicy);
        return ResponseEntity.ok(saved);
    }
}
