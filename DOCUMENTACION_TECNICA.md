# Documentacion Tecnica - Dulce Patojo SAC v1.0.0

Sistema POS y Administrativo para Cafeteria, Santa Ana, El Salvador.

---

## 1. Arquitectura

```
+------------------------------------------------------------------+
|                    Frontend (React 19 + Vite 8)                   |
|  +----------+ +----------+ +----------+ +----------+ +---------+ |
|  |   Caja   | |  Cocina  | | Despacho | |Inventario| |Reportes | |
|  |   POS    | |   KDS    | | Pedidos  | |Ingred.   | |Graficos | |
|  +----+-----+ +----+-----+ +----+-----+ +----+-----+ +----+----+ |
|       |            |            |            |             |      |
|       +-----+------+------+----+------+-----+------+------+      |
|             |             |             |             |           |
|       +-----v-------------v-------------v-------------v-----+     |
|       |             utils/api.js (Axios interceptor)        |     |
|       |       + hooks/ (useSocket, useInactividad)          |     |
|       |       + context/ (ThemeContext, ToastContext)        |     |
|       +-------------------------+---------------------------+     |
|                                 |                                  |
+---------------------------------+----------------------------------+
                                   |
+---------------------------------+----------------------------------+
|               Backend (Express 4 + Socket.IO)                       |
|  +----------+ +----------+ +----------+ +----------+ +----------+   |
|  |   Auth   | |  Caja/   | | Cocina/  | |Inventario| | Reportes |   |
|  |JWT+BCrypt| | Pedidos  | |WebSocket | |Ingred.   | | Analytics|   |
|  +----+-----+ +----+-----+ +----+-----+ +----+-----+ +----+-----+   |
|       |            |            |            |             |         |
|  +----v------------v------------v------------v-------------v-----+  |
|  |                    Config/ (socket.js, sessionManager.js,     |  |
|  |                    socketEmitter.js, database.js)             |  |
|  |                    middleware/ (auth.js: requireRol + JWT)    |  |
|  +-----------------------------+--------------------------------+  |
|                                |                                     |
|                     +----------v----------+                          |
|                     |  Supabase (PostgreSQL)|                        |
|                     |  + service_role key  |                         |
|                     |  + anon key (RLS)    |                         |
|                     +---------------------+                          |
+---------------------------------+----------------------------------+
```

### 1.1 Stack Tecnologico

| Capa        | Tecnologia                         |
|-------------|------------------------------------|
| Frontend    | React 19, Vite 8, React Router 7   |
| Backend     | Node.js, Express 4, Socket.IO 4    |
| ORM/DB      | @supabase/supabase-js 2            |
| Base datos  | PostgreSQL (via Supabase)          |
| Autenticacion | JWT + bcryptjs + sessionManager |
| Tiempo real | WebSockets (Socket.IO) por salas   |
| HTTP Client | Axios con interceptores            |
| Graficos    | Recharts 3                         |
| Iconos      | Lucide React                       |
| Exportacion | xlsx (Excel)                       |
| Archivos    | Multer (upload imagenes)           |
| DB nativa   | pg (driver PostgreSQL directo)     |

### 1.2 Estructura del Proyecto

```
restaurant-pos/
  backend/
    src/
      server.js            # Entry point: Express + Socket.IO
      config/
        database.js         # Clientes Supabase (anon + service_role)
        sessionManager.js   # Control de sesiones concurrentes
        socket.js           # Config Socket.IO con salas por rol
        socketEmitter.js    # Helpers para emitir eventos WS
      controllers/          # 14 controladores
        authController.js
        usuariosController.js
        productosController.js
        cajaController.js
        pedidosController.js
        pagosController.js
        mesasController.js
        promocionesController.js
        inventarioController.js
        ingredientesController.js
        recetasController.js
        proveedoresController.js
        reportesController.js
        uploadController.js
      middleware/
        auth.js             # 3 middlewares: auth, requireAdmin, requireRol()
      routes/               # 13 archivos de rutas
    sql/                    # 9 migraciones SQL
    scripts/                # 6 scripts de utilidad
  frontend/
    src/
      pages/                # 14 paginas + Login/Register/SesionExpirada
      components/           # 10 componentes reutilizables
      hooks/                # 3 hooks personalizados
      context/              # 2 contextos (Theme, Toast)
      utils/                # 4 utilidades (api, socket, password)
```

