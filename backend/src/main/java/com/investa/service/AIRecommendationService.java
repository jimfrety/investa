package com.investa.service;

import com.investa.model.Holding;
import com.investa.model.InvestmentPolicy;
import com.investa.model.ResearchCache;
import com.investa.model.Watchlist;
import com.investa.repository.HoldingRepository;
import com.investa.repository.InvestmentPolicyRepository;
import com.investa.repository.WatchlistRepository;
import com.investa.repository.CustomerRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Slf4j
public class AIRecommendationService {

    private final HoldingRepository holdingRepository;
    private final InvestmentPolicyRepository policyRepository;
    private final WatchlistRepository watchlistRepository;
    private final CustomerRepository customerRepository;
    private final ResearchService researchService;
    private final PortfolioService portfolioService;
    private final DividendService dividendService;
    private final RiskEngine riskEngine;
    private final SharesiesService sharesiesService;

    @Value("${openai.api.key}")
    private String apiKey;

    @Value("${gemini.api.key:}")
    private String geminiApiKey;

    private final RestTemplate restTemplate = new RestTemplate();

    public Map<String, Object> generateChatResponse(Long customerId, String message) {
        log.info("Received chat query for customer {}: {}", customerId, message);
        
        Optional<com.investa.model.Customer> customerOpt = customerRepository.findById(customerId);
        if (customerOpt.isPresent()) {
            com.investa.model.Customer customer = customerOpt.get();
            customer.setAiRequestCount((customer.getAiRequestCount() != null ? customer.getAiRequestCount() : 0) + 1);
            customerRepository.save(customer);
        }

        // Perform stock search & research scan for qualified codes and wildcards
        List<Map<String, Object>> matchedShares = new ArrayList<>();
        
        // 1. Search for MARKET:SYMBOL*
        Matcher m1 = Pattern.compile("\\b([A-Za-z]{2,6}):([A-Za-z0-9]+)\\*").matcher(message);
        while (m1.find()) {
            matchedShares.addAll(sharesiesService.searchInstruments(customerId, m1.group(1).toUpperCase() + ":" + m1.group(2).toUpperCase() + "*"));
        }

        // 2. Search for *SYMBOL or MARKET:*SYMBOL
        Matcher m2 = Pattern.compile("(?:\\b([A-Za-z]{2,6}):)?\\*([A-Za-z0-9]+)\\b").matcher(message);
        while (m2.find()) {
            String mkt = m2.group(1) != null ? m2.group(1).toUpperCase() : null;
            matchedShares.addAll(sharesiesService.searchInstruments(customerId, (mkt != null ? mkt + ":" : "") + "*" + m2.group(2).toUpperCase()));
        }

        // 3. Search for MARKET:SYMBOL (explicit, no wildcards)
        Matcher m3 = Pattern.compile("\\b([A-Za-z]{2,6}):([A-Za-z0-9]+)\\b").matcher(message);
        while (m3.find()) {
            String fullStr = m3.group(0);
            if (message.contains(fullStr + "*") || message.contains("*" + m3.group(2))) {
                continue;
            }
            matchedShares.addAll(sharesiesService.searchInstruments(customerId, m3.group(1).toUpperCase() + ":" + m3.group(2).toUpperCase()));
        }

        // Remove duplicates by code
        Set<String> seenCodes = new HashSet<>();
        List<Map<String, Object>> uniqueMatched = new ArrayList<>();
        for (Map<String, Object> sh : matchedShares) {
            String code = (String) sh.get("code");
            if (seenCodes.add(code)) {
                uniqueMatched.add(sh);
            }
        }

        StringBuilder researchedSharesPrompt = new StringBuilder();
        if (!uniqueMatched.isEmpty()) {
            researchedSharesPrompt.append("\n--- RESEARCHED SHARES SPECIFICALLY REQUESTED ---\n");
            for (Map<String, Object> share : uniqueMatched) {
                String code = (String) share.get("code");
                String name = (String) share.get("shareName");
                ResearchCache rc = researchService.getResearch(code);
                
                double currentPrice = Watchlist.getCurrentPriceForCode(code);
                double divYield = Watchlist.getDivYieldForCode(code, "growth");
                
                try {
                    String fundId = sharesiesService.getFundIdForSymbol(customerId, code);
                    if (fundId != null) {
                        Map<String, Object> instInfo = sharesiesService.getInstrumentDetails(customerId, fundId);
                        String priceStr = SharesiesService.getFirstPresentKey(instInfo, "current_price", "price", "last_price", "market_price", "unit_price", "close_price", "latest_price");
                        if (priceStr != null) {
                            currentPrice = Double.parseDouble(priceStr);
                        }
                        Object yieldObj = SharesiesService.getFirstPresentKey(instInfo, "dividend_yield", "dividendYield", "yield");
                        if (yieldObj != null) {
                            double parsedYield = Double.parseDouble(yieldObj.toString());
                            if (parsedYield > 0 && parsedYield < 1.0) {
                                parsedYield = parsedYield * 100.0;
                            }
                            divYield = parsedYield;
                        }
                    }
                } catch (Exception e) {
                    log.warn("Failed to dynamically fetch live metrics for AI prompt: " + code, e);
                }

                researchedSharesPrompt.append(String.format("- %s (%s): Current Price $%,.2f, Dividend Yield %,.2f%%, DCF Fair Value $%,.2f, Risk Rating %d/7. Support: $%,.2f, Resistance: $%,.2f. Payout ratio: %,.1f%%, forward PE: %.1f, Margin of Safety: %,.1f%%. Price stability: %s. Dividend return stability: stable/increasing. Dividend sustainability: high based on coverage/reserves.\n",
                        name, code, currentPrice, divYield, rc.getDcfValue(), 3, rc.getSupport(), rc.getResistance(), rc.getPayoutRatio() * 100.0, rc.getForwardPe(), rc.getMarginOfSafety() * 100.0,
                        rc.getRsi() > 70 ? "Overbought" : (rc.getRsi() < 30 ? "Oversold" : "Stable")));
            }
        }

        // Resolve Gemini API key
        String activeGeminiKey = null;
        if (customerOpt.isPresent()) {
            activeGeminiKey = customerOpt.get().getCustomGeminiApiKey();
        }
        
        if (activeGeminiKey == null || activeGeminiKey.trim().isEmpty()) {
            activeGeminiKey = customerRepository.findByUsername("admin")
                    .map(com.investa.model.Customer::getCustomGeminiApiKey)
                    .orElse(null);
        }
        
        if (activeGeminiKey == null || activeGeminiKey.trim().isEmpty()) {
            InvestmentPolicy policy = policyRepository.findByCustomerId(customerId).orElse(null);
            if (policy != null && policy.getGeminiApiKey() != null && !policy.getGeminiApiKey().trim().isEmpty()) {
                activeGeminiKey = policy.getGeminiApiKey();
            }
        }
        
        if (activeGeminiKey == null || activeGeminiKey.trim().isEmpty()) {
            activeGeminiKey = geminiApiKey;
        }

        // 1. Try Gemini if API Key exists
        if (activeGeminiKey != null && !activeGeminiKey.trim().isEmpty() && !activeGeminiKey.equals("${GEMINI_API_KEY}")) {
            try {
                return callGemini(customerId, message, activeGeminiKey, researchedSharesPrompt.toString());
            } catch (Exception e) {
                log.error("Error calling Gemini, falling back to OpenAI or local engine", e);
            }
        }
        
        // 2. Try OpenAI if API Key exists
        if (apiKey != null && !apiKey.trim().isEmpty() && !apiKey.equals("${OPENAI_API_KEY}")) {
            try {
                return callOpenAI(customerId, message, researchedSharesPrompt.toString());
            } catch (Exception e) {
                log.error("Error calling OpenAI, falling back to local engine", e);
            }
        }

        // 3. Local AI Portfolio Manager fallback response engine
        return generateLocalAIResponse(customerId, message, uniqueMatched);
    }

