package com.investa.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "transactions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Transaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long customerId;

    @Column(nullable = false)
    private String code;

    private String shareName;
    
    @Column(nullable = false)
    private String type; // BUY, SELL

    @Column(nullable = false)
    private Double quantity;

    @Column(nullable = false)
    private Double price;

    private Double brokerage;
    
    private String currency;
    
    @Column(nullable = false)
    private LocalDateTime timestamp;
}
