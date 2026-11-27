
# ---------- Etapa 1: compilar ----------
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app

# Se copia primero el pom para aprovechar la caché de dependencias
COPY pom.xml .
RUN mvn dependency:go-offline -B

COPY src ./src
RUN mvn package -DskipTests -B

# ---------- Etapa 2: ejecutar ----------
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

COPY --from=build /app/target/api-pagos.jar app.jar

EXPOSE 8007
ENTRYPOINT ["java", "-jar", "app.jar"]