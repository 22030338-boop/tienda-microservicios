# Tienda de Microservicios

Plataforma de comercio electrónico desarrollada mediante una arquitectura de microservicios multi-stack.

## Tecnologías

- PHP
- Python / FastAPI
- Go
- Node.js / Express
- Java / Spring Boot
- Angular
- PostgreSQL
- MongoDB
- Docker y Docker Compose

## Arquitectura

El sistema está compuesto por ocho microservicios independientes y una aplicación web.

## Servicios

| Servicio | Tecnología | Puerto |
|---|---|---|
| api-usuarios | PHP | 8001 |
| api-productos | PHP | 8002 |
| api-envios | Python | 8003 |
| api-inventario | Go | 8004 |
| api-carrito | Node.js | 8005 |
| api-pedidos | PHP | 8006 |
| api-pagos | Java | 8007 |
| api-resenas | Python | 8008 |
| frontend-tienda | Angular | 4200 |

## Ejecución

La plataforma se ejecutará mediante Docker Compose.

## Estado

En desarrollo.
