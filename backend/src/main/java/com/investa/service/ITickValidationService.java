package com.investa.service;

import com.investa.model.Holding;
import com.investa.model.Watchlist;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Validates and corrects share price data retrieved from Sharesies using iTick
 * (api0.itick.org) as an authoritative second source.
 *
 * Strategy:
 *  1. Group all symbols by their market region (au, us, etc.).
 *  2. Fire one HTTP request per region group (the minimum required by the API).
 *  3. Compare each holding's / watchlist item's price against the iTick price.
 *  4. If iTick reports a price that differs by more than PRICE_TOLERANCE_PCT,
 *     replace the Sharesies value with the iTick value and log the discrepancy.
 *
 * NZX is not covered by the current iTick subscription — those symbols are
 * left untouched.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ITickValidationService {

    private static final String ITICK_BASE_URL  = "https://api0.itick.org";
    private static final String ITICK_API_TOKEN = "cef5276441c3418090520ae20a10cb6e52dc3e11261649db99d7700ab6e011dc";

    /** Percentage difference that triggers a correction (5 %) */
    private static final double PRICE_TOLERANCE_PCT = 0.05;

    private final RestTemplate restTemplate = new RestTemplate();

    // ─────────────────────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Validates and corrects prices on all holdings and watchlist items in one
     * coordinated batch.  Each market region results in exactly one API call.
     *
     * @param holdings  holdings to validate (modified in-place)
     * @param watchlist watchlist items to validate (modified in-place)
     */
    public void validateAndCorrect(List<Holding> holdings, List<Watchlist> watchlist) {
        // Build a unified symbol → region map from both lists
        Map<String, String> symbolToRegion = new LinkedHashMap<>();
        for (Holding h : holdings) {
            String region = marketToRegion(h.getMarket());
            if (region != null) symbolToRegion.put(h.getCode().toUpperCase(), region);
        }
        for (Watchlist w : watchlist) {
            String region = marketToRegion(w.getMarket());
            if (region != null) symbolToRegion.put(w.getCode().toUpperCase(), region);
        }

        if (symbolToRegion.isEmpty()) {
            log.debug("ITickValidation: no supported-region symbols to validate.");
            return;
        }

        // Group symbols by region to minimise API calls
        Map<String, List<String>> byRegion = symbolToRegion.entrySet().stream()
                .collect(Collectors.groupingBy(
                        Map.Entry::getValue,
                        Collectors.mapping(Map.Entry::getKey, Collectors.toList())
                ));

        // Fetch one batch per region and merge results into a single price map
        Map<String, Double> iTick = new HashMap<>();
        for (Map.Entry<String, List<String>> entry : byRegion.entrySet()) {
            fetchRegionPrices(entry.getKey(), entry.getValue(), iTick);
        }

        if (iTick.isEmpty()) {
            log.warn("ITickValidation: received no usable price data from iTick.");
            return;
        }

        // Apply corrections
        int holdingCorrections = applyToHoldings(holdings, iTick);
        int watchlistCorrections = applyToWatchlist(watchlist, iTick);
        log.info("ITickValidation complete — {} holding(s) and {} watchlist item(s) corrected.",
                holdingCorrections, watchlistCorrections);
    }

    /**
     * Lightweight single-symbol lookup — used by AI research / watchlist add
     * flows where only one ticker needs validating.
     *
     * @return corrected price, or {@code sharesiesPrice} if iTick has no data.
     */
    public double validatePrice(String code, String market, double sharesiesPrice) {
        String region = marketToRegion(market);
        if (region == null) return sharesiesPrice;

        Map<String, Double> iTick = new HashMap<>();
        fetchRegionPrices(region, List.of(code.toUpperCase()), iTick);

        Double iTickPrice = iTick.get(code.toUpperCase());
        if (iTickPrice == null || iTickPrice <= 0) return sharesiesPrice;

        double diff = Math.abs(sharesiesPrice - iTickPrice) / iTickPrice;
        if (diff > PRICE_TOLERANCE_PCT) {
            log.info("ITickValidation [{}]: price corrected {:.4f} → {:.4f} (diff {:.1f}%)",
                    code, sharesiesPrice, iTickPrice, diff * 100);
            return iTickPrice;
        }
        return sharesiesPrice;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal helpers
    // ─────────────────────────────────────────────────────────────────────────

    /** Calls iTick /stock/quotes for one region and populates the price map. */
    @SuppressWarnings("unchecked")
    private void fetchRegionPrices(String region, List<String> symbols, Map<String, Double> out) {
        String codes = String.join(",", symbols);
        String url = ITICK_BASE_URL + "/stock/quotes?codes=" + codes + "&region=" + region;

        HttpHeaders headers = new HttpHeaders();
        headers.set("token", ITICK_API_TOKEN);
        headers.set("accept", "application/json");

        try {
            ResponseEntity<Map> response = restTemplate.exchange(
                    url, HttpMethod.GET, new HttpEntity<>(headers), Map.class);

            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                log.warn("ITickValidation [{}]: HTTP {} – no body", region, response.getStatusCode());
                return;
            }

            Map<String, Object> body = response.getBody();
            Object codeField = body.get("code");
            // iTick uses code=0 for success
            if (codeField instanceof Number && ((Number) codeField).intValue() != 0) {
                log.warn("ITickValidation [{}]: API error – {}", region, body.get("msg"));
                return;
            }

            Object dataObj = body.get("data");
            if (!(dataObj instanceof Map)) return;

            Map<String, Object> data = (Map<String, Object>) dataObj;
            for (Map.Entry<String, Object> entry : data.entrySet()) {
                String sym = entry.getKey().toUpperCase();
                if (!(entry.getValue() instanceof Map)) continue;
                Map<String, Object> quote = (Map<String, Object>) entry.getValue();

                // "p" = last traded price; "ld" = last day close (fallback)
                Double price = extractDouble(quote, "p");
                if (price == null || price <= 0) price = extractDouble(quote, "ld");
                if (price != null && price > 0) {
                    out.put(sym, price);
                    log.debug("ITickValidation [{}] {}: ${}", region, sym, price);
                }
            }
        } catch (Exception e) {
            log.warn("ITickValidation [{}]: request failed – {}", region, e.getMessage());
        }
    }

    private int applyToHoldings(List<Holding> holdings, Map<String, Double> iTick) {
        int count = 0;
        for (Holding h : holdings) {
            Double iTickPrice = iTick.get(h.getCode().toUpperCase());
            if (iTickPrice == null || iTickPrice <= 0) continue;

            double sharesiesPrice = h.getCurrentPrice() != null ? h.getCurrentPrice() : 0.0;
            if (sharesiesPrice <= 0 || priceDiffers(sharesiesPrice, iTickPrice)) {
                log.info("ITickValidation holding [{}]: price {} → {} (iTick authoritative)",
                        h.getCode(), sharesiesPrice, iTickPrice);
                h.setCurrentPrice(iTickPrice);
                // Recalculate unrealised gain with corrected price
                if (h.getQuantity() != null && h.getAvgPurchasePrice() != null) {
                    h.setUnrealisedGain((h.getQuantity() * iTickPrice) -
                            (h.getQuantity() * h.getAvgPurchasePrice()));
                }
                count++;
            }
        }
        return count;
    }

    private int applyToWatchlist(List<Watchlist> watchlist, Map<String, Double> iTick) {
        int count = 0;
        for (Watchlist w : watchlist) {
            Double iTickPrice = iTick.get(w.getCode().toUpperCase());
            if (iTickPrice == null || iTickPrice <= 0) continue;

            double sharesiesPrice = w.getCurrentPrice() != null ? w.getCurrentPrice() : 0.0;
            if (sharesiesPrice <= 0 || priceDiffers(sharesiesPrice, iTickPrice)) {
                log.info("ITickValidation watchlist [{}]: price {} → {} (iTick authoritative)",
                        w.getCode(), sharesiesPrice, iTickPrice);
                w.setCurrentPrice(iTickPrice);
                count++;
            }
        }
        return count;
    }

    /** Returns true when the two prices differ by more than PRICE_TOLERANCE_PCT. */
    private boolean priceDiffers(double a, double b) {
        if (b == 0) return false;
        return Math.abs(a - b) / b > PRICE_TOLERANCE_PCT;
    }

    private Double extractDouble(Map<String, Object> map, String key) {
        Object val = map.get(key);
        if (val instanceof Number) return ((Number) val).doubleValue();
        if (val instanceof String) {
            try { return Double.parseDouble((String) val); } catch (NumberFormatException ignored) {}
        }
        return null;
    }

    /**
     * Maps an internal market code to the iTick region string.
     * Returns null for markets not covered by the current subscription.
     */
    private String marketToRegion(String market) {
        if (market == null) return null;
        return switch (market.toUpperCase()) {
            case "ASX"    -> "au";
            case "NASDAQ",
                 "NYSE",
                 "AMEX",
                 "US"     -> "us";
            case "TSX",
                 "TSX-V"  -> "ca";
            case "SGX"    -> "sg";
            case "LSE"    -> "gb";
            case "HKEx",
                 "HKEX"   -> "hk";
            case "TSE"    -> "jp";
            // NZX not in current subscription — skip
            default       -> null;
        };
    }
}
