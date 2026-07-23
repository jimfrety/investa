package com.investa.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "actioned_recommendations")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ActionedRecommendation {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    private Long customerId;
    private String code;
}
