import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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

  constructor(private http: HttpClient) {}

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(
      `${this.usuariosUrl}/usuarios/login`,
      { email, password }
    );
  }

  registrar(
    nombre: string,
    email: string,
    password: string
  ): Observable<any> {
    return this.http.post(
      `${this.usuariosUrl}/usuarios/registro`,
      { nombre, email, password }
    );
  }

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
}
