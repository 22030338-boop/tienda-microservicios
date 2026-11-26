# Tienda de Microservicios

Plataforma de comercio electrónico desarrollada mediante una arquitectura de microservicios multi-stack.

El proyecto utiliza ocho microservicios independientes y una aplicación web Angular. Cada microservicio administra su propia lógica de negocio y su propia base de datos.

## 1. Tecnologías

| Tecnología | Uso |
|---|---|
| PHP | Usuarios, productos y pedidos |
| Python / FastAPI | Envíos y reseñas |
| Go | Inventario |
| Node.js / Express | Carrito de compras |
| Java / Spring Boot | Pagos |
| Angular | Aplicación web |
| PostgreSQL | Persistencia de datos relacionales |
| MongoDB | Persistencia de reseñas |
| Docker | Contenedores |
| Docker Compose | Orquestación de servicios |

## 2. Arquitectura

La plataforma está compuesta por ocho microservicios y una aplicación frontend.

### Microservicios

| Servicio | Tecnología | Puerto |
|---|---|---:|
| api-usuarios | PHP | 8001 |
| api-productos | PHP | 8002 |
| api-envios | Python | 8003 |
| api-inventario | Go | 8004 |
| api-carrito | Node.js / Express | 8005 |
| api-pedidos | PHP | 8006 |
| api-pagos | Java / Spring Boot | 8007 |
| api-resenas | Python | 8008 |
| frontend-tienda | Angular | 4200 |

Los puertos corresponden a los asignados para los servicios del proyecto. Su publicación y configuración se incorporarán a Docker Compose conforme se integren los microservicios.

## 3. Infraestructura de bases de datos

La infraestructura utiliza dos motores de bases de datos:

- **PostgreSQL 17:** administra la información relacional.
- **MongoDB 8.0:** almacena las reseñas de productos.

Cada microservicio tiene su propia base de datos y credenciales de acceso. Esto permite mantener separados los datos y las responsabilidades de cada servicio.

### Bases de datos PostgreSQL

| Microservicio | Base de datos | Usuario |
|---|---|---|
| api-usuarios | usuarios_db | usuarios_user |
| api-productos | productos_db | productos_user |
| api-envios | envios_db | envios_user |
| api-inventario | inventario_db | inventario_user |
| api-carrito | carrito_db | carrito_user |
| api-pedidos | pedidos_db | pedidos_user |
| api-pagos | pagos_db | pagos_user |

### MongoDB

| Microservicio | Base de datos | Usuario |
|---|---|---|
| api-resenas | resenas_db | resenas_user |

La colección principal es `resenas`.

### Tablas iniciales de PostgreSQL

| Base de datos | Tablas |
|---|---|
| usuarios_db | usuarios |
| productos_db | categorias, productos |
| envios_db | envios |
| inventario_db | inventario, reservas |
| carrito_db | carritos, carrito_items |
| pedidos_db | pedidos, pedido_detalles |
| pagos_db | pagos |

Estas estructuras constituyen la base inicial y podrán ampliarse conforme avance el desarrollo.

## 4. Requisitos previos

Para ejecutar la infraestructura necesitas:

- Git.
- Docker.
- Docker Compose.
- Una terminal compatible con Bash.

Se recomienda utilizar Docker Desktop con integración WSL 2 o Docker Engine instalado en Linux.

## 5. Instalación y configuración

### 5.1. Requisitos previos

Antes de comenzar, instala:

- Git.
- Docker.
- Docker Compose.

### 5.2. Clonar el proyecto

```bash
git clone https://github.com/22030338-boop/tienda-microservicios.git
cd tienda-microservicios
```

### 5.3. Configurar las variables de entorno

Crear el archivo `.env` a partir del ejemplo:

```bash
cp .env.example .env
```

Editar `.env` y establecer contraseñas administrativas propias para PostgreSQL y MongoDB:

```bash
nano .env
```

No subir el archivo `.env` a GitHub ni compartir sus credenciales.

### 5.4. Iniciar la infraestructura

Ejecutar desde la raíz del proyecto:

```bash
docker compose up -d
```

Este comando inicia PostgreSQL y MongoDB, crea sus bases de datos, usuarios y estructuras iniciales.

### 5.5. Verificar la instalación

Consultar el estado de los contenedores:

```bash
docker compose ps
```

PostgreSQL y MongoDB deben aparecer como `healthy`.

Consultar los registros si existe algún problema:

```bash
docker compose logs
```

**Nota:** los scripts de inicialización se ejecutan únicamente cuando los volúmenes de las bases de datos se crean por primera vez. Los cambios posteriores en dichos scripts no modifican automáticamente las bases de datos existentes.
