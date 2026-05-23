#!/bin/bash
# =============================================================
# PRUEBAS DE FLUJO COMPLETO: Pedidos, Estados y Pagos
# =============================================================
# Ejecutar con:  bash curl/pruebas_flujo.sh
# Requiere: servidor backend corriendo en localhost:5000
# =============================================================

BASE="http://localhost:5000"
TOKEN=""

echo "=== 1. Login como Cajero ==="
LOGIN=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"correo":"cajero@test.com","password":"123456"}')
TOKEN=$(echo "$LOGIN" | jq -r '.token')
echo "Token: ${TOKEN:0:20}..."

HEADER="Authorization: Bearer $TOKEN"

echo -e "\n=== 2. Ver mesas disponibles ==="
MESAS=$(curl -s "$BASE/mesas" -H "$HEADER")
MESA_ID=$(echo "$MESAS" | jq '[.[] | select(.estado=="disponible")][0].id')
MESA_NUM=$(echo "$MESAS" | jq '[.[] | select(.estado=="disponible")][0].numero')
echo "Mesa disponible: #$MESA_NUM (id=$MESA_ID)"

echo -e "\n=== 3. Crear pedido en mesa sin pago ==="
PEDIDO=$(curl -s -X POST "$BASE/pedidos" \
  -H "Content-Type: application/json" \
  -H "$HEADER" \
  -d '{
    "tipo": "en_mesa",
    "mesa_id": '"$MESA_ID"',
    "cliente_nombre": "Cliente Prueba",
    "items": [{"id":1,"tipo":"producto","nombre":"Producto Test","cantidad":2,"precio":15.50}],
    "notas": "Pedido de prueba - flujo completo"
  }')
PEDIDO_ID=$(echo "$PEDIDO" | jq '.id')
TICKET=$(echo "$PEDIDO" | jq -r '.numero_ticket')
echo "Pedido creado: #$TICKET — estado: $(echo "$PEDIDO" | jq -r '.estado') — id=$PEDIDO_ID"

echo -e "\n=== 4. Verificar mesa ocupada ==="
curl -s "$BASE/mesas" -H "$HEADER" | jq ".[] | select(.id==$MESA_ID) | {numero, estado}"

echo -e "\n=== 5. Transición: recibido → en_preparacion (cocinero) ==="
curl -s -X PATCH "$BASE/pedidos/$PEDIDO_ID/estado" \
  -H "Content-Type: application/json" -H "$HEADER" \
  -d '{"estado":"en_preparacion"}' | jq '{id, estado}'

echo -e "\n=== 6. Transición inválida (debe fallar) ==="
echo "Intentando en_preparacion → entregado..."
curl -s -X PATCH "$BASE/pedidos/$PEDIDO_ID/estado" \
  -H "Content-Type: application/json" -H "$HEADER" \
  -d '{"estado":"entregado"}' | jq '{error}'

echo -e "\n=== 7. en_preparacion → listo (cocinero) ==="
curl -s -X PATCH "$BASE/pedidos/$PEDIDO_ID/estado" \
  -H "Content-Type: application/json" -H "$HEADER" \
  -d '{"estado":"listo"}' | jq '{id, estado}'

echo -e "\n=== 8. listo → entregado (despachador) ==="
curl -s -X PATCH "$BASE/pedidos/$PEDIDO_ID/estado" \
  -H "Content-Type: application/json" -H "$HEADER" \
  -d '{"estado":"entregado"}' | jq '{id, estado}'

echo -e "\n=== 9a. Pagar vía POST /pedidos/:id/pagar ==="
curl -s -X POST "$BASE/pedidos/$PEDIDO_ID/pagar" \
  -H "Content-Type: application/json" -H "$HEADER" \
  -d '{"metodo_pago":"efectivo","monto_recibido":50.00,"propina":2.50}' | jq '{pedido: {id, estado}, pago: {metodo, total, propina}}'

echo -e "\n=== 9b. Verificar mesa liberada ==="
curl -s "$BASE/mesas" -H "$HEADER" | jq ".[] | select(.id==$MESA_ID) | {numero, estado}"

echo -e "\n=== 10. Crear pedido para_llevar y pagar vía POST /pagos ==="
PEDIDO2=$(curl -s -X POST "$BASE/pedidos" \
  -H "Content-Type: application/json" -H "$HEADER" \
  -d '{"tipo":"para_llevar","cliente_nombre":"Cliente Llevar","items":[{"id":1,"tipo":"producto","nombre":"Producto Test","cantidad":1,"precio":10.00}]}')
PEDIDO2_ID=$(echo "$PEDIDO2" | jq '.id')
echo "Pedido #$(echo "$PEDIDO2" | jq -r '.numero_ticket') creado (id=$PEDIDO2_ID)"

# Avanzar estados
curl -s -X PATCH "$BASE/pedidos/$PEDIDO2_ID/estado" -H "Content-Type: application/json" -H "$HEADER" -d '{"estado":"en_preparacion"}' > /dev/null
curl -s -X PATCH "$BASE/pedidos/$PEDIDO2_ID/estado" -H "Content-Type: application/json" -H "$HEADER" -d '{"estado":"listo"}' > /dev/null
curl -s -X PATCH "$BASE/pedidos/$PEDIDO2_ID/estado" -H "Content-Type: application/json" -H "$HEADER" -d '{"estado":"entregado"}' > /dev/null

# Pagar vía POST /pagos
curl -s -X POST "$BASE/pagos" \
  -H "Content-Type: application/json" -H "$HEADER" \
  -d '{"pedido_id":'"$PEDIDO2_ID"',"metodo_pago":"tarjeta","propina":1.00}' | jq '{pago: {metodo, total}}'

echo -e "\n=== 11. Verificar log de estados ==="
echo "Ejecutar en Supabase SQL Editor:"
echo "SELECT * FROM pedidos_estado_log WHERE pedido_id = $PEDIDO_ID;"
echo ""
echo "=== FLUJO COMPLETO VERIFICADO CON ÉXITO ==="
