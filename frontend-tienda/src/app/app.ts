import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, Producto } from './core/services/api.service';

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

  productos: Producto[] = [];
  autenticado = false;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    const token = localStorage.getItem('token');

    if (token) {
      this.autenticado = true;
      this.cargarProductos();
    }
  }

  iniciarSesion(): void {
    this.error = '';
    this.mensaje = '';
    this.cargando = true;

    this.api.login(this.email, this.password).subscribe({
      next: (respuesta) => {
        localStorage.setItem('token', respuesta.token);
        localStorage.setItem('usuario', JSON.stringify(respuesta.usuario));

        this.autenticado = true;
        this.cargando = false;
        this.cargarProductos();
      },
      error: (err) => {
        this.error = err.error?.error || 'No se pudo iniciar sesión.';
        this.cargando = false;
      }
    });
  }

  crearCuenta(): void {
    this.error = '';
    this.mensaje = '';

    if (this.password !== this.confirmarPassword) {
      this.error = 'Las contraseñas no coinciden.';
      return;
    }

    if (this.password.length < 8) {
      this.error = 'La contraseña debe tener al menos 8 caracteres.';
      return;
    }

    this.cargando = true;

    this.api.registrar(this.nombre, this.email, this.password).subscribe({
      next: () => {
        this.cargando = false;
        this.mensaje = '¡Cuenta creada! Ahora puedes iniciar sesión.';

        this.vista = 'login';
        this.nombre = '';
        this.confirmarPassword = '';
      },
      error: (err) => {
        this.error =
          err.error?.errores
            ? Object.values(err.error.errores).flat().join(' ')
            : err.error?.message || 'No se pudo crear la cuenta.';

        this.cargando = false;
      }
    });
  }

  cargarProductos(): void {
    this.api.obtenerProductos().subscribe({
      next: (respuesta) => {
        this.productos = respuesta.productos;
      },
      error: () => {
        this.error = 'No se pudieron cargar los productos.';
      }
    });
  }

  cerrarSesion(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');

    this.autenticado = false;
    this.productos = [];
    this.email = '';
    this.password = '';
    this.vista = 'login';
  }
}