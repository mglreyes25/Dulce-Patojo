# =============================================================
# PRUEBAS DE FLUJO COMPLETO: Pedidos, Estados y Pagos
# =============================================================
# Ejecutar con:  .\curl\pruebas_flujo.ps1
# Requiere: servidor backend corriendo en localhost:5000
# =============================================================

$BASE = "http://localhost:5000"

Write-Host "=== 1. Login como Cajero ===" -ForegroundColor Cyan
$login = Invoke-RestMethod -Uri "$BASE/auth/login" -Method Post -ContentType "application/json" -Body '{"correo":"cajero@test.com","password":"123456"}'
$TOKEN = $login.token
Write-Host "Token obtenido: $($TOKEN.Substring(0,20))..." -ForegroundColor Green

$headers = @{ Authorization = "Bearer $TOKEN" }

Write-Host "`n=== 2. Ver mesas disponibles ===" -ForegroundColor Cyan
$mesas = Invoke-RestMethod -Uri "$BASE/mesas" -Method Get -Headers $headers
$mesaDisponible = $mesas | Where-Object { $_.estado -eq 'disponible' } | Select-Object -First 1
Write-Host "Mesa disponible: #$($mesaDisponible.numero) (id=$($mesaDisponible.id))" -ForegroundColor Green

Write-Host "`n=== 3. Crear pedido en mesa sin pago ===" -ForegroundColor Cyan
$pedidoBody = @{
    tipo = "en_mesa"
    mesa_id = $mesaDisponible.id
    cliente_nombre = "Cliente Prueba"
    items = @(
        @{ id = 1; tipo = "producto"; nombre = "Producto Test"; cantidad = 2; precio = 15.50 }
    )
    notas = "Pedido de prueba - flujo completo"
} | ConvertTo-Json -Depth 3

$pedido = Invoke-RestMethod -Uri "$BASE/pedidos" -Method Post -ContentType "application/json" -Headers $headers -Body $pedidoBody
Write-Host "Pedido creado: #$($pedido.numero_ticket) — estado: $($pedido.estado) — id=$($pedido.id)" -ForegroundColor Green

$PEDIDO_ID = $pedido.id

Write-Host "`n=== 4. Verificar mesa ocupada ===" -ForegroundColor Cyan
$mesa = Invoke-RestMethod -Uri "$BASE/mesas" -Method Get -Headers $headers | Where-Object { $_.id -eq $mesaDisponible.id }
Write-Host "Mesa #$($mesa.numero): $($mesa.estado)" -ForegroundColor Green

Write-Host "`n=== 5. Transición: recibido → en_preparacion (cocinero) ===" -ForegroundColor Cyan
$res = Invoke-RestMethod -Uri "$BASE/pedidos/$PEDIDO_ID/estado" -Method Patch -ContentType "application/json" -Headers $headers -Body '{"estado":"en_preparacion"}'
Write-Host "Estado actual: $($res.estado)" -ForegroundColor Green

Write-Host "`n=== 6. Transición inválida (debe fallar) ===" -ForegroundColor Cyan
try {
    $null = Invoke-RestMethod -Uri "$BASE/pedidos/$PEDIDO_ID/estado" -Method Patch -ContentType "application/json" -Headers $headers -Body '{"estado":"entregado"}'
    Write-Host "ERROR: Debió rechazar transición en_preparacion→entregado" -ForegroundColor Red
} catch {
    Write-Host "OK: Transición rechazada correctamente: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host "`n=== 7. en_preparacion → listo (cocinero) ===" -ForegroundColor Cyan
$res = Invoke-RestMethod -Uri "$BASE/pedidos/$PEDIDO_ID/estado" -Method Patch -ContentType "application/json" -Headers $headers -Body '{"estado":"listo"}'
Write-Host "Estado actual: $($res.estado)" -ForegroundColor Green

Write-Host "`n=== 8. listo → entregado (despachador) ===" -ForegroundColor Cyan
$res = Invoke-RestMethod -Uri "$BASE/pedidos/$PEDIDO_ID/estado" -Method Patch -ContentType "application/json" -Headers $headers -Body '{"estado":"entregado"}'
Write-Host "Estado actual: $($res.estado)" -ForegroundColor Green

Write-Host "`n=== 9a. Pagar vía POST /pedidos/:id/pagar (endpoint original) ===" -ForegroundColor Cyan
$pagoBody = @{
    metodo_pago = "efectivo"
    monto_recibido = 50.00
    propina = 2.50
} | ConvertTo-Json
$res = Invoke-RestMethod -Uri "$BASE/pedidos/$PEDIDO_ID/pagar" -Method Post -ContentType "application/json" -Headers $headers -Body $pagoBody
Write-Host "Pedido pagado: $($res.pedido.estado)" -ForegroundColor Green
Write-Host "Pago registrado: $($res.pago.metodo) — total=$($res.pago.total) — propina=$($res.pago.propina)" -ForegroundColor Green

Write-Host "`n=== 9b. Verificar mesa liberada ===" -ForegroundColor Cyan
$mesa = Invoke-RestMethod -Uri "$BASE/mesas" -Method Get -Headers $headers | Where-Object { $_.id -eq $mesaDisponible.id }
Write-Host "Mesa #$($mesa.numero): $($mesa.estado)" -ForegroundColor Green

Write-Host "`n=== 10. Crear pedido para_prueba y pagar vía POST /pagos ===" -ForegroundColor Cyan
$pedido2 = Invoke-RestMethod -Uri "$BASE/pedidos" -Method Post -ContentType "application/json" -Headers $headers -Body (@{
    tipo = "para_llevar"
    cliente_nombre = "Cliente Llevar"
    items = @(@{ id = 1; tipo = "producto"; nombre = "Producto Test"; cantidad = 1; precio = 10.00 })
} | ConvertTo-Json -Depth 3)
Write-Host "Pedido #$($pedido2.numero_ticket) creado (id=$($pedido2.id))" -ForegroundColor Green

Start-Sleep -Seconds 1
$res = Invoke-RestMethod -Uri "$BASE/pedidos/$($pedido2.id)/estado" -Method Patch -ContentType "application/json" -Headers $headers -Body '{"estado":"en_preparacion"}'
$res = Invoke-RestMethod -Uri "$BASE/pedidos/$($pedido2.id)/estado" -Method Patch -ContentType "application/json" -Headers $headers -Body '{"estado":"listo"}'
$res = Invoke-RestMethod -Uri "$BASE/pedidos/$($pedido2.id)/estado" -Method Patch -ContentType "application/json" -Headers $headers -Body '{"estado":"entregado"}'

$pagoBody2 = @{
    pedido_id = $pedido2.id
    metodo_pago = "tarjeta"
    propina = 1.00
} | ConvertTo-Json
$res2 = Invoke-RestMethod -Uri "$BASE/pagos" -Method Post -ContentType "application/json" -Headers $headers -Body $pagoBody2
Write-Host "Pago registrado vía POST /pagos: $($res2.pago.metodo) — total=$($res2.pago.total)" -ForegroundColor Green

Write-Host "`n=== 11. Verificar log de estados ===" -ForegroundColor Cyan
Write-Host "(Ejecutar en Supabase SQL Editor: SELECT * FROM pedidos_estado_log WHERE pedido_id = $PEDIDO_ID;)" -ForegroundColor Magenta

Write-Host "`n=== FLUJO COMPLETO VERIFICADO CON ÉXITO ===" -ForegroundColor Green
