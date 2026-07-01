package com.investa.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;

@Entity
@Table(name = "portfolio_snapshots")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PortfolioSnapshot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private LocalDate snapshotDate;

    private Double totalValue;
    private Double unrealisedGain;
    private Double realisedGain;
    private Double dividendIncome;
    private Double cashBalance;

    private Integer healthScore; // 0-100
    private Integer dividendSafety; // 0-100
    private Integer growthPotential; // 0-100
    private Integer diversificationScore; // 0-100
    private Integer valuationScore; // 0-100
    private Integer riskScore; // 0-100
}