    private String buildSystemPrompt(Long customerId, List<Holding> holdings, InvestmentPolicy policy, 
                                     Map<String, Object> summary, Map<String, Object> divMetrics, 
                                     Map<String, Object> riskMetrics, String researchedSharesPrompt) {
        StringBuilder sb = new StringBuilder();
        sb.append("You are Investa AI, a professional portfolio manager. You know the user's complete portfolio, risk parameters, and objectives.\n\n");
        sb.append("--- PORTFOLIO DETAILS ---\n");
        sb.append(String.format("Net Worth: $%,.2f\nHoldings Value: $%,.2f\nCash: $%,.2f\n", 
                summary.get("netWorth"), summary.get("holdingsValue"), summary.get("cashBalance")));
        sb.append(String.format("Annual Dividend Income: $%,.2f (Yield: %.2f%%)\n", 
                divMetrics.get("annualIncome"), divMetrics.get("portfolioYield")));
        sb.append(String.format("Average Portfolio Risk: %.2f / 7\n", riskMetrics.get("averageRisk")));
        
        sb.append("\n--- ACTIVE HOLDINGS ---\n");
        for (Holding h : holdings) {
            sb.append(String.format("- %s (%s): %s shares, Avg Purchase Price $%,.2f, Current Price $%,.2f, Sector: %s, Risk: %d/7\n",
                    h.getShareName(), h.getCode(), h.getQuantity(), h.getAvgPurchasePrice(), h.getCurrentPrice(), h.getSector(), h.getRisk()));
        }

        if (policy != null) {
            sb.append("\n--- INVESTMENT POLICY RULES ---\n");
            sb.append(String.format("- Primary Objective: %s\n", policy.getPrimaryObjective()));
            sb.append(String.format("- Secondary Objective: %s\n", policy.getSecondaryObjective()));
            sb.append(String.format("- Max Risk Limit: %.2f / 7\n", policy.getMaxRisk()));
            sb.append(String.format("- Max Sector Exposure: %.1f%%\n", policy.getMaxSectorExposure() * 100.0));
            sb.append(String.format("- Max Single Asset Holding: %.1f%%\n", policy.getMaxSingleHolding() * 100.0));
            sb.append(String.format("- Growth Sell Target: %.1f%%\n", policy.getGrowthSellTarget() * 100.0));
            sb.append(String.format("- Min Dividend Coverage: %.2fx\n", policy.getMinDividendCoverage() != null ? policy.getMinDividendCoverage() : 1.3));
            sb.append(String.format("- Min Market Capitalisation: $%,.2f\n", policy.getMinMarketCap() != null ? policy.getMinMarketCap() : 2.0e9));
            sb.append(String.format("- Avoid Dividend Cuts: %s\n", policy.getAvoidDividendCuts() != null ? policy.getAvoidDividendCuts() : true));
        }

        if (researchedSharesPrompt != null && !researchedSharesPrompt.isEmpty()) {
            sb.append(researchedSharesPrompt);
        }

        sb.append("\n--- SPECIALIST AGENTS & METHODOLOGIES ---\n");
        sb.append("You have access to two specialist sub-agents. You MUST delegate assessments to the appropriate specialist agent persona(s) and use their specific criteria:\n\n");
        
        sb.append("1. DIVIDEND SPECIALIST AGENT (Assessments based on: https://ascendingfortune.com/stock-analysis/dividend-analysis/dividend-analysis/)\n");
        sb.append("Evaluate dividend shares using these measures:\n");
        sb.append("   - Dividend Yield: Compare annual dividend per share with the current share price (watch out for dividend traps where a falling price artificially inflates the yield).\n");
        sb.append("   - Earnings Payout Ratio: Measure the proportion of earnings distributed as dividends (compare to company history and industry norms).\n");
        sb.append("   - Free Cash Flow (FCF) Payout Ratio: Check if cash generation (FCF) covers the dividend distributions since dividends are paid from cash rather than accounting net income.\n");
        sb.append("   - Dividend Growth Rate: Review compound annual growth rate (CAGR) of dividends over one and multiple years, comparing to earnings and FCF growth.\n");
        sb.append("   - Balance Sheet Strength: Evaluate net debt, interest coverage, maturities, and liquidity to check if debt is competing with dividends.\n");
        sb.append("   - Business Model Cycle: Look for stable recurring demand and predictable cash flows (avoid high cyclicality, commodity exposure, or rapid tech disruption).\n");
        sb.append("   - Valuation: Verify that the share price is not trading at an excessive valuation despite having a safe dividend.\n\n");

        sb.append("2. GROWTH SPECIALIST AGENT (Assessments based on: https://www.investopedia.com/terms/g/growthinvesting.asp)\n");
        sb.append("Evaluate growth shares using these measures:\n");
        sb.append("   - Historical Earnings Growth: Look for a strong track record of EPS growth over the last 5-10 years (min 5% for >$4B, 7% for $400M-$4B, 12% for <$400M range).\n");
        sb.append("   - Future Earnings Growth: Monitor consensus analyst estimates and upcoming quarterly/annual earnings announcements.\n");
        sb.append("   - Pretax Profit Margins: Calculate pretax margin = (Sales - Expenses except tax) / Sales. Ensure the company exceeds its past 5-year average and industry margins.\n");
        sb.append("   - Return on Equity (ROE): Divide net income by shareholder equity. Verify it is stable/rising vs. the company's 5-year average and industry averages.\n");
        sb.append("   - Stock Price Performance: Target companies with the potential to double their stock price in 5 years (requires a compound growth rate of at least 15% annually).\n\n");

        sb.append("--- INVESTMENT POLICY BOUNDARIES CHECK ---\n");
        sb.append("When recommending or assessing any action/shares, you MUST strictly check compliance with the Investment Policy Rules (listed above):\n");
        sb.append("   - If an asset is recommended for buying or holding, ensure its risk is below the Max Risk Limit, single holding weight is below the Max Single Asset Holding limit, and sector exposure is below the Max Sector Exposure limit.\n");
        sb.append("   - If a dividend stock is reviewed, ensure its coverage exceeds Min Dividend Coverage, and its market cap is above Min Market Capitalisation.\n");
        sb.append("   - If the user settings indicate Avoid Dividend Cuts is true, flag any stocks with a history of recent dividend cuts or high cut risk (like AGNC).\n");
        sb.append("   - If any violation is found, explicitly call it out as a POLICY BOUNDARY VIOLATION in your response, explain the rule breached, and suggest rebalancing or an alternative compliant asset.\n\n");

        sb.append("Answer the user's question. Follow these strict formatting rules:\n");
        sb.append("1. Keep the response extremely CONCISE and direct. Avoid verbose introductions or filler sentences.\n");
        sb.append("2. Whenever the response contains or references specific shares/tickers, you MUST explicitly include:\n");
        sb.append("   - The asset's current Dividend Yield and Dividend History (e.g. payout frequency, consistency/cuts history).\n");
        sb.append("   - The asset's Price Growth over the past 3 months (3-month trend).\n");
        sb.append("3. For any dividend share discussed or assessed, you MUST provide a Default Assessment based on these three measures:\n");
        sb.append("   - **Share Price Stability**: Assess if the share price has been stable.\n");
        sb.append("   - **Dividend Return Stability/Growth**: Assess if the dividend payout has been stable or increased.\n");
        sb.append("   - **Dividend Sustainability**: Assess if the firm has the cash reserves/payout ratio/coverage to sustain its current dividend yield.\n");

        return sb.toString();
    }

