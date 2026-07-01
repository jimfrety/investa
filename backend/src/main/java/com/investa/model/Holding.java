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

    @Column(nullable = false)
    private String shareName;

    @Column(nullable = false, unique = true)
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

    private String currency;
    private String country;
    private String sector;
    
    @Column(length = 1000)
    private String notes;

    private java.time.LocalDateTime lastUpdated;
    private Double purchaseExchangeRate;
}
