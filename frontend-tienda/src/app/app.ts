import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ApiService,
  Producto,
  Usuario,
  Carrito,
  ArticuloCarrito,
  Inventario,
  Resena,
  ResenasRespuesta,
  CotizacionEnvio
} from './core/services/api.service';

interface ProductoTienda extends Producto {
  stock: number;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {

  vista: 'login' | 'registro' = 'login';

  email = '';
  password = '';
  nombre = '';
  confirmarPassword = '';

  mensaje = '';
  error = '';
  cargando = false;

  productos: ProductoTienda[] = [];
  autenticado = false;
  usuario: Usuario | null = null;

  carrito: Carrito | null = null;
  mostrarCarrito = false;
  procesandoCarrito = false;
  errorCarrito = '';

  // COTIZACIÓN DE ENVÍO Y PAGO
  zonaEnvio: 'local' | 'regional' | 'nacional' = 'local';
  pesoPaquete = 1;
  cotizacionEnvio: CotizacionEnvio | null = null;
  cotizandoEnvio = false;
  errorEnvio = '';
  metodoPago: 'tarjeta' | 'paypal' | 'transferencia' | 'oxxo' = 'tarjeta';

  // DATOS DE ENTREGA
  destinatarioEnvio = '';
  direccionEnvio = '';
  ciudadEnvio = '';

  // PROCESO DE COMPRA
  procesandoCompra = false;
  errorCompra = '';
  mensajeCompra = '';
  numeroSeguimiento = '';
  fechaEntregaEstimada = '';

  pedidoPendientePagoId: number | null = null;
  pedidoPagadoPendienteEnvioId: number | null = null;
  montoPedidoPendiente = 0;

  // DETALLE Y RESEÑAS
  productoSeleccionado: ProductoTienda | null = null;
  resenas: Resena[] = [];
  promedioResenas = 0;
  totalResenas = 0;
  cargandoResenas = false;
  enviandoResena = false;
  calificacionNueva = 5;
  comentarioNuevo = '';
  mensajeResena = '';
  errorResena = '';

  constructor(
    private api: ApiService,
    private cdr: ChangeDetectorRef
  ) {}

  actualizarVista(): void {
    this.cdr.markForCheck();
  }

  ngOnInit(): void {
    const token = localStorage.getItem('token');
    const usuarioGuardado = localStorage.getItem('usuario');

    if (token && usuarioGuardado) {
      try {
        this.usuario = JSON.parse(usuarioGuardado);
        this.autenticado = true;

        this.cargarProductos();
        this.cargarCarrito();
      } catch {
        this.cerrarSesion();
      }
    }

    this.actualizarVista();
  }

  iniciarSesion(): void {
    this.error = '';
    this.mensaje = '';
    this.cargando = true;
    this.actualizarVista();

    this.api.login(this.email, this.password).subscribe({
      next: (respuesta) => {
        localStorage.setItem('token', respuesta.token);
        localStorage.setItem(
          'usuario',
          JSON.stringify(respuesta.usuario)
        );

        this.usuario = respuesta.usuario;
        this.autenticado = true;
        this.cargando = false;

        this.cargarProductos();
        this.cargarCarrito();

        this.actualizarVista();
      },
      error: (err) => {
        this.error =
          err.error?.error || 'No se pudo iniciar sesión.';

        this.cargando = false;
        this.actualizarVista();
      }
    });
  }

  crearCuenta(): void {
    this.error = '';
    this.mensaje = '';

    if (this.password !== this.confirmarPassword) {
      this.error = 'Las contraseñas no coinciden.';
      this.actualizarVista();
      return;
    }

    if (this.password.length < 8) {
      this.error = 'La contraseña debe tener al menos 8 caracteres.';
      this.actualizarVista();
      return;
    }

    this.cargando = true;
    this.actualizarVista();

    this.api.registrar(
      this.nombre,
      this.email,
      this.password
    ).subscribe({
      next: () => {
        this.cargando = false;
        this.mensaje = '¡Cuenta creada! Ahora puedes iniciar sesión.';

        this.vista = 'login';
        this.nombre = '';
        this.password = '';
        this.confirmarPassword = '';

        this.actualizarVista();
      },
      error: (err) => {
        this.error =
          err.error?.errores
            ? Object.values(err.error.errores).flat().join(' ')
            : err.error?.message || 'No se pudo crear la cuenta.';

        this.cargando = false;
        this.actualizarVista();
      }
    });
  }

  cargarProductos(): void {
    this.api.obtenerProductos().subscribe({
      next: (respuesta) => {
        this.api.obtenerInventario().subscribe({
          next: (inventarioRespuesta) => {
            this.productos = respuesta.productos.map((producto) => {
              const existencia = inventarioRespuesta.inventario.find(
                (item: Inventario) =>
                  item.producto_id === producto.id
              );

              return {
                ...producto,
                stock: existencia?.existencias ?? 0
              };
            });

            this.actualizarVista();
          },
          error: () => {
            this.productos = respuesta.productos.map(producto => ({
              ...producto,
              stock: 0
            }));

            this.error = 'No se pudo consultar el inventario.';
            this.actualizarVista();
          }
        });
      },
      error: () => {
        this.error = 'No se pudieron cargar los productos.';
        this.actualizarVista();
      }
    });
  }

  cargarCarrito(): void {
    if (!this.usuario) return;

    this.api.obtenerCarrito(this.usuario.id).subscribe({
      next: (respuesta) => {
        this.carrito = respuesta;
        this.actualizarVista();
      },
      error: () => {
        this.errorCarrito = 'No se pudo cargar el carrito.';
        this.actualizarVista();
      }
    });
  }

  agregarAlCarrito(producto: ProductoTienda): void {
    if (!this.usuario || this.procesandoCarrito) return;

    const cantidadActual = this.cantidadEnCarrito(producto.id);

    if (cantidadActual >= producto.stock) {
      this.errorCarrito = 'No hay más existencias disponibles.';
      this.actualizarVista();
      return;
    }

    this.procesandoCarrito = true;
    this.errorCarrito = '';
    this.actualizarVista();

    this.api.agregarAlCarrito(
      this.usuario.id,
      producto.id,
      1
    ).subscribe({
      next: (respuesta) => {
        // Actualizar directamente con la respuesta del servidor.
        this.carrito = respuesta.carrito;
        this.procesandoCarrito = false;
        this.actualizarVista();
      },
      error: (err) => {
        this.errorCarrito =
          err.error?.error || 'No se pudo agregar el producto.';

        this.procesandoCarrito = false;
        this.actualizarVista();
      }
    });
  }

  cambiarCantidad(item: ArticuloCarrito, cantidad: number): void {
    if (!this.usuario || this.procesandoCarrito) return;
    if (cantidad < 1) return;

    const producto = this.productos.find(
      p => p.id === item.producto_id
    );

    if (producto && cantidad > producto.stock) {
      this.errorCarrito =
        'La cantidad supera las existencias disponibles.';

      this.actualizarVista();
      return;
    }

    this.procesandoCarrito = true;
    this.errorCarrito = '';
    this.actualizarVista();

    this.api.actualizarCantidadCarrito(
      this.usuario.id,
      item.producto_id,
      cantidad
    ).subscribe({
      next: () => {
        this.cargarCarrito();
        this.procesandoCarrito = false;
        this.actualizarVista();
      },
      error: (err) => {
        this.errorCarrito =
          err.error?.error || 'No se pudo actualizar la cantidad.';

        this.procesandoCarrito = false;
        this.actualizarVista();
      }
    });
  }

  eliminarDelCarrito(productoId: number): void {
    if (!this.usuario || this.procesandoCarrito) return;

    this.procesandoCarrito = true;
    this.errorCarrito = '';
    this.actualizarVista();

    this.api.eliminarDelCarrito(
      this.usuario.id,
      productoId
    ).subscribe({
      next: () => {
        this.cargarCarrito();
        this.procesandoCarrito = false;
        this.actualizarVista();
      },
      error: (err) => {
        this.errorCarrito =
          err.error?.error || 'No se pudo eliminar el producto.';

        this.procesandoCarrito = false;
        this.actualizarVista();
      }
    });
  }

  vaciarCarrito(): void {
    if (!this.usuario || this.procesandoCarrito) return;

    this.procesandoCarrito = true;
    this.errorCarrito = '';
    this.actualizarVista();

    this.api.vaciarCarrito(this.usuario.id).subscribe({
      next: () => {
        this.cargarCarrito();
        this.procesandoCarrito = false;
        this.actualizarVista();
      },
      error: (err) => {
        this.errorCarrito =
          err.error?.error || 'No se pudo vaciar el carrito.';

        this.procesandoCarrito = false;
        this.actualizarVista();
      }
    });
  }

  cotizarEnvio(): void {
    if (!this.carrito || this.carrito.productos.length === 0 || this.cotizandoEnvio) {
      return;
    }

    if (!Number.isFinite(this.pesoPaquete) || this.pesoPaquete <= 0 || this.pesoPaquete > 100) {
      this.errorEnvio = 'El peso debe ser mayor que 0 y no superar los 100 kg.';
      this.cotizacionEnvio = null;
      this.actualizarVista();
      return;
    }

    this.cotizandoEnvio = true;
    this.errorEnvio = '';
    this.cotizacionEnvio = null;
    this.actualizarVista();

    this.api.cotizarEnvio(this.zonaEnvio, this.pesoPaquete).subscribe({
      next: (respuesta) => {
        this.cotizacionEnvio = respuesta.cotizacion;
        this.cotizandoEnvio = false;
        this.actualizarVista();
      },
      error: (err) => {
        this.errorEnvio =
          err.error?.detail || err.error?.error ||
          'No se pudo calcular el costo del envío.';
        this.cotizandoEnvio = false;
        this.actualizarVista();
      }
    });
  }

  // ==========================================
  // PROCESAR COMPRA
  // ==========================================

  procesarCompra(): void {
    if (this.procesandoCompra) return;

    this.errorCompra = '';
    this.mensajeCompra = '';

    if (!this.usuario) {
      this.errorCompra = 'Debes iniciar sesión para comprar.';
      this.actualizarVista();
      return;
    }

    if (!this.carrito || this.carrito.productos.length === 0) {
      this.errorCompra = 'Tu carrito está vacío.';
      this.actualizarVista();
      return;
    }

    if (!this.cotizacionEnvio) {
      this.errorCompra = 'Primero debes calcular el costo del envío.';
      this.actualizarVista();
      return;
    }

    if (
      this.destinatarioEnvio.trim().length < 2 ||
      this.direccionEnvio.trim().length < 5 ||
      this.ciudadEnvio.trim().length < 2
    ) {
      this.errorCompra = 'Completa correctamente los datos de entrega.';
      this.actualizarVista();
      return;
    }

    this.procesandoCompra = true;
    this.actualizarVista();

    // Si el pedido ya está pagado, reintentar solamente el envío.
    if (this.pedidoPagadoPendienteEnvioId) {
      this.registrarEnvioPendiente();
      return;
    }

    // Si el pedido existe pero el pago fue rechazado o falló,
    // reintentar el pago sin crear otro pedido.
    if (this.pedidoPendientePagoId) {
      this.pagarPedidoPendiente();
      return;
    }

    // Crear un pedido nuevo.
    this.api.crearPedido(
      this.usuario.id,
      this.direccionEnvio.trim(),
      this.cotizacionEnvio.costo
    ).subscribe({
      next: (respuesta) => {
        const pedidoId = Number(
          respuesta?.id ??
          respuesta?.pedido?.id ??
          respuesta?.pedido_id
        );

        if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
          this.procesandoCompra = false;
          this.errorCompra =
            'El servidor creó una respuesta inesperada para el pedido. ' +
            'No vuelvas a comprar hasta verificarlo.';
          this.actualizarVista();
          return;
        }

        this.pedidoPendientePagoId = pedidoId;
        this.montoPedidoPendiente =
          this.totalCarrito + this.cotizacionEnvio!.costo;

        this.pagarPedidoPendiente();
      },
      error: (err) => {
        this.procesandoCompra = false;
        this.errorCompra =
          err.error?.error ||
          'No se pudo crear el pedido. Revisa tu carrito e inténtalo nuevamente.';
        this.actualizarVista();
      }
    });
  }