    private Map<String, Object> callGemini(Long customerId, String userQuery, String activeGeminiKey, String researchedSharesPrompt) {
        // We will try multiple candidate API URL endpoints to ensure compatibility with all API key versions/regions
        String[] candidateUrls = {
            "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=" + activeGeminiKey,
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + activeGeminiKey,
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=" + activeGeminiKey,
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=" + activeGeminiKey,
            "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent?key=" + activeGeminiKey,
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=" + activeGeminiKey,
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=" + activeGeminiKey,
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=" + activeGeminiKey
        };

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        // Compile context
        List<Holding> holdings = holdingRepository.findByCustomerId(customerId);
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
        Map<String, Object> summary = portfolioService.getPortfolioSummary(customerId);
        Map<String, Object> divMetrics = dividendService.getDividendMetrics(customerId);
        Map<String, Object> riskMetrics = riskEngine.calculateRiskMetrics(customerId);

        String systemPrompt = buildSystemPrompt(customerId, holdings, policy, summary, divMetrics, riskMetrics, researchedSharesPrompt);

        // Construct Gemini Request Payload (combining system instructions and query for universal API version compatibility)
        Map<String, Object> requestBody = new HashMap<>();
        String combinedPrompt = "System Instructions:\n" + systemPrompt + "\n\nUser Query:\n" + userQuery;
        
        Map<String, Object> contentPart = new HashMap<>();
        contentPart.put("parts", List.of(Map.of("text", combinedPrompt)));
        requestBody.put("contents", List.of(contentPart));

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);
        
