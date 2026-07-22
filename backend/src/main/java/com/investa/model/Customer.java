package com.investa.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "customers")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Customer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String username;

    @Column(nullable = false)
    private String password;

    private String name;

    private boolean isAdmin;

    private String customGeminiApiKey;

    @Builder.Default
    private Integer loginCount = 0;

    @Builder.Default
    private Integer aiRequestCount = 0;
}