---

## 2. Endpoints API

### 2.1 Auth (`/auth`)

| Metodo | Ruta                    | Auth | Descripcion                              |
|--------|-------------------------|------|------------------------------------------|
| POST   | `/auth/login`           | No   | Login (correo + password)                |
| POST   | `/auth/logout`          | Si   | Logout, elimina sesion activa            |
| POST   | `/auth/registro-publico`| No   | Registro publico (queda inactivo)        |
| GET    | `/auth/verify`          | Si   | Verificar validez del token JWT          |

### 2.2 Usuarios (`/usuarios`)

| Metodo | Ruta                            | Auth  | Descripcion                         |
|--------|---------------------------------|-------|-------------------------------------|
| GET    | `/usuarios`                     | Admin | Listar todos los usuarios           |
| GET    | `/usuarios/online`              | Si    | Usuarios conectados via WebSocket   |
| GET    | `/usuarios/:id`                 | Admin | Obtener usuario por ID              |
| POST   | `/usuarios`                     | Admin | Crear usuario                       |
| PUT    | `/usuarios/:id`                 | Admin | Actualizar usuario                  |
| PATCH  | `/usuarios/:id/inactivar`       | Admin | Desactivar usuario                  |
| PATCH  | `/usuarios/:id/activar`         | Admin | Reactivar usuario                   |
| DELETE | `/usuarios/:id`                 | Admin | Eliminar usuario (desvincula FKs)   |

### 2.3 Productos (`/productos`)

| Metodo | Ruta                                   | Auth  | Descripcion                          |
|--------|----------------------------------------|-------|--------------------------------------|
| GET    | `/productos`                           | Si    | Listar productos (con filtros)       |
| GET    | `/productos/:id`                       | Si    | Obtener producto por ID              |
| POST   | `/productos`                           | Admin | Crear producto                       |
| PUT    | `/productos/:id`                       | Admin | Actualizar producto                  |
| DELETE | `/productos/:id`                       | Admin | Eliminar producto (hard-delete)      |
| PATCH  | `/productos/:id/toggle`                | Admin | Alternar disponible/no disponible    |
| POST   | `/productos/upload-imagen`             | Admin | Subir imagen a Supabase Storage      |
| GET    | `/productos/categorias`                | Si    | Listar categorias                    |
| POST   | `/productos/categorias`                | Admin | Crear categoria                      |
| POST   | `/productos/precios/masivo`            | Admin | Actualizar precios por categoria     |
| GET    | `/productos/combos/lista`              | Si    | Listar combos disponibles            |
| POST   | `/productos/combos`                    | Admin | Crear combo                          |
| PUT    | `/productos/combos/:id`                | Admin | Actualizar combo                     |
| PATCH  | `/productos/combos/:id/toggle`         | Admin | Alternar activo/inactivo de combo    |
| GET    | `/productos/:id/historial`             | Admin | Historial de cambios de precio       |
| POST   | `/productos/:id/revertir-precio`       | Admin | Revertir al precio anterior          |

### 2.4 Promociones (`/promociones`)

| Metodo | Ruta                          | Auth  | Descripcion                      |
|--------|-------------------------------|-------|----------------------------------|
| GET    | `/promociones`                | Si    | Listar promociones               |
| GET    | `/promociones/activas`        | Si    | Promociones activas (happy hour) |
| POST   | `/promociones`                | Admin | Crear promocion                  |
| PUT    | `/promociones/:id`            | Admin | Actualizar promocion             |
| PATCH  | `/promociones/:id/toggle`     | Admin | Alternar activa/inactiva         |
| DELETE | `/promociones/:id`            | Admin | Eliminar promocion               |

### 2.5 Pedidos (`/pedidos`)

| Metodo | Ruta                           | Auth       | Descripcion                          |
|--------|--------------------------------|------------|--------------------------------------|
| GET    | `/pedidos`                     | Si         | Listar pedidos (con filtros)         |
| GET    | `/pedidos/:id`                 | Si         | Obtener pedido con items/pagos       |
| GET    | `/pedidos/resumen`             | Si         | KPIs: totales, conteos, top productos|
| GET    | `/pedidos/contador-ticket`     | Si         | Siguiente numero de ticket del dia   |
| POST   | `/pedidos`                     | Caj/Admin  | Crear pedido (IVA + stock)           |
| PATCH  | `/pedidos/:id/estado`          | Si         | Cambiar estado del pedido            |
| POST   | `/pedidos/:id/pagar`           | Caj/Admin  | Procesar pago completo               |
| GET    | `/pedidos/:id/ticket`          | Si         | Datos del ticket en JSON             |
| GET    | `/pedidos/:id/ticket/html`     | Si         | Ticket HTML para impresora termica   |
| POST   | `/pedidos/:id/reimprimir`      | Caj/Admin  | Reimprimir ticket                    |

