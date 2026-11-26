package main

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

type Producto struct {
	ID     int `json:"id"`
	Stock  int `json:"stock"`
}

var inventario = map[int]int{
	1: 10,
	2: 25,
	3: 15,
}

func main() {
	r := gin.Default()

	r.GET("/api/salud", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"servicio": "api-inventario",
			"estado":   "activo",
		})
	})

	r.GET("/api/inventario/:id", func(c *gin.Context) {
		id, err := strconv.Atoi(c.Param("id"))

		if err != nil || id < 1 {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "ID inválido",
			})
			return
		}

		stock, existe := inventario[id]

		if !existe {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "Producto no encontrado",
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"producto_id": id,
			"stock":      stock,
		})
	})

	r.POST("/api/inventario/:id/reservar", func(c *gin.Context) {
		id, err := strconv.Atoi(c.Param("id"))

		if err != nil || id < 1 {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "ID inválido",
			})
			return
		}

		var solicitud struct {
			Cantidad int `json:"cantidad" binding:"required,gt=0"`
		}

		if err := c.ShouldBindJSON(&solicitud); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Cantidad inválida",
			})
			return
		}

		stock, existe := inventario[id]

		if !existe {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "Producto no encontrado",
			})
			return
		}

		if stock < solicitud.Cantidad {
			c.JSON(http.StatusConflict, gin.H{
				"error": "Stock insuficiente",
			})
			return
		}

		inventario[id] -= solicitud.Cantidad

		c.JSON(http.StatusOK, gin.H{
			"mensaje":     "Stock reservado",
			"producto_id": id,
			"stock":      inventario[id],
		})
	})

	r.Run(":8004")
}
