plugins {
	java
	id("org.springframework.boot") version "4.1.0"
	id("io.spring.dependency-management") version "1.1.7"
	jacoco
}

group = "com.platinumrelations.interview"
version = "0.0.1-SNAPSHOT"

java {
	toolchain {
		languageVersion = JavaLanguageVersion.of(25)
	}
}

repositories {
	mavenCentral()
}

dependencies {
	implementation("org.springframework.boot:spring-boot-starter-webmvc")
	testImplementation("org.springframework.boot:spring-boot-starter-webmvc-test")
	implementation("org.springframework.boot:spring-boot-starter-data-jdbc")
	testImplementation("org.springframework.boot:spring-boot-starter-data-jdbc-test")
	implementation ("org.springframework.boot:spring-boot-starter-validation")
	implementation ("org.springframework.boot:spring-boot-starter-actuator")

	runtimeOnly("org.postgresql:postgresql")

	testImplementation("org.springframework.boot:spring-boot-h2console")
	testImplementation("com.h2database:h2")

	implementation("org.springdoc:springdoc-openapi-starter-webmvc-ui:3.0.3")

	implementation("tools.jackson.dataformat:jackson-dataformat-csv:")
	implementation("tools.jackson.core:jackson-databind")

	compileOnly("org.projectlombok:lombok:1.18.46")
	annotationProcessor("org.projectlombok:lombok:1.18.46")

	testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

jacoco {
	toolVersion = "0.8.15"
}

tasks.withType<Test> {
	useJUnitPlatform()
	finalizedBy(tasks.jacocoTestReport)
}

tasks.jacocoTestReport {
	dependsOn(tasks.test)

	reports {
		xml.required.set(true)
		csv.required.set(false)
		html.required.set(true)
	}
}

// Skip the extra -plain.jar and give bootJar a fixed name so the Dockerfile
// doesn't have to glob for it.
tasks.named<Jar>("jar") {
	enabled = false
}

// bootRun is local-dev only — the image builds bootJar and runs `java -jar` with no active
// profile — so it defaults to the `local` profile, which points the datasource at
// localhost instead of the `db` service name that only works on a docker network.
tasks.named<org.springframework.boot.gradle.tasks.run.BootRun>("bootRun") {
	environment("SPRING_PROFILES_ACTIVE", System.getenv("SPRING_PROFILES_ACTIVE") ?: "local")
}

tasks.javadoc {
	destinationDir = file("$buildDir/custom-javadoc-path")

	options {
		encoding = "UTF-8"
		this as StandardJavadocDocletOptions
		charSet("UTF-8")
		author(true)
		version(true)
		addBooleanOption("html5", true)
		addBooleanOption("Xdoclint:none", true)
	}

	isFailOnError = false
}