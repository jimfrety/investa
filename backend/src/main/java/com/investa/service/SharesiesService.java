package com.investa.service;

import com.investa.model.Holding;
import com.investa.model.InvestmentPolicy;
import com.investa.model.Transaction;
import com.investa.model.Watchlist;
import com.investa.model.Dividend;
import com.investa.repository.HoldingRepository;
import com.investa.repository.InvestmentPolicyRepository;
import com.investa.repository.TransactionRepository;
import com.investa.repository.WatchlistRepository;
import com.investa.repository.DividendRepository;
import lombok.Getter;
import lombok.Setter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import java.time.LocalDate;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
@Slf4j
public class SharesiesService {

    private final HoldingRepository holdingRepository;
    private final InvestmentPolicyRepository policyRepository;
    private final WatchlistRepository watchlistRepository;
    private final TransactionRepository transactionRepository;
    private final DividendRepository dividendRepository;
    private final CurrencyService currencyService;
    
    private final RestTemplate restTemplate = createRestTemplate();

    private static RestTemplate createRestTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10000); // 10s timeout
        factory.setReadTimeout(15000);    // 15s timeout
        return new RestTemplate(factory);
    }

    @Getter
    @Setter
    public static class SharesiesSession {
        private boolean authenticated = false;
        private String connectedEmail = null;
        private String userId = null;
        private String distillToken = null;
        private String rakaiaToken = null;
        private String sessionCookie = null;
        private String portfolioId = null;
        private String appBaseUrl = "https://app.sharesies.nz";
        private String dataBaseUrl = "https://data.sharesies.nz";
        private String portfolioBaseUrl = "https://portfolio.sharesies.nz";
    }

    private final Map<Long, SharesiesSession> activeSessions = new ConcurrentHashMap<>();

    public SharesiesSession getSession(Long customerId) {
        return activeSessions.computeIfAbsent(customerId, k -> new SharesiesSession());
    }

    public boolean isAuthenticated(Long customerId) {
        return getSession(customerId).isAuthenticated();
    }

    public String getConnectedEmail(Long customerId) {
        return getSession(customerId).getConnectedEmail();
    }

    public String getUserId(Long customerId) {
        return getSession(customerId).getUserId();
    }

    private String getFirstPresentKey(Map map, String... keys) {
        for (String key : keys) {
            if (map.get(key) != null) {
                return map.get(key).toString();
            }
        }
        return null;
    }

    // Cache to map Sharesies fund UUIDs -> Ticker Code (e.g. "uuid-123" -> "MSFT")
    private final Map<String, String> instrumentCache = new ConcurrentHashMap<>();
    private final Map<String, Map<String, Object>> catalogCache = new ConcurrentHashMap<>();

    private HttpHeaders createHeaders(Long customerId) {
        SharesiesSession session = getSession(customerId);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
        headers.set("Accept", "*/*");
        headers.set("Accept-Language", "en-US,en;q=0.9");
        if (session.getSessionCookie() != null) {
            headers.set("Cookie", "session=" + session.getSessionCookie());
        }
        if (session.getDistillToken() != null) {
            headers.set("Authorization", "Bearer " + session.getDistillToken());
        }
        return headers;
    }

    private HttpHeaders createCookieOnlyHeaders(Long customerId) {
        SharesiesSession session = getSession(customerId);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
        headers.set("Accept", "*/*");
        headers.set("Accept-Language", "en-US,en;q=0.9");
        if (session != null && session.getSessionCookie() != null) {
            headers.set("Cookie", "session=" + session.getSessionCookie());
        }
        return headers;
    }

    private HttpHeaders createRakaiaHeaders(Long customerId) {
        SharesiesSession session = getSession(customerId);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
        headers.set("Accept", "*/*");
        headers.set("Accept-Language", "en-US,en;q=0.9");
        if (session != null) {
            if (session.getSessionCookie() != null) {
                headers.set("Cookie", "session=" + session.getSessionCookie());
            }
            if (session.getRakaiaToken() != null) {
                headers.set("Authorization", "Bearer " + session.getRakaiaToken());
            }
        }
        return headers;
    }

    public String loginWithMfa(Long customerId, String email, String password, String mfaCode) {
        String res = attemptLogin(customerId, "https://app.sharesies.nz", "https://data.sharesies.nz", email, password, mfaCode);
        if ("SUCCESS".equals(res) || "MFA_REQUIRED".equals(res)) {
            return res;
        }
        log.info("NZ domain login unsuccessful. Trying COM domain (https://app.sharesies.com)...");
        return attemptLogin(customerId, "https://app.sharesies.com", "https://data.sharesies.com", email, password, mfaCode);
    }

    public boolean login(Long customerId, String email, String password) {
        return "SUCCESS".equals(loginWithMfa(customerId, email, password, null));
    }

    private String attemptLogin(Long customerId, String appUrl, String dataUrl, String email, String password, String mfaCode) {
        try {
            log.info("Attempting Sharesies login for customer {} at {} for email: {} (mfa code provided: {})", customerId, appUrl, email, mfaCode != null && !mfaCode.trim().isEmpty());
            Map<String, Object> loginPayload = new HashMap<>();
            loginPayload.put("email", email);
            loginPayload.put("password", password);
            loginPayload.put("remember", true);
            if (mfaCode != null && !mfaCode.trim().isEmpty()) {
                loginPayload.put("mfa_token", mfaCode.trim());
                loginPayload.put("email_mfa_token", mfaCode.trim());
            }

            HttpHeaders headers = createHeaders(customerId);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(loginPayload, headers);
            ResponseEntity<Map> response = restTemplate.postForEntity(
                appUrl + "/api/identity/login",
                entity,
                Map.class
            );

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map body = response.getBody();
                Boolean auth = (Boolean) body.get("authenticated");
                if (Boolean.TRUE.equals(auth)) {
                    SharesiesSession session = getSession(customerId);
                    session.setAuthenticated(true);
                    session.setConnectedEmail(email);
                    session.setAppBaseUrl(appUrl);
                    session.setDataBaseUrl(dataUrl);
                    session.setPortfolioBaseUrl(appUrl.contains(".com") ? "https://portfolio.sharesies.com" : "https://portfolio.sharesies.nz");
                    session.setDistillToken((String) body.get("distill_token"));
                    session.setRakaiaToken((String) body.get("rakaia_token"));
                    
                    // Parse session cookie
                    List<String> cookieHeaders = response.getHeaders().get(HttpHeaders.SET_COOKIE);
                    if (cookieHeaders != null) {
                        for (String cookie : cookieHeaders) {
                            if (cookie.startsWith("session=")) {
                                session.setSessionCookie(cookie.split(";")[0].substring("session=".length()));
                                break;
                            }
                        }
                    }

                    // Extract user ID
                    List userList = (List) body.get("user_list");
                    if (userList != null && !userList.isEmpty()) {
                        Map userMap = (Map) userList.get(0);
                        session.setUserId((String) userMap.get("id"));
                    }

                    log.info("Sharesies login successful for customer {}. User ID: {}", customerId, session.getUserId());
                    
                    // Pre-populate instruments mapping cache has been disabled to prevent out-of-memory errors
                    return "SUCCESS";
                } else {
                    log.warn("Sharesies login at {} returned unauthenticated: {}", appUrl, body);
                    String type = String.valueOf(body.get("type")).toLowerCase();
                    if (type.contains("mfa") || body.containsKey("mfa_required") || body.toString().toLowerCase().contains("mfa")) {
                        return "MFA_REQUIRED";
                    }
                }
            }
        } catch (Exception e) {
            log.error("Sharesies login failed for customer {} at {}: {}", customerId, appUrl, e.getMessage());
        }
        return "FAILED";
    }

    public void logout(Long customerId) {
        activeSessions.remove(customerId);
        log.info("Logged out customer {} from Sharesies session.", customerId);
    }

    public Watchlist addToWatchlist(Long customerId, String code) {
        if (code == null || code.trim().isEmpty()) return null;
        String upperCode = code.trim().toUpperCase();
        
        List<Watchlist> existing = watchlistRepository.findByCustomerIdAndCode(customerId, upperCode);
        if (!existing.isEmpty()) {
            return existing.get(0);
        }
        
        String shareName = upperCode;
        String market = "NZX";
        Integer riskVal = 3;
        
        try {
            String fundId = getFundIdForSymbol(customerId, upperCode);
            if (fundId != null) {
                Map<String, Object> instInfo = getInstrumentDetails(customerId, fundId);
                String nameVal = getFirstPresentKey(instInfo, "name", "share_name", "company_name");
                if (nameVal != null && !nameVal.trim().isEmpty()) {
                    shareName = nameVal;
                }
                String marketVal = getFirstPresentKey(instInfo, "exchange", "market", "exchange_code");
                if (marketVal != null && !marketVal.trim().isEmpty()) {
                    market = marketVal;
                }
                Integer risk = extractRisk(instInfo, 3);
                if (risk != null) riskVal = risk;
            }
        } catch (Exception e) {
            log.warn("Failed to fetch details for adding stock to watchlist: " + upperCode, e);
        }
        
        Watchlist wItem = Watchlist.builder()
                .customerId(customerId)
                .code(upperCode)
                .shareName(shareName)
                .market(market)
                .risk(riskVal)
                .growth(50)
                .portfolioFit(75)
                .overallScore(70.0)
                .targetPrice(0.0)
                .type("GROWTH")
                .dividendYield(Watchlist.getDivYieldForCode(upperCode, "growth"))
                .currentPrice(Watchlist.getCurrentPriceForCode(upperCode))
                .build();
                
        return watchlistRepository.save(wItem);
    }


    private String getSymbolForFundId(Long customerId, String fundId) {
        if (instrumentCache.containsKey(fundId)) {
            return instrumentCache.get(fundId);
        }
        SharesiesSession session = getSession(customerId);
        try {
            HttpHeaders headers = createHeaders(customerId);
            HttpEntity<Void> entity = new HttpEntity<>(headers);

            String url = session.getDataBaseUrl() + "/api/v1/instruments/" + fundId;
            ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.GET, entity, Map.class);
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map inst = response.getBody();
                String symbol = (String) inst.get("symbol");
                if (symbol == null) {
                    symbol = (String) inst.get("code");
                }
                if (symbol != null) {
                    String cleanSymbol = symbol.toUpperCase();
                    this.instrumentCache.put(fundId, cleanSymbol);
                    return cleanSymbol;
                }
            }
        } catch (Exception e) {
            log.error("Failed to translate Sharesies fund ID: {}", fundId, e);
        }
        return "UNKNOWN-" + fundId.substring(0, 5);
    }

    private boolean hasClassificationData(Map<String, Object> inst) {
        return extractSector(inst, false) != null;
    }

    private String extractSector(Map<String, Object> inst, boolean useFallback) {
        if (inst == null) return useFallback ? "Financials" : null;

        String[] stringKeys = {"sector", "category", "industry", "classification", "market_classification", "sector_name", "industry_name", "category_name", "fund_type", "asset_type", "instrument_type", "type"};
        for (String k : stringKeys) {
            Object val = inst.get(k);
            if (val instanceof String s && !s.trim().isEmpty() && !s.equalsIgnoreCase("equity") && !s.equalsIgnoreCase("mf") && !s.equalsIgnoreCase("share") && !s.equalsIgnoreCase("stock")) {
                return s;
            } else if (val instanceof Map m) {
                for (String subK : new String[]{"sector", "category", "industry", "name", "title", "classification"}) {
                    Object subVal = m.get(subK);
                    if (subVal instanceof String s && !s.trim().isEmpty() && !s.equalsIgnoreCase("equity") && !s.equalsIgnoreCase("mf") && !s.equalsIgnoreCase("share") && !s.equalsIgnoreCase("stock")) {
                        return s;
                    }
                }
            }
        }

        String[] listKeys = {"categories", "sectors", "industries", "tags", "classifications", "market_classifications", "instrument_categories"};
        for (String k : listKeys) {
            Object val = inst.get(k);
            if (val instanceof List list && !list.isEmpty()) {
                for (Object item : list) {
                    if (item instanceof String s && !s.trim().isEmpty() && !s.equalsIgnoreCase("equity") && !s.equalsIgnoreCase("mf") && !s.equalsIgnoreCase("share") && !s.equalsIgnoreCase("stock")) {
                        return s;
                    } else if (item instanceof Map m) {
                        for (String subK : new String[]{"name", "category", "sector", "industry", "title", "classification"}) {
                            Object subVal = m.get(subK);
                            if (subVal instanceof String s && !s.trim().isEmpty() && !s.equalsIgnoreCase("equity") && !s.equalsIgnoreCase("mf") && !s.equalsIgnoreCase("share") && !s.equalsIgnoreCase("stock")) {
                                return s;
                            }
                        }
                    }
                }
            }
        }

        return useFallback ? "Financials" : null;
    }

    private Integer parseRiskValue(Object val) {
        if (val == null) return null;
        if (val instanceof Number n) {
            int intVal = n.intValue();
            if (intVal >= 1 && intVal <= 10) return Math.min(7, Math.max(1, intVal));
        } else if (val instanceof String s) {
            s = s.trim();
            if (s.isEmpty()) return null;
            try {
                int intVal = Integer.parseInt(s);
                if (intVal >= 1 && intVal <= 10) return Math.min(7, Math.max(1, intVal));
            } catch (NumberFormatException ignored) {}
            
            for (char c : s.toCharArray()) {
                if (Character.isDigit(c)) {
                    int d = Character.getNumericValue(c);
                    if (d >= 1 && d <= 10) return Math.min(7, Math.max(1, d));
                }
            }
            
            String lower = s.toLowerCase();
            if (lower.contains("very high") || lower.contains("speculative") || lower.contains("aggressive")) return 7;
            if (lower.contains("high") || lower.contains("growth")) return 6;
            if (lower.contains("medium high") || lower.contains("moderate high")) return 5;
            if (lower.contains("medium") || lower.contains("moderate") || lower.contains("balanced")) return 4;
            if (lower.contains("low medium") || lower.contains("cautious")) return 3;
            if (lower.contains("low") || lower.contains("conservative") || lower.contains("defensive")) return 2;
            if (lower.contains("very low") || lower.contains("cash") || lower.contains("capital stable")) return 1;
        }
        return null;
    }

    private boolean hasRiskData(Map<String, Object> inst) {
        return extractRisk(inst, null) != null;
    }

    private Integer extractRisk(Map<String, Object> inst, Integer fallback) {
        if (inst == null) return fallback;

        String[] riskKeys = {"risk", "risk_rating", "risk_level", "rating", "level", "riskRating", "riskLevel", "fund_risk", "volatility", "volatility_rating", "risk_indicator", "srri", "risk_score", "riskScore"};
        for (String k : riskKeys) {
            Integer parsed = parseRiskValue(inst.get(k));
            if (parsed != null) return parsed;
        }

        for (Object val : inst.values()) {
            if (val instanceof Map m) {
                for (String subK : new String[]{"risk", "risk_rating", "risk_level", "rating", "level", "value", "score", "indicator", "volatility", "name", "title", "classification"}) {
                    Integer parsed = parseRiskValue(m.get(subK));
                    if (parsed != null) return parsed;
                }
            } else if (val instanceof List list && !list.isEmpty()) {
                for (Object item : list) {
                    if (item instanceof Map m) {
                        for (String subK : new String[]{"risk", "risk_rating", "risk_level", "rating", "level", "value", "score", "name", "title", "classification"}) {
                            Integer parsed = parseRiskValue(m.get(subK));
                            if (parsed != null) return parsed;
                        }
                    } else if (item instanceof String s && (s.toLowerCase().contains("risk") || s.toLowerCase().contains("rating") || s.toLowerCase().contains("level") || s.toLowerCase().contains("aggressive") || s.toLowerCase().contains("conservative") || s.toLowerCase().contains("growth") || s.toLowerCase().contains("balanced"))) {
                        Integer parsed = parseRiskValue(s);
                        if (parsed != null) return parsed;
                    }
                }
            }
        }

        return fallback;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> getInstrumentDetails(Long customerId, String fundId) {
        if (catalogCache.containsKey(fundId)) {
            Map<String, Object> cached = catalogCache.get(fundId);
            boolean hasPrice = getFirstPresentKey(cached, "current_price", "price", "last_price", "market_price", "unit_price", "close_price", "latest_price") != null;
            if (cached != null && hasClassificationData(cached) && hasRiskData(cached) && hasPrice) {
                return cached;
            }
        }
        SharesiesSession session = getSession(customerId);
        try {
            HttpHeaders headers = createHeaders(customerId);
            HttpEntity<Void> entity = new HttpEntity<>(headers);
            String url = session.getDataBaseUrl() + "/api/v1/instruments/" + fundId;
            ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.GET, entity, Map.class);
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map<String, Object> inst = (Map<String, Object>) response.getBody();
                if (inst != null) {
                    if (catalogCache.containsKey(fundId)) {
                        Map<String, Object> existing = new HashMap<>(catalogCache.get(fundId));
                        existing.putAll(inst);
                        inst = existing;
                    }
                    catalogCache.put(fundId, inst);
                    String symbol = (String) inst.get("symbol");
                    if (symbol == null) symbol = (String) inst.get("code");
                    if (symbol != null) instrumentCache.put(fundId, symbol.toUpperCase());
                    return inst;
                }
            }
        } catch (Exception e) {
            log.error("Failed to fetch individual instrument details for: {}", fundId, e);
        }
        return catalogCache.getOrDefault(fundId, Collections.emptyMap());
    }

    @SuppressWarnings("unchecked")
    public Object getWalletBalance(Long customerId) {
        SharesiesSession session = getSession(customerId);
        if (!session.isAuthenticated()) {
            log.warn("Cannot get wallet balance; session not authenticated.");
            return null;
        }
        try {
            HttpHeaders headers = createHeaders(customerId);
            HttpEntity<Void> entity = new HttpEntity<>(headers);
            ResponseEntity<Map> response = restTemplate.exchange(
                session.getAppBaseUrl() + "/api/identity/check",
                HttpMethod.GET,
                entity,
                Map.class
            );
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map<String, Object> body = (Map<String, Object>) response.getBody();
                Object userObj = body.get("user");
                if (userObj instanceof Map m) {
                    return m.get("wallet_balances");
                }
            }
        } catch (Exception e) {
            log.error("Failed to fetch wallet balance from identity check endpoint", e);
        }
        return null;
    }

    @SuppressWarnings("unchecked")
    public boolean syncProfileAndHoldings(Long customerId) {
        SharesiesSession session = getSession(customerId);
        if (!session.isAuthenticated()) {
            log.warn("Cannot sync; session not authenticated.");
            return false;
        }

        Map<String, Object> portfolioSummaryMap = null;
        try {
            log.info("Fetching profile details from check endpoint...");
            HttpHeaders headers = createHeaders(customerId);
            HttpEntity<Void> entity = new HttpEntity<>(headers);

            ResponseEntity<Map> response = restTemplate.exchange(
                session.getAppBaseUrl() + "/api/identity/check",
                HttpMethod.GET,
                entity,
                Map.class
            );

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map body = response.getBody();
                
                Map userMap = null;
                Object userObj = body.get("user");
                if (userObj instanceof Map m) {
                    userMap = m;
                }

                // 1. Sync Cash Balance
                Object walletObj = getWalletBalance(customerId);
                if (walletObj == null && userMap != null) {
                    walletObj = userMap.get("wallet_balances");
                }
                Double totalCashBase = 0.0;
                if (walletObj instanceof Map mapVal) {
                    for (Object val : mapVal.values()) {
                        if (val instanceof Map balMap) {
                            String curr = getFirstPresentKey(balMap, "currency", "curr", "currency_code", "code");
                            if (curr == null) curr = "NZD";
                            String balStr = getFirstPresentKey(balMap, "available", "available_balance", "balance", "amount", "total");
                            if (balStr != null) {
                                try {
                                    double amt = Double.parseDouble(balStr);
                                    totalCashBase += currencyService.convertToBase(amt, curr);
                                } catch (NumberFormatException ignored) {}
                            }
                        } else if (val != null) {
                            try { totalCashBase += Double.parseDouble(val.toString()); } catch (NumberFormatException ignored) {}
                        }
                    }
                } else if (walletObj instanceof List listVal && !listVal.isEmpty()) {
                    for (Object item : listVal) {
                        if (item instanceof Map balMap) {
                            String curr = getFirstPresentKey(balMap, "currency", "curr", "currency_code", "code");
                            if (curr == null) curr = "NZD";
                            String balStr = getFirstPresentKey(balMap, "available", "available_balance", "balance", "amount", "total");
                            if (balStr != null) {
                                try {
                                    double amt = Double.parseDouble(balStr);
                                    totalCashBase += currencyService.convertToBase(amt, curr);
                                } catch (NumberFormatException ignored) {}
                            }
                        }
                    }
                }
                
                String resolvedPortfolioId = null;
                if (userMap != null) {
                    Object userPorts = userMap.get("portfolios");
                    if (userPorts instanceof List list && !list.isEmpty()) {
                        Object first = list.get(0);
                        if (first instanceof Map m) {
                            if (m.get("id") != null) resolvedPortfolioId = m.get("id").toString();
                            else if (m.get("portfolio_id") != null) resolvedPortfolioId = m.get("portfolio_id").toString();
                        }
                    } else if (userMap.get("portfolio_id") != null) {
                        resolvedPortfolioId = userMap.get("portfolio_id").toString();
                    }
                }
                if (resolvedPortfolioId == null && body.get("portfolios") instanceof List list && !list.isEmpty()) {
                    Object first = list.get(0);
                    if (first instanceof Map m) {
                        if (m.get("id") != null) resolvedPortfolioId = m.get("id").toString();
                        else if (first != null) resolvedPortfolioId = first.toString();
                    }
                }
                if (resolvedPortfolioId == null && body.get("portfolio_id") != null) {
                    resolvedPortfolioId = body.get("portfolio_id").toString();
                }
                if (resolvedPortfolioId == null) {
                    resolvedPortfolioId = session.getUserId();
                }
                session.setPortfolioId(resolvedPortfolioId);
                
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
                if (policy != null) {
                    policy.setCashAvailable(totalCashBase);
                    policyRepository.save(policy);
                    log.info("Populated Cash Available for customer {}: {} NZD", customerId, totalCashBase);
                }

                // 2. Sync Watchlist/Favourites
                Object watchObj = userMap != null ? userMap.get("watchlist") : null;
                if (watchObj == null && userMap != null) watchObj = userMap.get("favourites");
                if (watchObj == null && userMap != null) watchObj = userMap.get("favorite_instruments");
                if (watchObj == null && userMap != null) watchObj = userMap.get("favourite_instruments");
                if (watchObj == null && userMap != null) watchObj = userMap.get("watchlist_instruments");
                if (watchObj == null) watchObj = body.get("watchlist");
                if (watchObj == null) watchObj = body.get("favourites");
                if (watchObj == null) watchObj = body.get("favorite_instruments");
                if (watchObj == null) watchObj = body.get("favourite_instruments");

                if (watchObj instanceof List watchlistCodes) {
                    // Delete existing watchlist for customer first (clean sync)
                    watchlistRepository.deleteAll(watchlistRepository.findByCustomerId(customerId));
                    
                    for (Object wObj : watchlistCodes) {
                        if (wObj != null) {
                            String watchId = null;
                            if (wObj instanceof Map m) {
                                Object idVal = m.get("fund_id");
                                if (idVal == null) idVal = m.get("id");
                                if (idVal == null) idVal = m.get("instrument_id");
                                if (idVal != null) watchId = idVal.toString();
                            } else {
                                watchId = wObj.toString();
                            }
                            if (watchId != null && !watchId.isEmpty()) {
                                String ticker = getSymbolForFundId(customerId, watchId);
                                if (watchlistRepository.findByCustomerIdAndCode(customerId, ticker).isEmpty()) {
                                    Map<String, Object> instInfo = getInstrumentDetails(customerId, watchId);
                                    String shareName = getFirstPresentKey(instInfo, "name", "share_name", "company_name");
                                    if (shareName == null || shareName.trim().isEmpty()) {
                                        shareName = ticker + " (Sharesies Favourite)";
                                    }
                                    String market = getFirstPresentKey(instInfo, "exchange", "market", "exchange_code");
                                    if (market == null || market.trim().isEmpty()) {
                                        market = "NZX";
                                    }
                                    Integer riskVal = extractRisk(instInfo, 3);
                                    if (riskVal == null || riskVal == 0) riskVal = 3;

                                    Watchlist wItem = Watchlist.builder()
                                            .customerId(customerId)
                                            .code(ticker)
                                            .shareName(shareName)
                                            .market(market)
                                            .risk(riskVal)
                                            .growth(50)
                                            .portfolioFit(50)
                                            .overallScore(70.0)
                                            .targetPrice(0.0)
                                            .type("GROWTH")
                                            .dividendYield(Watchlist.getDivYieldForCode(ticker, "growth"))
                                            .currentPrice(Watchlist.getCurrentPriceForCode(ticker))
                                            .build();
                                    watchlistRepository.save(wItem);
                                }
                            }
                        }
                    }
                }

                // 3. Sync Active Holdings
                String portfolioId = session.getPortfolioId();
                if (portfolioId != null) {
                    try {
                        String summaryUrl = session.getPortfolioBaseUrl() + "/api/v1/portfolios/" + portfolioId;
                        HttpHeaders portHeaders = createHeaders(customerId);
                        if (session.getRakaiaToken() != null) {
                            portHeaders.set("Authorization", "Bearer " + session.getRakaiaToken());
                        }
                        HttpEntity<Void> portEntity = new HttpEntity<>(portHeaders);
                        ResponseEntity<Map> summaryResp = restTemplate.exchange(summaryUrl, HttpMethod.GET, portEntity, Map.class);
                        if (summaryResp.getStatusCode().is2xxSuccessful() && summaryResp.getBody() != null) {
                            Map<String, Object> sMap = summaryResp.getBody();
                            portfolioSummaryMap = sMap;
                            Double totalEstimatedValue = null;
                            Double totalReturnVal = null;
                            Double amountPutIn = null;
                            Double simpleReturnVal = null;
                            
                            Object tev = getFirstPresentKey(sMap, "portfolio_value", "total_estimated_value", "estimated_value", "value", "net_worth");
                            if (tev != null) {
                                try { totalEstimatedValue = Double.parseDouble(tev.toString()); } catch (NumberFormatException ignored) {}
                            }
                            Object tr = getFirstPresentKey(sMap, "total_return", "gain", "return", "total_gain");
                            if (tr != null) {
                                try { totalReturnVal = Double.parseDouble(tr.toString()); } catch (NumberFormatException ignored) {}
                            }
                            Object api = getFirstPresentKey(sMap, "cost_basis", "amount_put_in", "cost", "total_cost", "put_in");
                            if (api != null) {
                                try { amountPutIn = Double.parseDouble(api.toString()); } catch (NumberFormatException ignored) {}
                            }
                            Object sr = getFirstPresentKey(sMap, "simple_return", "return_percentage", "percentage_gain");
                            if (sr != null) {
                                try { simpleReturnVal = Double.parseDouble(sr.toString()); } catch (NumberFormatException ignored) {}
                            }
                            
                            InvestmentPolicy policyObj = policyRepository.findByCustomerId(customerId)
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
                            if (policyObj != null) {
                                if (totalEstimatedValue != null) policyObj.setSharesiesTotalEstimatedValue(totalEstimatedValue);
                                if (totalReturnVal != null) policyObj.setSharesiesTotalReturn(totalReturnVal);
                                if (amountPutIn != null) policyObj.setSharesiesAmountPutIn(amountPutIn);
                                if (simpleReturnVal != null) policyObj.setSharesiesSimpleReturn(simpleReturnVal);
                                policyRepository.save(policyObj);
                            }
                        }
                    } catch (Exception e) {
                        log.error("Failed to fetch portfolio summary: {}", e.getMessage());
                    }

                    String instrumentsUrl = session.getPortfolioBaseUrl() + "/api/v1/portfolios/" + portfolioId + "/instruments";
                    try {
                        HttpHeaders portHeaders = createHeaders(customerId);
                        if (session.getRakaiaToken() != null) {
                            portHeaders.set("Authorization", "Bearer " + session.getRakaiaToken());
                        }
                        HttpEntity<Void> portEntity = new HttpEntity<>(portHeaders);
                        ResponseEntity<Map> portResp = restTemplate.exchange(instrumentsUrl, HttpMethod.GET, portEntity, Map.class);
                        if (portResp.getStatusCode().is2xxSuccessful() && portResp.getBody() != null) {
                            Map<String, Object> bodyMap = portResp.getBody();
                            List<Map> holdingsList = new ArrayList<>();
                            Object instObj = bodyMap.get("instruments");
                            if (instObj == null) instObj = bodyMap.get("holdings");
                            if (instObj == null) instObj = bodyMap.get("portfolio");
                            if (instObj == null) instObj = bodyMap.get("instrument_returns");
                            if (instObj == null) instObj = bodyMap.get("results");
                            if (instObj == null) instObj = bodyMap.get("data");

                            if (instObj instanceof List list) {
                                for (Object o : list) {
                                    if (o instanceof Map m) holdingsList.add((Map) m);
                                }
                            } else if (instObj instanceof Map mapVal) {
                                for (Object val : mapVal.values()) {
                                    if (val instanceof Map m) {
                                        holdingsList.add((Map) m);
                                    } else if (val instanceof List list) {
                                        for (Object o : list) {
                                            if (o instanceof Map m) holdingsList.add((Map) m);
                                        }
                                    }
                                }
                            }

                            if (!holdingsList.isEmpty()) {
                                // Delete customer holdings before inserting synced ones
                                holdingRepository.deleteAll(holdingRepository.findByCustomerId(customerId));

                                for (Map portItem : holdingsList) {
                                    log.info("Sharesies sync raw holding portItem: {}", portItem);
                                    String fundId = getFirstPresentKey(portItem, "instrument_uuid", "fund_id", "instrument_id", "id", "fund_uuid", "fundUuid", "instrumentId");
                                    if (fundId == null) continue;
                                    String sharesVal = getFirstPresentKey(portItem, "shares_owned", "shares", "quantity", "units", "total_shares", "balance", "amount", "total_units", "current_shares");
                                    String avgPriceVal = getFirstPresentKey(portItem, "average_price", "avg_cost", "cost_price", "average_cost_price", "purchase_price", "avg_purchase_price", "cost_basis", "total_cost_basis");
                                    String feesValStr = getFirstPresentKey(portItem, "transaction_fees", "fees", "brokerage");
                                    
                                    if (sharesVal == null) sharesVal = "0.0";
                                    if (avgPriceVal == null) avgPriceVal = "0.0";
                                    double parsedFees = 0.0;
                                    if (feesValStr != null) {
                                        try { parsedFees = Double.parseDouble(feesValStr); } catch (NumberFormatException ignored) {}
                                    }

                                    try {
                                        Double quantity = Double.valueOf(sharesVal);
                                        Double costVal = Double.valueOf(avgPriceVal);
                                        Double costPrice = costVal;
                                        if (portItem.get("average_price") == null && portItem.get("avg_cost") == null && quantity > 0.0 && (portItem.get("cost_basis") != null || portItem.get("total_cost_basis") != null)) {
                                            costPrice = costVal / quantity;
                                        }
                                        
                                        if (quantity > 0.0) {
                                            String code = getSymbolForFundId(customerId, fundId);
                                            Map<String, Object> instInfo = getInstrumentDetails(customerId, fundId);

                                            String nameVal = getFirstPresentKey(instInfo, "name", "company_name", "title", "description");
                                            String shareName = nameVal != null ? nameVal : (code + " (Sharesies Asset)");

                                            String marketVal = getFirstPresentKey(instInfo, "market", "exchange", "market_code");
                                            String market = marketVal != null ? marketVal : "NZX";

                                            String currVal = getFirstPresentKey(instInfo, "currency", "curr", "currency_code");
                                            String currency = currVal != null ? currVal : (market.contains("US") || market.contains("NYSE") || market.contains("NASDAQ") ? "USD" : (market.contains("ASX") || market.contains("AU") ? "AUD" : "NZD"));
                                            if (currency.equalsIgnoreCase("USD") || currency.equalsIgnoreCase("US")) currency = "USD";
                                            else if (currency.equalsIgnoreCase("AUD") || currency.equalsIgnoreCase("AU")) currency = "AUD";
                                            else currency = "NZD";

                                            String country = currency.equals("USD") ? "US" : (currency.equals("AUD") ? "AU" : "NZ");
                                            String sector = extractSector(instInfo, true);

                                            double invValue = 0.0;
                                            String ivStr = getFirstPresentKey(portItem, "investment_value", "market_value", "value", "current_value");
                                            if (ivStr != null) {
                                                try {
                                                    double parsedIv = Double.parseDouble(ivStr);
                                                    if (parsedIv > 0.0) invValue = parsedIv;
                                                } catch (NumberFormatException ignored) {}
                                            }

                                            double invValueLocal = invValue;

                                            String curPriceVal = getFirstPresentKey(portItem, "current_price", "price", "last_price", "market_price", "unit_price", "close_price", "latest_price");
                                            if (curPriceVal == null) {
                                                curPriceVal = getFirstPresentKey(instInfo, "current_price", "price", "last_price", "market_price", "unit_price", "close_price", "latest_price");
                                            }
                                            Double currentPrice = costPrice;
                                            if (curPriceVal != null) {
                                                try { currentPrice = Double.valueOf(curPriceVal); } catch (NumberFormatException ignored) {}
                                            }
                                            if (invValueLocal > 0.0 && quantity > 0.0) {
                                                currentPrice = invValueLocal / quantity;
                                            } else if (invValueLocal == 0.0 && quantity > 0.0 && currentPrice > 0.0) {
                                        invValueLocal = quantity * currentPrice;
                                            }

                                            Integer riskVal = extractRisk(instInfo, extractRisk(portItem, 5));

                                            double unregGain = (quantity * currentPrice) - (quantity * costPrice);
                                            if (portItem.get("total_return_detail") instanceof Map trDetail) {
                                                Object ucg = trDetail.get("unrealised_capital_gains");
                                                if (ucg != null) {
                                                    try {
                                                        unregGain = Double.parseDouble(ucg.toString());
                                                    } catch (Exception ignored) {}
                                                }
                                            } else {
                                                String ugValStr = getFirstPresentKey(portItem, "unrealised_gain", "unrealised_pnl", "gain", "gain_loss", "total_gain", "unrealised_cop_gain", "unrealised_cop_pnl");
                                                if (ugValStr != null) {
                                                    try {
                                                        double parsedUg = Double.parseDouble(ugValStr);
                                                        if (!"NZD".equalsIgnoreCase(currency) && ugValStr.toLowerCase().contains("nzd")) {
                                                            parsedUg = currencyService.convertFromBase(parsedUg, currency);
                                                        }
                                                        unregGain = parsedUg;
                                                    } catch (Exception ignored) {}
                                                }
                                            }

                                            double simpRet = 0.0;
                                            if (costPrice > 0.0) {
                                                simpRet = ((currentPrice - costPrice) / costPrice) * 100.0;
                                            }

                                            Double purchaseExchangeRate = null;
                                            double feesLocal = parsedFees;
                                            double divLocal = 0.0;
                                            String divlStr = getFirstPresentKey(portItem, "dividends_received", "dividends");
                                            if (divlStr != null) {
                                                try { divLocal = Double.parseDouble(divlStr); } catch (Exception ignored) {}
                                            }

                                            double divHome = divLocal;
                                            String divhStr = getFirstPresentKey(portItem, "dividends_received_home", "dividends_home");
                                            if (divhStr != null) {
                                                try { divHome = Double.parseDouble(divhStr); } catch (Exception ignored) {}
                                            }

                                            double ivHome = invValue;
                                            String ivhStr = getFirstPresentKey(portItem, "investment_value_home", "market_value_home", "value_home", "current_value_home");
                                            if (ivhStr != null) {
                                                try { ivHome = Double.parseDouble(ivhStr); } catch (Exception ignored) {}
                                            }

                                            double costBasisLocal = quantity * costPrice;
                                            if (costBasisLocal > 0.0 && !"NZD".equalsIgnoreCase(currency)) {
                                                double trHome = 0.0;
                                                String trhStr = getFirstPresentKey(portItem, "total_return_home", "return_home", "pnl_home");
                                                if (trhStr != null) {
                                                    try { trHome = Double.parseDouble(trhStr); } catch (Exception ignored) {}
                                                }

                                                double ucgHome = 0.0;
                                                String ucghStr = getFirstPresentKey(portItem, "unrealised_capital_gains_home", "unrealised_gain_home", "unrealised_pnl_home");
                                                if (ucghStr != null) {
                                                    try { ucgHome = Double.parseDouble(ucghStr); } catch (Exception ignored) {}
                                                }

                                                double liveRate = (invValue > 0.0) ? (ivHome / invValue) : currencyService.getRateToBase(currency);
                                                double feesHome = feesLocal * liveRate;

                                                double currencyGainHome = trHome - ucgHome - divHome + feesHome;
                                                double fixedCurrentRate = currencyService.getRateToBase(currency);
                                                purchaseExchangeRate = fixedCurrentRate - (currencyGainHome / costBasisLocal);
                                            }
                                            if (purchaseExchangeRate == null || purchaseExchangeRate <= 0.0) {
                                                purchaseExchangeRate = currencyService.getRateToBase(currency);
                                            }

                                            Holding holding = Holding.builder()
                                                    .customerId(customerId)
                                                    .code(code)
                                                    .shareName(shareName)
                                                    .quantity(quantity)
                                                    .avgPurchasePrice(costPrice)
                                                    .currentPrice(currentPrice)
                                                    .unrealisedGain(unregGain)
                                                    .simpleReturn(simpRet)
                                                    .investmentValue(ivHome)
                                                    .market(market)
                                                    .currency(currency)
                                                    .country(country)
                                                    .sector(sector)
                                                    .risk(riskVal)
                                                    .purchaseExchangeRate(purchaseExchangeRate)
                                                    .brokerage(feesLocal)
                                                    .dividendIncome(divLocal)
                                                    .dividendIncomeHome(divHome)
                                                    .lastUpdated(java.time.LocalDateTime.now())
                                                    .notes("Synced from Sharesies API with live instrument data")
                                                    .build();
                                            holdingRepository.save(holding);

                                            // Sync Dividend History
                                            try {
                                                String divUrl = session.getDataBaseUrl() + "/api/v1/instruments/" + fundId + "/dividends";
                                                HttpHeaders divHeaders = createHeaders(customerId);
                                                HttpEntity<Void> divEntity = new HttpEntity<>(divHeaders);
                                                ResponseEntity<Map> divResp = restTemplate.exchange(divUrl, HttpMethod.GET, divEntity, Map.class);
                                                if (divResp.getStatusCode().is2xxSuccessful() && divResp.getBody() != null) {
                                                    Map<String, Object> divBody = divResp.getBody();
                                                    Object divsObj = divBody.get("dividends");
                                                    if (divsObj instanceof List divsList) {
                                                        for (Object dObj : divsList) {
                                                            if (dObj instanceof Map dMap) {
                                                                Double divAmt = null;
                                                                Object amtObj = getFirstPresentKey(dMap, "amount", "rate", "value");
                                                                if (amtObj != null) {
                                                                    try { divAmt = Double.parseDouble(amtObj.toString()); } catch (NumberFormatException ignored) {}
                                                                }
                                                                
                                                                LocalDate exDate = null;
                                                                Object exObj = getFirstPresentKey(dMap, "ex_date", "ex_dividend_date", "exDividendDate");
                                                                if (exObj != null) {
                                                                    try { 
                                                                        String exStr = exObj.toString();
                                                                        if (exStr.length() >= 10) exStr = exStr.substring(0, 10);
                                                                        exDate = LocalDate.parse(exStr); 
                                                                    } catch (Exception ignored) {}
                                                                }
                                                                
                                                                LocalDate payDate = null;
                                                                Object payObj = getFirstPresentKey(dMap, "payment_date", "pay_date", "paymentDate");
                                                                if (payObj != null) {
                                                                    try { 
                                                                        String payStr = payObj.toString();
                                                                        if (payStr.length() >= 10) payStr = payStr.substring(0, 10);
                                                                        payDate = LocalDate.parse(payStr); 
                                                                    } catch (Exception ignored) {}
                                                                }
                                                                
                                                                String divType = (String) getFirstPresentKey(dMap, "type", "dividend_type", "kind");
                                                                if (divType == null) divType = "QUARTERLY";
                                                                
                                                                String divStatus = (String) getFirstPresentKey(dMap, "status", "payment_status");
                                                                if (divStatus == null) divStatus = "PAID";
                                                                divStatus = divStatus.toUpperCase();

                                                                if (divAmt != null && payDate != null) {
                                                                    final LocalDate finalPayDate = payDate;
                                                                    Optional<Dividend> existing = dividendRepository.findByCode(code).stream()
                                                                        .filter(x -> finalPayDate.equals(x.getPaymentDate()))
                                                                        .findFirst();
                                                                    
                                                                    if (existing.isEmpty()) {
                                                                        Dividend newDiv = Dividend.builder()
                                                                            .code(code)
                                                                            .amount(divAmt)
                                                                            .exDividendDate(exDate)
                                                                            .paymentDate(payDate)
                                                                            .type(divType.toUpperCase())
                                                                            .status(divStatus)
                                                                            .build();
                                                                        dividendRepository.save(newDiv);
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            } catch (Exception e) {
                                                log.error("Failed to sync dividends for ticker {}: {}", code, e.getMessage());
                                            }
                                        }
                                    } catch (NumberFormatException ignored) {}
                                }
                            }
                        }
                    } catch (Exception e) {
                        log.error("Failed to fetch portfolio instruments: {}", e.getMessage(), e);
                    }
                }
                syncTransactionsAndApplyOverrides(customerId);
                calculateAndSaveDerivedSeeds(customerId, portfolioSummaryMap);
                return true;
            }
        } catch (Exception e) {
            log.error("Failed to sync profile and holdings for customer {}", customerId, e);
        }
        return false;
    }

    public void syncTransactionsAndApplyOverrides(Long customerId) {
        SharesiesSession session = getSession(customerId);
        if (!session.isAuthenticated() || session.getUserId() == null) return;
        try {
            log.info("Syncing transaction history for customer {}...", customerId);
            List<Map> txList = fetchAllSharesiesTransactions(customerId, session);
            
            // Delete existing transactions for customer (clean sync)
            transactionRepository.deleteAll(transactionRepository.findByCustomerId(customerId));
            
            int syncedCount = 0;
            for (Object item : txList) {
                if (item instanceof Map txMap) {
                    String typeStr = getFirstPresentKey(txMap, "type", "transaction_type", "action");
                    if (typeStr == null) typeStr = "BUY";
                    typeStr = typeStr.toUpperCase();
                    
                    if (!typeStr.contains("BUY") && !typeStr.contains("SELL") && !typeStr.contains("DIV") && !typeStr.contains("FEE") && !typeStr.contains("BROKERAGE")) {
                        continue;
                    }
                    String fundId = getFirstPresentKey(txMap, "fund_id", "instrument_id", "id");
                    String ticker = fundId != null ? getSymbolForFundId(customerId, fundId) : null;
                    if (ticker == null) {
                        String desc = getFirstPresentKey(txMap, "description", "memo", "name");
                        if (desc != null) {
                            if (desc.contains("JEPI")) ticker = "JEPI";
                            else if (desc.contains("ENB")) ticker = "ENB";
                            else if (desc.contains("O")) ticker = "O";
                            else if (desc.contains("META")) ticker = "META";
                            else if (desc.contains("USF")) ticker = "USF";
                        }
                    }
                    if (ticker == null) {
                        ticker = "CASH";
                    }

                    Double quantity = 0.0;
                    String qtyStr = getFirstPresentKey(txMap, "shares", "quantity", "units", "volume");
                    if (qtyStr != null) {
                        try { quantity = Double.parseDouble(qtyStr); } catch (NumberFormatException ignored) {}
                    }
                    Double price = 0.0;
                    String priceStr = getFirstPresentKey(txMap, "price", "unit_price", "amount");
                    if (priceStr != null) {
                        try { price = Double.parseDouble(priceStr); } catch (NumberFormatException ignored) {}
                    }
                    Double fee = 0.0;
                    String feeStr = getFirstPresentKey(txMap, "fee", "brokerage", "transaction_fee");
                    if (feeStr != null) {
                        try { fee = Double.parseDouble(feeStr); } catch (NumberFormatException ignored) {}
                    }

                    String name = ticker;
                    if (fundId != null) {
                        Map<String, Object> inst = getInstrumentDetails(customerId, fundId);
                        if (inst != null && inst.get("name") != null) name = inst.get("name").toString();
                    }

                    String txCurrency = (String) getFirstPresentKey(txMap, "currency", "currency_code");
                    if (txCurrency == null || txCurrency.trim().isEmpty()) {
                        txCurrency = "NZD";
                    }
                    txCurrency = txCurrency.toUpperCase();

                    java.time.LocalDateTime txTimestamp = java.time.LocalDateTime.now();
                    Object tsObj = getFirstPresentKey(txMap, "timestamp", "date", "created_at");
                    if (tsObj != null) {
                        try {
                            long epoch = Long.parseLong(tsObj.toString());
                            txTimestamp = java.time.LocalDateTime.ofInstant(java.time.Instant.ofEpochSecond(epoch), java.time.ZoneId.systemDefault());
                        } catch (Exception ignored) {
                            try {
                                String tsStr = tsObj.toString();
                                if (tsStr.length() > 19) tsStr = tsStr.substring(0, 19);
                                txTimestamp = java.time.LocalDateTime.parse(tsStr);
                            } catch (Exception ignored2) {}
                        }
                    }

                    Transaction tx = Transaction.builder()
                            .customerId(customerId)
                            .code(ticker)
                            .shareName(name)
                            .type(typeStr.contains("SELL") ? "SELL" : (typeStr.contains("DIV") ? "DIVIDEND" : (typeStr.contains("FEE") || typeStr.contains("BROKERAGE") ? "FEE" : "BUY")))
                            .quantity(quantity)
                            .price(price)
                            .brokerage(fee)
                            .currency(txCurrency)
                            .timestamp(txTimestamp)
                            .build();
                    transactionRepository.save(tx);
                    syncedCount++;
                }
            }
            log.info("Synced {} historical transactions for customer {}.", syncedCount, customerId);

            // Apply historical overrides to active Holdings
            List<Holding> holdings = holdingRepository.findByCustomerId(customerId);
            for (Holding h : holdings) {
                List<Transaction> txs = transactionRepository.findByCustomerIdAndCodeOrderByTimestampDesc(customerId, h.getCode());
                if (!txs.isEmpty()) {
                    double totalBrokerage = 0.0;
                    double totalDividends = 0.0;
                    for (Transaction tx : txs) {
                        if (tx.getBrokerage() != null) totalBrokerage += tx.getBrokerage();
                        if ("DIVIDEND".equalsIgnoreCase(tx.getType())) {
                            totalDividends += Math.abs(tx.getPrice() * (tx.getQuantity() > 0 ? tx.getQuantity() : 1.0));
                        }
                    }
                    if (totalBrokerage > 0.0) h.setBrokerage(totalBrokerage);
                    if (totalDividends > 0.0) h.setDividendIncome(totalDividends);
                    holdingRepository.save(h);
                }
            }
        } catch (Exception e) {
            log.error("Failed to sync transactions or apply overrides: {}", e.getMessage(), e);
        }
    }

    private List<Map> fetchAllSharesiesTransactions(Long customerId, SharesiesSession session) {
        List<Map> allTransactions = new ArrayList<>();
        String[] baseUrls = new String[]{
            session.getAppBaseUrl(),
            session.getDataBaseUrl(),
            session.getPortfolioBaseUrl()
        };
        for (String baseUrl : baseUrls) {
            if (baseUrl == null) continue;
            try {
                HttpHeaders headers;
                String headerDesc;
                if (baseUrl.contains("data.sharesies.nz")) {
                    headers = createHeaders(customerId);
                    headerDesc = "distill-token";
                } else if (baseUrl.contains("portfolio.sharesies.nz") || baseUrl.contains("portfolio.sharesies.com")) {
                    headers = createRakaiaHeaders(customerId);
                    headerDesc = "rakaia-token";
                } else {
                    headers = createCookieOnlyHeaders(customerId);
                    headerDesc = "cookie-only";
                }
                
                HttpEntity<Void> entity = new HttpEntity<>(headers);
                boolean hasMore = true;
                String beforeId = null;
                List<Map> batchTransactions = new ArrayList<>();

                while (hasMore) {
                    String url = baseUrl + "/api/accounting/transaction-history?limit=50&acting_as_id=" + session.getUserId();
                    if (beforeId != null) {
                        url += "&before=" + beforeId;
                    }
                    
                    ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.GET, entity, Map.class);
                    if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                        Map body = response.getBody();
                        Object txObj = body.get("transactions");
                        if (txObj instanceof List list) {
                            for (Object o : list) {
                                if (o instanceof Map m) batchTransactions.add(m);
                            }
                            
                            Object hm = body.get("has_more");
                            hasMore = hm instanceof Boolean && (Boolean) hm;
                            
                            if (hasMore && !list.isEmpty()) {
                                Object last = list.get(list.size() - 1);
                                if (last instanceof Map lastMap && lastMap.get("transaction_id") != null) {
                                    beforeId = lastMap.get("transaction_id").toString();
                                } else {
                                    hasMore = false;
                                }
                            } else {
                                hasMore = false;
                            }
                        } else {
                            hasMore = false;
                        }
                    } else {
                        hasMore = false;
                    }
                }
                
                if (!batchTransactions.isEmpty()) {
                    allTransactions.addAll(batchTransactions);
                    log.info("Successfully fetched {} transactions from {} using {} for customer {}", batchTransactions.size(), baseUrl, headerDesc, customerId);
                    break;
                }
            } catch (Exception e) {
                log.warn("Failed to fetch historical transactions from {} using accounting endpoint: {}. Trying fallback...", baseUrl, e.getMessage());
            }
        }
        return allTransactions;
    }


    private double fetchFeesFromOrderHistory(Long customerId, SharesiesSession session, String fundId, String currency) {
        double totalFeesForFund = 0.0;
        String[] urls = new String[]{
            session.getAppBaseUrl() + "/api/accounting/order-history-v4?fund_id=" + fundId + "&acting_as_id=" + session.getUserId(),
            session.getDataBaseUrl() + "/api/accounting/order-history-v4?fund_id=" + fundId + "&acting_as_id=" + session.getUserId()
        };
        for (String url : urls) {
            try {
                HttpHeaders headers = url.contains("data.sharesies.nz") ? createHeaders(customerId) : createCookieOnlyHeaders(customerId);
                HttpEntity<Void> entity = new HttpEntity<>(headers);
                ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.GET, entity, Map.class);
                if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                    Object ordersObj = response.getBody().get("orders");
                    if (ordersObj instanceof List list) {
                        for (Object o : list) {
                            if (o instanceof Map order) {
                                Object feeVal = getFirstPresentKey(order, "fee", "brokerage", "transaction_fee");
                                if (feeVal != null) {
                                    try {
                                        double fee = Double.parseDouble(feeVal.toString());
                                        totalFeesForFund += fee;
                                    } catch (NumberFormatException ignored) {}
                                }
                            }
                        }
                        if (totalFeesForFund > 0.0) {
                            break;
                        }
                    }
                }
            } catch (Exception e) {
                log.warn("Failed to fetch order history for fund {} from {}: {}", fundId, url, e.getMessage());
            }
        }
        return totalFeesForFund;
    }

    private double fetchDividendsFromInstrument(Long customerId, SharesiesSession session, String fundId, String instrumentCurrency, double currentQuantity) {
        double totalDividendsNzd = 0.0;
        String[] urls = new String[]{
            session.getDataBaseUrl() + "/api/v1/instruments/" + fundId + "/dividends",
            session.getAppBaseUrl() + "/api/v1/instruments/" + fundId + "/dividends"
        };
        for (String url : urls) {
            try {
                HttpHeaders headers = url.contains("data.sharesies.nz") ? createHeaders(customerId) : createCookieOnlyHeaders(customerId);
                HttpEntity<Void> entity = new HttpEntity<>(headers);
                ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.GET, entity, Map.class);
                if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                    Object dividendsObj = response.getBody().get("dividends");
                    if (dividendsObj instanceof List list) {
                        String symbol = instrumentCache.get(fundId);
                        List<Transaction> txs = new ArrayList<>();
                        if (symbol != null) {
                            txs = transactionRepository.findByCustomerIdAndCodeOrderByTimestampDesc(customerId, symbol);
                        }
                        
                        double fundDividendsNzd = 0.0;
                        for (Object o : list) {
                            if (o instanceof Map div) {
                                Object amtVal = getFirstPresentKey(div, "amount", "rate", "value", "net_amount");
                                Object payObj = getFirstPresentKey(div, "payment_date", "pay_date", "paymentDate");
                                Object exObj = getFirstPresentKey(div, "ex_date", "ex_dividend_date", "exDividendDate");
                                
                                if (amtVal != null && payObj != null) {
                                    try {
                                        double rate = Double.parseDouble(amtVal.toString());
                                        
                                        String payStr = payObj.toString();
                                        if (payStr.length() >= 10) payStr = payStr.substring(0, 10);
                                        LocalDate paymentDate = LocalDate.parse(payStr);
                                        
                                        if (paymentDate.isBefore(LocalDate.now())) {
                                            LocalDate exDate = paymentDate;
                                            if (exObj != null) {
                                                String exStr = exObj.toString();
                                                if (exStr.length() >= 10) exStr = exStr.substring(0, 10);
                                                exDate = LocalDate.parse(exStr);
                                            }
                                            
                                            double sharesOnExDate = currentQuantity;
                                            for (Transaction tx : txs) {
                                                if (tx.getTimestamp() != null && tx.getTimestamp().toLocalDate().isAfter(exDate)) {
                                                    if ("BUY".equalsIgnoreCase(tx.getType())) {
                                                        sharesOnExDate -= (tx.getQuantity() != null ? tx.getQuantity() : 0.0);
                                                    } else if ("SELL".equalsIgnoreCase(tx.getType())) {
                                                        sharesOnExDate += (tx.getQuantity() != null ? tx.getQuantity() : 0.0);
                                                    }
                                                }
                                            }
                                            
                                            if (sharesOnExDate > 0.0) {
                                                double divLocalAmount = sharesOnExDate * rate;
                                                
                                                String divCurrency = (String) getFirstPresentKey(div, "currency", "currency_code");
                                                if (divCurrency == null || divCurrency.trim().isEmpty()) {
                                                    divCurrency = instrumentCurrency;
                                                }
                                                divCurrency = divCurrency.toUpperCase();
                                                
                                                fundDividendsNzd += currencyService.convertToBase(divLocalAmount, divCurrency);
                                            }
                                        }
                                    } catch (Exception ignored) {}
                                }
                            }
                        }
                        if (fundDividendsNzd > 0.0) {
                            totalDividendsNzd = fundDividendsNzd;
                            break;
                        }
                    }
                }
            } catch (Exception e) {
                log.warn("Failed to fetch dividends for fund {} from {}: {}", fundId, url, e.getMessage());
            }
        }
        return totalDividendsNzd;
    }

    private void calculateAndSaveDerivedSeeds(Long customerId, Map<String, Object> sMap) {
        try {
            double totalUnrealised = 0.0;
            double totalUnrealisedCurrency = 0.0;
            double calculatedFees = 0.0;
            double calculatedDivs = 0.0;

            List<Holding> holdings = holdingRepository.findByCustomerId(customerId);
            SharesiesSession session = getSession(customerId);

            // Unrealised gains/losses (converted to NZD base currency)
            totalUnrealised = holdings.stream()
                    .mapToDouble(h -> {
                        double qty = h.getQuantity() != null ? h.getQuantity() : 0.0;
                        double cost = h.getAvgPurchasePrice() != null ? h.getAvgPurchasePrice() : 0.0;
                        double price = h.getCurrentPrice() != null ? h.getCurrentPrice() : 0.0;
                        double unrealisedLocal = (price - cost) * qty;
                        String currency = h.getCurrency() != null ? h.getCurrency() : "NZD";
                        return currencyService.convertToBase(unrealisedLocal, currency);
                    })
                    .sum();

            // Unrealised Currency gains/losses
            totalUnrealisedCurrency = holdings.stream()
                    .filter(h -> !"NZD".equalsIgnoreCase(h.getCurrency()))
                    .mapToDouble(h -> {
                        double cost = h.getQuantity() * (h.getAvgPurchasePrice() != null ? h.getAvgPurchasePrice() : 0.0);
                        String currency = h.getCurrency();
                        double currentRate = currencyService.getRateToBase(currency);
                        double purchaseRate = h.getPurchaseExchangeRate() != null ? h.getPurchaseExchangeRate() : currentRate;
                        return (currentRate - purchaseRate) * cost;
                    })
                    .sum();

            List<Transaction> allTxs = transactionRepository.findByCustomerId(customerId);

            // Calculate Fees by summing brokerage from all transactions (since they are synced via get_transactions)
            for (Transaction tx : allTxs) {
                if (tx.getBrokerage() != null && tx.getBrokerage() > 0.0) {
                    String txCur = tx.getCurrency() != null ? tx.getCurrency() : "NZD";
                    calculatedFees += currencyService.convertToBase(tx.getBrokerage(), txCur);
                }
            }

            // Calculate Dividends using get_dividends endpoint
            for (Holding h : holdings) {
                String fundId = getFundIdForSymbol(customerId, h.getCode());
                String cur = h.getCurrency() != null ? h.getCurrency() : "NZD";
                
                double divsLocal = 0.0;
                if (fundId != null) {
                    divsLocal = fetchDividendsFromInstrument(customerId, session, fundId, cur, h.getQuantity());
                }
                
                // Fallbacks to active holding value if sync endpoint returns 0
                if (divsLocal == 0.0) {
                    divsLocal = h.getDividendIncome() != null ? h.getDividendIncome() : 0.0;
                }
                
                calculatedDivs += currencyService.convertToBase(divsLocal, cur);
            }

            // Fallback to transaction history if calculated dividends are completely empty
            if (calculatedDivs == 0.0) {
                double ledgerDivs = 0.0;
                for (Transaction tx : allTxs) {
                    String currency = "NZD";
                    if (tx.getCode() != null && !tx.getCode().equals("CASH")) {
                        Optional<Holding> hOpt = holdingRepository.findByCustomerIdAndCode(customerId, tx.getCode());
                        if (hOpt.isPresent()) {
                            currency = hOpt.get().getCurrency();
                        }
                    }

                    if ("DIVIDEND".equalsIgnoreCase(tx.getType())) {
                        double qty = tx.getQuantity() != null && tx.getQuantity() > 0.0 ? tx.getQuantity() : 1.0;
                        ledgerDivs += currencyService.convertToBase(Math.abs(tx.getPrice() * qty), currency);
                    }
                }
                calculatedDivs = ledgerDivs;
            }

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
            if (policy != null) {
                policy.setSeedUnrealisedGains(totalUnrealised);
                policy.setSeedRealisedGains(null);
                policy.setSeedUnrealisedCurrencyGains(totalUnrealisedCurrency);
                policy.setSeedRealisedCurrencyGains(null);
                policy.setSeedTransactionFees(-calculatedFees);
                policy.setSeedDividendsReceived(calculatedDivs);
                policyRepository.save(policy);
                log.info("Successfully derived and populated seed overrides for customer {}: Unrealised={}, UnrealisedCurrency={}, Fees={}, Dividends={}",
                        customerId, totalUnrealised, totalUnrealisedCurrency, -calculatedFees, calculatedDivs);
            }
        } catch (Exception e) {
            log.error("Failed to derive and populate seed overrides from Sharesies: {}", e.getMessage(), e);
        }
    }

    public Map<String, Object> testApiUrl(Long customerId, String url, String headerType) {
        Map<String, Object> resMap = new HashMap<>();
        try {
            HttpHeaders headers;
            if ("cookie".equalsIgnoreCase(headerType)) {
                headers = createCookieOnlyHeaders(customerId);
            } else {
                headers = createHeaders(customerId);
            }
            HttpEntity<Void> entity = new HttpEntity<>(headers);
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, entity, String.class);
            resMap.put("status", response.getStatusCode().value());
            resMap.put("body", response.getBody());
        } catch (Exception e) {
            resMap.put("error", e.getMessage());
        }
        return resMap;
    }

    public String getFundIdForSymbol(Long customerId, String symbol) {
        if (symbol == null) return null;
        String upper = symbol.toUpperCase();
        for (Map.Entry<String, String> entry : instrumentCache.entrySet()) {
            if (upper.equals(entry.getValue())) {
                return entry.getKey();
            }
        }
        // Fallback: search the API directly for this symbol
        try {
            SharesiesSession session = getSession(customerId);
            HttpHeaders headers = createHeaders(customerId);
            HttpEntity<Void> entity = new HttpEntity<>(headers);
            String url = session.getDataBaseUrl() + "/api/v1/instruments?Page=1&PerPage=10&Query=" + upper;
            ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.GET, entity, Map.class);
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Object instObj = response.getBody().get("instruments");
                if (instObj instanceof List instruments) {
                    for (Object instItem : instruments) {
                        if (instItem instanceof Map inst) {
                            String id = (String) inst.get("id");
                            String code = (String) inst.get("symbol");
                            if (code == null) code = (String) inst.get("code");
                            if (id != null && code != null) {
                                String cleanCode = code.toUpperCase();
                                instrumentCache.put(id, cleanCode);
                                if (upper.equals(cleanCode)) {
                                    return id;
                                }
                            }
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.error("Failed to query fund ID for symbol: {}", symbol, e);
        }
        return null;
    }

    public boolean buy(Long customerId, String symbol, Double amount) {
        if (!isAuthenticated(customerId)) {
            log.warn("Cannot execute Sharesies buy: Customer {} is not authenticated.", customerId);
            return false;
        }
        String fundId = getFundIdForSymbol(customerId, symbol);
        if (fundId == null) {
            log.warn("Cannot execute Sharesies buy: Could not resolve fund ID for symbol {}", symbol);
            return false;
        }
        SharesiesSession session = getSession(customerId);
        try {
            HttpHeaders headers = createHeaders(customerId);
            Map<String, Object> body = new HashMap<>();
            body.put("action", "place");
            body.put("amount", amount);
            body.put("fund_id", fundId);
            body.put("expected_fee", amount * 0.005);
            body.put("acting_as_id", session.getUserId());

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);
            String url = session.getAppBaseUrl() + "/api/cart/immediate-buy-v2";
            ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.POST, entity, Map.class);
            if (response.getStatusCode().is2xxSuccessful()) {
                log.info("Sharesies BUY order placed successfully for customer {}: Symbol={}, Amount={}", customerId, symbol, amount);
                return true;
            }
            log.warn("Sharesies BUY order returned non-success status: {}", response.getStatusCode());
        } catch (Exception e) {
            log.error("Error executing Sharesies BUY order for customer {}: {}", customerId, e.getMessage(), e);
        }
        return false;
    }

    public boolean sell(Long customerId, String symbol, Double shares) {
        if (!isAuthenticated(customerId)) {
            log.warn("Cannot execute Sharesies sell: Customer {} is not authenticated.", customerId);
            return false;
        }
        String fundId = getFundIdForSymbol(customerId, symbol);
        if (fundId == null) {
            log.warn("Cannot execute Sharesies sell: Could not resolve fund ID for symbol {}", symbol);
            return false;
        }
        SharesiesSession session = getSession(customerId);
        try {
            HttpHeaders headers = createHeaders(customerId);
            Map<String, Object> body = new HashMap<>();
            body.put("shares", shares);
            body.put("fund_id", fundId);
            body.put("acting_as_id", session.getUserId());

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);
            String url = session.getAppBaseUrl() + "/api/fund/sell";
            ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.POST, entity, Map.class);
            if (response.getStatusCode().is2xxSuccessful()) {
                log.info("Sharesies SELL order placed successfully for customer {}: Symbol={}, Shares={}", customerId, symbol, shares);
                return true;
            }
            log.warn("Sharesies SELL order returned non-success status: {}", response.getStatusCode());
        } catch (Exception e) {
            log.error("Error executing Sharesies SELL order for customer {}: {}", customerId, e.getMessage(), e);
        }
        return false;
    }
}