  private pagarPedidoPendiente(): void {
    const pedidoId = this.pedidoPendientePagoId;

    if (!pedidoId) {
      this.procesandoCompra = false;
      this.actualizarVista();
      return;
    }

    this.api.procesarPago(
      pedidoId,
      this.montoPedidoPendiente,
      this.metodoPago
    ).subscribe({
      next: (pago) => {
        if (pago.estado !== 'aprobado') {
          this.procesandoCompra = false;
          this.errorCompra =
            pago.motivo || 'El pago fue rechazado. Puedes intentar nuevamente.';
          this.actualizarVista();
          return;
        }

        this.pedidoPendientePagoId = null;
        this.pedidoPagadoPendienteEnvioId = pedidoId;

        this.registrarEnvioPendiente();
      },
      error: (err) => {
        this.procesandoCompra = false;
        this.errorCompra =
          err.error?.error ||
          'No se pudo confirmar el pago. Revisa el estado del pedido antes de volver a intentarlo.';
        this.actualizarVista();
      }
    });
  }

  private registrarEnvioPendiente(): void {
    const pedidoId = this.pedidoPagadoPendienteEnvioId;

    if (!pedidoId || !this.cotizacionEnvio) {
      this.procesandoCompra = false;
      this.actualizarVista();
      return;
    }

    this.api.crearEnvio({
      pedido_id: pedidoId,
      destinatario: this.destinatarioEnvio.trim(),
      direccion: this.direccionEnvio.trim(),
      ciudad: this.ciudadEnvio.trim(),
      zona: this.zonaEnvio,
      peso_kg: this.pesoPaquete
    }).subscribe({
      next: (respuesta) => {
        const envio = respuesta.envio;

        this.numeroSeguimiento =
          envio?.numero_seguimiento || '';

        this.fechaEntregaEstimada =
          envio?.fecha_estimada_entrega || '';

        this.pedidoPagadoPendienteEnvioId = null;
        this.procesandoCompra = false;

        this.mensajeCompra =
          `¡Compra completada! Pedido #${pedidoId}. ` +
          `Número de seguimiento: ${this.numeroSeguimiento || 'registrado'}.`;

        // Vaciar el carrito después de registrar el envío.
        if (this.usuario) {
          this.api.vaciarCarrito(this.usuario.id).subscribe({
            next: () => {
              this.carrito = {
                usuario_id: this.usuario!.id,
                productos: [],
                total: 0
              };
              this.cotizacionEnvio = null;
              this.actualizarVista();
            },
            error: () => {
              this.errorCompra =
                'El pedido y el envío se registraron, pero no se pudo vaciar el carrito.';
              this.actualizarVista();
            }
          });
        }

        this.actualizarVista();
      },
      error: (err) => {
        this.procesandoCompra = false;
        this.errorCompra =
          err.error?.detail ||
          err.error?.error ||
          'El pago fue aprobado, pero no se pudo registrar el envío. ' +
          'Puedes reintentar sin volver a pagar.';
        this.actualizarVista();
      }
    });
  }

