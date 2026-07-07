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
}
