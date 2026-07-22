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
    private Double currentPrice;

    public static double getCurrentPriceForCode(String code) {
        if (code == null) return 50.0;
        String clean = code.toUpperCase();
        if (clean.contains(":")) {
            clean = clean.substring(clean.indexOf(":") + 1);
        }
        switch (clean) {
            case "AAPL": return 175.50;
            case "MSFT": return 395.20;
            case "NVDA": return 120.40;
            case "KO": return 58.30;
            case "PG": return 155.10;
            case "JPM": return 185.00;
            case "XOM": return 112.50;
            case "PFE": return 27.80;
            case "CRWD": return 290.00;
            case "JEPI": return 55.40;
            case "O": return 53.15;
            case "SPK": return 4.95;
            case "GNE": return 2.35;
            case "ENB": return 48.20;
            case "XRO": return 118.00;
            case "VZ": return 39.50;
            case "SSG": return 1.39;
            default:
                return 45.0 + Math.random() * 50.0;
        }
    }

    public static double getDivYieldForCode(String code, String type) {
        if (code == null) return 0.0;
        String clean = code.toUpperCase();
        if (clean.contains(":")) {
            clean = clean.substring(clean.indexOf(":") + 1);
        }
        switch (clean) {
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
            case "SSG": return 7.35;
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
