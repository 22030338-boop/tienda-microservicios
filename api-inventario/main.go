package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	_ "github.com/jackc/pgx/v5/stdlib"
)

var db *sql.DB

type SolicitudReserva struct {
	PedidoID int64 `json:"pedido_id" binding:"required,gt=0"`
	Cantidad int   `json:"cantidad" binding:"required,gt=0"`
}

func conectarDB() error {
	host := os.Getenv("DB_HOST")
	port := os.Getenv("DB_PORT")
	name := os.Getenv("DB_NAME")
	user := os.Getenv("DB_USER")
	password := os.Getenv("DB_PASSWORD")
	sslmode := os.Getenv("DB_SSLMODE")

	if host == "" || name == "" || user == "" || password == "" {
		return fmt.Errorf("faltan variables de entorno de PostgreSQL")
	}

	if port == "" {
		port = "5432"
	}

	if sslmode == "" {
		sslmode = "disable"
	}

	dsn := url.URL{
		Scheme: "postgres",
		User:   url.UserPassword(user, password),
		Host:   net.JoinHostPort(host, port),
		Path:   name,
	}

	query := url.Values{}
	query.Set("sslmode", sslmode)
	dsn.RawQuery = query.Encode()

	var err error

	db, err = sql.Open("pgx", dsn.String())
	if err != nil {
		return fmt.Errorf("no se pudo abrir la conexión: %w", err)
	}

	db.SetMaxOpenConns(20)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(30 * time.Minute)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		return fmt.Errorf("no se pudo conectar a PostgreSQL: %w", err)
	}

	log.Println("Conexión a PostgreSQL establecida correctamente")

	return nil
}

func main() {
	if err := conectarDB(); err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	r := gin.Default()

	r.GET("/api/salud", func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), 3*time.Second)
		defer cancel()

		if err := db.PingContext(ctx); err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"servicio": "api-inventario",
				"estado":   "sin conexión a PostgreSQL",
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"servicio": "api-inventario",
			"estado":   "activo",
			"baseDatos": "conectada",
		})
	})

	r.GET("/api/inventario/:id", consultarInventario)

	r.POST("/api/inventario/:id/reservar", reservarInventario)

	r.POST("/api/inventario/reservas/:id/liberar", liberarReserva)

	r.POST("/api/inventario/reservas/:id/confirmar", confirmarReserva)

	if err := r.Run(":8004"); err != nil {
		log.Fatal("Error al iniciar el servidor: ", err)
	}
}

func consultarInventario(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)

	if err != nil || id < 1 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "ID inválido",
		})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var stock int

	err = db.QueryRowContext(ctx,
		`SELECT existencias
		 FROM inventario
		 WHERE producto_id = $1`,
		id,
	).Scan(&stock)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Producto no encontrado en el inventario",
		})
		return
	}

	if err != nil {
		log.Println("Error al consultar inventario:", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "No se pudo consultar el inventario",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"producto_id": id,
		"stock":       stock,
	})
}

