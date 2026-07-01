package com.investa.repository;

import com.investa.model.Dividend;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface DividendRepository extends JpaRepository<Dividend, Long> {
    List<Dividend> findByCode(String code);
    List<Dividend> findByCodeOrderByPaymentDateDesc(String code);
}
