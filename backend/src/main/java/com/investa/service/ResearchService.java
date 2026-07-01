package com.investa.service;

import com.investa.model.ResearchCache;
import com.investa.repository.ResearchCacheRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.Random;

@Service
@RequiredArgsConstructor
public class ResearchService {

    private final ResearchCacheRepository researchCacheRepository;
    private final Random random = new Random();

    public ResearchCache getResearch(String code) {
        String cleanCode = code.trim().toUpperCase();
        return researchCacheRepository.findByCode(cleanCode)
                .orElseGet(() -> createMockResearch(cleanCode));
    }

    private ResearchCache createMockResearch(String code) {
        double simulatedPrice = 15.0 + random.nextDouble() * 200.0;
        ResearchCache cache = ResearchCache.builder()
                .code(code)
                .revenue((1 + random.nextInt(40)) + "." + random.nextInt(9) + "B")
                .eps(0.2 + random.nextDouble() * 8.0)
                .cashFlow((50 + random.nextInt(500)) * 1.0e6)
                .debt((10 + random.nextInt(300)) * 1.0e6)
                .payoutRatio(0.2 + random.nextDouble() * 0.5)
                .roe(0.08 + random.nextDouble() * 0.20)
                .roic(0.06 + random.nextDouble() * 0.15)
                .peg(0.9 + random.nextDouble() * 1.5)
                .forwardPe(12.0 + random.nextDouble() * 30.0)
                .dcfValue(simulatedPrice * (0.8 + random.nextDouble() * 0.4))
                .analystTarget(simulatedPrice * (0.95 + random.nextDouble() * 0.3))
                .marginOfSafety((random.nextDouble() * 0.25) - 0.05)
                .rsi(35.0 + random.nextDouble() * 40.0)
                .macd("Neutral")
                .support(simulatedPrice * 0.92)
                .resistance(simulatedPrice * 1.08)
                .low52Week(simulatedPrice * 0.8)
                .high52Week(simulatedPrice * 1.2)
                .sentimentSummary("Neutral")
                .newsHighlights("Latest earnings reports show steady margins.")
                .updatedAt(LocalDateTime.now())
                .build();
        return researchCacheRepository.save(cache);
    }
}
