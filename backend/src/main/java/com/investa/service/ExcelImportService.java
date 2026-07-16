package com.investa.service;

import com.investa.model.Holding;
import com.investa.model.InvestmentPolicy;
import com.investa.model.Watchlist;
import com.investa.model.Transaction;
import com.investa.model.Dividend;
import com.investa.model.ResearchCache;
import com.investa.model.PortfolioSnapshot;
import com.investa.model.Customer;
import com.investa.repository.*;
import jakarta.annotation.PostConstruct;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class ExcelImportService {

    private final HoldingRepository holdingRepository;
    private final InvestmentPolicyRepository policyRepository;
    private final WatchlistRepository watchlistRepository;
    private final TransactionRepository transactionRepository;
    private final DividendRepository dividendRepository;
    private final ResearchCacheRepository researchCacheRepository;
    private final PortfolioSnapshotRepository snapshotRepository;
    private final CustomerRepository customerRepository;

    @Value("${investa.excel.path}")
    private String excelFilePath;

    @PostConstruct
    @Transactional
    public void importExcelOnStartup() {
        try {
            log.info("Starting startup Excel import and user verification...");
            
            // 1. Initialise Admin user if not present
            if (customerRepository.findByUsername("admin").isEmpty()) {
                customerRepository.save(Customer.builder()
                        .username("admin")
                        .password("admin123")
                        .name("System Administrator")
                        .isAdmin(true)
                        .build());
                log.info("Created default Admin user: admin / admin123");
            }

            // 2. Initialise default Customer if not present
            Customer defaultCust = customerRepository.findByUsername("customer1").orElse(null);
            if (defaultCust == null) {
                defaultCust = customerRepository.save(Customer.builder()
                        .username("customer1")
                        .password("password123")
                        .name("Default Customer")
                        .isAdmin(false)
                        .build());
                log.info("Created default Customer: customer1 / password123");
            }

            final Long customerId = defaultCust.getId();

            // 3. Initialise Policy if not present
            if (policyRepository.findByCustomerId(customerId).isEmpty()) {
                InvestmentPolicy policy = InvestmentPolicy.builder()
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
                        .cashAvailable(10000.0) // Seed cash
                        .seedUnrealisedGains(2516.01)
                        .seedRealisedGains(-107.56)
                        .seedUnrealisedCurrencyGains(563.53)
                        .seedRealisedCurrencyGains(0.70)
                        .seedTransactionFees(228.33)
                        .seedDividendsReceived(691.28)
                        .build();
                policyRepository.save(policy);
                log.info("Created default Investment Policy for customer1.");
            }

            if (holdingRepository.findByCustomerId(customerId).size() > 0) {
                log.info("Holdings table already populated for customer1. Verifying Current Price against Investment Value...");
                for (Holding h : holdingRepository.findByCustomerId(customerId)) {
                    boolean changed = false;
                    if (h.getQuantity() != null && h.getQuantity() > 0.0 && h.getInvestmentValue() != null && h.getInvestmentValue() > 0.0) {
                        double impliedPrice = h.getInvestmentValue() / h.getQuantity();
                        if (h.getCurrentPrice() == null || Math.abs(h.getCurrentPrice() - impliedPrice) > 0.0001) {
                            h.setCurrentPrice(impliedPrice);
                            if (h.getAvgPurchasePrice() != null) {
                                h.setUnrealisedGain((h.getQuantity() * impliedPrice) - (h.getQuantity() * h.getAvgPurchasePrice()));
                            }
                            changed = true;
                        }
                    }
                    if (h.getLastUpdated() == null) {
                        h.setLastUpdated(LocalDateTime.now());
                        changed = true;
                    }
                    if (changed) {
                        holdingRepository.save(h);
                    }
                }
                return;
            }

            File file = new File(excelFilePath);
            if (!file.exists()) {
                log.warn("Excel file not found at {}. Cannot initialize default portfolio.", excelFilePath);
                return;
            }

            try (FileInputStream fis = new FileInputStream(file)) {
                importExcelStream(customerId, fis);
            }
            
        } catch (Exception e) {
            log.error("Failed to seed default customer1 portfolio on startup", e);
        }
    }

    @Transactional
    public void importExcelStream(Long customerId, InputStream is) throws Exception {
        log.info("Executing spreadsheet import for customer {}; clearing holdings, transactions, watchlist, and snapshots...", customerId);
        
        holdingRepository.deleteAll(holdingRepository.findByCustomerId(customerId));
        transactionRepository.deleteAll(transactionRepository.findByCustomerId(customerId));
        watchlistRepository.deleteAll(watchlistRepository.findByCustomerId(customerId));
        snapshotRepository.deleteAll(snapshotRepository.findByCustomerId(customerId));
        
        holdingRepository.flush();
        transactionRepository.flush();
        watchlistRepository.flush();
        snapshotRepository.flush();

        List<RawStock> rawStocks = new ArrayList<>();
        try (Workbook workbook = new XSSFWorkbook(is)) {
            Sheet sheet = workbook.getSheetAt(0);
            Iterator<Row> rowIterator = sheet.iterator();
            
            // Skip header row
            if (rowIterator.hasNext()) {
                rowIterator.next();
            }
            
            while (rowIterator.hasNext()) {
                Row row = rowIterator.next();
                Cell shareCell = row.getCell(0);
                Cell codeCell = row.getCell(1);
                Cell marketCell = row.getCell(2);
                Cell typeCell = row.getCell(3);
                Cell riskCell = row.getCell(4);
                Cell currentValCell = row.getCell(5);
                Cell currencyCell = row.getCell(6);
                Cell returnCell = row.getCell(7);
                Cell sharesCell = row.getCell(8);
                
                if (codeCell == null || codeCell.getCellType() == CellType.BLANK) {
                    continue;
                }
                
                String share = getStringValue(shareCell);
                String code = getStringValue(codeCell);
                String market = getStringValue(marketCell);
                String type = getStringValue(typeCell);
                if (type.isEmpty()) type = "growth";
                
                int riskVal = 5;
                if (riskCell != null) {
                    if (riskCell.getCellType() == CellType.NUMERIC) {
                        riskVal = (int) riskCell.getNumericCellValue();
                    } else if (riskCell.getCellType() == CellType.STRING) {
                        try {
                            riskVal = Integer.parseInt(riskCell.getStringCellValue().trim());
                        } catch (NumberFormatException e) {
                            // use default
                        }
                    }
                }
                
                Double currentValue = getNumericValue(currentValCell);
                String currency = getStringValue(currencyCell);
                Double simpleReturn = getNumericValue(returnCell);
                if (simpleReturn != null && returnCell != null) {
                    String formatString = returnCell.getCellStyle().getDataFormatString();
                    if (formatString != null && formatString.contains("%")) {
                        double scaled = simpleReturn * 100.0;
                        if (Math.abs(simpleReturn) <= 3.0 && scaled >= -100.0) {
                            simpleReturn = scaled;
                        }
                    }
                }
                Double shares = getNumericValue(sharesCell);

                rawStocks.add(new RawStock(share, code, market, type, riskVal, currentValue, currency, simpleReturn, shares));
            }
        }

        log.info("Parsed {} rows from uploaded spreadsheet.", rawStocks.size());

        // Map sectors for simulation
        Map<String, String[]> sectorMap = new HashMap<>();
        sectorMap.put("Technology", new String[]{"CRWD", "TXN", "MU", "GOOG", "IONQ", "RGTI", "QBTS", "META", "XRO", "S"});
        sectorMap.put("Real Estate", new String[]{"O", "NPF"});
        sectorMap.put("Energy", new String[]{"ENB", "GNE", "HESM"});
        sectorMap.put("Healthcare", new String[]{"JNJ", "ARX"});
        sectorMap.put("Financials", new String[]{"JEPI", "BKT", "GCI", "MIN", "PFLT", "FTQI", "VNLA"});
        sectorMap.put("Consumer Cyclical", new String[]{"HVN", "SPK", "AIR", "KMB"});
        sectorMap.put("ETFs / Index", new String[]{"USF", "APA", "EUF", "EMF", "OZY", "VHY", "HVST", "FNZ", "SCHF"});

        Random random = new Random(42);
        double totalPortfolioValue = 0.0;
        double totalUnrealised = 0.0;

        for (RawStock rs : rawStocks) {
            String sector = "Other";
            for (Map.Entry<String, String[]> entry : sectorMap.entrySet()) {
                if (Arrays.asList(entry.getValue()).contains(rs.code)) {
                    sector = entry.getKey();
                    break;
                }
            }

            // Determine Country
            String country = "United States";
            if ("NZX".equals(rs.market)) {
                country = "New Zealand";
            } else if ("ASX".equals(rs.market)) {
                country = "Australia";
            }

            double qty = rs.shares != null ? rs.shares : 0.0;
            double curVal = rs.currentValue != null ? rs.currentValue : 0.0;
            double retPct = rs.simpleReturn != null ? rs.simpleReturn : 0.0;
            String cur = rs.currency != null && !rs.currency.isEmpty() ? rs.currency : "USD";

            if (qty > 0 && curVal > 0) {
                double costBasis = curVal / (1.0 + (retPct / 100.0));
                double avgPrice = costBasis / qty;
                double currentPrice = curVal / qty;
                double unrealised = curVal - costBasis;
                
                totalPortfolioValue += curVal;
                totalUnrealised += unrealised;

                double purchaseRate = 1.0;
                if ("USD".equalsIgnoreCase(cur)) {
                    purchaseRate = 1.52;
                } else if ("AUD".equalsIgnoreCase(cur)) {
                    purchaseRate = 1.03;
                }

                Holding holding = Holding.builder()
                        .customerId(customerId)
                        .shareName(rs.share)
                        .code(rs.code)
                        .market(rs.market)
                        .type(rs.type)
                        .risk(rs.risk)
                        .quantity(qty)
                        .avgPurchasePrice(Math.round(avgPrice * 100.0) / 100.0)
                        .currentPrice(Math.round(currentPrice * 100.0) / 100.0)
                        .brokerage(29.95)
                        .unrealisedGain(unrealised)
                        .realisedGain(0.0)
                        .dividendIncome(0.0)
                        .simpleReturn(retPct)
                        .currency(cur)
                        .country(country)
                        .sector(sector)
                        .notes("Imported via spreadsheet.")
                        .lastUpdated(LocalDateTime.now())
                        .purchaseExchangeRate(purchaseRate)
                        .build();
                holdingRepository.save(holding);

                // Add Transaction log
                transactionRepository.save(Transaction.builder()
                        .customerId(customerId)
                        .code(rs.code)
                        .shareName(rs.share)
                        .type("BUY")
                        .quantity(qty)
                        .price(avgPrice)
                        .brokerage(15.0)
                        .timestamp(LocalDateTime.now().minusMonths(3))
                        .build());

                // Research Cache entry
                if (researchCacheRepository.findByCode(rs.code).isEmpty()) {
                    ResearchCache cache = ResearchCache.builder()
                            .code(rs.code)
                            .revenue((1 + random.nextInt(40)) + "." + random.nextInt(9) + "B")
                            .eps(0.2 + random.nextDouble() * 10.0)
                            .cashFlow((50 + random.nextInt(500)) * 1.0e6)
                            .debt((10 + random.nextInt(300)) * 1.0e6)
                            .payoutRatio("dividend".equals(rs.type) ? 0.6 : "both".equals(rs.type) ? 0.35 : 0.0)
                            .roe(0.05 + random.nextDouble() * 0.20)
                            .roic(0.04 + random.nextDouble() * 0.15)
                            .peg(0.9 + random.nextDouble() * 1.5)
                            .forwardPe(12.0 + random.nextDouble() * 30.0)
                            .dcfValue(currentPrice * (0.8 + random.nextDouble() * 0.4))
                            .analystTarget(currentPrice * (0.95 + random.nextDouble() * 0.3))
                            .marginOfSafety((random.nextDouble() * 0.25) - 0.05)
                            .rsi(35.0 + random.nextDouble() * 40.0)
                            .macd("Neutral")
                            .support(currentPrice * 0.92)
                            .resistance(currentPrice * 1.08)
                            .low52Week(currentPrice * 0.8)
                            .high52Week(currentPrice * 1.2)
                            .sentimentSummary("Neutral")
                            .newsHighlights("Imported asset fundamentals.")
                            .updatedAt(LocalDateTime.now())
                            .build();
                    researchCacheRepository.save(cache);
                }

                // Simulate Dividends
                boolean isDiv = "dividend".equals(rs.type) || "both".equals(rs.type);
                if (isDiv) {
                    double yield = "dividend".equals(rs.type) ? 5.5 : 2.5;
                    double annualDiv = currentPrice * (yield / 100.0);
                    int frequency = rs.code.equals("JEPI") || rs.code.equals("O") ? 12 : 4;
                    double perPayout = annualDiv / frequency;
                    
                    for (int i = -3; i <= 3; i++) {
                        if (i == 0) continue;
                        LocalDate payDate = LocalDate.now().plusMonths(i * (12 / frequency));
                        if (dividendRepository.findByCode(rs.code).stream().filter(d -> payDate.equals(d.getPaymentDate())).findFirst().isEmpty()) {
                            dividendRepository.save(Dividend.builder()
                                    .code(rs.code)
                                    .amount(perPayout)
                                    .exDividendDate(payDate.minusWeeks(2))
                                    .paymentDate(payDate)
                                    .type(frequency == 12 ? "MONTHLY" : "QUARTERLY")
                                    .status(i < 0 ? "PAID" : "DECLARED")
                                    .build());
                        }
                    }
                }
            } else {
                // Otherwise, save to Watchlist
                int divQuality = 40 + random.nextInt(55);
                int growthScore = 30 + random.nextInt(65);
                int valueScore = 40 + random.nextInt(55);
                int fitScore = 50 + random.nextInt(45);
                int momScore = 30 + random.nextInt(65);
                double overall = (divQuality + growthScore + valueScore + rs.risk*10.0 + fitScore + momScore) / 6.0;

                watchlistRepository.save(Watchlist.builder()
                        .customerId(customerId)
                        .code(rs.code)
                        .shareName(rs.share)
                        .market(rs.market)
                        .type(rs.type)
                        .dividendQuality(divQuality)
                        .growth(growthScore)
                        .valueScore(valueScore)
                        .risk(rs.risk)
                        .portfolioFit(fitScore)
                        .momentum(momScore)
                        .overallScore(Math.round(overall * 10.0) / 10.0)
                        .targetPrice(10.0 + random.nextDouble() * 100.0)
                        .dividendYield(Watchlist.getDivYieldForCode(rs.code, rs.type))
                        .currentPrice(Watchlist.getCurrentPriceForCode(rs.code))
                        .build());
            }
        }

        // Seed a default list of watchlist items
        List<WatchlistItemSeed> watchlistSeeds = Arrays.asList(
            new WatchlistItemSeed("AAPL", "Apple Inc", "NASDAQ", "growth", 3, 150.0),
            new WatchlistItemSeed("MSFT", "Microsoft Corp", "NASDAQ", "growth", 3, 350.0),
            new WatchlistItemSeed("NVDA", "Nvidia Corp", "NASDAQ", "growth", 4, 110.0),
            new WatchlistItemSeed("KO", "Coca-Cola Co", "NYSE", "dividend", 2, 55.0),
            new WatchlistItemSeed("PG", "Procter & Gamble Co", "NYSE", "dividend", 2, 140.0),
            new WatchlistItemSeed("JPM", "JPMorgan Chase & Co", "NYSE", "both", 3, 160.0),
            new WatchlistItemSeed("XOM", "Exxon Mobil Corp", "NYSE", "dividend", 4, 100.0),
            new WatchlistItemSeed("PFE", "Pfizer Inc", "NYSE", "dividend", 3, 25.0)
        );

        for (WatchlistItemSeed ws : watchlistSeeds) {
            if (holdingRepository.findByCustomerIdAndCode(customerId, ws.code).isPresent()) {
                continue;
            }
            if (watchlistRepository.findByCustomerIdAndCode(customerId, ws.code).isPresent()) {
                continue;
            }
            
            int divQuality = 55 + random.nextInt(40);
            int growthScore = 40 + random.nextInt(55);
            int valueScore = 40 + random.nextInt(50);
            int fitScore = 60 + random.nextInt(35);
            int momScore = 30 + random.nextInt(65);
            double overall = (divQuality + growthScore + valueScore + (7 - ws.risk)*10.0 + fitScore + momScore) / 6.0;

            watchlistRepository.save(Watchlist.builder()
                    .customerId(customerId)
                    .code(ws.code)
                    .shareName(ws.name)
                    .market(ws.market)
                    .type(ws.type)
                    .dividendQuality(divQuality)
                    .growth(growthScore)
                    .valueScore(valueScore)
                    .risk(ws.risk)
                    .portfolioFit(fitScore)
                    .momentum(momScore)
                    .overallScore(Math.round(overall * 10.0) / 10.0)
                    .targetPrice(ws.targetPrice)
                    .dividendYield(Watchlist.getDivYieldForCode(ws.code, ws.type))
                    .currentPrice(Watchlist.getCurrentPriceForCode(ws.code))
                    .build());
        }

        // Re-generate snapshots history (ensuring all generated values are strictly positive)
        double startValue = Math.max(1000.0, totalPortfolioValue * 0.7);
        double incrementalStep = (totalPortfolioValue - startValue) / 30.0;
        for (int i = 30; i >= 0; i--) {
            LocalDate date = LocalDate.now().minusDays(i);
            double dailyValue = startValue + ((30 - i) * incrementalStep) + (random.nextDouble() * (totalPortfolioValue * 0.05));
            dailyValue = Math.max(100.0, dailyValue);
            snapshotRepository.save(PortfolioSnapshot.builder()
                    .customerId(customerId)
                    .snapshotDate(date)
                    .totalValue(dailyValue)
                    .unrealisedGain(totalUnrealised * (0.8 + (30 - i) * 0.007))
                    .realisedGain(0.0)
                    .dividendIncome(i * 120.0)
                    .cashBalance(10000.0)
                    .healthScore(85 + random.nextInt(10))
                    .dividendSafety(88 + random.nextInt(8))
                    .growthPotential(75 + random.nextInt(15))
                    .diversificationScore(90)
                    .valuationScore(85)
                    .riskScore(87)
                    .build());
        }
        
        log.info("Spreadsheet import seeding finished successfully for customer {}.", customerId);
    }

    private String getStringValue(Cell cell) {
        if (cell == null) return "";
        if (cell.getCellType() == CellType.STRING) {
            return cell.getStringCellValue().trim();
        } else if (cell.getCellType() == CellType.NUMERIC) {
            double val = cell.getNumericCellValue();
            if (val == (long) val) {
                return String.valueOf((long) val);
            }
            return String.valueOf(val);
        }
        return "";
    }

    private Double getNumericValue(Cell cell) {
        if (cell == null) return null;
        if (cell.getCellType() == CellType.NUMERIC) {
            return cell.getNumericCellValue();
        } else if (cell.getCellType() == CellType.STRING) {
            try {
                return Double.parseDouble(cell.getStringCellValue().trim());
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }

    @Getter
    @RequiredArgsConstructor
    private static class RawStock {
        private final String share;
        private final String code;
        private final String market;
        private final String type;
        private final int risk;
        private final Double currentValue;
        private final String currency;
        private final Double simpleReturn;
        private final Double shares;
    }

    @Getter
    @RequiredArgsConstructor
    private static class WatchlistItemSeed {
        private final String code;
        private final String name;
        private final String market;
        private final String type;
        private final int risk;
        private final double targetPrice;
    }
}
