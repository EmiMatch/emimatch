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
