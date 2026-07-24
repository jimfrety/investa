package com.investa.service;

import com.investa.model.Holding;
import com.investa.model.Watchlist;
import com.investa.repository.HoldingRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Fetches end-of-day prices from the MarketStack API and uses them to:
 *  1. Sync all holding prices on demand (syncAllHoldingPricesAsync).
 *  2. Validate & correct prices returned by Sharesies after every portfolio sync
 *     (validateAndCorrect) — all symbols are requested in a single API call.
 *
 * MarketStack exchange suffixes:
 *   NZX  → .XNZE   ASX → .AX     US exchanges → no suffix
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MarketStackPriceService {

    private final HoldingRepository holdingRepository;
    private final RestTemplate restTemplate = new RestTemplate();

    private static final String BASE_URL  = "https://api.marketstack.com/v2/eod/latest";
    private static final String API_KEY   = "a430703e185f73b93294699210ff4523";
    private static final String API_URL   = BASE_URL + "?access_key=" + API_KEY + "&symbols=";

    /** Price discrepancy threshold that triggers a correction (5 %). */
    private static final double PRICE_TOLERANCE_PCT = 0.05;

    // ── In-memory price cache (15-minute TTL) ────────────────────────────────
    private static class CachedPrice {
        final double price;
        final long   timestamp;
        CachedPrice(double price, long timestamp) {
            this.price = price;
            this.timestamp = timestamp;
        }
    }
    private final Map<String, CachedPrice> priceCache = new java.util.concurrent.ConcurrentHashMap<>();
    private static final long CACHE_DURATION_MS = 15 * 60 * 1000L;

    // ─────────────────────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Async price sync triggered by the "Sync Prices" button.
     * Fetches all holdings in one MarketStack call and persists corrected prices.
     */
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
            String msKey = toMarketStackSymbol(h.getCode(), h.getMarket()).toUpperCase();
            CachedPrice cp = priceCache.get(msKey);
            return cp != null && (now - cp.timestamp) < CACHE_DURATION_MS;
        });

        if (allCached) {
            log.info("All holding prices are within the 15-minute cache — updating from cache.");
            for (Holding h : holdings) {
                String msKey = toMarketStackSymbol(h.getCode(), h.getMarket()).toUpperCase();
                CachedPrice cp = priceCache.get(msKey);
                if (cp != null && cp.price > 0) {
                    applyPriceToHolding(h, cp.price);
                    holdingRepository.save(h);
                }
            }
            holdingRepository.flush();
            return;
        }

        String symbolsString = buildSymbolString(holdings);
        Map<String, Double> prices = fetchMarketStackPrices(symbolsString);

        int successCount = 0;
        for (Holding h : holdings) {
            String msKey = toMarketStackSymbol(h.getCode(), h.getMarket()).toUpperCase();
            Double price = prices.get(msKey);
            if (price != null && price > 0) {
                priceCache.put(msKey, new CachedPrice(price, now));
                applyPriceToHolding(h, price);
                holdingRepository.save(h);
                successCount++;
            }
        }
        holdingRepository.flush();
        log.info("Finished price sync. Updated {} of {} holdings from MarketStack.", successCount, holdings.size());
    }

    /**
     * Validates prices on all supplied holdings and watchlist items against
     * MarketStack data in a single batch API call.
     * Any price that differs by more than PRICE_TOLERANCE_PCT is corrected in-place.
     * Callers are responsible for persisting the modified objects.
     *
     * @param holdings  mutable list of holdings to validate
     * @param watchlist mutable list of watchlist items to validate
     */
    public void validateAndCorrect(List<Holding> holdings, List<Watchlist> watchlist) {
        // Build the full symbol list from both collections
        List<String> allSymbols = new ArrayList<>();
        Map<String, String> codeToMarket = new LinkedHashMap<>();

        for (Holding h : holdings) {
            String key = h.getCode().toUpperCase();
            codeToMarket.put(key, h.getMarket());
            allSymbols.add(toMarketStackSymbol(h.getCode(), h.getMarket()));
        }
        for (Watchlist w : watchlist) {
            String key = w.getCode().toUpperCase();
            if (!codeToMarket.containsKey(key)) {
                codeToMarket.put(key, w.getMarket());
                allSymbols.add(toMarketStackSymbol(w.getCode(), w.getMarket()));
            }
        }

        if (allSymbols.isEmpty()) return;

        // One API call for all symbols
        String symbolsParam = String.join(",", allSymbols);
        Map<String, Double> prices = fetchMarketStackPrices(symbolsParam);

        if (prices.isEmpty()) {
            log.warn("MarketStack validation: no prices returned — Sharesies data retained.");
            return;
        }

        int holdingCorrections  = 0;
        int watchlistCorrections = 0;

        for (Holding h : holdings) {
            String msKey = toMarketStackSymbol(h.getCode(), h.getMarket()).toUpperCase();
            Double msPrice = prices.get(msKey);
            if (msPrice == null || msPrice <= 0) continue;
            double current = h.getCurrentPrice() != null ? h.getCurrentPrice() : 0.0;
            if (current <= 0 || priceDiffers(current, msPrice)) {
                log.info("MarketStack validation [{}]: price corrected {} → {} (diff {:.1f}%)",
                        h.getCode(), current, msPrice,
                        current > 0 ? Math.abs(current - msPrice) / msPrice * 100 : 100.0);
                applyPriceToHolding(h, msPrice);
                holdingCorrections++;
            }
        }

        for (Watchlist w : watchlist) {
            String msKey = toMarketStackSymbol(w.getCode(), w.getMarket()).toUpperCase();
            Double msPrice = prices.get(msKey);
            if (msPrice == null || msPrice <= 0) continue;
            double current = w.getCurrentPrice() != null ? w.getCurrentPrice() : 0.0;
            if (current <= 0 || priceDiffers(current, msPrice)) {
                log.info("MarketStack validation watchlist [{}]: price corrected {} → {}",
                        w.getCode(), current, msPrice);
                w.setCurrentPrice(msPrice);
                watchlistCorrections++;
            }
        }

        log.info("MarketStack validation complete — {} holding(s) and {} watchlist item(s) corrected.",
                holdingCorrections, watchlistCorrections);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal helpers
    // ─────────────────────────────────────────────────────────────────────────

    /** Executes one MarketStack EOD/latest call and returns a bare-code → price map. */
    @SuppressWarnings("unchecked")
    private Map<String, Double> fetchMarketStackPrices(String symbolsParam) {
        Map<String, Double> result = new LinkedHashMap<>();
        try {
            String url = API_URL + symbolsParam;
            ResponseEntity<Object> response = restTemplate.getForEntity(url, Object.class);

            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                log.error("MarketStack API returned status {}", response.getStatusCode());
                return result;
            }

            Object body = response.getBody();
            List<?> dataList;

            if (body instanceof List) {
                dataList = (List<?>) body;
            } else if (body instanceof Map) {
                Object dataObj = ((Map<?, ?>) body).get("data");
                if (dataObj instanceof List) {
                    dataList = (List<?>) dataObj;
                } else {
                    log.warn("MarketStack response missing 'data' array.");
                    return result;
                }
            } else {
                log.warn("MarketStack response is unknown type: {}", body.getClass());
                return result;
            }

            for (Object itemObj : dataList) {
                if (!(itemObj instanceof Map)) continue;
                @SuppressWarnings("unchecked")
                Map<String, Object> item = (Map<String, Object>) itemObj;
                String symbol = (String) item.get("symbol");
                Object closeObj = item.get("close");
                if (symbol == null || closeObj == null) continue;

                double price = closeObj instanceof Number
                        ? ((Number) closeObj).doubleValue()
                        : Double.parseDouble(closeObj.toString());

                if (price <= 0) continue;

                // Map by the exact returned symbol (e.g. WMI.AX)
                result.put(symbol.toUpperCase(), price);
            }
        } catch (Exception e) {
            log.error("MarketStack API call failed: {}", e.getMessage(), e);
        }
        return result;
    }

    /** Appends the correct exchange suffix for MarketStack. */
    private String toMarketStackSymbol(String code, String market) {
        if (market != null) {
            String upperMarket = market.toUpperCase();
            if (upperMarket.contains("NZX") || upperMarket.contains("XNZE"))  return code + ".XNZE";
            if (upperMarket.contains("ASX") || upperMarket.contains("XASX"))  return code + ".AX";
        }
        return code; // US / other exchanges need no suffix
    }

    /** Builds the symbols query string for the existing holdings-only sync. */
    private String buildSymbolString(List<Holding> holdings) {
        return holdings.stream()
                .map(h -> toMarketStackSymbol(h.getCode(), h.getMarket()))
                .collect(Collectors.joining(","));
    }

    /** Applies a corrected price to a holding and recalculates unrealised gain. */
    private void applyPriceToHolding(Holding h, double price) {
        h.setCurrentPrice(price);
        h.setLastUpdated(java.time.LocalDateTime.now());
        if (h.getQuantity() != null && h.getQuantity() > 0 && h.getAvgPurchasePrice() != null) {
            h.setUnrealisedGain((h.getQuantity() * price) - (h.getQuantity() * h.getAvgPurchasePrice()));
        }
    }

    private boolean priceDiffers(double a, double b) {
        if (b == 0) return false;
        return Math.abs(a - b) / b > PRICE_TOLERANCE_PCT;
    }
}
