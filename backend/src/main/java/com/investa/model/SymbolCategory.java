package com.investa.model;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "symbol_category")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SymbolCategory {
    @Id
    private String symbol;
    private String category;
}
