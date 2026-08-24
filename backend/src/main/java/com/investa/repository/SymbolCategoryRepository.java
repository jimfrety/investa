package com.investa.repository;

import com.investa.model.SymbolCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SymbolCategoryRepository extends JpaRepository<SymbolCategory, String> {
}
