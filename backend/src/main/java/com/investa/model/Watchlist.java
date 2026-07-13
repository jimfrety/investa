package com.investa.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "watchlist")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Watchlist {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long customerId;

    @Column(nullable = false)
    private String code;

    private String shareName;
    private String market;
    private String type; // growth, dividend, both
    
    private Integer dividendQuality;
    private Integer growth;
    private Integer valueScore;
    private Integer risk;
    private Integer portfolioFit;
    private Integer momentum;
    private Double overallScore;
    
    private Double targetPrice;
    private Double dividendYield;

    public static double getDivYieldForCode(String code, String type) {
        if (code == null) return 0.0;
        switch (code.toUpperCase()) {
            case "JEPI": return 7.50;
            case "O": return 5.85;
            case "KO": return 3.10;
            case "SPK": return 5.50;
            case "GNE": return 6.20;
            case "ENB": return 6.50;
            case "AAPL": return 0.55;
            case "MSFT": return 0.75;
            case "NVDA": return 0.03;
            case "CRWD": return 0.00;
            case "XRO": return 0.00;
            case "VZ": return 6.40;
            case "JPM": return 2.40;
            case "PG": return 2.45;
            case "XOM": return 3.20;
            case "PFE": return 5.80;
            default:
                if ("dividend".equalsIgnoreCase(type)) {
                    return 5.5;
                } else if ("both".equalsIgnoreCase(type)) {
                    return 2.5;
                } else {
                    return 0.0;
                }
        }
    }
}
