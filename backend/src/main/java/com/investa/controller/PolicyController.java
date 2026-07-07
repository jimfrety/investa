package com.investa.controller;

import com.investa.model.InvestmentPolicy;
import com.investa.repository.InvestmentPolicyRepository;
import com.investa.service.AIRecommendationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/policy")
@RequiredArgsConstructor
@CrossOrigin
public class PolicyController {

    private final InvestmentPolicyRepository policyRepository;
    private final AIRecommendationService recommendationService;

    @GetMapping
    public ResponseEntity<InvestmentPolicy> getPolicy(@RequestHeader("X-Customer-ID") Long customerId) {
        InvestmentPolicy policy = policyRepository.findByCustomerId(customerId)
                .orElseGet(() -> InvestmentPolicy.builder()
                        .customerId(customerId)
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
                        .build());
        return ResponseEntity.ok(policy);
    }

    @PutMapping
    public ResponseEntity<InvestmentPolicy> updatePolicy(
            @RequestHeader("X-Customer-ID") Long customerId,
            @RequestBody InvestmentPolicy updatedPolicy) {
        InvestmentPolicy existing = policyRepository.findByCustomerId(customerId).orElse(null);
        updatedPolicy.setCustomerId(customerId);
        if (existing != null) {
            updatedPolicy.setId(existing.getId());
        }
        InvestmentPolicy saved = policyRepository.save(updatedPolicy);
        return ResponseEntity.ok(saved);
    }

    @PostMapping("/test-gemini-key")
    public ResponseEntity<java.util.Map<String, Object>> testGeminiKey(@RequestBody java.util.Map<String, String> payload) {
        String key = payload.get("key");
        java.util.Map<String, Object> result = recommendationService.testGeminiKey(key);
        return ResponseEntity.ok(result);
    }
}
