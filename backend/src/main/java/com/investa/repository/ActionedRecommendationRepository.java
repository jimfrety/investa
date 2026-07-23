package com.investa.repository;

import com.investa.model.ActionedRecommendation;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ActionedRecommendationRepository extends JpaRepository<ActionedRecommendation, Long> {
    List<ActionedRecommendation> findByCustomerId(Long customerId);
    boolean existsByCustomerIdAndCode(Long customerId, String code);
}
