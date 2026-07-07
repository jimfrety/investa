package com.investa.controller;

import com.investa.model.Customer;
import com.investa.repository.CustomerRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin
public class AuthController {

    private final CustomerRepository customerRepository;

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> credentials) {
        String username = credentials.get("username");
        String password = credentials.get("password");

        if (username == null || password == null) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Username and password required."));
        }

        Optional<Customer> opt = customerRepository.findByUsername(username.trim());
        if (opt.isPresent() && opt.get().getPassword().equals(password)) {
            Customer customer = opt.get();
            Map<String, Object> resp = new HashMap<>();
            resp.put("success", true);
            resp.put("customerId", customer.getId());
            resp.put("username", customer.getUsername());
            resp.put("name", customer.getName());
            resp.put("isAdmin", customer.isAdmin());
            return ResponseEntity.ok(resp);
        }

        return ResponseEntity.status(401).body(Map.of("success", false, "message", "Invalid username or password."));
    }

    @GetMapping("/health")
    public ResponseEntity<?> health() {
        return ResponseEntity.ok(Map.of("status", "UP"));
    }

    @PutMapping("/profile")
    public ResponseEntity<?> updateProfile(
            @RequestHeader("X-Customer-ID") Long customerId,
            @RequestBody Map<String, String> payload) {
        String newUsername = payload.get("username");
        String newPassword = payload.get("password");
        String newName = payload.get("name");

        Optional<Customer> opt = customerRepository.findById(customerId);
        if (opt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("message", "User profile not found."));
        }

        Customer customer = opt.get();

        if (newUsername != null && !newUsername.trim().isEmpty()) {
            String trimmedUser = newUsername.trim();
            if (!customer.getUsername().equalsIgnoreCase(trimmedUser)) {
                if (customerRepository.findByUsername(trimmedUser).isPresent()) {
                    return ResponseEntity.badRequest().body(Map.of("message", "Username already exists."));
                }
                customer.setUsername(trimmedUser);
            }
        }

        if (newName != null) {
            customer.setName(newName.trim());
        }

        if (newPassword != null && !newPassword.isEmpty()) {
            customer.setPassword(newPassword);
        }

        Customer saved = customerRepository.save(customer);
        Map<String, Object> resp = new HashMap<>();
        resp.put("success", true);
        resp.put("customerId", saved.getId());
        resp.put("username", saved.getUsername());
        resp.put("name", saved.getName());
        resp.put("isAdmin", saved.isAdmin());
        return ResponseEntity.ok(resp);
    }
}
