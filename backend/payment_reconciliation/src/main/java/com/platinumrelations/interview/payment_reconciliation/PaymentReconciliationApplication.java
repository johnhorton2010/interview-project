package com.platinumrelations.interview.payment_reconciliation;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Entry point for the payment reconciliation service.
 *
 * <p>Component scanning is rooted at this package, so every {@code core}, {@code ledger},
 * {@code processor}, and {@code reconciliation} bean is discovered from here. Startup fails fast
 * if the fee schedule or the configured holiday list cannot be parsed; those failures are
 * translated into readable diagnostics by the {@code AbstractFailureAnalyzer} implementations in
 * {@code reconciliation.exception}.
 *
 * @author John
 */
@SpringBootApplication
public class PaymentReconciliationApplication {

	/**
	 * Boots the Spring application context.
	 *
	 * @param args standard command line arguments, forwarded to Spring Boot; typically used to
	 *             override properties such as {@code --spring.profiles.active}
	 */
	public static void main(String[] args) {
		SpringApplication.run(PaymentReconciliationApplication.class, args);
	}

}
