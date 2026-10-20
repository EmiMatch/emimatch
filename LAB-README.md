# EmiMatch Lab — demo experimental

Esta rama está separada de `main` y no debe integrarse en producción automáticamente.

## Objetivo
Probar una experiencia unificada con cuatro capítulos:
- EmiMatch Citas
- EmiMatch Social
- EmiMatch Live
- EmiMatch Contenidos

## Seguridad de esta primera demo
- La pantalla de entrada se reemplaza solo durante la compilación de la APK Lab.
- Los ejemplos son ficticios y las acciones son simuladas.
- No hay registro, login, conexión de Supabase, mensajes reales ni pagos en la pantalla demo.
- La identidad Android de Lab es `com.emimatch.lab`, distinta de producción (`com.emimatch.app`).
- La APK de prueba se compila como debug y se guarda como artefacto de GitHub Actions por 14 días.
- No copiar claves de firma ni secretos de producción a este entorno.

## Compilar
El workflow `.github/workflows/build-lab-apk.yml` se ejecuta al actualizar esta rama o manualmente desde GitHub Actions. Descargá el artefacto `EmiMatch-Lab-APK-Demo` para instalarlo como aplicación separada.

## Próximas etapas
1. Revisar el diseño y navegación.
2. Ajustar la demo según comentarios.
3. Planificar un backend de pruebas independiente antes de implementar funciones reales.
4. Probar cada módulo y solo después proponer cambios de producción.

## Validación de la demo interactiva
La revisión de código del 20 de octubre de 2026 confirma interacciones locales para perfiles, likes, publicaciones, comentarios, guardados, chats de ejemplo, preferencias de perfil y vistas conceptuales de Live y Contenidos. El workflow valida la sintaxis del JavaScript con Node antes de compilar y comprueba que la demo siga aislada de servicios reales. La ampliación de Social incluye pestañas de publicaciones, personas, solicitudes recibidas y enviadas, lista de amigos y guardados; botones simulados para aceptar/rechazar solicitudes, quitar amigos, seguir y enviar solicitudes; selector de privacidad por publicación; y acción de reportar contenido. Todo es temporal y ficticio: no persiste después de cerrar la demo y no usa servicios reales.
