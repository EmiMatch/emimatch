# EmiMatch Premium: planes de pago único

## Alcance de esta rama

Esta propuesta agrega una pantalla independiente, una Edge Function nueva (premium-one-time-create) y columnas aditivas para registrar el tipo, duración y monto esperado de cada compra. No reemplaza premium-create, que continúa siendo el flujo de suscripción mensual existente.

Precios fijados en servidor para evitar que el navegador pueda modificarlos:
- 1 mes: ARS 4.990
- 3 meses: ARS 11.990
- 6 meses: ARS 19.990
- 12 meses: ARS 29.990

## Estado de la revisión técnica

- La validación del pago de pago único rechaza una moneda ausente en la respuesta de Mercado Pago; no la interpreta por defecto como ARS.
- La rama incorpora la RPC `grant_one_time_premium_period`, que valida otra vez importe/moneda en la base de datos y, en una sola transacción, registra el pago aprobado, extiende el período y marca `premium_period_granted_at`. El bloqueo de fila del pago evita que notificaciones concurrentes otorguen dos períodos por la misma compra; el bloqueo de la fila del usuario serializa compras distintas de la misma cuenta.
- **La protección transaccional está implementada en el código de propuesta, pero aún no está validada en ejecución.** La migración no se aplicó y el webhook actualizado no se desplegó. Hace falta ejecutar pruebas reales en un entorno aislado, incluidas notificaciones concurrentes/repetidas, y verificar el comportamiento de reembolsos y del flujo recurrente antes de considerar la rama lista para fusionar o desplegar.
- Por ahora, esta rama continúa siendo una propuesta no publicada.

## Antes de activar

No fusionar ni desplegar para usuarios hasta completar la prueba de integración en un entorno de prueba. El HTML de propuesta puede estar en GitHub, pero la compra no queda activa hasta que estén desplegadas la migración, la versión actualizada de premium-webhook y la nueva función.

## Orden de despliegue recomendado

1. Revisar esta rama y el borrador de PR.
2. Aplicar la migración 20261020013000_premium_one_time_plans.sql en un entorno de prueba.
3. Desplegar la versión actualizada de premium-webhook.
4. Desplegar premium-one-time-create con verificación JWT habilitada.
5. Probar los cuatro importes con credenciales/modo de prueba de Mercado Pago.
6. Confirmar que los eventos de pago llegan firmados y que solo el estado approved activa Premium.
7. Confirmar que el monto y la moneda del pago coinciden con el importe guardado en servidor.
8. Repetir la notificación del mismo pago y comprobar que no extiende el período por segunda vez.
9. Probar que una compra posterior extiende el acceso después de un período Premium vigente.
10. Confirmar que los pagos recurrentes anteriores siguen activándose con su ciclo mensual normal.
11. Solo después de aprobar las pruebas, fusionar y publicar la pantalla de planes.

## Casos de prueba mínimos

- Sesión ausente o vencida: rechaza la solicitud y no abre Mercado Pago.
- Clave de plan inválida o manipulada: rechaza la solicitud.
- Cuenta administradora: devuelve Premium permanente sin iniciar un cobro.
- Preferencia creada en entorno de prueba: devuelve únicamente el enlace de prueba.
- Pago pendiente/rechazado: no activa Premium.
- Pago aprobado con importe o moneda incorrectos: no activa Premium y registra un evento de discrepancia.
- Pago aprobado con importe correcto: activa el plazo seleccionado.
- Notificación repetida del mismo pago: no suma meses otra vez.
- Compra posterior mientras existe Premium activo: comienza al finalizar el período activo.
- Reembolso/contracargo: conserva el tratamiento de revocación ya existente.
- Suscripción mensual anterior: conserva su vencimiento y su renovación actuales.

## Notas

- Los beneficios adicionales (insignia, visitas anónimas, impulso del perfil, burbuja especial y deshacer likes) no se anuncian como activos en esta pantalla.
- La pantalla usa la clave pública de Supabase igual que la página de membresía existente; la clave de servicio y el token de Mercado Pago permanecen exclusivamente en los secretos del servidor.
- No se realizaron despliegues en Supabase ni cambios en la rama main.
