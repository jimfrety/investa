package com.investa.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "research_cache")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ResearchCache {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String code;

    private String revenue; // e.g. "12.4B"
    private Double eps;
    private Double cashFlow;
    private Double debt;
    private Double payoutRatio; // e.g. 0.65 (65%)
    private Double roe; // return on equity
    private Double roic; // return on invested capital
    private Double peg; // price/earnings-to-growth
    private Double forwardPe;
    
    // Valuation
    private Double dcfValue;
    private Double analystTarget;
    private Double marginOfSafety; // percentage, e.g. 0.15 (15%)

    // Technicals
    private Double rsi;
    private String macd; // e.g. "Bullish crossover"
    private Double support;
    private Double resistance;
    private Double low52Week;
    private Double high52Week;

    // Sentiment
    private String sentimentSummary; // "Bullish / Neutral / Bearish"
    private String newsHighlights;

    private LocalDateTime updatedAt;
}
