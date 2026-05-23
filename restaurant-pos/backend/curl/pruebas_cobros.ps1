# =============================================================
# PRUEBAS DE FLUJO: Cobros Pendientes + Bloqueo + Pagos
# =============================================================
# Ejecutar: .\curl\pruebas_cobros.ps1
# Requiere: servidor backend en localhost:5000
# =============================================================

$BASE = "http://localhost:5000"
$ERRORS = 0

Write-Host "╔══════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   PRUEBAS MÓDULO COBROS PENDIENTES              ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════╝" -ForegroundColor Cyan

# ── Helper ──
function Test-Step {
  param($Name, $ScriptBlock)
  Write-Host "`n▶ $Name..." -ForegroundColor Yellow
  try {
    $result = & $ScriptBlock
    Write-Host "  ✓ OK" -ForegroundColor Green
    return $result
  } catch {
    Write-Host "  ✖ FAIL: $_" -ForegroundColor Red
    $global:ERRORS++
    return $null
  }
}

# ── 1. Login ──
$login = Test-Step "Login como Cajero" {
  $r = Invoke-RestMethod -Uri "$BASE/auth/login" -Method Post -ContentType "application/json" -Body '{"correo":"cajero@test.com","password":"123456"}'
  if (-not $r.token) { throw "No token" }
  $r
}
$TOKEN = $login.token
$headers = @{ Authorization = "Bearer $TOKEN" }
$USUARIO_ID = $login.usuario?.id ?? 1
Write-Host "   Token: $($TOKEN.Substring(0,20))..." -ForegroundColor Gray
Write-Host "   Usuario ID: $USUARIO_ID" -ForegroundColor Gray

# ── 2. Ver mesas disponibles ──
$mesaDisponible = Test-Step "Obtener mesa disponible" {
  $mesas = Invoke-RestMethod -Uri "$BASE/mesas" -Method Get -Headers $headers
  $m = $mesas | Where-Object { $_.estado -eq 'disponible' } | Select-Object -First 1
  if (-not $m) { throw "No hay mesas disponibles" }
  Write-Host "   Mesa #$($m.numero) (id=$($m.id))" -ForegroundColor Gray
  $m
}

# ═══════════════════════════════════════════════════════
# CASO 1: Crear pedido → aparece en cobros → iniciar
#         cobro → mesa pagando → pagar → desaparece
# ═══════════════════════════════════════════════════════
Write-Host "`n${'='*60}" -ForegroundColor Cyan
Write-Host "CASO 1: Flujo completo de cobro" -ForegroundColor Cyan
Write-Host "${'='*60}" -ForegroundColor Cyan

$pedido = Test-Step "Crear pedido en mesa" {
  $body = @{
    tipo = "en_mesa"
    mesa_id = $mesaDisponible.id
    cliente_nombre = "Test Cobros"
    items = @(@{ id = 1; tipo = "producto"; nombre = "Producto Test"; cantidad = 2; precio = 10.00 })
  } | ConvertTo-Json -Depth 3
  $r = Invoke-RestMethod -Uri "$BASE/pedidos" -Method Post -ContentType "application/json" -Headers $headers -Body $body
  Write-Host "   Pedido #$($r.numero_ticket) creado (id=$($r.id))" -ForegroundColor Gray
  $r
}

Test-Step "Transicionar pedido a 'entregado'" {
  Invoke-RestMethod -Uri "$BASE/pedidos/$($pedido.id)/estado" -Method Patch -ContentType "application/json" -Headers $headers -Body '{"estado":"en_preparacion"}' | Out-Null
  Invoke-RestMethod -Uri "$BASE/pedidos/$($pedido.id)/estado" -Method Patch -ContentType "application/json" -Headers $headers -Body '{"estado":"listo"}' | Out-Null
  Invoke-RestMethod -Uri "$BASE/pedidos/$($pedido.id)/estado" -Method Patch -ContentType "application/json" -Headers $headers -Body '{"estado":"entregado"}' | Out-Null
  $r = Invoke-RestMethod -Uri "$BASE/pedidos/$($pedido.id)" -Method Get -Headers $headers
  if ($r.estado -ne 'entregado') { throw "Estado esperado: entregado, obtenido: $($r.estado)" }
  Write-Host "   Estado: $($r.estado)" -ForegroundColor Gray
}

