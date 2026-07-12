package com.investa.controller;

import com.investa.model.InvestmentPolicy;
import com.investa.model.ResearchCache;
import com.investa.model.Watchlist;
import com.investa.repository.InvestmentPolicyRepository;
import com.investa.repository.WatchlistRepository;
import com.investa.service.DividendService;
import com.investa.service.PortfolioService;
import com.investa.service.ResearchService;
import com.investa.service.RiskEngine;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/market")
@RequiredArgsConstructor
@CrossOrigin
public class MarketController {

    private final WatchlistRepository watchlistRepository;
    private final ResearchService researchService;
    private final PortfolioService portfolioService;
    private final DividendService dividendService;
    private final RiskEngine riskEngine;
    private final InvestmentPolicyRepository policyRepository;

    @GetMapping("/watchlist")
    public ResponseEntity<List<Watchlist>> getWatchlist(@RequestHeader("X-Customer-ID") Long customerId) {
        List<Watchlist> watchlist = watchlistRepository.findByCustomerId(customerId);
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

        double maxRisk = policy.getMaxRisk() != null ? policy.getMaxRisk() : 4.5;

        for (Watchlist item : watchlist) {
            int fit = 75;
            if (item.getRisk() != null) {
                if (item.getRisk() > maxRisk) {
                    fit -= (int) ((item.getRisk() - maxRisk) * 15);
                } else {
                    fit += (int) ((maxRisk - item.getRisk()) * 5);
                }
            }
            fit = Math.max(10, Math.min(99, fit));
            item.setPortfolioFit(fit);

            double overall = ((item.getDividendQuality() != null ? item.getDividendQuality() : 60)
                            + (item.getGrowth() != null ? item.getGrowth() : 60)
                            + (item.getValueScore() != null ? item.getValueScore() : 60)
                            + (item.getRisk() != null ? (7 - item.getRisk()) * 10.0 : 40.0)
                            + fit
                            + (item.getMomentum() != null ? item.getMomentum() : 60)) / 6.0;
            item.setOverallScore(Math.round(overall * 10.0) / 10.0);
        }
        return ResponseEntity.ok(watchlist);
    }

    @GetMapping("/research/{code}")
    public ResponseEntity<ResearchCache> getResearch(@PathVariable String code) {
        return ResponseEntity.ok(researchService.getResearch(code));
    }

    @GetMapping("/rebalance")
    public ResponseEntity<List<Map<String, Object>>> getRebalance(
            @RequestHeader("X-Customer-ID") Long customerId,
            @RequestParam Double amount) {
        return ResponseEntity.ok(portfolioService.getRebalanceRecommendations(customerId, amount));
    }

    @GetMapping("/risk")
    public ResponseEntity<Map<String, Object>> getRiskMetrics(@RequestHeader("X-Customer-ID") Long customerId) {
        return ResponseEntity.ok(riskEngine.calculateRiskMetrics(customerId));
    }

    @GetMapping("/dividends/metrics")
    public ResponseEntity<Map<String, Object>> getDividendMetrics(@RequestHeader("X-Customer-ID") Long customerId) {
        return ResponseEntity.ok(dividendService.getDividendMetrics(customerId));
    }

    @GetMapping("/dividends/calendar")
    public ResponseEntity<List<Map<String, Object>>> getDividendCalendar(@RequestHeader("X-Customer-ID") Long customerId) {
        return ResponseEntity.ok(dividendService.getDividendCalendar(customerId));
    }

    @GetMapping("/dividends/payments")
    public ResponseEntity<List<Map<String, Object>>> getDividendPayments(@RequestHeader("X-Customer-ID") Long customerId) {
        return ResponseEntity.ok(dividendService.getDividendPayments(customerId));
    }
}
