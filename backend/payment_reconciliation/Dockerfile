# syntax=docker/dockerfile:1.7
#
# Spring Boot 4.1 + Java 25 + Gradle
#
# Build:  DOCKER_BUILDKIT=1 docker build -t myapp:latest .
# Run:    docker run --rm -p 8080:8080 myapp:latest

ARG JDK_IMAGE=eclipse-temurin:25-jdk-alpine
ARG JRE_IMAGE=eclipse-temurin:25-jre-alpine


##############################################################################
# 1. Gradle build -> fat jar
##############################################################################
FROM ${JDK_IMAGE} AS build
WORKDIR /src

# Wrapper + build scripts first so dependency resolution is cached
# independently of source changes.
COPY gradlew ./
COPY gradle ./gradle
COPY settings.gradle.kts build.gradle.kts gradle.properties ./
RUN chmod +x gradlew
RUN --mount=type=cache,target=/root/.gradle \
    ./gradlew --no-daemon -q dependencies > /dev/null 2>&1 || true

COPY src ./src
RUN --mount=type=cache,target=/root/.gradle \
    ./gradlew --no-daemon -x test bootJar

# build.gradle.kts should only be generating one jar that matches, so this is deterministic.
RUN cp build/libs/payment_reconciliation-*.jar /src/application.jar


##############################################################################
# 2. Explode the layered jar
#
# `extract` (jarmode=tools, Boot 3.3+) writes a *plain* application.jar with a
# Class-Path manifest plus lib/*.jar.
# `--layers` splits that output across the layer directories from layers.idx.
##############################################################################
FROM ${JRE_IMAGE} AS extract
WORKDIR /extract
COPY --from=build /src/application.jar ./application.jar
RUN java -Djarmode=tools -jar application.jar extract --layers --destination ./layers \
 && rm application.jar \
 && ls -R ./layers | head -40

##############################################################################
# 3. Runtime
#
# Layers are copied stable-first so Docker's cache survives code-only changes.
# The .aot file changes on every build, so it goes last.
##############################################################################
FROM ${JRE_IMAGE}

RUN addgroup -g 10001 -S spring && \
    adduser -u 10001 -S -D -H -s /sbin/nologin -G spring spring

WORKDIR /application

# Copied from the SAME extract stage as the training run: identical bytes and
# mtimes, so the cache's classpath validation passes.
COPY --from=extract /extract/layers/dependencies/ ./
COPY --from=extract /extract/layers/snapshot-dependencies/ ./
COPY --from=extract /extract/layers/application/ ./

USER 10001
EXPOSE 8080

ENTRYPOINT ["java", \
  "-XX:MaxRAMPercentage=75", \
  "-XX:+ExitOnOutOfMemoryError", \
  "-jar", "application.jar"]