Test-Step "Verificar pedido aparece en cobros pendientes" {
  $r = Invoke-RestMethod -Uri "$BASE/api/caja/cobros-pendientes" -Method Get -Headers $headers
  $encontrado = $r.data | Where-Object { $_.id -eq $pedido.id }
  if (-not $encontrado) { throw "Pedido #$($pedido.id) no aparece en cobros pendientes" }
  Write-Host "   Encontrado: ticket #$($encontrado.numero_ticket), estado $($encontrado.estado)" -ForegroundColor Gray
}

Test-Step "Iniciar cobro (bloquear pedido)" {
  $r = Invoke-RestMethod -Uri "$BASE/api/caja/iniciar-cobro" -Method Post -ContentType "application/json" -Headers $headers -Body (@{ pedido_id = $pedido.id } | ConvertTo-Json)
  if (-not $r.message) { throw "No se pudo iniciar cobro" }
  Write-Host "   $($r.message)" -ForegroundColor Gray
}

Test-Step "Verificar mesa en estado 'pagando'" {
  $mesas = Invoke-RestMethod -Uri "$BASE/mesas" -Method Get -Headers $headers
  $mesa = $mesas | Where-Object { $_.id -eq $mesaDisponible.id }
  if ($mesa.estado -ne 'pagando') { throw "Mesa debería estar 'pagando', está '$($mesa.estado)'" }
  Write-Host "   Mesa #$($mesa.numero): $($mesa.estado)" -ForegroundColor Gray
}

Test-Step "Registrar pago" {
  $r = Invoke-RestMethod -Uri "$BASE/pagos" -Method Post -ContentType "application/json" -Headers $headers -Body (@{
    pedido_id = $pedido.id
    metodo_pago = "efectivo"
    monto_recibido = 30.00
    propina = 2.00
  } | ConvertTo-Json)
  Write-Host "   Pago registrado: $($r.pago.metodo), total=$($r.pago.total)" -ForegroundColor Gray
}

Test-Step "Verificar pedido ya no aparece en cobros pendientes" {
  Start-Sleep -Seconds 1
  $r = Invoke-RestMethod -Uri "$BASE/api/caja/cobros-pendientes" -Method Get -Headers $headers
  $encontrado = $r.data | Where-Object { $_.id -eq $pedido.id }
  if ($encontrado) { throw "Pedido #$($pedido.id) aún aparece en cobros pendientes" }
  Write-Host "   ✓ Ya no aparece" -ForegroundColor Gray
}

Test-Step "Verificar mesa liberada a 'disponible'" {
  $mesas = Invoke-RestMethod -Uri "$BASE/mesas" -Method Get -Headers $headers
  $mesa = $mesas | Where-Object { $_.id -eq $mesaDisponible.id }
  if ($mesa.estado -ne 'disponible') { throw "Mesa debería estar 'disponible', está '$($mesa.estado)'" }
  Write-Host "   Mesa #$($mesa.numero): $($mesa.estado) ✓" -ForegroundColor Gray
}

# ═══════════════════════════════════════════════════════
# CASO 2: Dos cajeros intentan iniciar cobro simultáneo
# ═══════════════════════════════════════════════════════
Write-Host "`n${'='*60}" -ForegroundColor Cyan
Write-Host "CASO 2: Bloqueo simultáneo — segundo debe recibir 409" -ForegroundColor Cyan
Write-Host "${'='*60}" -ForegroundColor Cyan

$pedido2 = Test-Step "Crear segundo pedido para prueba de concurrencia" {
  $body = @{
    tipo = "para_llevar"
    cliente_nombre = "Test Concurrencia"
    items = @(@{ id = 2; tipo = "producto"; nombre = "Otro Producto"; cantidad = 1; precio = 25.00 })
  } | ConvertTo-Json -Depth 3
  $r = Invoke-RestMethod -Uri "$BASE/pedidos" -Method Post -ContentType "application/json" -Headers $headers -Body $body
  Invoke-RestMethod -Uri "$BASE/pedidos/$($r.id)/estado" -Method Patch -ContentType "application/json" -Headers $headers -Body '{"estado":"en_preparacion"}' | Out-Null
  Invoke-RestMethod -Uri "$BASE/pedidos/$($r.id)/estado" -Method Patch -ContentType "application/json" -Headers $headers -Body '{"estado":"listo"}' | Out-Null
  $r
}

