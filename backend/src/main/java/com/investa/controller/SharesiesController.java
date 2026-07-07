package com.investa.controller;

import com.investa.service.SharesiesService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/sharesies")
@RequiredArgsConstructor
@CrossOrigin
public class SharesiesController {

    private final SharesiesService sharesiesService;

    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(
            @RequestHeader("X-Customer-ID") Long customerId,
            @RequestBody Map<String, String> payload) {
        String email = payload.get("email");
        String password = payload.get("password");
        String mfaCode = payload.get("mfaCode");
        if (mfaCode == null) mfaCode = payload.get("code");
        if (mfaCode == null) mfaCode = payload.get("mfa");

        Map<String, Object> response = new HashMap<>();
        if (email == null || password == null) {
            response.put("success", false);
            response.put("message", "Email and password are required.");
            return ResponseEntity.badRequest().body(response);
        }

        String result = sharesiesService.loginWithMfa(customerId, email, password, mfaCode);
        if ("SUCCESS".equals(result)) {
            response.put("success", true);
            response.put("message", "Successfully logged in to Sharesies.");
            sharesiesService.syncProfileAndHoldings(customerId);
        } else if ("MFA_REQUIRED".equals(result)) {
            response.put("success", false);
            response.put("mfaRequired", true);
            response.put("message", "Sharesies requires 2-Step Verification. Please enter the 6-digit code sent to your email / authenticator app.");
        } else {
            response.put("success", false);
            response.put("message", "Sharesies authentication failed. Please check credentials or verification code.");
        }
        return ResponseEntity.ok(response);
    }

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getStatus(@RequestHeader("X-Customer-ID") Long customerId) {
        Map<String, Object> response = new HashMap<>();
        response.put("authenticated", sharesiesService.isAuthenticated(customerId));
        response.put("email", sharesiesService.getConnectedEmail(customerId));
        response.put("userId", sharesiesService.getUserId(customerId));
        return ResponseEntity.ok(response);
    }

    @PostMapping("/sync")
    public ResponseEntity<Map<String, Object>> sync(@RequestHeader("X-Customer-ID") Long customerId) {
        Map<String, Object> response = new HashMap<>();
        if (!sharesiesService.isAuthenticated(customerId)) {
            response.put("success", false);
            response.put("message", "Not authenticated with Sharesies.");
            return ResponseEntity.status(401).body(response);
        }

        boolean success = sharesiesService.syncProfileAndHoldings(customerId);
        response.put("success", success);
        if (success) {
            response.put("message", "Holdings, cash, and favourites synchronized successfully.");
        } else {
            response.put("message", "Sync failed. Session may have expired.");
        }
        return ResponseEntity.ok(response);
    }

    @GetMapping("/wallet")
    public ResponseEntity<Object> getWallet(@RequestHeader("X-Customer-ID") Long customerId) {
        if (!sharesiesService.isAuthenticated(customerId)) {
            return ResponseEntity.status(401).body(Map.of("success", false, "message", "Not authenticated with Sharesies."));
        }
        return ResponseEntity.ok(sharesiesService.getWalletBalance(customerId));
    }

    @PostMapping("/logout")
    public ResponseEntity<Map<String, Object>> logout(@RequestHeader("X-Customer-ID") Long customerId) {
        sharesiesService.logout(customerId);
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Logged out of Sharesies session.");
        return ResponseEntity.ok(response);
    }

    @GetMapping("/test-url")
    public ResponseEntity<Map<String, Object>> testUrl(
            @RequestHeader("X-Customer-ID") Long customerId,
            @RequestParam("url") String url,
            @RequestParam(value = "headers", defaultValue = "distill") String headerType) {
        return ResponseEntity.ok(sharesiesService.testApiUrl(customerId, url, headerType));
    }
}
