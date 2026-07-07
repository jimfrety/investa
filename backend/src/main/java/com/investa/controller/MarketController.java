package com.investa.controller;

import com.investa.model.ResearchCache;
import com.investa.model.Watchlist;
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

    @GetMapping("/watchlist")
    public ResponseEntity<List<Watchlist>> getWatchlist(@RequestHeader("X-Customer-ID") Long customerId) {
        return ResponseEntity.ok(watchlistRepository.findByCustomerId(customerId));
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
