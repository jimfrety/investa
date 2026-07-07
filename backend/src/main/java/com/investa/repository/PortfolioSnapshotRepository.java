package com.investa.repository;

import com.investa.model.PortfolioSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface PortfolioSnapshotRepository extends JpaRepository<PortfolioSnapshot, Long> {
    List<PortfolioSnapshot> findAllByOrderBySnapshotDateAsc();
    List<PortfolioSnapshot> findByCustomerIdOrderBySnapshotDateAsc(Long customerId);
    List<PortfolioSnapshot> findByCustomerId(Long customerId);
}
