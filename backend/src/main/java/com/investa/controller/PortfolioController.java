package com.investa.controller;

import com.investa.model.Holding;
import com.investa.model.PortfolioSnapshot;
import com.investa.model.Transaction;
import com.investa.repository.HoldingRepository;
import com.investa.repository.PortfolioSnapshotRepository;
import com.investa.repository.TransactionRepository;
import com.investa.service.PortfolioService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.investa.service.ExcelImportService;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/portfolio")
@RequiredArgsConstructor
@CrossOrigin
public class PortfolioController {

    private final PortfolioService portfolioService;
    private final HoldingRepository holdingRepository;
    private final TransactionRepository transactionRepository;
    private final ExcelImportService excelImportService;
    private final com.investa.service.MarketStackPriceService priceService;
    private final PortfolioSnapshotRepository snapshotRepository;

    @PostMapping("/import")
    public ResponseEntity<Map<String, Object>> importPortfolio(
            @RequestHeader("X-Customer-ID") Long customerId,
            @RequestParam("file") MultipartFile file) {
        try {
            excelImportService.importExcelStream(customerId, file.getInputStream());
            return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Portfolio spreadsheet imported successfully!"
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", "Failed to parse spreadsheet: " + e.getMessage()
            ));
        }
    }

    @GetMapping("/summary")
    public ResponseEntity<Map<String, Object>> getSummary(@RequestHeader("X-Customer-ID") Long customerId) {
        Map<String, Object> summary = portfolioService.getPortfolioSummary(customerId);

        // Auto-record today's snapshot (idempotent — skips if one already exists for today)
        LocalDate today = LocalDate.now();
        boolean alreadyRecorded = snapshotRepository
                .findByCustomerIdOrderBySnapshotDateAsc(customerId)
                .stream()
                .anyMatch(s -> today.equals(s.getSnapshotDate()));
        if (!alreadyRecorded) {
            Number netWorth = (Number) summary.get("netWorth");
            Number cashBalance = (Number) summary.get("cashBalance");
            Number unrealisedGain = (Number) summary.get("unrealisedGain");
            Number realisedGain = (Number) summary.get("realisedGain");
            Number dividendIncome = (Number) summary.get("dividendIncome");
            snapshotRepository.save(PortfolioSnapshot.builder()
                    .customerId(customerId)
                    .snapshotDate(today)
                    .totalValue(netWorth != null ? netWorth.doubleValue() : 0.0)
                    .cashBalance(cashBalance != null ? cashBalance.doubleValue() : 0.0)
                    .unrealisedGain(unrealisedGain != null ? unrealisedGain.doubleValue() : 0.0)
                    .realisedGain(realisedGain != null ? realisedGain.doubleValue() : 0.0)
                    .dividendIncome(dividendIncome != null ? dividendIncome.doubleValue() : 0.0)
                    .build());
        }

        return ResponseEntity.ok(summary);
    }

    @GetMapping("/snapshots")
    public ResponseEntity<List<PortfolioSnapshot>> getSnapshots(@RequestHeader("X-Customer-ID") Long customerId) {
        return ResponseEntity.ok(
                snapshotRepository.findByCustomerIdOrderBySnapshotDateAsc(customerId)
        );
    }

    @GetMapping("/holdings")
    public ResponseEntity<List<Holding>> getHoldings(@RequestHeader("X-Customer-ID") Long customerId) {
        List<Holding> holdings = holdingRepository.findByCustomerId(customerId);
        for (Holding h : holdings) {
            double qty = h.getQuantity() != null ? h.getQuantity() : 0.0;
            double curPrice = h.getCurrentPrice() != null ? h.getCurrentPrice() : 0.0;
            double costPrice = h.getAvgPurchasePrice() != null ? h.getAvgPurchasePrice() : 0.0;
            if (h.getUnrealisedGain() == null) {
                h.setUnrealisedGain((qty * curPrice) - (qty * costPrice));
            }
            if ((h.getSimpleReturn() == null || h.getSimpleReturn() == 0.0) && costPrice > 0.0) {
                h.setSimpleReturn(((curPrice - costPrice) / costPrice) * 100.0);
            }
            if (h.getInvestmentValue() == null || h.getInvestmentValue() == 0.0) {
                h.setInvestmentValue(qty * curPrice);
            }
        }
        return ResponseEntity.ok(holdings);
    }

    @GetMapping("/transactions")
    public ResponseEntity<List<Transaction>> getTransactions(@RequestHeader("X-Customer-ID") Long customerId) {
        return ResponseEntity.ok(transactionRepository.findByCustomerIdOrderByTimestampDesc(customerId));
    }

    @PostMapping("/trade")
    public ResponseEntity<Transaction> executeTrade(
            @RequestHeader("X-Customer-ID") Long customerId,
            @RequestBody TradeRequest request) {
        Transaction tx = portfolioService.executeTrade(
                customerId,
                request.getCode(),
                request.getType(),
                request.getQuantity(),
                request.getPrice(),
                request.getBrokerage()
        );
        return ResponseEntity.ok(tx);
    }

    @PostMapping("/sync-prices")
    public ResponseEntity<Map<String, Object>> syncPrices() {
        priceService.syncAllHoldingPricesAsync();
        return ResponseEntity.ok(Map.of(
            "success", true,
            "message", "Price synchronization triggered in the background."
        ));
    }

    @PutMapping("/holdings/{id}")
    public ResponseEntity<?> updateHolding(
            @RequestHeader("X-Customer-ID") Long customerId,
            @PathVariable Long id,
            @RequestBody Holding details) {
        try {
            Holding h = holdingRepository.findById(id)
                    .orElseThrow(() -> new IllegalArgumentException("Holding not found with id: " + id));

            // Verify customer ownership
            if (!h.getCustomerId().equals(customerId)) {
                return ResponseEntity.status(403).body(Map.of("message", "Unauthorized to update this holding."));
            }

            if (details.getRisk() != null && (details.getRisk() < 1 || details.getRisk() > 7)) {
                return ResponseEntity.badRequest().body(Map.of("message", "Risk rating must be between 1 and 7"));
            }

            if (details.getCode() != null && !details.getCode().isEmpty()) {
                h.setCode(details.getCode().toUpperCase());
            }
            h.setShareName(details.getShareName());
            h.setMarket(details.getMarket());
            h.setSector(details.getSector());
            h.setRisk(details.getRisk() != null ? details.getRisk() : h.getRisk());
            h.setQuantity(details.getQuantity());
            h.setAvgPurchasePrice(details.getAvgPurchasePrice());
            h.setCurrentPrice(details.getCurrentPrice());
            
            if (details.getCurrency() != null) {
                h.setCurrency(details.getCurrency());
            }

            if (h.getQuantity() != null && h.getCurrentPrice() != null && h.getAvgPurchasePrice() != null) {
                h.setUnrealisedGain((h.getQuantity() * h.getCurrentPrice()) - (h.getQuantity() * h.getAvgPurchasePrice()));
            }
            h.setLastUpdated(java.time.LocalDateTime.now());

            Holding saved = holdingRepository.save(h);
            return ResponseEntity.ok(saved);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @Data
    public static class TradeRequest {
        private String code;
        private String type; // BUY, SELL
        private Double quantity;
        private Double price;
        private Double brokerage = 29.95;
    }
}
