package com.investa.service;

import com.investa.model.Holding;
import com.investa.model.Dividend;
import com.investa.repository.HoldingRepository;
import com.investa.repository.DividendRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.TextStyle;
import java.util.*;

@Service
@RequiredArgsConstructor
public class DividendService {

    private final HoldingRepository holdingRepository;
    private final DividendRepository dividendRepository;
    private final CurrencyService currencyService;

    public Map<String, Object> getDividendMetrics() {
        List<Holding> holdings = holdingRepository.findAll();
        
        double totalAnnualIncome = 0.0;
        double totalPortfolioValue = 0.0;

        for (Holding h : holdings) {
            String currency = h.getCurrency() != null ? h.getCurrency() : "NZD";
            double currentVal = h.getQuantity() * h.getCurrentPrice();
            totalPortfolioValue += currencyService.convertToBase(currentVal, currency);

            // Fetch dividends for this code to calculate annual payment
            List<Dividend> divs = dividendRepository.findByCode(h.getCode());
            if (!divs.isEmpty()) {
                // Find annual frequency
                long countInYear = divs.stream()
                        .filter(d -> d.getPaymentDate().isAfter(LocalDate.now().minusYears(1)))
                        .count();
                
                double latestAmount = divs.stream()
                        .max(Comparator.comparing(Dividend::getPaymentDate))
                        .map(Dividend::getAmount)
                        .orElse(0.0);

                if (countInYear == 0) {
                    // fall back to frequency type
                    String type = divs.get(0).getType();
                    countInYear = type.equalsIgnoreCase("MONTHLY") ? 12 : 4;
                }
                
                double annualSharePayout = latestAmount * countInYear;
                double annualHoldingIncome = h.getQuantity() * annualSharePayout;
                totalAnnualIncome += currencyService.convertToBase(annualHoldingIncome, currency);
            }
        }

        // Default fallback if no dividends initialized
        if (totalAnnualIncome == 0.0) {
            totalAnnualIncome = 8400.0; // Seed default
        }

        double monthlyAverage = totalAnnualIncome / 12.0;
        double growthRate = 8.4; // 8.4% growth rate
        
        // Compound growth calculation to 2030 (4 years from 2026)
        double projected2030 = totalAnnualIncome * Math.pow(1 + (growthRate / 100.0), 4);

        Map<String, Object> metrics = new HashMap<>();
        metrics.put("annualIncome", totalAnnualIncome);
        metrics.put("monthlyAverage", monthlyAverage);
        metrics.put("projectedIncome2030", projected2030);
        metrics.put("growthRate", growthRate);
        metrics.put("portfolioYield", totalPortfolioValue > 0 ? (totalAnnualIncome / totalPortfolioValue) * 100.0 : 0.0);

        return metrics;
    }

    public List<Map<String, Object>> getDividendCalendar() {
        List<Holding> holdings = holdingRepository.findAll();
        Map<String, Double> monthlyIncome = new LinkedHashMap<>();
        
        String[] months = {"January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"};
        for (String m : months) {
            monthlyIncome.put(m, 0.0);
        }

        int currentYear = LocalDate.now().getYear();

        for (Holding h : holdings) {
            String currency = h.getCurrency() != null ? h.getCurrency() : "NZD";
            List<Dividend> divs = dividendRepository.findByCode(h.getCode());
            for (Dividend d : divs) {
                if (d.getPaymentDate().getYear() == currentYear) {
                    String monthName = d.getPaymentDate().getMonth().getDisplayName(TextStyle.FULL, Locale.ENGLISH);
                    double currentAmt = monthlyIncome.getOrDefault(monthName, 0.0);
                    double paymentInBase = currencyService.convertToBase(h.getQuantity() * d.getAmount(), currency);
                    monthlyIncome.put(monthName, currentAmt + paymentInBase);
                }
            }
        }

        List<Map<String, Object>> calendar = new ArrayList<>();
        for (Map.Entry<String, Double> entry : monthlyIncome.entrySet()) {
            Map<String, Object> monthData = new HashMap<>();
            monthData.put("month", entry.getKey());
            monthData.put("income", entry.getValue());
            calendar.add(monthData);
        }

        return calendar;
    }
}