  cantidadEnCarrito(productoId: number): number {
    return this.carrito?.productos.find(
      item => item.producto_id === productoId
    )?.cantidad ?? 0;
  }

  nombreProducto(productoId: number): string {
    return this.productos.find(
      producto => producto.id === productoId
    )?.nombre ?? `Producto #${productoId}`;
  }

  stockProducto(productoId: number): number {
    return this.productos.find(
      producto => producto.id === productoId
    )?.stock ?? 0;
  }

  get totalArticulos(): number {
    return this.carrito?.productos.reduce(
      (total, item) => total + item.cantidad,
      0
    ) ?? 0;
  }

  get totalCarrito(): number {
    return Number(this.carrito?.total ?? 0);
  }

  get totalConEnvio(): number {
    return this.totalCarrito + (this.cotizacionEnvio?.costo ?? 0);
  }

  // DETALLE DEL PRODUCTO Y RESEÑAS

  abrirDetalle(producto: ProductoTienda): void {
    this.productoSeleccionado = producto;
    this.resenas = [];
    this.promedioResenas = 0;
    this.totalResenas = 0;
    this.comentarioNuevo = '';
    this.calificacionNueva = 5;
    this.mensajeResena = '';
    this.errorResena = '';
    this.cargarResenas(producto.id);
  }