### 2.6 Mesas (`/mesas`)

| Metodo | Ruta                    | Auth  | Descripcion                 |
|--------|-------------------------|-------|-----------------------------|
| GET    | `/mesas`                | Si    | Listar mesas                |
| POST   | `/mesas`                | Admin | Crear mesa                  |
| PUT    | `/mesas/:id`            | Admin | Actualizar mesa             |
| PATCH  | `/mesas/:id/estado`     | Si    | Cambiar estado de mesa      |

### 2.7 Pagos (`/pagos`)

| Metodo | Ruta    | Auth      | Descripcion                 |
|--------|---------|-----------|-----------------------------|
| POST   | `/pagos`| Caj/Admin | Registrar pago (con propina)|

### 2.8 Caja (`/api/caja`)

| Metodo | Ruta                             | Auth      | Descripcion                         |
|--------|----------------------------------|-----------|-------------------------------------|
| GET    | `/api/caja/cobros-pendientes`    | Caj/Admin | Pedidos pendientes de cobro         |
| POST   | `/api/caja/iniciar-cobro`        | Caj/Admin | Bloquear pedido para cobro          |
| POST   | `/api/caja/liberar-bloqueo`      | Caj/Admin | Liberar bloqueo de cobro            |
| GET    | `/api/caja/pedidos/:id/log`      | Caj/Admin | Historial de cambios de estado      |

### 2.9 Inventario (`/inventario`)

| Metodo | Ruta                                | Auth  | Descripcion                      |
|--------|-------------------------------------|-------|----------------------------------|
| GET    | `/inventario`                       | Admin | Listar inventario con stock      |
| GET    | `/inventario/movimientos/:prod`     | Admin | Movimientos de un producto       |
| POST   | `/inventario/entrada`               | Admin | Registrar entrada de stock       |
| POST   | `/inventario/salida`                | Admin | Registrar salida de stock        |
| POST   | `/inventario/ajuste`                | Admin | Ajustar stock manualmente        |
| PUT    | `/inventario/stock-minimo`          | Admin | Actualizar stock minimo          |

### 2.10 Ingredientes (`/ingredientes`)

| Metodo | Ruta                              | Auth  | Descripcion                      |
|--------|-----------------------------------|-------|----------------------------------|
| GET    | `/ingredientes`                   | Si    | Listar ingredientes              |
| GET    | `/ingredientes/:id`               | Si    | Obtener ingrediente por ID       |
| POST   | `/ingredientes`                   | Admin | Crear ingrediente                |
| PUT    | `/ingredientes/:id`               | Admin | Actualizar ingrediente           |
| DELETE | `/ingredientes/:id`               | Admin | Eliminar (soft-delete)           |
| PATCH  | `/ingredientes/:id/stock`         | Admin | Ajustar stock manual             |
| GET    | `/ingredientes/:id/movimientos`   | Si    | Historial de movimientos         |

### 2.11 Recetas (`/recetas`)

| Metodo | Ruta        | Auth  | Descripcion                        |
|--------|-------------|-------|------------------------------------|
| GET    | `/recetas`  | Si    | Listar recetas (por producto)      |
| POST   | `/recetas`  | Admin | Guardar/Reemplazar recetas         |

### 2.12 Proveedores (`/proveedores`)

| Metodo | Ruta                 | Auth  | Descripcion               |
|--------|----------------------|-------|---------------------------|
| GET    | `/proveedores`       | Si    | Listar proveedores        |
| POST   | `/proveedores`       | Admin | Crear proveedor           |
| PUT    | `/proveedores/:id`   | Admin | Actualizar proveedor      |
| DELETE | `/proveedores/:id`   | Admin | Eliminar (soft-delete)    |

### 2.13 Reportes (`/api/reportes`)

