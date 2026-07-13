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
            totalCostBasis += currencyService.convertToBase(cost, currency);
            totalUnrealisedGain += currencyService.convertToBase(unrealised, currency);
            
            double realised = h.getRealisedGain() != null ? h.getRealisedGain() : 0.0;
            totalRealisedGain += currencyService.convertToBase(realised, currency);

            double divIncome = h.getDividendIncome() != null ? h.getDividendIncome() : 0.0;
            totalDividendIncome += currencyService.convertToBase(divIncome, currency);

            // Detailed Total Return Component calculations in base currency (NZD)
            calcUnrealisedGainAsset += unrealised * currentRate;
            calcRealisedGainAsset += realised * currentRate;
            calcUnrealisedCurrencyGain += (currentRate - purchaseRate) * cost;
            calcRealisedCurrencyGain += realised * (currentRate - purchaseRate);
            
            double brokerage = h.getBrokerage() != null ? h.getBrokerage() : 0.0;
            calcTransactionFees += brokerage * currentRate;
            calcDividendsReceived += divIncome * currentRate;
        }

        double totalUnrealisedGainAsset = policy.getSeedUnrealisedGains() != null ? policy.getSeedUnrealisedGains() : calcUnrealisedGainAsset;
        double totalRealisedGainAsset = calcRealisedGainAsset;
        double totalUnrealisedCurrencyGain = policy.getSeedUnrealisedCurrencyGains() != null ? policy.getSeedUnrealisedCurrencyGains() : calcUnrealisedCurrencyGain;
        double totalRealisedCurrencyGain = calcRealisedCurrencyGain;
        double totalTransactionFees = policy.getSeedTransactionFees() != null ? policy.getSeedTransactionFees() : calcTransactionFees;
        double totalDividendsReceived = policy.getSeedDividendsReceived() != null ? policy.getSeedDividendsReceived() : calcDividendsReceived;

        double cash = policy.getCashAvailable() != null ? policy.getCashAvailable() : 0.0;
        double netWorth = policy.getSharesiesTotalEstimatedValue() != null ? policy.getSharesiesTotalEstimatedValue() : totalHoldingsValue;

        double totalReturn = policy.getSharesiesTotalReturn() != null ? policy.getSharesiesTotalReturn() : (totalUnrealisedGainAsset + totalRealisedGainAsset 
                + totalUnrealisedCurrencyGain + totalRealisedCurrencyGain 
                + totalDividendsReceived - totalTransactionFees);

        double amountPutIn = policy.getSharesiesAmountPutIn() != null ? policy.getSharesiesAmountPutIn() : totalCostBasis;
        
        double simpleReturnPercent = policy.getSharesiesSimpleReturn() != null ? policy.getSharesiesSimpleReturn() : (amountPutIn > 0 ? (totalReturn / amountPutIn) * 100.0 : 0.0);

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
        
        Optional<Holding> holdingOpt = holdingRepository.findByCustomerIdAndCode(customerId, code);
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

        // Resolve asset currency based on holding or watchlist market
        String currency = "NZD";
        if (holdingOpt.isPresent()) {
            currency = holdingOpt.get().getCurrency();
        } else {
            Optional<Watchlist> wlOpt = watchlistRepository.findByCustomerIdAndCode(customerId, code);
            if (wlOpt.isPresent()) {
                String market = wlOpt.get().getMarket();
                currency = "NZX".equals(market) ? "NZD" : "ASX".equals(market) ? "AUD" : "USD";
            }
        }

        double cash = policy.getCashAvailable() != null ? policy.getCashAvailable() : 0.0;

        if (type.equalsIgnoreCase("BUY")) {
            // For BUY, the quantity parameter represents the cash amount to invest (according to Sharesies API buy(company, amount))
            double amountToBuy = quantity;
            double totalCostInBase = currencyService.convertToBase(amountToBuy, currency);

            if (cash < totalCostInBase) {
                throw new IllegalArgumentException("Insufficient cash available. Required: $" + String.format("%.2f", totalCostInBase) + " NZD, Available: $" + String.format("%.2f", cash) + " NZD");
            }

            // Call Sharesies if authenticated
            if (sharesiesService.isAuthenticated(customerId)) {
                boolean ok = sharesiesService.buy(customerId, code, amountToBuy);
                if (!ok) {
                    throw new IllegalStateException("Sharesies BUY order failed. Please check connection/balance.");
                }
            }

            policy.setCashAvailable(cash - totalCostInBase);
            
            // Calculate actual shares bought based on amount and price
            double actualShares = (amountToBuy - brokerage) / price;
            if (actualShares <= 0) {
                throw new IllegalArgumentException("Buy amount must be greater than brokerage fee.");
            }

            Holding holding;
            if (holdingOpt.isPresent()) {
                holding = holdingOpt.get();
                double oldQty = holding.getQuantity();
                double oldAvg = holding.getAvgPurchasePrice();
                double newQty = oldQty + actualShares;
                double newAvg = ((oldQty * oldAvg) + amountToBuy) / newQty;
                
                holding.setQuantity(newQty);
                holding.setAvgPurchasePrice(newAvg);
                holding.setBrokerage((holding.getBrokerage() != null ? holding.getBrokerage() : 0.0) + brokerage);
            } else {
                Optional<Watchlist> wlOpt = watchlistRepository.findByCustomerIdAndCode(customerId, code);
                String name = wlOpt.isPresent() ? wlOpt.get().getShareName() : code;
                String market = wlOpt.isPresent() ? wlOpt.get().getMarket() : "NASDAQ";
                String assetType = wlOpt.isPresent() ? wlOpt.get().getType() : "growth";
                int riskVal = wlOpt.isPresent() ? wlOpt.get().getRisk() : 5;

                holding = Holding.builder()
                        .customerId(customerId)
                        .code(code)
                        .shareName(name)
                        .market(market)
                        .type(assetType)
                        .risk(riskVal)
                        .quantity(actualShares)
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
                throw new IllegalArgumentException("No holding found for " + code);
            }
            Holding holding = holdingOpt.get();
            double oldQty = holding.getQuantity();
            if (oldQty < sharesToSell) {
                throw new IllegalArgumentException("Cannot sell more shares than held. Held: " + oldQty + ", Sell: " + sharesToSell);
            }
            
            // Call Sharesies if authenticated
            if (sharesiesService.isAuthenticated(customerId)) {
                boolean ok = sharesiesService.sell(customerId, code, sharesToSell);
                if (!ok) {
                    throw new IllegalStateException("Sharesies SELL order failed. Please check connection/holdings.");
                }
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
