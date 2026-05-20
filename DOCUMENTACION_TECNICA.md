# Documentación Técnica — Dulce Patojo SAC v1.0.0

Sistema POS y Administrativo para Cafetería, Santa Ana, El Salvador.

---

## 1. Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React 19 + Vite 8)              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐  │
│  │   Caja   │ │  Cocina  │ │Despacho  │ │  Inventario   │  │
│  │   POS    │ │   KDS    │ │ Pedidos  │ │Ingred./Recetas│  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └───────┬───────┘  │
│       └────────────┼────────────┼────────────────┘          │
│                    │     HTTP/WS  │                         │
│              ┌─────▼─────────────▼──────┐                   │
│              │   utils/api.js (proxy)   │                   │
│              │   Vite proxy /api → :5000│                   │
│              └─────────────┬────────────┘                   │
└────────────────────────────┼────────────────────────────────┘
                             │
┌────────────────────────────┼────────────────────────────────┐
│              Backend (Express + socket.io)                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐  │
│  │   Auth   │ │  Caja/   │ │ Cocina/  │ │  Inventario   │  │
│  │  JWT+BC  │ │  Pedidos │ │ WebSocket│ │  Ingredientes │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └───────┬───────┘  │
│       └────────────┼────────────┼────────────────┘          │
│                    │     HTTP    │                           │
│              ┌─────▼─────────────▼──────┐                   │
│              │   @supabase/supabase-js  │                   │
│              │   (service_role + anon)  │                   │
│              └─────────────┬────────────┘                   │
└────────────────────────────┼────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │    Supabase     │
                    │  (PostgreSQL)   │
                    └─────────────────┘
