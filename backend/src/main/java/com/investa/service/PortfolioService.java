package com.investa.service;

import com.investa.model.Holding;
import com.investa.model.InvestmentPolicy;
import com.investa.model.Transaction;
import com.investa.model.Watchlist;
import com.investa.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class PortfolioService {

    private final HoldingRepository holdingRepository;
    private final TransactionRepository transactionRepository;
    private final InvestmentPolicyRepository policyRepository;
    private final WatchlistRepository watchlistRepository;
    private final CurrencyService currencyService;
    private final SharesiesService sharesiesService;

    public Map<String, Object> getPortfolioSummary(Long customerId) {
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

        double totalHoldingsValue = 0.0;
        double totalCostBasis = 0.0;
        double totalUnrealisedGain = 0.0;
        double totalRealisedGain = 0.0;
        double totalDividendIncome = 0.0;

        double calcUnrealisedGainAsset = 0.0;
        double calcRealisedGainAsset = 0.0;
        double calcUnrealisedCurrencyGain = 0.0;
        double calcRealisedCurrencyGain = 0.0;
        double calcTransactionFees = 0.0;
        double calcDividendsReceived = 0.0;

        for (Holding h : holdings) {
            double currentVal = h.getQuantity() * h.getCurrentPrice();
            double cost = h.getQuantity() * h.getAvgPurchasePrice();
            double unrealised = currentVal - cost;
            h.setUnrealisedGain(unrealised);
            
            String currency = h.getCurrency() != null ? h.getCurrency() : "NZD";
            double currentRate = currencyService.getRateToBase(currency);
            double purchaseRate = h.getPurchaseExchangeRate() != null ? h.getPurchaseExchangeRate() : currentRate;

            double invVal = h.getInvestmentValue() != null ? h.getInvestmentValue() : currencyService.convertToBase(currentVal, currency);
            totalHoldingsValue += invVal;
            totalCostBasis += cost * purchaseRate;
            
            double realised = h.getRealisedGain() != null ? h.getRealisedGain() : 0.0;
            totalRealisedGain += currencyService.convertToBase(realised, currency);

            double divIncome = h.getDividendIncome() != null ? h.getDividendIncome() : 0.0;
            double divHome = h.getDividendIncomeHome() != null ? h.getDividendIncomeHome() : currencyService.convertToBase(divIncome, currency);
            totalDividendIncome += divHome;
 
            // Detailed Total Return Component calculations in base currency (NZD)
            calcUnrealisedGainAsset += unrealised * currentRate;
            calcRealisedGainAsset += realised * currentRate;
            calcUnrealisedCurrencyGain += (currentRate - purchaseRate) * cost;
            calcRealisedCurrencyGain += realised * (currentRate - purchaseRate);
            
            double brokerage = h.getBrokerage() != null ? h.getBrokerage() : 0.0;
            calcTransactionFees += brokerage * currentRate;
            calcDividendsReceived += divHome;

            // Log validation for each share
            double unrealisedVal = currentVal - cost;
            double validationDiff = currentVal - unrealisedVal;
            System.out.println("VALIDATION [Share: " + h.getCode() + "]: Current Value (" + currentVal + ") - Unrealised Gain/Loss (" + unrealisedVal + ") = " + validationDiff + " (Total Cost Basis: " + cost + ")");
        }
        
        if (holdings.size() > 0) {
            totalUnrealisedGain = totalHoldingsValue - totalCostBasis;
        }

        double totalUnrealisedGainAsset = (holdings.size() > 0) ? calcUnrealisedGainAsset : (policy.getSeedUnrealisedGains() != null ? policy.getSeedUnrealisedGains() : 0.0);
        double totalRealisedGainAsset = calcRealisedGainAsset;
        double totalUnrealisedCurrencyGain = (holdings.size() > 0) ? calcUnrealisedCurrencyGain : (policy.getSeedUnrealisedCurrencyGains() != null ? policy.getSeedUnrealisedCurrencyGains() : 0.0);
        double totalRealisedCurrencyGain = calcRealisedCurrencyGain;
        double totalTransactionFees = (holdings.size() > 0) ? calcTransactionFees : (policy.getSeedTransactionFees() != null ? policy.getSeedTransactionFees() : 0.0);
        double totalDividendsReceived = (holdings.size() > 0) ? calcDividendsReceived : (policy.getSeedDividendsReceived() != null ? policy.getSeedDividendsReceived() : 0.0);

        double cash = policy.getCashAvailable() != null ? policy.getCashAvailable() : 0.0;

        double totalReturn = (holdings.size() > 0) 
                ? (totalUnrealisedGain + totalUnrealisedCurrencyGain + totalDividendsReceived + totalTransactionFees)
                : (policy.getSharesiesTotalReturn() != null ? policy.getSharesiesTotalReturn() : 0.0);

        double amountPutIn = (holdings.size() > 0) ? totalCostBasis : (policy.getSharesiesAmountPutIn() != null ? policy.getSharesiesAmountPutIn() : 0.0);

        double netWorth = (holdings.size() > 0) ? (totalReturn + amountPutIn) : (policy.getSharesiesTotalEstimatedValue() != null ? policy.getSharesiesTotalEstimatedValue() : cash);
        
        double simpleReturnPercent = amountPutIn > 0 ? (totalReturn / amountPutIn) * 100.0 : 0.0;

        Map<String, Object> summary = new HashMap<>();
        summary.put("holdingsValue", totalHoldingsValue);
        summary.put("cashBalance", cash);
        summary.put("netWorth", netWorth);
        summary.put("totalCostBasis", totalCostBasis);
        summary.put("unrealisedGain", totalUnrealisedGain);
        summary.put("unrealisedGainPercent", totalCostBasis > 0 ? (totalUnrealisedGain / totalCostBasis) * 100.0 : 0.0);
        summary.put("realisedGain", totalRealisedGain);
        summary.put("dividendIncome", totalDividendIncome);
        summary.put("holdingsCount", holdings.size());
        summary.put("amountPutIn", amountPutIn);
        summary.put("simpleReturn", totalUnrealisedGain);
        summary.put("simpleReturnPercent", simpleReturnPercent);

        // Total Return details
        summary.put("unrealisedAssetGains", totalUnrealisedGainAsset);
        summary.put("realisedAssetGains", totalRealisedGainAsset);
        summary.put("unrealisedCurrencyGains", totalUnrealisedCurrencyGain);
        summary.put("realisedCurrencyGains", totalRealisedCurrencyGain);
        summary.put("transactionFees", totalTransactionFees);
        summary.put("dividendsReceived", totalDividendsReceived);
        summary.put("totalReturn", totalReturn);

        return summary;
    }

    @Transactional
    public Transaction executeTrade(Long customerId, String code, String type, Double quantity, Double price, Double brokerage) {
        log.info("Executing trade for customer {}: {} {} shares/amount of {} at ${}", customerId, type, quantity, code, price);

        // ── Normalise qualified code (e.g. "ASX:SSG" → market="ASX", bareCode="SSG") ──
        String bareCode;
        String qualifiedMarket;
        if (code != null && code.contains(":")) {
            String[] parts = code.split(":", 2);
            qualifiedMarket = parts[0].toUpperCase();
            bareCode = parts[1].toUpperCase();
        } else {
            qualifiedMarket = null;
            bareCode = code != null ? code.toUpperCase() : code;
        }

        Optional<Holding> holdingOpt = holdingRepository.findByCustomerIdAndCode(customerId, bareCode);
        InvestmentPolicy policy = policyRepository.findByCustomerId(customerId)
                .orElseGet(() -> {
                    InvestmentPolicy p = InvestmentPolicy.builder()
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
                            .build();
                    return policyRepository.save(p);
                });

        // Resolve asset currency — prefer holding, then qualified market prefix, then watchlist
        String currency = "NZD";
        if (holdingOpt.isPresent()) {
            currency = holdingOpt.get().getCurrency();
        } else if (qualifiedMarket != null) {
            currency = "NZX".equals(qualifiedMarket) ? "NZD" : "ASX".equals(qualifiedMarket) ? "AUD" : "USD";
        } else {
            Optional<Watchlist> wlOpt = watchlistRepository.findByCustomerIdAndCode(customerId, bareCode);
            if (wlOpt.isPresent()) {
                String market = wlOpt.get().getMarket();
                currency = "NZX".equals(market) ? "NZD" : "ASX".equals(market) ? "AUD" : "USD";
            }
        }

        double cash = policy.getCashAvailable() != null ? policy.getCashAvailable() : 0.0;
        boolean sharesiesConnected = sharesiesService.isAuthenticated(customerId);

        if (type.equalsIgnoreCase("BUY")) {
            // quantity = number of shares to buy; totalCost = shares * price + brokerage
            double sharesToBuy = quantity;
            double totalCost = (sharesToBuy * price) + brokerage;
            double totalCostInBase = currencyService.convertToBase(totalCost, currency);

            // Only enforce cash check when connected to Sharesies (live account)
            if (sharesiesConnected && cash < totalCostInBase) {
                throw new IllegalArgumentException("Insufficient cash available. Required: $"
                        + String.format("%.2f", totalCostInBase) + " NZD, Available: $"
                        + String.format("%.2f", cash) + " NZD");
            }

            // Place live order if authenticated
            if (sharesiesConnected) {
                try {
                    boolean success = sharesiesService.buy(customerId, bareCode, totalCost, currency);
                    if (!success) {
                        throw new IllegalStateException("Failed to place the buy order in Sharesies. The fund may not have been found or the session is invalid.");
                    }
                } catch (RuntimeException e) {
                    throw new IllegalStateException(e.getMessage());
                }
                policy.setCashAvailable(cash - totalCostInBase);
            } else {
                throw new IllegalStateException("Sharesies session expired or not connected. Please connect to Sharesies to execute trades.");
            }

            if (sharesToBuy <= 0) {
                throw new IllegalArgumentException("Quantity must be greater than zero.");
            }

            Holding holding;
            if (holdingOpt.isPresent()) {
                holding = holdingOpt.get();
                double oldQty = holding.getQuantity();
                double oldAvg = holding.getAvgPurchasePrice();
                double newQty = oldQty + sharesToBuy;
                double newAvg = ((oldQty * oldAvg) + (sharesToBuy * price)) / newQty;
                
                holding.setQuantity(newQty);
                holding.setAvgPurchasePrice(newAvg);
                holding.setBrokerage((holding.getBrokerage() != null ? holding.getBrokerage() : 0.0) + brokerage);
            } else {
                Optional<Watchlist> wlOpt = watchlistRepository.findByCustomerIdAndCode(customerId, bareCode);
                String name = wlOpt.isPresent() ? wlOpt.get().getShareName() : bareCode;
                // Derive market: prefer watchlist record, then qualified prefix, then default
                String market = wlOpt.isPresent() ? wlOpt.get().getMarket()
                        : (qualifiedMarket != null ? qualifiedMarket : "NASDAQ");
                String assetType = wlOpt.isPresent() ? wlOpt.get().getType() : "growth";
                int riskVal = wlOpt.isPresent() ? wlOpt.get().getRisk() : 5;

                holding = Holding.builder()
                        .customerId(customerId)
                        .code(bareCode)
                        .shareName(name)
                        .market(market)
                        .type(assetType)
                        .risk(riskVal)
                        .quantity(sharesToBuy)
                        .avgPurchasePrice(price)
                        .currentPrice(price)
                        .brokerage(brokerage)
                        .unrealisedGain(0.0)
                        .realisedGain(0.0)
                        .dividendIncome(0.0)
                        .currency(currency)
                        .country(market.equals("NZX") ? "New Zealand" : market.equals("ASX") ? "Australia" : "United States")
                        .sector("Other")
                        .notes("Added to portfolio via active trade.")
                        .purchaseExchangeRate(currencyService.getRateToBase(currency))
                        .build();
                
                wlOpt.ifPresent(watchlistRepository::delete);
            }
            
            holding.setCurrentPrice(price);
            holding.setUnrealisedGain((holding.getQuantity() * price) - (holding.getQuantity() * holding.getAvgPurchasePrice()));
            holding.setLastUpdated(LocalDateTime.now());
            holdingRepository.save(holding);
            
        } else if (type.equalsIgnoreCase("SELL")) {
            // For SELL, the quantity parameter represents the number of shares (according to Sharesies API sell(company, shares))
            double sharesToSell = quantity;
            if (holdingOpt.isEmpty()) {
                throw new IllegalArgumentException("No holding found for " + bareCode + " (requested: " + code + ")");
            }
            Holding holding = holdingOpt.get();
            double oldQty = holding.getQuantity();
            if (oldQty < sharesToSell) {
                throw new IllegalArgumentException("Cannot sell more shares than held. Held: " + oldQty + ", Sell: " + sharesToSell);
            }
            
            // Place live order if authenticated
            if (sharesiesConnected) {
                try {
                    boolean success = sharesiesService.sell(customerId, bareCode, sharesToSell);
                    if (!success) {
                        throw new IllegalStateException("Failed to place the sell order in Sharesies. The fund may not have been found or the session is invalid.");
                    }
                } catch (RuntimeException e) {
                    throw new IllegalStateException(e.getMessage());
                }
            } else {
                throw new IllegalStateException("Sharesies session expired or not connected. Please connect to Sharesies to execute trades.");
            }

            double saleProceeds = (sharesToSell * price) - brokerage;
            double saleProceedsInBase = currencyService.convertToBase(saleProceeds, currency);
            policy.setCashAvailable(cash + saleProceedsInBase);

            double costBasisSold = sharesToSell * holding.getAvgPurchasePrice();
            double gainOnSale = (sharesToSell * price) - costBasisSold - brokerage;
            holding.setRealisedGain((holding.getRealisedGain() != null ? holding.getRealisedGain() : 0.0) + gainOnSale);

            double newQty = oldQty - sharesToSell;
            if (newQty == 0) {
                holdingRepository.delete(holding);
                watchlistRepository.save(Watchlist.builder()
                        .customerId(customerId)
                        .code(holding.getCode())
                        .shareName(holding.getShareName())
                        .market(holding.getMarket())
                        .type(holding.getType())
                        .risk(holding.getRisk())
                        .dividendQuality(75)
                        .growth(75)
                        .valueScore(75)
                        .portfolioFit(80)
                        .momentum(70)
                        .overallScore(75.0)
                        .dividendYield(Watchlist.getDivYieldForCode(holding.getCode(), holding.getType()))
                        .currentPrice(Watchlist.getCurrentPriceForCode(holding.getCode()))
                        .build());
            } else {
                holding.setQuantity(newQty);
                holding.setUnrealisedGain((newQty * price) - (newQty * holding.getAvgPurchasePrice()));
                holding.setLastUpdated(LocalDateTime.now());
                holdingRepository.save(holding);
            }
        } else {
            throw new IllegalArgumentException("Invalid trade type: " + type);
        }

        policyRepository.save(policy);

        Transaction tx = Transaction.builder()
                .customerId(customerId)
                .code(code)
                .shareName(holdingOpt.isPresent() ? holdingOpt.get().getShareName() : code)
                .type(type.toUpperCase())
                .quantity(quantity)
                .price(price)
                .brokerage(brokerage)
                .timestamp(LocalDateTime.now())
                .build();
        
        return transactionRepository.save(tx);
    }

    public List<Map<String, Object>> getRebalanceRecommendations(Long customerId, double amount) {
        List<Holding> holdings = holdingRepository.findByCustomerId(customerId);
        List<Watchlist> watchlist = watchlistRepository.findByCustomerId(customerId);
        
        List<Map<String, Object>> recommendations = new ArrayList<>();
        
        Map<String, Double> targetWeights = new HashMap<>();
        targetWeights.put("JEPI", 0.35); // 35% of new money
        targetWeights.put("ENB", 0.25);  // 25% of new money
        targetWeights.put("O", 0.20);    // 20% of new money
        targetWeights.put("META", 0.10); // 10% of new money
        targetWeights.put("USF", 0.10);  // 10% of new money

        Map<String, String> reasons = new HashMap<>();
        reasons.put("JEPI", "Excellent dividend yield (monthly distribution) reducing portfolio volatility.");
        reasons.put("ENB", "Undervalued energy dividend compounder with strong coverage ratio.");
        reasons.put("O", "Consistent monthly income REIT, currently trading below historical averages.");
        reasons.put("META", "Reasonable valuation growth stock with accelerating operational cash flows.");
        reasons.put("USF", "Broad US market ETF exposure to maintain indexing growth and diversification.");

        for (Map.Entry<String, Double> entry : targetWeights.entrySet()) {
            String code = entry.getKey();
            double weight = entry.getValue();
            double allocateAmt = amount * weight;
            
            double price = 50.0;
            String shareName = code;
            String currency = "USD"; // Default to USD for major international holdings
            if (code.equals("USF")) {
                currency = "NZD";
            }
            
            final String finalCode = code;
            Optional<Holding> hOpt = holdings.stream().filter(h -> h.getCode().equals(finalCode)).findFirst();
            if (hOpt.isPresent()) {
                price = hOpt.get().getCurrentPrice();
                shareName = hOpt.get().getShareName();
                currency = hOpt.get().getCurrency();
            } else {
                Optional<Watchlist> wOpt = watchlist.stream().filter(w -> w.getCode().equals(finalCode)).findFirst();
                if (wOpt.isPresent()) {
                    shareName = wOpt.get().getShareName();
                    String market = wOpt.get().getMarket();
                    currency = "NZX".equals(market) ? "NZD" : "ASX".equals(market) ? "AUD" : "USD";
                }
            }

            // Convert price of asset to base currency (NZD) to compute quantity purchased
            double priceInBase = currencyService.convertToBase(price, currency);
            double shares = Math.floor(allocateAmt / priceInBase * 100.0) / 100.0;
            
            if (shares > 0) {
                Map<String, Object> rec = new HashMap<>();
                rec.put("code", code);
                rec.put("shareName", shareName);
                rec.put("amount", allocateAmt);
                rec.put("shares", shares);
                rec.put("price", price); // keep local price for display
                rec.put("reason", reasons.get(code));
                recommendations.add(rec);
            }
        }
        
        return recommendations;
    }
}