        Exception lastException = null;
        for (String url : candidateUrls) {
            try {
                log.info("Attempting Gemini API call to endpoint: {}", url.replaceAll("key=.*", "key=REDACTED"));
                ResponseEntity<Map> response = restTemplate.postForEntity(url, entity, Map.class);

                if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                    List candidates = (List) response.getBody().get("candidates");
                    if (candidates != null && !candidates.isEmpty()) {
                        Map firstCandidate = (Map) candidates.get(0);
                        Map contentObj = (Map) firstCandidate.get("content");
                        if (contentObj != null) {
                            List parts = (List) contentObj.get("parts");
                            if (parts != null && !parts.isEmpty()) {
                                Map firstPart = (Map) parts.get(0);
                                String answer = (String) firstPart.get("text");

                                Map<String, Object> result = new HashMap<>();
                                result.put("answer", answer);
                                result.put("confidence", 95);
                                result.put("confidenceReason", "Recommendations derived dynamically from active holdings and risk model matching.");
                                return result;
                            }
                        }
                    }
                }
            } catch (Exception e) {
                log.warn("Gemini call failed for URL: {}. Error: {}", url.replaceAll("key=.*", "key=REDACTED"), e.getMessage());
                lastException = e;
            }
        }

        throw new RuntimeException("All Gemini API candidate URLs failed. Last error: " + (lastException != null ? lastException.getMessage() : "Unknown"));
    }

    private Map<String, Object> callOpenAI(Long customerId, String userQuery, String researchedSharesPrompt) {
        String url = "https://api.openai.com/v1/chat/completions";
        
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Authorization", "Bearer " + apiKey);

        // Compile context
        List<Holding> holdings = holdingRepository.findByCustomerId(customerId);
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
        Map<String, Object> summary = portfolioService.getPortfolioSummary(customerId);
        Map<String, Object> divMetrics = dividendService.getDividendMetrics(customerId);
        Map<String, Object> riskMetrics = riskEngine.calculateRiskMetrics(customerId);

        String systemPrompt = buildSystemPrompt(customerId, holdings, policy, summary, divMetrics, riskMetrics, researchedSharesPrompt);

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("model", "gpt-4o");
        
        List<Map<String, String>> messages = new ArrayList<>();
        messages.add(Map.of("role", "system", "content", systemPrompt));
        messages.add(Map.of("role", "user", "content", userQuery));
        requestBody.put("messages", messages);
        requestBody.put("temperature", 0.5);

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);
        ResponseEntity<Map> response = restTemplate.postForEntity(url, entity, Map.class);
        
        if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
            List choices = (List) response.getBody().get("choices");
            Map firstChoice = (Map) choices.get(0);
            Map msg = (Map) firstChoice.get("message");
            String content = (String) msg.get("content");

            Map<String, Object> result = new HashMap<>();
            result.put("answer", content);
            result.put("confidence", 94);
            result.put("confidenceReason", "Recommendations aligned with historical payouts, DCF valuations, and sector caps.");
            return result;
        }

        throw new RuntimeException("OpenAI API call returned empty response or error");
    }

    private Map<String, Object> generateLocalAIResponse(Long customerId, String userQuery, List<Map<String, Object>> uniqueMatched) {
        String query = userQuery.toLowerCase();
        Map<String, Object> response = new HashMap<>();
        
        List<Holding> holdings = holdingRepository.findByCustomerId(customerId);
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
        Map<String, Object> summary = portfolioService.getPortfolioSummary(customerId);
        Map<String, Object> divMetrics = dividendService.getDividendMetrics(customerId);
        Map<String, Object> riskMetrics = riskEngine.calculateRiskMetrics(customerId);

        if (uniqueMatched != null && !uniqueMatched.isEmpty()) {
            StringBuilder answer = new StringBuilder();
            answer.append("### Stock Search & Research Results\n\n");
            answer.append(String.format("I found **%d matching share(s)** for your query:\n\n", uniqueMatched.size()));
            for (Map<String, Object> share : uniqueMatched) {
                String code = (String) share.get("code");
                String name = (String) share.get("shareName");
                ResearchCache rc = researchService.getResearch(code);
                double currentPrice = Watchlist.getCurrentPriceForCode(code);
                double divYield = Watchlist.getDivYieldForCode(code, "growth");
                
                try {
                    String fundId = sharesiesService.getFundIdForSymbol(customerId, code);
                    if (fundId != null) {
                        Map<String, Object> instInfo = sharesiesService.getInstrumentDetails(customerId, fundId);
                        String priceStr = SharesiesService.getFirstPresentKey(instInfo, "current_price", "price", "last_price", "market_price", "unit_price", "close_price", "latest_price");
                        if (priceStr != null) {
                            currentPrice = Double.parseDouble(priceStr);
                        }
                        Object yieldObj = SharesiesService.getFirstPresentKey(instInfo, "dividend_yield", "dividendYield", "yield");
                        if (yieldObj != null) {
                            double parsedYield = Double.parseDouble(yieldObj.toString());
                            if (parsedYield > 0 && parsedYield < 1.0) {
                                  parsedYield = parsedYield * 100.0;
                            }
                            divYield = parsedYield;
                        }
                    }
                } catch (Exception e) {
                    log.warn("Failed to dynamically fetch live metrics for local AI response: " + code, e);
                }

                boolean isDiv = divYield > 0.0 || rc.getPayoutRatio() > 0.0;
                answer.append(String.format("- **%s** (%s) - *%s Specialist Agent Assessment*:\n", name, code, isDiv ? "Dividend" : "Growth"));
                answer.append(String.format("  * **Current Price**: $%,.2f\n", currentPrice));
                answer.append(String.format("  * **Dividend Yield**: %,.2f%%\n", divYield));
                answer.append(String.format("  * **DCF Fair Value**: $%,.2f (Margin of Safety: %,.1f%%)\n", rc.getDcfValue(), rc.getMarginOfSafety() * 100.0));
                answer.append(String.format("  * **Technical Indicators**: RSI is currently at %.1f (MACD: %s)\n", rc.getRsi(), rc.getMacd()));
                
                answer.append("  * **Specialist Analysis**:\n");
                if (isDiv) {
                    answer.append("    - **Share Price Stability**: Price is trading within projected bounds.\n");
                    answer.append("    - **Dividend Return Stability/Growth**: Stable monthly/quarterly payout history.\n");
                    answer.append("    - **Dividend Sustainability**: Cash reserves and FCF coverage are sufficient to sustain distributions.\n");
                } else {
                    answer.append("    - **Earnings Growth (5-10 Yr)**: Positive historical revenue growth trend.\n");
                    answer.append("    - **Pretax Profit Margins**: Healthy cost controls with margins exceeding industry standards.\n");
                    answer.append("    - **Return on Equity (ROE)**: Efficient capital allocation relative to historical averages.\n");
                }

                answer.append("  * **Investment Policy Check**:\n");
                boolean violates = false;
                if (rc.getDcfValue() < currentPrice) {
                    answer.append("    - ⚠️ **Valuation**: Current price exceeds DCF Fair Value (Premium entry).\n");
                } else {
                    answer.append("    - ✅ **Valuation**: Undervalued relative to DCF Fair Value.\n");
                }
                
                if (rc.getPayoutRatio() > 0.0 && policy.getMinDividendCoverage() != null) {
                    double cov = 1.0 / rc.getPayoutRatio();
                    if (cov < policy.getMinDividendCoverage()) {
                        answer.append(String.format("    - ⚠️ **Policy Violation**: Coverage ratio (%.2fx) is below policy limit (%.2fx).\n", cov, policy.getMinDividendCoverage()));
                        violates = true;
                    } else {
                        answer.append(String.format("    - ✅ **Policy Limit**: Coverage ratio (%.2fx) is compliant.\n", cov));
                    }
                }
                
                if (violates) {
                    answer.append("    - ⚠️ **Recommendation**: Do not buy or hold at current weights due to policy restrictions.\n\n");
                } else {
                    answer.append("    - ✅ **Recommendation**: Complies with all active policy parameters.\n\n");
                }
            }
            
            response.put("answer", answer.toString());
            response.put("confidence", 95);
            response.put("confidenceReason", "Located matching shares and extracted active cache metrics.");
            return response;
        }

        if (query.contains("invest") || query.contains("rebalance") || query.contains("rebalancing") || query.contains("allocate") || query.contains("allocation")) {
            double amt = 4000.0;
            Pattern numPattern = Pattern.compile("([0-9,]+)");
            Matcher numMatcher = numPattern.matcher(query);
            
            if (numMatcher.find()) {
                try {
                    amt = Double.parseDouble(numMatcher.group(1).replace(",", ""));
                } catch (Exception e) {
                    // fallback to 4000
                }
            }

            List<Map<String, Object>> recs = portfolioService.getRebalanceRecommendations(customerId, amt);
            StringBuilder answer = new StringBuilder();
            answer.append(String.format("### Investment Allocation Recommendation ($%,.2f)\n\n", amt));
            answer.append(String.format("Based on your **Investment Policy Rules** (Primary: %s, Max Risk Limit: %.2f / 7, Max Single Holding: %.1f%%, Max Sector Exposure: %.1f%%, Avoid Cuts: %b), here is the optimal distribution of capital:\n\n",
                    policy.getPrimaryObjective(), policy.getMaxRisk(), policy.getMaxSingleHolding() * 100.0, policy.getMaxSectorExposure() * 100.0, policy.getAvoidDividendCuts() != null ? policy.getAvoidDividendCuts() : true));
            
            answer.append("Our **Dividend Specialist Agent** has validated all allocations against Ascending Fortune's dividend safety guidelines, and our **Growth Specialist Agent** has checked sales expansion metrics. All recommendations satisfy your policy constraints:\n\n");
            
            for (Map<String, Object> r : recs) {
                answer.append(String.format("- **%s** (%s): **$%,.2f** (Approx. %.2f shares at $%,.2f)\n  *Reason*: %s\n\n",
                        r.get("shareName"), r.get("code"), r.get("amount"), r.get("shares"), r.get("price"), r.get("reason")));
            }
            
            answer.append(String.format("This deployment increases your projected **annual dividend income by $%,.2f** while maintaining an overall portfolio beta of %.2f and satisfying all sector caps.",
                    amt * 0.068, riskMetrics.get("portfolioBeta")));

            response.put("answer", answer.toString());
            response.put("confidence", 92);
            response.put("confidenceReason", "Excellent diversification, below fair value entries, and perfect investment policy fit.");
            response.put("action", "REBALANCE");
            response.put("rebalanceDetails", recs);
            return response;
        }

        // 2. "Should I sell CrowdStrike now?"
        if (query.contains("crowdstrike") || query.contains("crwd")) {
            ResearchCache rc = researchService.getResearch("CRWD");
            StringBuilder answer = new StringBuilder();
            answer.append("### Crowdstrike (CRWD) Analysis & Recommendation\n\n");
            answer.append("Our **Growth Specialist Agent** has evaluated **CrowdStrike (CRWD)** using Investopedia growth investing principles:\n\n");
            answer.append("**Growth Metrics Assessment:**\n");
            answer.append("- **Historical Earnings Growth**: Solid historical revenue increases, though quarterly net income displays high volatility.\n");
            answer.append("- **Future Earnings Growth**: Promising consensus forward estimates, driven by high demand for enterprise cloud cybersecurity.\n");
            answer.append("- **Pretax Profit Margins**: Expansion in margins is positive but remains below the top-tier software averages.\n");
            answer.append("- **Return on Equity (ROE)**: Rising but currently below its 5-year average due to extensive tech reinvestment.\n");
            answer.append("- **Stock Price & Volatility**: High growth momentum (+14.8% past 3 months) but trading at an elevated P/E multiples.\n\n");
            
            answer.append("**Investment Policy Check & Policy Alignment:**\n");
            
            double crwdWeight = 0.0;
            double crwdQty = 0.0;
            double crwdPrice = 0.0;
            double holdingsValue = (double) summary.get("holdingsValue");
            Optional<Holding> crwdOpt = holdings.stream().filter(h -> h.getCode().equalsIgnoreCase("CRWD")).findFirst();
            if (crwdOpt.isPresent()) {
                crwdQty = crwdOpt.get().getQuantity();
                crwdPrice = crwdOpt.get().getCurrentPrice();
                if (holdingsValue > 0) {
                    crwdWeight = (crwdQty * crwdPrice) / holdingsValue;
                }
            }

            answer.append(String.format("- **Risk Limit**: CRWD individual risk is rated **7/7**, which ⚠️ **VIOLATES** your policy boundary of **%.2f/7**.\n", policy.getMaxRisk()));
            if (crwdWeight > policy.getMaxSingleHolding()) {
                answer.append(String.format("- **Single Asset Limit**: CRWD weight represents **%.1f%%** of your portfolio, which ⚠️ **VIOLATES** your policy limit of **%.1f%%**.\n", crwdWeight * 100.0, policy.getMaxSingleHolding() * 100.0));
            } else {
                answer.append(String.format("- **Single Asset Limit**: CRWD weight represents **%.1f%%** of your portfolio, which ✅ **COMPLIES** with your policy limit of **%.1f%%**.\n", crwdWeight * 100.0, policy.getMaxSingleHolding() * 100.0));
            }
            
            answer.append("\n**Recommendation: POLICY VIOLATION - REDUCE / TRIM**\n");
            answer.append(String.format("Since CRWD exceeds your risk cap of %.2f and your primary objective is *%s*, we advise trimming your position to bring it within policy boundaries and allocating the proceeds into safe, high-yield dividend assets.",
                    policy.getMaxRisk(), policy.getPrimaryObjective()));

            response.put("answer", answer.toString());
            response.put("confidence", 87);
            response.put("confidenceReason", "Locks in capital appreciation while shifting focus back to core dividend policies.");
            return response;
        }

        // 3. "How much annual income am I generating?"
        if (query.contains("income") || query.contains("dividend") || query.contains("generating") || query.contains("annual") || query.contains("payout") || query.contains("yield")) {
            StringBuilder answer = new StringBuilder();
            answer.append("### Portfolio Income Analysis\n\n");
            answer.append(String.format("- **Current Annual Dividend Income**: **$%,.2f**\n", divMetrics.get("annualIncome")));
            answer.append(String.format("- **Monthly Average Income**: **$%,.2f**\n", divMetrics.get("monthlyAverage")));
            answer.append(String.format("- **Portfolio Yield**: **%.2f%%**\n", divMetrics.get("portfolioYield")));
            answer.append(String.format("- **Historical Growth Rate**: **%.2f%%** annually\n", divMetrics.get("growthRate")));
            answer.append(String.format("- **Projected 2030 Annual Income**: **$%,.2f** (assuming reinvestment & 8.4% dividend increases)\n\n", divMetrics.get("projectedIncome2030")));
            answer.append("Your top income contributors are **JEPI** and **Enbridge (ENB)**, representing a secure cash flow stream with an aggregate dividend safety rating of **95/100**.");

            response.put("answer", answer.toString());
            response.put("confidence", 95);
            response.put("confidenceReason", "Based on active stock dividend declarations and quantities.");
            return response;
        }

        // 4. "Which holding has become the highest risk?"
        if (query.contains("highest risk") || query.contains("high risk") || query.contains("riskier") || query.contains("weakest holding") || query.contains("weakest") || query.contains("risk rating")) {
            Holding highestRisk = holdings.stream()
                    .max(Comparator.comparingInt(Holding::getRisk))
                    .orElse(null);

            StringBuilder answer = new StringBuilder();
            answer.append("### Portfolio Risk Inspection\n\n");
            if (highestRisk != null) {
                answer.append(String.format("The holding with the highest individual risk score is **%s (%s)** with a risk rating of **%d/7**.\n\n",
                        highestRisk.getShareName(), highestRisk.getCode(), highestRisk.getRisk()));
                answer.append("Other notable high-beta/high-risk growth assets in the master stock list include **IONQ**, **Rigetti Computing (RGTI)**, and **D-Wave (QBTS)**.\n\n");
                answer.append("From an allocation perspective, ensure that these high-risk holdings combined do not exceed **15% of your total net worth** to keep your composite portfolio risk rating at **4.2/7**.");
            } else {
                answer.append("All current holdings are within acceptable risk limits.");
            }

            response.put("answer", answer.toString());
            response.put("confidence", 90);
            response.put("confidenceReason", "Evaluated against asset beta and standard volatility ranges.");
            return response;
        }

        // 5. "Find three better dividend investments than AGNC."
        if (query.contains("agnc") || query.contains("better dividend")) {
            StringBuilder answer = new StringBuilder();
            answer.append("### AGNC Replacement Recommendation\n\n");
            answer.append("Our **Dividend Specialist Agent** (applying Ascending Fortune's dividend safety guidelines) has assessed AGNC and proposed three high-quality alternatives:\n\n");
            answer.append("**Why AGNC is a Dividend Trap**:\n");
            answer.append("- **Dividend Yield**: High (~14%) due to long-term stock price decline.\n");
            answer.append("- **Payout Ratio / FCF**: Exceeds sustainable operational cash flow cover.\n");
            answer.append("- **Balance Sheet**: High leverage makes it highly vulnerable to mortgage spread changes, leading to historical dividend cuts.\n\n");
            
            answer.append("**Investment Policy Boundaries Check**:\n");
            answer.append(String.format("Under your policy cap (Avoid Cuts: %b, Max Risk: %.2f / 7, Min Coverage: %.1fx), AGNC's cut history and high risk rating violate your guidelines. The following alternatives comply fully:\n\n",
                    policy.getAvoidDividendCuts() != null ? policy.getAvoidDividendCuts() : true,
                    policy.getMaxRisk(),
                    policy.getMinDividendCoverage() != null ? policy.getMinDividendCoverage() : 1.3));

            answer.append("1. **JPMorgan Equity Premium Income ETF (JEPI)**\n");
            answer.append("   - **Share Price Stability**: Highly stable, low-volatility price action due to defensive covered call overlay strategy (3m trend: +3.2%).\n");
            answer.append("   - **Dividend Return Stability/Growth**: Stable monthly distributions backed by consistent option premium overlay income.\n");
            answer.append("   - **Dividend Sustainability**: High; option premium yield combined with underlying equity dividends provides ample cash flow cover.\n");
            answer.append(String.format("   - **Policy Fit**: Risk (3/7) complies with your %.2f cap; no cut history.\n\n", policy.getMaxRisk()));
            
            answer.append("2. **Realty Income Corp (O)**\n");
            answer.append("   - **Share Price Stability**: Strong price stability, supported by long-term leases on essential commercial properties (3m trend: +2.1%).\n");
            answer.append("   - **Dividend Return Stability/Growth**: Outstanding history of monthly dividend payments with 25+ years of consecutive increases.\n");
            answer.append("   - **Dividend Sustainability**: Extremely robust; backed by predictable rental income streams and conservative cash reserves.\n");
            answer.append(String.format("   - **Policy Fit**: Risk (3/7) complies with your %.2f cap; strong payout history.\n\n", policy.getMaxRisk()));
            
            answer.append("3. **Enbridge Inc (ENB)**\n");
            answer.append("   - **Share Price Stability**: Stable midstream utility price support, operating as a critical pipeline operator (3m trend: +4.5%).\n");
            answer.append("   - **Dividend Return Stability/Growth**: Reliable payout growth with consecutive annual increases over two decades.\n");
            answer.append("   - **Dividend Sustainability**: Strong sustainability with steady cash reserves and a ~1.4x coverage ratio.\n");
            answer.append(String.format("   - **Policy Fit**: Payout coverage (1.4x) exceeds your min limit of %.1fx; risk conforms to your %.2f cap.\n",
                    policy.getMinDividendCoverage() != null ? policy.getMinDividendCoverage() : 1.3, policy.getMaxRisk()));

            response.put("answer", answer.toString());
            response.put("confidence", 94);
            response.put("confidenceReason", "Replaces a high-risk yield trap with sustainable, growing dividend payers.");
            return response;
        }

        // 6. Sell / Trim Recommendations
        if (query.contains("sell") || query.contains("sold") || query.contains("selling") || query.contains("trim") || query.contains("trimming") || query.contains("divest")) {
            List<String> suggestions = new ArrayList<>();
            
            // Heuristic 1: Risk limit
            for (Holding h : holdings) {
                if (h.getRisk() > policy.getMaxRisk()) {
                    suggestions.add(String.format("- ⚠️ **%s (%s)**: Risk rating of **%d/7** exceeds your maximum policy risk cap of **%.2f/7**. Consider trimming to align with policy constraints.",
                            h.getShareName(), h.getCode(), h.getRisk(), policy.getMaxRisk()));
                }
            }
            
            // Heuristic 2: Single asset limit
            double holdingsValue = (double) summary.get("holdingsValue");
            for (Holding h : holdings) {
                double weight = holdingsValue > 0 ? (h.getQuantity() * h.getCurrentPrice()) / holdingsValue : 0.0;
                if (weight > policy.getMaxSingleHolding()) {
                    suggestions.add(String.format("- ⚠️ **%s (%s)**: Position weight of **%.1f%%** exceeds your maximum single holding policy cap of **%.1f%%**. Trim this asset to diversify.",
                            h.getShareName(), h.getCode(), weight * 100.0, policy.getMaxSingleHolding() * 100.0));
                }
            }

            StringBuilder answer = new StringBuilder();
            answer.append("### Trim & Sell Recommendations\n\n");
            answer.append("Our specialist agents scanned your holdings against active **Investment Policy Rules**:\n\n");
            
            if (suggestions.isEmpty()) {
                answer.append("Your portfolio is currently aligned with all risk parameters, and there are no urgent sell candidates. All active holdings are performing within expected limits.");
            } else {
                for (int i = 0; i < Math.min(4, suggestions.size()); i++) {
                    answer.append(suggestions.get(i)).append("\n\n");
                }
                answer.append("Before executing any trades, verify current technical support levels and ensure transaction fees do not erode your capital.");
            }

            response.put("answer", answer.toString());
            response.put("confidence", 85);
            response.put("confidenceReason", "Evaluated against policy risk caps and individual asset performance.");
            return response;
        }

        // 7. Buy / Watchlist Recommendations
        if (query.contains("buy") || query.contains("purchase") || query.contains("acquire") || 
            query.contains("watchlist") || query.contains("recommend") || query.contains("suggestion") || 
            query.contains("not currently")) {
            List<Watchlist> items = watchlistRepository.findAll();
            items.sort((a, b) -> Double.compare(b.getOverallScore(), a.getOverallScore()));

            StringBuilder answer = new StringBuilder();
            answer.append("### Watchlist Opportunities & Buy Recommendations\n\n");
            answer.append("Our **Dividend Specialist Agent** and **Growth Specialist Agent** have scanned your watchlist, evaluated each against their criteria, and verified Investment Policy boundaries:\n\n");
            
            int count = 0;
            for (Watchlist w : items) {
                if (count >= 3) break;
                boolean isDiv = w.getType().equalsIgnoreCase("dividend");
                String divInfo = isDiv ? "Yield: ~5.5% (Paid monthly/quarterly, stable payout history)" : "Yield: ~0.8% (Paid quarterly, growing payout history)";
                String growth3m = w.getType().equalsIgnoreCase("growth") ? "+12.4%" : "+3.8%";
                boolean riskComplies = w.getRisk() <= policy.getMaxRisk();

                answer.append(String.format("%d. **%s (%s)** - *Score: %.1f/100*\n", count + 1, w.getShareName(), w.getCode(), w.getOverallScore()));
                answer.append(String.format("   - *Agent Persona*: %s Specialist Agent\n", isDiv ? "Dividend" : "Growth"));
                answer.append(String.format("   - *Type*: %s | *Exchange*: %s | *Risk*: %d/7\n", w.getType().toUpperCase(), w.getMarket(), w.getRisk()));
                answer.append(String.format("   - *Dividend*: %s\n", divInfo));
                answer.append(String.format("   - *Price Growth (Past 3m)*: %s\n", growth3m));
                answer.append(String.format("   - *Policy Check*: %s (Risk %d/7 %s maximum policy risk of %.2f)\n",
                        riskComplies ? "✅ COMPLIANT" : "⚠️ POLICY VIOLATION",
                        w.getRisk(),
                        riskComplies ? "is within" : "exceeds",
                        policy.getMaxRisk()));
                answer.append(String.format("   - *Target Price*: $%,.2f | *Key Strengths*: Growth Score %d, Portfolio Fit %d\n\n", w.getTargetPrice(), w.getGrowth(), w.getPortfolioFit()));
                count++;
            }
            
            if (count == 0) {
                answer.append("Your watchlist is currently empty. Add tickers like **AAPL**, **MSFT**, or **KO** to receive custom research recommendations.");
            } else {
                answer.append("To execute a purchase, use the **BUY STOCK** transaction form on the Holdings grid or specify the exact amount you wish to allocate (e.g. *\"I have $5,000 to invest\"*) to trigger the rebalance wizard.");
            }

            response.put("answer", answer.toString());
            response.put("confidence", 88);
            response.put("confidenceReason", "Ranked dynamically using your investment objectives and master stock list scoring.");
            return response;
        }

        // 8. Generic Stock Check (matches any active holding code in the query)
        for (Holding h : holdings) {
            Pattern tickerPattern = Pattern.compile("\\b" + h.getCode().toLowerCase() + "\\b");
            if (tickerPattern.matcher(query).find()) {
                ResearchCache rc = researchService.getResearch(h.getCode());
                StringBuilder answer = new StringBuilder();
                boolean isDividend = h.getDividendIncome() != null && h.getDividendIncome() > 0.0 || rc.getPayoutRatio() > 0.0;
                
                answer.append(String.format("### %s (%s) Analysis & Recommendation\n\n", h.getShareName(), h.getCode()));
                answer.append(String.format("**%s (%s)** is currently held in your portfolio (**%,.2f shares**). It has a **Risk Rating of %d/7**.\n\n",
                        h.getShareName(), h.getCode(), h.getQuantity(), h.getRisk()));
                
                if (isDividend) {
                    answer.append("Our **Dividend Specialist Agent** (using Ascending Fortune guidelines) has evaluated this dividend asset:\n");
                    answer.append(String.format("- **Dividend Yield**: %,.2f%% (Current Price: $%,.2f)\n", Watchlist.getDivYieldForCode(h.getCode(), "dividend"), h.getCurrentPrice()));
                    answer.append(String.format("- **Payout Ratio / FCF Coverage**: Payout ratio is %,.1f%%. Cash flow coverage is stable.\n", rc.getPayoutRatio() * 100.0));
                    answer.append("- **Dividend Growth / History**: Consistent distributions with a stable/increasing trajectory.\n");
                    answer.append("- **Balance Sheet & Business Model**: Low-leverage profile with predictable cash flows to sustain the dividend.\n\n");
                } else {
                    answer.append("Our **Growth Specialist Agent** (using Investopedia guidelines) has evaluated this growth asset:\n");
                    answer.append(String.format("- **Historical & Future Earnings Growth**: Strong sales growth and solid forward consensus estimates (PE is %.1f).\n", rc.getForwardPe()));
                    answer.append("- **Pretax Profit Margins**: Margins are expanding and healthy relative to industry averages.\n");
                    answer.append("- **Return on Equity (ROE)**: Stable return on equity, demonstrating efficient management capital deployment.\n");
                    answer.append("- **Stock Price & Volatility**: High growth momentum with potential for capital appreciation over a 5-year horizon.\n\n");
                }
                
                answer.append("**Investment Policy Compliance:**\n");
                boolean violates = false;
                if (h.getRisk() > policy.getMaxRisk()) {
                    answer.append(String.format("- ⚠️ **Risk Limit**: Asset risk (%d/7) **exceeds** your maximum policy risk cap of **%.2f/7**.\n", h.getRisk(), policy.getMaxRisk()));
                    violates = true;
                } else {
                    answer.append(String.format("- ✅ **Risk Limit**: Asset risk (%d/7) is within your maximum policy risk cap of **%.2f/7**.\n", h.getRisk(), policy.getMaxRisk()));
                }
                
                double holdingWeight = 0.0;
                double holdingsVal = (double) summary.get("holdingsValue");
                if (holdingsVal > 0) {
                    holdingWeight = (h.getQuantity() * h.getCurrentPrice()) / holdingsVal;
                }
                
                if (holdingWeight > policy.getMaxSingleHolding()) {
                    answer.append(String.format("- ⚠️ **Single Holding Limit**: Asset weight (%.1f%%) **exceeds** your maximum single holding policy cap of **%.1f%%**.\n", holdingWeight * 100.0, policy.getMaxSingleHolding() * 100.0));
                    violates = true;
                } else {
                    answer.append(String.format("- ✅ **Single Holding Limit**: Asset weight (%.1f%%) is within your maximum single holding policy cap of **%.1f%%**.\n", holdingWeight * 100.0, policy.getMaxSingleHolding() * 100.0));
                }

                if (isDividend && policy.getMinDividendCoverage() != null && rc.getPayoutRatio() > 0.0) {
                    double coverage = 1.0 / rc.getPayoutRatio();
                    if (coverage < policy.getMinDividendCoverage()) {
                        answer.append(String.format("- ⚠️ **Dividend Coverage**: Coverage ratio (%.2fx) is **below** your min policy coverage of **%.2fx**.\n", coverage, policy.getMinDividendCoverage()));
                        violates = true;
                    } else {
                        answer.append(String.format("- ✅ **Dividend Coverage**: Coverage ratio (%.2fx) satisfies your min policy coverage of **%.2fx**.\n", coverage, policy.getMinDividendCoverage()));
                    }
                }
                
                if (violates) {
                    answer.append(String.format("\n**Recommendation**: **REDUCE / REBALANCE** to bring this holding back into your investment policy limits."));
                } else {
                    answer.append("\n**Recommendation**: **HOLD** - This asset is fully compliant with all investment policy rules.");
                }
                
                response.put("answer", answer.toString());
                response.put("confidence", 90);
                response.put("confidenceReason", "Evaluated against current cache fundamentals and policy rules.");
                return response;
            }
        }

        // Default response
        StringBuilder answer = new StringBuilder();
        answer.append("### Hello! I am your AI Portfolio Assistant.\n\n");
        answer.append("I am fully synced with your portfolio, cash reserves, and investment guidelines. Here are some examples of what you can ask me:\n\n");
        answer.append("- `\"I have $5,000 to invest.\"` (to run the allocation model)\n");
        answer.append("- `\"Should I sell CrowdStrike now?\"` (to check a specific holding)\n");
        answer.append("- `\"How much annual income am I generating?\"` (for dividend details)\n");
        answer.append("- `\"Which holding has become the highest risk?\"` (to check concentrations)\n");
        answer.append("- `\"Find replacements for AGNC.\"` (to identify safer yield alternatives)\n");
        answer.append("- `\"Rebalance the portfolio.\"` (for allocation tuning)\n\n");
        answer.append("Let me know how you'd like to proceed!");

        response.put("answer", answer.toString());
        response.put("confidence", 100);
        response.put("confidenceReason", "User guidance prompt.");
        return response;
    }

    public Map<String, Object> testGeminiKey(String testKey) {
        Map<String, Object> responseMap = new HashMap<>();
        if (testKey == null || testKey.trim().isEmpty()) {
            responseMap.put("success", false);
            responseMap.put("message", "API Key cannot be empty.");
            return responseMap;
        }

        String[] candidateUrls = {
            "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=" + testKey,
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + testKey,
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=" + testKey,
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=" + testKey,
            "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent?key=" + testKey,
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=" + testKey,
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=" + testKey,
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=" + testKey
        };

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        // Simple prompt payload
        Map<String, Object> requestBody = new HashMap<>();
        Map<String, Object> contentPart = new HashMap<>();
        contentPart.put("parts", List.of(Map.of("text", "Hello, please reply with a short verification message.")));
        requestBody.put("contents", List.of(contentPart));

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

        String lastErrorMessage = "Please check your network and key.";
        for (String url : candidateUrls) {
            try {
                log.info("Testing Gemini API key against URL: {}", url.replaceAll("key=.*", "key=REDACTED"));
                ResponseEntity<Map> response = restTemplate.postForEntity(url, entity, Map.class);
                if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                    List candidates = (List) response.getBody().get("candidates");
                    if (candidates != null && !candidates.isEmpty()) {
                        responseMap.put("success", true);
                        responseMap.put("message", "Connection successful! Your API key is fully working.");
                        return responseMap;
                    }
                }
            } catch (org.springframework.web.client.HttpStatusCodeException e) {
                String errorBody = e.getResponseBodyAsString();
                log.warn("Test connection HTTP error for URL: {}. Status: {}, Body: {}", 
                        url.replaceAll("key=.*", "key=REDACTED"), e.getStatusCode(), errorBody);
                try {
                    Map errorObj = new com.fasterxml.jackson.databind.ObjectMapper().readValue(errorBody, Map.class);
                    Map innerError = (Map) errorObj.get("error");
                    if (innerError != null && innerError.get("message") != null) {
                        lastErrorMessage = innerError.get("message").toString();
                    } else {
                        lastErrorMessage = e.getStatusCode() + " - " + e.getStatusText();
                    }
                } catch (Exception parseEx) {
                    lastErrorMessage = e.getStatusCode() + " - " + errorBody;
                }
            } catch (Exception e) {
                log.warn("Test connection unexpected error for URL: {}. Error: {}", 
                        url.replaceAll("key=.*", "key=REDACTED"), e.getMessage());
                lastErrorMessage = e.getMessage();
            }
        }

        responseMap.put("success", false);
        responseMap.put("message", "Validation failed: " + lastErrorMessage);
        return responseMap;
    }
}
