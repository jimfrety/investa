package com.investa.service;

import com.investa.model.Holding;
import com.investa.repository.HoldingRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class MarketStackPriceService {

    private final HoldingRepository holdingRepository;
    private final RestTemplate restTemplate = new RestTemplate();
    private static final String API_URL = "https://api.marketstack.com/v2/eod/latest?access_key=a430703e185f73b93294699210ff4523&symbols=";

    private static class CachedPrice {
        final double price;
        final long timestamp;
        CachedPrice(double price, long timestamp) {
            this.price = price;
            this.timestamp = timestamp;
        }
    }
    private final Map<String, CachedPrice> priceCache = new java.util.concurrent.ConcurrentHashMap<>();
    private static final long CACHE_DURATION_MS = 15 * 60 * 1000L; // 15 minutes TTL

    @Async
    public void syncAllHoldingPricesAsync() {
        log.info("Starting asynchronous current price sync with MarketStack API...");
        List<Holding> holdings = holdingRepository.findAll();
        if (holdings.isEmpty()) {
            log.info("No holdings found to sync.");
            return;
        }

        long now = System.currentTimeMillis();
        boolean allCached = holdings.stream().allMatch(h -> {
            CachedPrice cp = priceCache.get(h.getCode().toUpperCase());
            return cp != null && (now - cp.timestamp) < CACHE_DURATION_MS;
        });

        if (allCached) {
            log.info("All holding prices are present in local 15-minute cache. Updating database from cache without calling MarketStack API.");
            for (Holding h : holdings) {
                CachedPrice cp = priceCache.get(h.getCode().toUpperCase());
                if (cp != null && cp.price > 0) {
                    h.setCurrentPrice(cp.price);
                    h.setLastUpdated(java.time.LocalDateTime.now());
                    if (h.getQuantity() != null && h.getQuantity() > 0 && h.getAvgPurchasePrice() != null) {
                        double costBasis = h.getQuantity() * h.getAvgPurchasePrice();
                        double curVal = h.getQuantity() * cp.price;
                        h.setUnrealisedGain(curVal - costBasis);
                    }
                    holdingRepository.save(h);
                }
            }
            holdingRepository.flush();
            return;
        }

        // Join all symbols with correct MarketStack exchange suffixes
        String symbolsString = holdings.stream()
                .map(h -> {
                    String code = h.getCode();
                    if ("NZX".equalsIgnoreCase(h.getMarket())) {
                        return code + ".NZ";
                    } else if ("ASX".equalsIgnoreCase(h.getMarket())) {
                        return code + ".AX";
                    }
                    return code;
                })
                .collect(Collectors.joining(","));

        try {
            String requestUrl = API_URL + symbolsString;
            ResponseEntity<Map> response = restTemplate.getForEntity(requestUrl, Map.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                List<Map<String, Object>> dataList = (List<Map<String, Object>>) response.getBody().get("data");
                if (dataList != null) {
                    int successCount = 0;
                    for (Map<String, Object> item : dataList) {
                        String symbol = (String) item.get("symbol");
                        Number closePriceNum = (Number) item.get("close");
                        if (symbol != null && closePriceNum != null) {
                            double latestPrice = closePriceNum.doubleValue();
                            
                            // Strip exchange suffix if present for database matching
                            String cleanCode = symbol;
                            if (symbol.endsWith(".NZ") || symbol.endsWith(".AX")) {
                                cleanCode = symbol.substring(0, symbol.length() - 3);
                            }
                            
                            final String finalCode = cleanCode;
                            priceCache.put(finalCode.toUpperCase(), new CachedPrice(latestPrice, now));

                            Holding h = holdings.stream()
                                    .filter(x -> x.getCode().equalsIgnoreCase(finalCode))
                                    .findFirst()
                                    .orElse(null);
                                    
                            if (h != null && latestPrice > 0) {
                                h.setCurrentPrice(latestPrice);
                                h.setLastUpdated(java.time.LocalDateTime.now());
                                
                                // Re-calculate unrealised gain in local currency
                                if (h.getQuantity() != null && h.getQuantity() > 0 && h.getAvgPurchasePrice() != null) {
                                    double costBasis = h.getQuantity() * h.getAvgPurchasePrice();
                                    double curVal = h.getQuantity() * latestPrice;
                                    h.setUnrealisedGain(curVal - costBasis);
                                }
                                
                                holdingRepository.save(h);
                                successCount++;
                            }
                        }
                    }
                    holdingRepository.flush();
                    log.info("Finished price sync. Successfully updated {} of {} holdings from MarketStack.", successCount, holdings.size());
                } else {
                    log.warn("MarketStack response did not contain data array.");
                }
            } else {
                log.error("MarketStack API call returned error: status {}", response.getStatusCode());
            }
        } catch (Exception e) {
            log.error("Failed to sync prices with MarketStack: {}", e.getMessage(), e);
        }
    }
}
