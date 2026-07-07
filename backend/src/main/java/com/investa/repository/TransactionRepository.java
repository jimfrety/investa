package com.investa.repository;

import com.investa.model.Transaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface TransactionRepository extends JpaRepository<Transaction, Long> {
    List<Transaction> findByCodeOrderByTimestampDesc(String code);
    List<Transaction> findAllByOrderByTimestampDesc();
    List<Transaction> findByCustomerIdOrderByTimestampDesc(Long customerId);
    List<Transaction> findByCustomerIdAndCodeOrderByTimestampDesc(Long customerId, String code);
    List<Transaction> findByCustomerId(Long customerId);
}