  cerrarDetalle(): void {
    this.productoSeleccionado = null;
    this.resenas = [];
    this.errorResena = '';
    this.mensajeResena = '';
  }

  cargarResenas(productoId: number): void {
    this.cargandoResenas = true;
    this.errorResena = '';
    this.actualizarVista();

    this.api.obtenerResenas(productoId).subscribe({
      next: (respuesta: ResenasRespuesta) => {
        this.resenas = respuesta.resenas;
        this.promedioResenas = respuesta.promedio;
        this.totalResenas = respuesta.total;
        this.cargandoResenas = false;
        this.actualizarVista();
      },
      error: () => {
        this.errorResena = 'No se pudieron cargar las reseñas.';
        this.cargandoResenas = false;
        this.actualizarVista();
      }
    });
  }

  publicarResena(): void {
    if (!this.productoSeleccionado || this.enviandoResena) return;

    const comentario = this.comentarioNuevo.trim();

    if (!comentario) {
      this.errorResena = 'Escribe un comentario antes de publicar.';
      return;
    }

    if (this.calificacionNueva < 1 || this.calificacionNueva > 5) {
      this.errorResena = 'Selecciona una calificación entre 1 y 5.';
      return;
    }

    this.enviandoResena = true;
    this.errorResena = '';
    this.mensajeResena = '';
    this.actualizarVista();

    this.api.crearResena(
      this.productoSeleccionado.id,
      this.calificacionNueva,
      comentario
    ).subscribe({
      next: () => {
        this.mensajeResena = '¡Tu reseña se publicó correctamente!';
        this.comentarioNuevo = '';
        this.calificacionNueva = 5;
        this.enviandoResena = false;
        this.cargarResenas(this.productoSeleccionado!.id);
        this.actualizarVista();
      },
      error: (err) => {
        this.errorResena =
          err.error?.error || 'No se pudo publicar la reseña.';

        this.enviandoResena = false;
        this.actualizarVista();
      }
    });
  }

  cerrarSesion(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');

    this.autenticado = false;
    this.usuario = null;
    this.productos = [];
    this.carrito = null;
    this.mostrarCarrito = false;
    this.procesandoCarrito = false;
    this.cerrarDetalle();

    this.email = '';
    this.password = '';
    this.nombre = '';
    this.confirmarPassword = '';

    this.vista = 'login';
    this.error = '';
    this.errorCarrito = '';
    this.cotizacionEnvio = null;
    this.errorEnvio = '';
    this.cotizandoEnvio = false;
    this.mensaje = '';

    this.destinatarioEnvio = '';
    this.direccionEnvio = '';
    this.ciudadEnvio = '';
    this.errorCompra = '';
    this.mensajeCompra = '';
    this.numeroSeguimiento = '';
    this.fechaEntregaEstimada = '';
    this.pedidoPendientePagoId = null;
    this.pedidoPagadoPendienteEnvioId = null;
    this.montoPedidoPendiente = 0;

    this.actualizarVista();
  }
}
