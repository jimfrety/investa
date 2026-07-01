package com.investa.service;

import org.springframework.stereotype.Service;
import java.util.Map;

@Service
public class CurrencyService {

    // Fixed exchange rates to convert to NZD (Base Currency)
    // 1 USD = 1.63 NZD
    // 1 AUD = 1.08 NZD
    private static final Map<String, Double> TO_BASE_RATES = Map.of(
        "NZD", 1.0,
        "USD", 1.63,
        "AUD", 1.08
    );

    public double convertToBase(double amount, String currency) {
        if (currency == null) return amount;
        double rate = TO_BASE_RATES.getOrDefault(currency.toUpperCase(), 1.0);
        return amount * rate;
    }

    public double convertFromBase(double amountInBase, String targetCurrency) {
        if (targetCurrency == null) return amountInBase;
        double rate = TO_BASE_RATES.getOrDefault(targetCurrency.toUpperCase(), 1.0);
        return amountInBase / rate;
    }

    public double getRateToBase(String currency) {
        if (currency == null) return 1.0;
        return TO_BASE_RATES.getOrDefault(currency.toUpperCase(), 1.0);
    }
}
