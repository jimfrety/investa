package com.investa.controller;

import com.investa.model.Holding;
import com.investa.model.Transaction;
import com.investa.repository.HoldingRepository;
import com.investa.repository.TransactionRepository;
import com.investa.service.PortfolioService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.investa.service.ExcelImportService;
import org.springframework.web.multipart.MultipartFile;

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

    @PostMapping("/import")
    public ResponseEntity<Map<String, Object>> importPortfolio(@RequestParam("file") MultipartFile file) {
        try {
            excelImportService.importExcelStream(file.getInputStream());
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
    public ResponseEntity<Map<String, Object>> getSummary() {
        return ResponseEntity.ok(portfolioService.getPortfolioSummary());
    }

    @GetMapping("/holdings")
    public ResponseEntity<List<Holding>> getHoldings() {
        return ResponseEntity.ok(holdingRepository.findAll());
    }

    @GetMapping("/transactions")
    public ResponseEntity<List<Transaction>> getTransactions() {
        return ResponseEntity.ok(transactionRepository.findAllByOrderByTimestampDesc());
    }

    @PostMapping("/trade")
    public ResponseEntity<Transaction> executeTrade(@RequestBody TradeRequest request) {
        Transaction tx = portfolioService.executeTrade(
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
    public ResponseEntity<?> updateHolding(@PathVariable Long id, @RequestBody Holding details) {
        try {
            Holding h = holdingRepository.findById(id)
                    .orElseThrow(() -> new IllegalArgumentException("Holding not found with id: " + id));

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
            holdingRepository.flush();
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