# Primer inicio de cobro (debe funcionar)
Test-Step "Primer cajero inicia cobro (debe ser exitoso)" {
  $r = Invoke-RestMethod -Uri "$BASE/api/caja/iniciar-cobro" -Method Post -ContentType "application/json" -Headers $headers -Body (@{ pedido_id = $pedido2.id } | ConvertTo-Json)
  if (-not $r.message) { throw "Debió ser exitoso" }
  Write-Host "   ✓ $($r.message)" -ForegroundColor Gray
}

# Segundo inicio de cobro (debe fallar con 409)
Test-Step "Segundo cajero intenta iniciar cobro (debe fallar 409)" {
  try {
    $null = Invoke-RestMethod -Uri "$BASE/api/caja/iniciar-cobro" -Method Post -ContentType "application/json" -Headers $headers -Body (@{ pedido_id = $pedido2.id } | ConvertTo-Json)
    throw "Debió rechazar el segundo inicio de cobro"
  } catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -ne 409) { throw "Se esperaba 409, se obtuvo $statusCode" }
    Write-Host "   ✓ Rechazado con 409: $($_.Exception.Message)" -ForegroundColor Green
  }
}

# Liberar bloqueo para limpiar
Test-Step "Liberar bloqueo del pedido 2" {
  $r = Invoke-RestMethod -Uri "$BASE/api/caja/liberar-bloqueo" -Method Post -ContentType "application/json" -Headers $headers -Body (@{ pedido_id = $pedido2.id } | ConvertTo-Json)
  Write-Host "   ✓ $($r.message)" -ForegroundColor Gray
}

# ═══════════════════════════════════════════════════════
# CASO 3: Pago duplicado rechazado
# ═══════════════════════════════════════════════════════
Write-Host "`n${'='*60}" -ForegroundColor Cyan
Write-Host "CASO 3: Pago duplicado debe ser rechazado" -ForegroundColor Cyan
Write-Host "${'='*60}" -ForegroundColor Cyan

# Pagar el pedido2
Test-Step "Pagar pedido 2 (primer pago, debe funcionar)" {
  $r = Invoke-RestMethod -Uri "$BASE/pagos" -Method Post -ContentType "application/json" -Headers $headers -Body (@{
    pedido_id = $pedido2.id
    metodo_pago = "tarjeta"
    monto_recibido = 25.00
    propina = 0
  } | ConvertTo-Json)
  Write-Host "   ✓ Pago registrado: $($r.pago.metodo)" -ForegroundColor Gray
}

Test-Step "Intentar pagar pedido 2 otra vez (debe fallar)" {
  try {
    $null = Invoke-RestMethod -Uri "$BASE/pagos" -Method Post -ContentType "application/json" -Headers $headers -Body (@{
      pedido_id = $pedido2.id
      metodo_pago = "efectivo"
      monto_recibido = 30.00
      propina = 0
    } | ConvertTo-Json)
    throw "Debió rechazar pago duplicado"
  } catch {
    Write-Host "   ✓ Rechazado: $($_.Exception.Message)" -ForegroundColor Green
  }
}

# ═══════════════════════════════════════════════════════
# CASO 4: Verificar cobros pendientes endpoint
# ═══════════════════════════════════════════════════════
Write-Host "`n${'='*60}" -ForegroundColor Cyan
Write-Host "CASO 4: Endpoint cobros-pendientes con paginación" -ForegroundColor Cyan
Write-Host "${'='*60}" -ForegroundColor Cyan

Test-Step "GET /api/caja/cobros-pendientes con paginación" {
  $r = Invoke-RestMethod -Uri "$BASE/api/caja/cobros-pendientes?page=1&limit=5" -Method Get -Headers $headers
  if ($null -eq $r.data) { throw "Respuesta no tiene campo 'data'" }
  Write-Host "   Total: $($r.total), Página: $($r.page), Total páginas: $($r.totalPages)" -ForegroundColor Gray
  Write-Host "   Items en página: $($r.data.Count)" -ForegroundColor Gray
}

# ═══════════════════════════════════════════════════════
# RESULTADOS
# ═══════════════════════════════════════════════════════
Write-Host "`n${'='*60}" -ForegroundColor Cyan
if ($ERRORS -eq 0) {
  Write-Host "✅ TODAS LAS PRUEBAS PASARON EXITOSAMENTE" -ForegroundColor Green
} else {
  Write-Host "❌ $ERRORS prueba(s) fallaron" -ForegroundColor Red
}
Write-Host "${'='*60}" -ForegroundColor Cyan
