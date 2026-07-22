package com.investa.controller;

import com.investa.model.InvestmentPolicy;
import com.investa.model.ResearchCache;
import com.investa.model.Watchlist;
import com.investa.model.ShareRecommendation;
import com.investa.repository.InvestmentPolicyRepository;
import com.investa.repository.WatchlistRepository;
import com.investa.repository.ShareRecommendationRepository;
import com.investa.repository.CustomerRepository;
import com.investa.service.DividendService;
import com.investa.service.PortfolioService;
import com.investa.service.ResearchService;
import com.investa.service.RiskEngine;
import com.investa.service.SharesiesService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

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
    private final SharesiesService sharesiesService;
    private final ShareRecommendationRepository shareRecommendationRepository;
    private final CustomerRepository customerRepository;

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
            if (item.getCurrentPrice() == null) {
                item.setCurrentPrice(Watchlist.getCurrentPriceForCode(item.getCode()));
            }
            if (item.getDividendYield() == null) {
                item.setDividendYield(Watchlist.getDivYieldForCode(item.getCode(), item.getType()));
            }

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

    @PostMapping("/watchlist")
    public ResponseEntity<?> addToWatchlist(
            @RequestHeader("X-Customer-ID") Long customerId,
            @RequestBody Map<String, String> payload) {
        String code = payload.get("code");
        if (code == null || code.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Stock code is required."));
        }
        Watchlist added = sharesiesService.addToWatchlist(customerId, code);
        if (added == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Failed to add stock to watchlist."));
        }
        return ResponseEntity.ok(added);
    }

    @DeleteMapping("/watchlist/{code}")
    public ResponseEntity<?> removeFromWatchlist(
            @RequestHeader("X-Customer-ID") Long customerId,
            @PathVariable String code) {
        Optional<Watchlist> item = watchlistRepository.findByCustomerIdAndCode(customerId, code.toUpperCase());
        if (item.isPresent()) {
            watchlistRepository.delete(item.get());
        }
        return ResponseEntity.ok(Map.of("success", true, "message", "Stock removed from watchlist."));
    }

    @GetMapping("/recommendations")
    public ResponseEntity<List<ShareRecommendation>> getRecommendations() {
        return ResponseEntity.ok(shareRecommendationRepository.findAllByOrderByTimestampDesc());
    }

    @PostMapping("/recommendations")
    public ResponseEntity<?> recommendStock(
            @RequestHeader("X-Customer-ID") Long customerId,
            @RequestBody Map<String, String> payload) {
        String code = payload.get("code");
        String notes = payload.get("notes");
        if (code == null || code.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Stock code is required."));
        }
        
        String upperCode = code.trim().toUpperCase();
        String shareName = upperCode;
        
        // Find company name from watchlist
        Optional<Watchlist> watchOpt = watchlistRepository.findByCustomerIdAndCode(customerId, upperCode);
        if (watchOpt.isPresent()) {
            shareName = watchOpt.get().getShareName();
        } else {
            try {
                String fundId = sharesiesService.getFundIdForSymbol(customerId, upperCode);
                if (fundId != null) {
                    Map<String, Object> instInfo = sharesiesService.getInstrumentDetails(customerId, fundId);
                    String nameVal = (String) instInfo.get("name");
                    if (nameVal != null) shareName = nameVal;
                }
            } catch (Exception ignored) {}
        }

        String customerName = "Anonymous";
        Optional<com.investa.model.Customer> customerOpt = customerRepository.findById(customerId);
        if (customerOpt.isPresent()) {
            customerName = customerOpt.get().getName();
            if (customerName == null || customerName.trim().isEmpty()) {
                customerName = customerOpt.get().getUsername();
            }
        }

        ShareRecommendation rec = ShareRecommendation.builder()
                .code(upperCode)
                .shareName(shareName)
                .customerId(customerId)
                .customerName(customerName)
                .notes(notes)
                .timestamp(LocalDateTime.now())
                .build();

        return ResponseEntity.ok(shareRecommendationRepository.save(rec));
    }
}
