package com.investa.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "holdings")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Holding {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long customerId;

    @Column(nullable = false)
    private String shareName;

    @Column(nullable = false)
    private String code;

    private String market;
    private String type; // growth, dividend, both
    private Integer risk; // 1 to 10 scale

    private Double quantity;
    private Double avgPurchasePrice;
    private Double currentPrice;
    private Double brokerage;
    
    private Double unrealisedGain;
    private Double realisedGain;
    private Double dividendIncome;
    private Double simpleReturn; // Simple return percentage from spreadsheet
    private Double investmentValue; // Investment value in home currency (NZD)

    private String currency;
    private String country;
    private String sector;
    
    @Column(length = 1000)
    private String notes;

    private java.time.LocalDateTime lastUpdated;
    private Double purchaseExchangeRate;

    public Double getCurrentPrice() {
        if (currentPrice != null) return currentPrice;
        if (avgPurchasePrice != null) return avgPurchasePrice;
        return 0.0;
    }

    public Double getQuantity() {
        return quantity != null ? quantity : 0.0;
    }

    public Double getInvestmentValue() {
        if (investmentValue != null && investmentValue != 0.0) return investmentValue;
        return getQuantity() * getCurrentPrice();
    }
}
