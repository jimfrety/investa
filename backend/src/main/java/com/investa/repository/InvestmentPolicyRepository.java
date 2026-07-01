package com.investa.repository;

import com.investa.model.InvestmentPolicy;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface InvestmentPolicyRepository extends JpaRepository<InvestmentPolicy, Long> {
}