func reservarInventario(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)

	if err != nil || id < 1 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "ID inválido",
		})
		return
	}

	var solicitud SolicitudReserva

	if err := c.ShouldBindJSON(&solicitud); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Se requiere un pedido_id y una cantidad mayor que cero",
		})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		log.Println("Error al iniciar transacción:", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "No se pudo iniciar la reserva",
		})
		return
	}
	defer tx.Rollback()

	var stockRestante int

	err = tx.QueryRowContext(ctx,
		`UPDATE inventario
		 SET existencias = existencias - $1,
		     actualizado_en = CURRENT_TIMESTAMP
		 WHERE producto_id = $2
		   AND existencias >= $1
		 RETURNING existencias`,
		solicitud.Cantidad,
		id,
	).Scan(&stockRestante)

	if err == sql.ErrNoRows {
		var existe bool

		checkErr := tx.QueryRowContext(ctx,
			`SELECT EXISTS(
				SELECT 1 FROM inventario WHERE producto_id = $1
			)`,
			id,
		).Scan(&existe)

		if checkErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "No se pudo verificar el producto",
			})
			return
		}

		if !existe {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "Producto no encontrado en el inventario",
			})
			return
		}

		c.JSON(http.StatusConflict, gin.H{
			"error": "Stock insuficiente",
		})
		return
	}

	if err != nil {
		log.Println("Error al descontar existencias:", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "No se pudo reservar el inventario",
		})
		return
	}

	var reservaID int64

	err = tx.QueryRowContext(ctx,
		`INSERT INTO reservas
			(pedido_id, producto_id, cantidad, estado)
		 VALUES ($1, $2, $3, 'pendiente')
		 RETURNING id`,
		solicitud.PedidoID,
		id,
		solicitud.Cantidad,
	).Scan(&reservaID)

	if err != nil {
		log.Println("Error al registrar reserva:", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "No se pudo registrar la reserva",
		})
		return
	}

	if err := tx.Commit(); err != nil {
		log.Println("Error al confirmar transacción:", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "No se pudo completar la reserva",
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"mensaje":       "Stock reservado correctamente",
		"reserva_id":    reservaID,
		"pedido_id":     solicitud.PedidoID,
		"producto_id":   id,
		"cantidad":      solicitud.Cantidad,
		"stock_restante": stockRestante,
		"estado":        "pendiente",
	})
}

func liberarReserva(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)

	if err != nil || id < 1 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "ID de reserva inválido",
		})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "No se pudo iniciar la operación",
		})
		return
	}
	defer tx.Rollback()

	var productoID int64
	var cantidad int
	var estado string

	err = tx.QueryRowContext(ctx,
		`SELECT producto_id, cantidad, estado
		 FROM reservas
		 WHERE id = $1
		 FOR UPDATE`,
		id,
	).Scan(&productoID, &cantidad, &estado)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Reserva no encontrada",
		})
		return
	}

	if err != nil {
		log.Println("Error al consultar reserva:", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "No se pudo consultar la reserva",
		})
		return
	}

	if estado != "pendiente" {
		c.JSON(http.StatusConflict, gin.H{
			"error": "La reserva ya fue procesada",
			"estado": estado,
		})
		return
	}

	_, err = tx.ExecContext(ctx,
		`UPDATE reservas
		 SET estado = 'liberada'
		 WHERE id = $1`,
		id,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "No se pudo actualizar la reserva",
		})
		return
	}

	_, err = tx.ExecContext(ctx,
		`UPDATE inventario
		 SET existencias = existencias + $1,
		     actualizado_en = CURRENT_TIMESTAMP
		 WHERE producto_id = $2`,
		cantidad,
		productoID,
	)

	if err != nil {
		log.Println("Error al devolver existencias:", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "No se pudo devolver el stock",
		})
		return
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "No se pudo completar la liberación",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"mensaje":    "Reserva liberada correctamente",
		"reserva_id": id,
		"estado":     "liberada",
	})
}

func confirmarReserva(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)

	if err != nil || id < 1 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "ID de reserva inválido",
		})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	resultado, err := db.ExecContext(ctx,
		`UPDATE reservas
		 SET estado = 'confirmada'
		 WHERE id = $1
		   AND estado = 'pendiente'`,
		id,
	)

	if err != nil {
		log.Println("Error al confirmar reserva:", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "No se pudo confirmar la reserva",
		})
		return
	}

	filas, err := resultado.RowsAffected()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "No se pudo verificar la operación",
		})
		return
	}

	if filas == 0 {
		var estado string

		err := db.QueryRowContext(ctx,
			`SELECT estado FROM reservas WHERE id = $1`,
			id,
		).Scan(&estado)

		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "Reserva no encontrada",
			})
			return
		}

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "No se pudo consultar la reserva",
			})
			return
		}

		c.JSON(http.StatusConflict, gin.H{
			"error":  "La reserva ya fue procesada",
			"estado": estado,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"mensaje":    "Reserva confirmada correctamente",
		"reserva_id": id,
		"estado":     "confirmada",
	})
}
