import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Usuario {
  id: number;
  nombre: string;
  correo: string;
  rol: string;
}

export interface Producto {
  id: number;
  nombre: string;
  descripcion: string;
  precio: number;
  categoria_id: number | null;
  categoria: string | null;
}

export interface Inventario {
  producto_id: number;
  existencias: number;
  actualizado_en?: string;
}

export interface StockProducto {
  producto_id: number;
  stock: number;
}

export interface ArticuloCarrito {
  producto_id: number;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

export interface Carrito {
  usuario_id: number;
  productos: ArticuloCarrito[];
  total: number;
}

export interface LoginResponse {
  mensaje: string;
  token: string;
  tipo: string;
  expires_in: number;
  usuario: Usuario;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  private readonly usuariosUrl = 'http://localhost:8001/api';
  private readonly productosUrl = 'http://localhost:8002/api';
  private readonly inventarioUrl = 'http://localhost:8004/api';
  private readonly carritoUrl = 'http://localhost:8005/api';
  private readonly resenasUrl = 'http://localhost:8008/api';
  private readonly enviosUrl = 'http://localhost:8003/api';
  private readonly pedidosUrl = 'http://localhost:8006/api';
  private readonly pagosUrl = 'http://localhost:8007/api';

  constructor(private http: HttpClient) {}

  // USUARIOS

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(
      `${this.usuariosUrl}/usuarios/login`,
      { email, password }
    );
  }

  registrar(nombre: string, email: string, password: string): Observable<any> {
    return this.http.post(
      `${this.usuariosUrl}/usuarios/registro`,
      { nombre, email, password }
    );
  }

  // PRODUCTOS

  obtenerProductos(): Observable<{ productos: Producto[] }> {
    return this.http.get<{ productos: Producto[] }>(
      `${this.productosUrl}/productos`
    );
  }

  obtenerProducto(id: number): Observable<{ producto: Producto }> {
    return this.http.get<{ producto: Producto }>(
      `${this.productosUrl}/productos/${id}`
    );
  }

  // INVENTARIO

  obtenerInventario(): Observable<{ inventario: Inventario[] }> {
    return this.http.get<{ inventario: Inventario[] }>(
      `${this.inventarioUrl}/inventario`
    );
  }

  obtenerStock(id: number): Observable<StockProducto> {
    return this.http.get<StockProducto>(
      `${this.inventarioUrl}/inventario/${id}`
    );
  }


  // ENVÍOS

  cotizarEnvio(
    zona: 'local' | 'regional' | 'nacional',
    pesoKg: number
  ): Observable<CotizacionEnvioRespuesta> {
    return this.http.post<CotizacionEnvioRespuesta>(
      `${this.enviosUrl}/envios/cotizar`,
      { zona, peso_kg: pesoKg }
    );
  }

  // PEDIDOS

  crearPedido(
    usuarioId: number,
    direccion: string,
    costoEnvio: number
  ): Observable<any> {
    return this.http.post(
      `${this.pedidosUrl}/pedidos`,
      {
        usuario_id: usuarioId,
        direccion,
        costo_envio: costoEnvio
      }
    );
  }

  // PAGOS

  procesarPago(
    pedidoId: number,
    monto: number,
    metodoPago: string
  ): Observable<any> {
    return this.http.post(
      `${this.pagosUrl}/pagos/procesar`,
      {
        pedido_id: pedidoId,
        monto,
        metodo_pago: metodoPago
      }
    );
  }

  // ENVÍO DEL PEDIDO

  crearEnvio(datos: {
    pedido_id: number;
    destinatario: string;
    direccion: string;
    ciudad: string;
    zona: 'local' | 'regional' | 'nacional';
    peso_kg: number;
  }): Observable<any> {
    return this.http.post(
      `${this.enviosUrl}/envios`,
      datos
    );
  }

  // RESEÑAS

  obtenerResenas(productoId: number): Observable<ResenasRespuesta> {
    return this.http.get<ResenasRespuesta>(
      `${this.resenasUrl}/resenas/producto/${productoId}`
    );
  }

  crearResena(
    productoId: number,
    calificacion: number,
    comentario: string
  ): Observable<Resena> {
    const token = localStorage.getItem('token');

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });

    return this.http.post<Resena>(
      `${this.resenasUrl}/resenas`,
      {
        producto_id: productoId,
        calificacion,
        comentario
      },
      { headers }
    );
  }


  // CARRITO

  obtenerCarrito(usuarioId: number): Observable<Carrito> {
    return this.http.get<Carrito>(
      `${this.carritoUrl}/carrito/${usuarioId}`
    );
  }

  agregarAlCarrito(
    usuarioId: number,
    productoId: number,
    cantidad: number
  ): Observable<{ mensaje: string; carrito: Carrito }> {
    return this.http.post<{ mensaje: string; carrito: Carrito }>(
      `${this.carritoUrl}/carrito/${usuarioId}/agregar`,
      { producto_id: productoId, cantidad }
    );
  }

  actualizarCantidadCarrito(
    usuarioId: number,
    productoId: number,
    cantidad: number
  ): Observable<{ mensaje: string; carrito: Carrito }> {
    return this.http.put<{ mensaje: string; carrito: Carrito }>(
      `${this.carritoUrl}/carrito/${usuarioId}/items/${productoId}`,
      { cantidad }
    );
  }

  eliminarDelCarrito(usuarioId: number, productoId: number): Observable<any> {
    return this.http.delete(
      `${this.carritoUrl}/carrito/${usuarioId}/items/${productoId}`
    );
  }

  vaciarCarrito(usuarioId: number): Observable<any> {
    return this.http.delete(
      `${this.carritoUrl}/carrito/${usuarioId}`
    );
  }
}


export interface Resena {
  id: string;
  producto_id: number;
  usuario_id: number;
  calificacion: number;
  comentario: string;
  fecha: string;
}

export interface ResenasRespuesta {
  producto_id: number;
  promedio: number;
  total: number;
  resenas: Resena[];
}


// ENVÍOS

export interface CotizacionEnvio {
  zona: string;
  peso_kg: number;
  costo: number;
  dias_estimados: number;
}

export interface CotizacionEnvioRespuesta {
  mensaje: string;
  cotizacion: CotizacionEnvio;
}