| Metodo | Ruta                       | Auth | Descripcion                          |
|--------|----------------------------|------|--------------------------------------|
| GET    | `/api/reportes/ventas`     | Si   | Ventas por periodo (hoy/semana/mes)  |
| GET    | `/api/reportes/productos`  | Si   | Top N productos mas vendidos         |
| GET    | `/api/reportes/inventario` | Si   | Movimientos de inventario            |
| GET    | `/api/reportes/caja`       | Si   | Resumen de caja (ingresos/egresos)   |

---

## 3. Middleware de Seguridad

### 3.1 auth.js - Tres niveles de proteccion

```
authMiddleware (default)
  Verifica JWT del header Authorization: Bearer <token>
  Adjunta req.user con { id, nombre, correo, rol }
  Retorna 401 si expirado -> { error, expired: true }

requireAdmin
  Requiere req.user.rol === 'Admin'
  Retorna 403 si no es admin

requireRol(...roles)
  Factory: requireRol('Admin','Cajero')
  Verifica req.user.rol en la lista
  Retorna 403 con roles permitidos
```

### 3.2 sessionManager.js - Sesiones concurrentes

```
hasActiveSession(userId)   -> Verifica si ya hay sesion activa
addSession(userId)         -> Registra nueva sesion
removeSession(userId)      -> Elimina sesion al logout
```

- Limpieza automatica cada 5 minutos de sesiones expiradas
- Expiración de sesion: 30 minutos

### 3.3 Multer - Subida de archivos

- Almacenamiento en memoria (memoryStorage)
- Limite de 5MB por archivo
- Solo imagenes (image/jpeg, image/png, image/webp)
- Usado en POST /productos/upload-imagen

---

## 4. WebSockets (Socket.IO)

### 4.1 Arquitectura de salas por rol

Al conectarse, el cliente se une a una sala segun su rol:

| Rol      | Sala          | Eventos que recibe                       |
|----------|---------------|------------------------------------------|
| Cocinero | room:cocina   | nuevo_pedido, estado_pedido              |
| Despachador | room:despacho | estado_pedido, pedido_listo             |
| Cajero   | room:cajero   | cobro_iniciado, bloqueo_liberado, pedido_pagado |

### 4.2 Eventos

| Evento             | Direccion      | Payload                              | Uso                       |
|--------------------|----------------|--------------------------------------|---------------------------|
| `nuevo_pedido`     | Server-Cliente | `{ pedido }`                         | Cocina KDS                |
| `estado_pedido`    | Server-Cliente | `{ pedido_id, estado }`              | Despacho, Caja            |
| `pedido_listo`     | Server-Cliente | `{ pedido_id }`                      | Despacho                  |
| `pedido_pagado`    | Server-Cliente | `{ pedido_id }`                      | Caja en tiempo real       |
| `cobro_iniciado`   | Server-Cliente | `{ pedido_id, usuario_id }`          | Caja (bloqueo pesimista)  |
| `bloqueo_liberado` | Server-Cliente | `{ pedido_id }`                      | Caja                      |

### 4.3 Polling de respaldo

Cocina.jsx realiza polling cada 8 segundos como respaldo si WebSocket falla.

---

## 5. Esquema de Base de Datos

### 5.1 Tablas Principales

**usuarios** - `id`, `nombre`, `correo`, `password`, `rol` (Admin|Cajero|Cocinero|Despachador), `activo`, `created_at`

**productos** - `id`, `nombre`, `descripcion`, `precio`, `categoria_id`, `disponible`, `imagen_url`, `stock`, `stock_minimo`, `exento_iva`, `created_at`

**categorias** - `id`, `nombre`, `descripcion`

**combos** - `id`, `nombre`, `descripcion`, `precio`, `activo`, `imagen_url`, `created_at`

**combo_productos** - `id`, `combo_id`, `producto_id`, `cantidad`

**mesas** - `id`, `numero`, `capacidad`, `estado` (disponible|ocupada|pagando)

**pedidos** - `id`, `numero_ticket`, `tipo` (para_llevar|en_mesa|para_recoger|domicilio), `mesa_id`, `cliente_nombre`, `estado` (recibido|en_preparacion|listo|entregado|pagado|cancelado), `subtotal`, `descuento`, `iva`, `total_con_iva`, `total`, `direccion_entrega`, `telefono_contacto`, `cargo_envio`, `usuario_id`, `notas`, `created_at`

