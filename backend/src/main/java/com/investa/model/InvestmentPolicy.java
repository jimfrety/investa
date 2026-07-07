package com.investa.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "investment_policies")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InvestmentPolicy {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long customerId;

    private String primaryObjective; // Maximise long-term dividend income
    private String secondaryObjective; // Grow capital

    private Double growthSellTarget; // e.g. 0.35 (35%)
    private Double maxRisk; // e.g. 4.5
    private Double maxSingleHolding; // e.g. 0.07 (7%)
    private Double minDividendCoverage; // e.g. 1.3
    private Double minMarketCap; // e.g. 2.0e9 (2 Billion)
    private Boolean avoidDividendCuts; // true/false
    private Double maxSectorExposure; // e.g. 0.20 (20%)
    
    private Double cashAvailable; // Cash ready to invest
    
    private Double sharesiesTotalEstimatedValue;
    private Double sharesiesTotalReturn;
    private Double sharesiesAmountPutIn;
    private Double sharesiesSimpleReturn;

    private Double seedUnrealisedGains;
    private Double seedRealisedGains;
    private Double seedUnrealisedCurrencyGains;
    private Double seedRealisedCurrencyGains;
    private Double seedTransactionFees;
    private Double seedDividendsReceived;
    
    @Convert(converter = com.investa.util.AesEncryptor.class)
    private String geminiApiKey;
}
