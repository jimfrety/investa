package com.investa.controller;

import com.investa.service.AIRecommendationService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
@CrossOrigin
public class ChatController {

    private final AIRecommendationService recommendationService;

    @PostMapping
    public ResponseEntity<Map<String, Object>> chat(@RequestBody ChatRequest request) {
        Map<String, Object> response = recommendationService.generateChatResponse(request.getMessage());
        return ResponseEntity.ok(response);
    }

    @Data
    public static class ChatRequest {
        private String message;
    }
}