```

### 1.1 Stack Tecnológico

| Capa        | Tecnología                      |
|-------------|----------------------------------|
| Frontend    | React 19, Vite 8, socket.io-client |
| Backend     | Node.js, Express 4, socket.io    |
| ORM/DB      | @supabase/supabase-js 2         |
| Base de datos | PostgreSQL (vía Supabase)      |
| Autenticación | JWT + bcryptjs                 |
| Tiempo real | WebSockets (socket.io)          |
| Proxy dev   | Vite proxy (development)        |

---

## 2. Endpoints API

### 2.1 Auth
| Método | Ruta                          | Auth | Descripción                     |
|--------|-------------------------------|------|---------------------------------|
| POST   | `/auth/login`                 | No   | Login (correo + password)       |
| POST   | `/auth/logout`                | Sí   | Logout                          |
| POST   | `/auth/registro-publico`      | No   | Registro público (queda inactivo)|
| GET    | `/auth/verificar`             | Sí   | Verificar validez del token     |

### 2.2 Usuarios
| Método | Ruta                          | Auth | Descripción                     |
|--------|-------------------------------|------|---------------------------------|
| GET    | `/usuarios`                   | Sí   | Listar todos los usuarios       |
| GET    | `/usuarios/:id`               | Sí   | Obtener usuario por ID          |
| POST   | `/usuarios`                   | Sí   | Crear usuario                   |
| PUT    | `/usuarios/:id`               | Sí   | Actualizar usuario              |
| DELETE | `/usuarios/:id`               | Sí   | Desactivar usuario (soft-delete)|

### 2.3 Productos
| Método | Ruta                          | Auth | Descripción                     |
|--------|-------------------------------|------|---------------------------------|
| GET    | `/productos`                  | Sí   | Listar productos activos        |
| GET    | `/productos/:id`              | Sí   | Obtener producto por ID         |
| POST   | `/productos`                  | Sí   | Crear producto                  |
| PUT    | `/productos/:id`              | Sí   | Actualizar producto             |
| DELETE | `/productos/:id`              | Sí   | Desactivar producto             |

### 2.4 Categorías
| Método | Ruta                          | Auth | Descripción                     |
|--------|-------------------------------|------|---------------------------------|
| GET    | `/categorias`                 | Sí   | Listar categorías               |

### 2.5 Mesas
| Método | Ruta                          | Auth | Descripción                     |
|--------|-------------------------------|------|---------------------------------|
| GET    | `/mesas`                      | Sí   | Listar mesas                    |
| POST   | `/mesas`                      | Sí   | Crear mesa                      |
| PUT    | `/mesas/:id`                  | Sí   | Actualizar mesa                 |
| DELETE | `/mesas/:id`                  | Sí   | Eliminar mesa                   |

### 2.6 Pedidos (Caja)
| Método | Ruta                          | Auth | Descripción                     |
|--------|-------------------------------|------|---------------------------------|
| GET    | `/pedidos`                    | Sí   | Listar pedidos                  |
| GET    | `/pedidos/resumen`            | Sí   | KPIs: totales, conteos, top productos |
| GET    | `/pedidos/:id`                | Sí   | Obtener pedido con items/pagos  |
| POST   | `/pedidos`                    | Sí   | Crear pedido (con IVA+stock)    |
| PUT    | `/pedidos/:id`                | Sí   | Actualizar estado del pedido    |
| POST   | `/pedidos/procesar-pago`      | Sí   | Procesar pago (con propina)     |

### 2.7 Cocina/Despacho
| Método | Ruta                          | Auth | Descripción                     |
|--------|-------------------------------|------|---------------------------------|
| GET    | `/pedidos/cocina`             | Sí   | Pedidos para cocina             |
| PUT    | `/pedidos/:id/estado`         | Sí   | Actualizar estado (WS emit)     |

### 2.8 Promociones
| Método | Ruta                          | Auth | Descripción                     |
|--------|-------------------------------|------|---------------------------------|
| GET    | `/promociones`                | Sí   | Listar promociones activas      |
| POST   | `/promociones`                | Sí   | Crear promoción                 |
| PUT    | `/promociones/:id`            | Sí   | Actualizar promoción            |
| DELETE | `/promociones/:id`            | Sí   | Desactivar promoción            |

### 2.9 Inventario (Fase 4)
| Método | Ruta                          | Auth | Descripción                     |
|--------|-------------------------------|------|---------------------------------|
| GET    | `/inventario`                 | Sí   | Listar inventario (productos)   |
| POST   | `/inventario/movimiento`      | Sí   | Registrar movimiento de stock   |
| GET    | `/inventario/movimientos/:id` | Sí   | Movimientos de un producto      |

### 2.10 Ingredientes (Fase 4)
| Método | Ruta                          | Auth | Descripción                     |
|--------|-------------------------------|------|---------------------------------|
| GET    | `/ingredientes`               | Sí   | Listar ingredientes             |
| POST   | `/ingredientes`               | Sí   | Crear ingrediente               |
| PUT    | `/ingredientes/:id`           | Sí   | Actualizar ingrediente          |
| DELETE | `/ingredientes/:id`           | Sí   | Eliminar (soft-delete)          |
| POST   | `/ingredientes/:id/ajustar-stock` | Sí | Ajustar stock manual           |
| GET    | `/ingredientes/:id/movimientos` | Sí  | Historial de movimientos        |

### 2.11 Recetas (Fase 4)
| Método | Ruta                          | Auth | Descripción                     |
|--------|-------------------------------|------|---------------------------------|
| GET    | `/recetas`                    | Sí   | Listar recetas (por producto)   |
| POST   | `/recetas`                    | Sí   | Guardar/Reemplazar recetas      |

### 2.12 Proveedores (Fase 4)
| Método | Ruta                          | Auth | Descripción                     |
|--------|-------------------------------|------|---------------------------------|
| GET    | `/proveedores`                | Sí   | Listar proveedores              |
| POST   | `/proveedores`                | Sí   | Crear proveedor                 |
| PUT    | `/proveedores/:id`            | Sí   | Actualizar proveedor            |
| DELETE | `/proveedores/:id`            | Sí   | Eliminar (soft-delete)          |

---

## 3. Esquema de Base de Datos

### 3.1 Tablas Principales

**usuarios** — `id`, `nombre`, `correo`, `password`, `rol` (Admin|Cajero|Cocinero|Despachador), `activo`, `created_at`

**productos** — `id`, `nombre`, `descripcion`, `precio`, `categoria_id`, `disponible`, `imagen_url`, `stock`, `stock_minimo`, `exento_iva`, `created_at`

**categorias** — `id`, `nombre`, `descripcion`

**mesas** — `id`, `numero`, `capacidad`, `estado` (disponible|ocupada|pagando)

**pedidos** — `id`, `numero_ticket`, `tipo` (para_llevar|en_mesa|para_recoger|domicilio), `mesa_id`, `cliente_nombre`, `estado` (recibido|en_preparacion|listo|entregado|pagado|cancelado), `subtotal`, `descuento`, `iva`, `total_con_iva`, `total`, `direccion_entrega`, `telefono_contacto`, `cargo_envio`, `usuario_id`, `notas`, `created_at`

**pedido_items** — `id`, `pedido_id`, `producto_id`, `combo_id`, `promocion_id`, `tipo_item`, `nombre`, `cantidad`, `precio_unitario`, `notas`

**pagos** — `id`, `pedido_id`, `metodo` (efectivo|tarjeta|qr|billetera_digital|transferencia), `monto_recibido`, `cambio`, `subtotal_sin_iva`, `iva`, `total_con_iva`, `total`, `propina`, `usuario_id`

### 3.2 Tablas de Inventario (Fase 4)

**ingredientes** — `id`, `nombre`, `unidad`, `stock`, `stock_minimo`, `precio_compra`, `proveedor_id`, `activo`, `deleted_at`

**recetas** — `id`, `producto_id`, `ingrediente_id`, `cantidad` (UNIQUE por producto+ingrediente)

**movimientos_ingredientes** — `id`, `ingrediente_id`, `tipo` (entrada|salida|ajuste), `cantidad`, `stock_anterior`, `stock_nuevo`, `descripcion`, `referencia_tipo`, `referencia_id`, `usuario_id`

**proveedores** — `id`, `nombre`, `contacto`, `telefono`, `correo`, `direccion`, `activo`, `deleted_at`

### 3.3 Tablas Contables (Fase 5)

**impuestos** — `id`, `nombre`, `tasa`, `activo`

**tickets** — `id`, `pedido_id`, `numero_ticket`, `fecha`, `contador_diario`

**cierres_caja** — `id`, `fecha`, `total_pedidos`, `total_efectivo`, `total_tarjeta`, `total_descuentos`, `total_neto`, `monto_fisico`, `diferencia`, `cerrado_por`, `activo`

### 3.4 Tablas de Seguridad

**intentos_login** — `correo`, `intentos`, `bloqueado_hasta`
**bitacora_permisos** — `usuario_id`, `accion`, `descripcion`, `created_at`

---

## 4. Configuración del Entorno

### Backend (`backend/.env`)
```
PORT=5000
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...     # anon key (pública)
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIs...   # service_role key (admin)
JWT_SECRET=sb_secret_tu_secreto
```

### Frontend (`frontend/.env`)
```
VITE_API_URL=http://localhost:5000
VITE_SOCKET_URL=http://localhost:5000
```

### Proxy de Desarrollo
`vite.config.js` redirige todas las rutas `/auth`, `/productos`, `/pedidos`, etc. a `http://localhost:5000`. En producción, el frontend compilado se sirve desde el backend o un CDN.

