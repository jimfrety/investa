package com.investa.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;

@Entity
@Table(name = "dividends")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Dividend {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String code;

    private Double amount;
    private LocalDate exDividendDate;
    private LocalDate paymentDate;
    private String type; // MONTHLY, QUARTERLY, ANNUAL
    private String status; // PAID, DECLARED, PROJECTED
}