**pedido_items** - `id`, `pedido_id`, `producto_id`, `combo_id`, `promocion_id`, `tipo_item` (producto|combo|promocion), `nombre`, `cantidad`, `precio_unitario`, `notas`

**pagos** - `id`, `pedido_id`, `metodo` (efectivo|tarjeta|qr|billetera_digital|transferencia), `monto_recibido`, `cambio`, `subtotal_sin_iva`, `iva`, `total_con_iva`, `total`, `propina`, `usuario_id`

**tickets** - `id`, `pedido_id`, `numero_ticket`, `fecha`, `contador_diario`

**cierres_caja** - `id`, `fecha`, `total_pedidos`, `total_efectivo`, `total_tarjeta`, `total_descuentos`, `total_neto`, `monto_fisico`, `diferencia`, `cerrado_por`, `activo`

### 5.2 Tablas de Promociones

**promociones** - `id`, `nombre`, `descripcion`, `tipo` (descuento_porcentaje|dos_x_uno|tres_x_dos|happy_hour|descuento_monto), `valor`, `cantidad_maxima`, `activo`, `fecha_inicio`, `fecha_fin`, `created_at`

### 5.3 Tablas de Inventario

**ingredientes** - `id`, `nombre`, `unidad`, `stock`, `stock_minimo`, `precio_compra`, `proveedor_id`, `activo`, `deleted_at`

**recetas** - `id`, `producto_id`, `ingrediente_id`, `cantidad` (UNIQUE por producto+ingrediente)

**movimientos_ingredientes** - `id`, `ingrediente_id`, `tipo` (entrada|salida|ajuste), `cantidad`, `stock_anterior`, `stock_nuevo`, `descripcion`, `referencia_tipo`, `referencia_id`, `usuario_id`

**inventario_movimientos** - `id`, `producto_id`, `tipo` (entrada|salida|ajuste), `cantidad`, `stock_anterior`, `stock_nuevo`, `descripcion`, `usuario_id`

**proveedores** - `id`, `nombre`, `contacto`, `telefono`, `correo`, `direccion`, `activo`, `deleted_at`

### 5.4 Tablas de Auditoria y Control

**pedidos_estado_log** - `id`, `pedido_id`, `estado_anterior`, `estado_nuevo`, `cambiado_por`, `nota`, `creado_en`

**cobros_bloqueo** - `id`, `pedido_id` (UNIQUE), `usuario_id`, `iniciado_en`

**historial_precios** - `id`, `producto_id`, `precio_anterior`, `precio_nuevo`, `usuario_id`, `created_at`

**intentos_login** - `correo`, `intentos`, `bloqueado_hasta`

**bitacora_permisos** - `usuario_id`, `accion`, `descripcion`, `created_at`

### 5.5 Tablas Contables

**impuestos** - `id`, `nombre`, `tasa`, `activo`

---

## 6. Triggers y Funciones de Base de Datos

| Trigger                          | Evento              | Accion                                           |
|----------------------------------|---------------------|--------------------------------------------------|
| `trg_ocupar_mesa_al_crear_pedido`| AFTER INSERT pedidos | Cambia mesa a `ocupada` si pedido tiene mesa    |
| `trg_pagar_y_liberar_mesa`       | AFTER INSERT pagos   | Cambia pedido a `pagado`, libera mesa            |
| `trg_log_y_notify_cambio_estado` | AFTER UPDATE estado  | Registra en `pedidos_estado_log` + pg_notify     |
| `trg_notify_nuevo_pedido`        | AFTER INSERT pedidos | pg_notify de nuevo pedido                        |
| `trg_notify_pago_registrado`     | AFTER INSERT pagos   | pg_notify de pago registrado                     |
| `trg_limpiar_bloqueo_al_pagar`   | AFTER INSERT pagos   | Elimina bloqueo de cobro al pagar                |
| `trg_notify_cobro_iniciado`      | AFTER INSERT cobros  | pg_notify de cobro iniciado                      |
| `trg_notify_bloqueo_liberado`    | AFTER DELETE cobros  | pg_notify de bloqueo liberado                    |

---

## 7. Roles del Sistema

| Rol           | Acceso                                      |
|---------------|---------------------------------------------|
| **Admin**     | Todo el sistema                             |
| **Cajero**    | Caja POS, consultar pedidos, procesar pagos |
| **Cocinero**  | Cocina KDS (ver/actualizar estado)          |
| **Despachador** | Despacho (pedidos listos para entregar)   |