---

## 5. WebSockets (socket.io)

Canales:
| Evento          | Dirección | Payload                          | Uso                    |
|-----------------|-----------|----------------------------------|------------------------|
| `nuevo_pedido`  | Server→Client | `{ pedido }`                   | Cocina KDS             |
| `estado_pedido` | Server→Client | `{ pedido_id, estado }`        | Despacho               |
| `connect`       | Client→Server | —                                | Inicio conexión        |

Polling de respaldo: 8 segundos en Cocina.jsx.

---

## 6. Roles del Sistema

| Rol           | Acceso                                  |
|---------------|-----------------------------------------|
| **Admin**     | Todo el sistema                         |
| **Cajero**    | Caja POS, consultar pedidos             |
| **Cocinero**  | Cocina KDS (ver/actualizar estado)      |
| **Despachador** | Despacho (pedidos listos → entregar) |

---

## 7. Cálculo de IVA (13% SV)

```javascript
const tasaIVA = 0.130;  // 13%
const subtotalSinIVA = items.reduce((sum, item) => sum + item.precio_unitario * item.cantidad, 0);
const iva = productosNoExentos * tasaIVA;
const totalConIVA = subtotalSinIVA + iva;
```

Productos con `exento_iva = true` no generan IVA.

---

## 8. Seguridad

- Contraseñas hasheadas con bcrypt (salt rounds: 10)
- JWT con expiración de 30 minutos
- Bloqueo de cuenta tras 3 intentos fallidos (5 min)
- Soft-delete (`deleted_at`) en tablas principales
- Claves Supabase separadas: `SUPABASE_ANON_KEY` (pública) vs `SUPABASE_SERVICE_KEY` (admin)
- `.env` excluido del repositorio
- Validación estricta de contraseñas (8+ chars, mayúscula, minúscula, número, especial)

---

## 9. Migraciones SQL

Ejecutar en orden dentro del SQL Editor de Supabase Dashboard:

1. `backend/sql/migracion_pedidos.sql` — Tablas base (pedidos, pagos, mesas, tickets)
2. `backend/sql/migracion_inventario.sql` — Inventario de productos
3. `backend/sql/migracion_recetas.sql` — Ingredientes, recetas, proveedores
4. `backend/sql/migracion_iva.sql` — IVA 13%, propinas, domicilio
5. `backend/sql/migracion_completa_final.sql` — Migración completa (idempotente)

> **Importante**: Después de ejecutar migraciones, correr `NOTIFY pgrst, 'reload schema';` en el SQL Editor para refrescar el schema cache de PostgREST.

---

## 10. Inicio Rápido

```bash
# Backend
cd restaurant-pos/backend
cp .env.example .env   # Configurar claves Supabase
npm install
npm run dev

# Frontend
cd restaurant-pos/frontend
cp .env.example .env
npm install
npm run dev
```

Abrir `http://localhost:5173` en el navegador.
