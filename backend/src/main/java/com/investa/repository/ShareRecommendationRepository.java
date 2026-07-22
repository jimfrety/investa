package com.investa.repository;

import com.investa.model.ShareRecommendation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ShareRecommendationRepository extends JpaRepository<ShareRecommendation, Long> {
    List<ShareRecommendation> findAllByOrderByTimestampDesc();
    List<ShareRecommendation> findByCustomerIdAndCode(Long customerId, String code);
}
