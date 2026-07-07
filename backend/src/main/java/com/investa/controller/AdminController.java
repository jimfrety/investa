package com.investa.controller;

import com.investa.model.Customer;
import com.investa.model.InvestmentPolicy;
import com.investa.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin
public class AdminController {

    private final CustomerRepository customerRepository;
    private final HoldingRepository holdingRepository;
    private final InvestmentPolicyRepository policyRepository;
    private final WatchlistRepository watchlistRepository;
    private final TransactionRepository transactionRepository;
    private final PortfolioSnapshotRepository portfolioSnapshotRepository;

    @GetMapping("/customers")
    public ResponseEntity<List<Customer>> getAllCustomers() {
        return ResponseEntity.ok(customerRepository.findAll());
    }

    @PostMapping("/customers")
    @Transactional
    public ResponseEntity<?> createCustomer(@RequestBody Customer newCustomer) {
        if (newCustomer.getUsername() == null || newCustomer.getPassword() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Username and password required."));
        }
        if (customerRepository.findByUsername(newCustomer.getUsername()).isPresent()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Username already exists."));
        }
        newCustomer.setAdmin(false);
        Customer saved = customerRepository.save(newCustomer);

        // Initialize empty policy for the customer
        InvestmentPolicy policy = InvestmentPolicy.builder()
                .customerId(saved.getId())
                .primaryObjective("Maximise long-term dividend income")
                .secondaryObjective("Grow capital")
                .growthSellTarget(0.35)
                .maxRisk(4.5)
                .maxSingleHolding(0.07)
                .minDividendCoverage(1.3)
                .minMarketCap(2.0e9)
                .avoidDividendCuts(true)
                .maxSectorExposure(0.20)
                .cashAvailable(0.0)
                .build();
        policyRepository.save(policy);

        return ResponseEntity.ok(saved);
    }

    @PutMapping("/customers/{id}")
    @Transactional
    public ResponseEntity<?> updateCustomer(@PathVariable Long id, @RequestBody Customer customerDetails) {
        return customerRepository.findById(id).map(customer -> {
            if (customerDetails.getName() != null) customer.setName(customerDetails.getName());
            if (customerDetails.getUsername() != null && !customerDetails.getUsername().trim().isEmpty()) {
                String trimmedUser = customerDetails.getUsername().trim();
                if (!customer.getUsername().equalsIgnoreCase(trimmedUser)) {
                    if (customerRepository.findByUsername(trimmedUser).isPresent()) {
                        return ResponseEntity.badRequest().body(Map.of("message", "Username already exists."));
                    }
                    customer.setUsername(trimmedUser);
                }
            }
            if (customerDetails.getPassword() != null && !customerDetails.getPassword().isEmpty()) {
                customer.setPassword(customerDetails.getPassword());
            }
            if (customerDetails.getCustomGeminiApiKey() != null) {
                customer.setCustomGeminiApiKey(customerDetails.getCustomGeminiApiKey());
            }
            Customer saved = customerRepository.save(customer);
            return ResponseEntity.ok(saved);
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/customers/{id}")
    @Transactional
    public ResponseEntity<?> deleteCustomer(@PathVariable Long id) {
        return customerRepository.findById(id).map(customer -> {
            // Cascade delete all scoped data
            holdingRepository.deleteAll(holdingRepository.findByCustomerId(id));
            watchlistRepository.deleteAll(watchlistRepository.findByCustomerId(id));
            transactionRepository.deleteAll(transactionRepository.findByCustomerId(id));
            portfolioSnapshotRepository.deleteAll(portfolioSnapshotRepository.findByCustomerId(id));
            policyRepository.findByCustomerId(id).ifPresent(policyRepository::delete);
            
            customerRepository.delete(customer);
            log.info("Deleted customer: {} and all associated portfolio details.", customer.getUsername());
            return ResponseEntity.ok(Map.of("success", true, "message", "Customer and all associated data deleted."));
        }).orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/settings/gemini")
    public ResponseEntity<Map<String, String>> getSystemGeminiKey() {
        Optional<Customer> adminOpt = customerRepository.findByUsername("admin");
        String key = adminOpt.map(Customer::getCustomGeminiApiKey).orElse("");
        return ResponseEntity.ok(Map.of("key", key != null ? key : ""));
    }

    @PutMapping("/settings/gemini")
    @Transactional
    public ResponseEntity<?> updateSystemGeminiKey(@RequestBody Map<String, String> payload) {
        String key = payload.get("key");
        Customer admin = customerRepository.findByUsername("admin")
                .orElseGet(() -> Customer.builder()
                        .username("admin")
                        .password("admin123")
                        .name("System Administrator")
                        .isAdmin(true)
                        .build());
        admin.setCustomGeminiApiKey(key);
        customerRepository.save(admin);
        return ResponseEntity.ok(Map.of("success", true, "message", "System default Gemini API key updated."));
    }
}