---

## 8. Calculo de IVA (13% SV)

```javascript
const tasaIVA = 0.130;
const subtotalSinIVA = items.reduce((sum, item) => {
  const prod = productos.find(p => p.id === item.producto_id);
  return sum + (prod.exento_iva ? 0 : item.precio_unitario * item.cantidad);
}, 0);
const iva = subtotalSinIVA * tasaIVA;
const totalConIVA = subtotalSinIVA + iva + cargoEnvio;
```

Productos con `exento_iva = true` no generan IVA. El cargo de envio no genera IVA.

---

## 9. Seguridad

- Contrasenas hasheadas con bcrypt (salt rounds: 10)
- Validacion estricta de contrasenas (8+ chars, mayuscula, minuscula, numero, especial)
- JWT con expiracion de 30 minutos
- Control de sesiones concurrentes (sessionManager)
- Bloqueo de cuenta tras 3 intentos fallidos (5 min)
- Soft-delete (`deleted_at`) en ingredientes y proveedores
- Claves Supabase separadas: `anon` (RLS publica) vs `service_role` (admin)
- Tres niveles de middleware: `auth`, `requireAdmin`, `requireRol()`
- Bloqueo pesimista de cobros (cobros_bloqueo)
- .env excluido del repositorio
- Multer con limite de 5MB y solo imagenes

---

## 10. Migraciones SQL

Ejecutar en orden dentro del SQL Editor de Supabase Dashboard:

1. `backend/sql/migracion_completa_final.sql` - Migracion completa (idempotente)
2. `backend/sql/migracion_pedidos.sql` - Tablas base (mesas, pedidos, pagos, tickets, promociones, combos)
3. `backend/sql/migracion_iva.sql` - IVA 13%, metodos de pago, tipo domicilio
4. `backend/sql/migracion_triggers_log.sql` - Triggers y log de estados
5. `backend/sql/migracion_cobros_bloqueo.sql` - Bloqueo pesimista de cobros
6. `backend/sql/migracion_inventario.sql` - Stock y movimientos de productos
7. `backend/sql/migracion_recetas.sql` - Ingredientes, recetas, proveedores
8. `backend/sql/migracion_promociones_cantidad.sql` - Campo cantidad_maxima
9. `backend/sql/fix_rls_triggers.sql` - Fix RLS (solo si error 42501)

Despues de ejecutar migraciones, correr `NOTIFY pgrst, 'reload schema';` en el SQL Editor.

---

## 11. Configuracion del Entorno

### Backend (`backend/.env`)
```
PORT=5000
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=eyJ...  # anon key (publica)
SUPABASE_SERVICE_KEY=eyJ... # service_role key (admin)
JWT_SECRET=tu_secreto_jwt
```

### Frontend (`frontend/.env`)
```
VITE_API_URL=http://localhost:5000
VITE_SOCKET_URL=http://localhost:5000
```

### Proxy de Desarrollo
`vite.config.js` redirige todas las rutas `/auth`, `/productos`, `/pedidos`, `/api`, etc. a `http://localhost:5000`. En produccion, el frontend compilado se sirve desde el backend (Express static).

---

## 12. Inicio Rapido

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

---

## 13. Mapa de Rutas del Frontend

| Ruta              | Pagina          | Roles con acceso        |
|-------------------|-----------------|-------------------------|
| `/login`          | Login           | Todos                   |
| `/register`       | Registro        | Todos                   |
| `/sesion-expirada`| Sesion Expirada | Todos                   |
| `/dashboard`      | Dashboard       | Admin                   |
| `/caja`           | Caja POS        | Admin, Cajero           |
| `/cocina`         | Cocina KDS      | Admin, Cocinero         |
| `/despacho`       | Despacho        | Admin, Despachador      |
| `/productos`      | Productos       | Admin                   |
| `/usuarios`       | Usuarios        | Admin                   |
| `/promociones`    | Promociones     | Admin                   |
| `/inventario`     | Inventario      | Admin                   |
| `/ingredientes`   | Ingredientes    | Admin                   |
| `/recetas`        | Recetas         | Admin                   |
| `/mesas`          | Mesas           | Admin                   |
| `/reportes`       | Reportes        | Admin                   |
| `/configuracion`  | Configuracion   | Todos                   |
