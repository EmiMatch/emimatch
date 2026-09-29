import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

// Compatibilidad con claves antiguas y nuevas de Supabase.
const SUPABASE_ADMIN_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
  Deno.env.get("SUPABASE_SECRET_KEY");

const SUPABASE_ANON_KEY =
  Deno.env.get("SUPABASE_ANON_KEY") ||
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY");

function jsonResponse(
  body: Record<string, unknown>,
  status = 200
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    }
  );
}

Deno.serve(async (req: Request) => {
  /*
   * CORS / navegador
   */
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 204,
      headers: corsHeaders,
    });
  }

  /*
   * Solo POST
   */
  if (req.method !== "POST") {
    return jsonResponse(
      {
        success: false,
        error: "Método no permitido.",
      },
      405
    );
  }

  try {
    /*
     * Comprobaciones de configuración.
     */
    if (!SUPABASE_URL) {
      console.error("Falta SUPABASE_URL.");
      return jsonResponse(
        {
          success: false,
          error: "Configuración de Supabase incompleta.",
        },
        500
      );
    }

    if (!SUPABASE_ANON_KEY) {
      console.error("Falta SUPABASE_ANON_KEY/PUBLISHABLE_KEY.");
      return jsonResponse(
        {
          success: false,
          error: "Clave pública de Supabase no configurada.",
        },
        500
      );
    }

    if (!SUPABASE_ADMIN_KEY) {
      console.error(
        "Falta SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SECRET_KEY."
      );

      return jsonResponse(
        {
          success: false,
          error:
            "Clave administrativa de Supabase no configurada.",
        },
        500
      );
    }

    /*
     * Obtener Authorization.
     */
    const authorization =
      req.headers.get("Authorization") ||
      req.headers.get("authorization");

    if (!authorization) {
      return jsonResponse(
        {
          success: false,
          error: "Falta autorización.",
        },
        401
      );
    }

    /*
     * Debe ser:
     * Authorization: Bearer <JWT>
     */
    if (!authorization.startsWith("Bearer ")) {
      return jsonResponse(
        {
          success: false,
          error: "Formato de autorización inválido.",
        },
        401
      );
    }

    const accessToken =
      authorization.substring("Bearer ".length).trim();

    if (!accessToken) {
      return jsonResponse(
        {
          success: false,
          error: "Token de sesión vacío.",
        },
        401
      );
    }

    /*
     * Cliente para identificar al usuario autenticado.
     */
    const userClient = createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      }
    );

    /*
     * Validar JWT y obtener usuario real.
     */
    const {
      data: userData,
      error: userError,
    } = await userClient.auth.getUser(accessToken);

    if (userError || !userData?.user) {
      console.error(
        "JWT inválido:",
        userError?.message
      );

      return jsonResponse(
        {
          success: false,
          error:
            "La sesión no es válida o expiró. Iniciá sesión nuevamente.",
        },
        401
      );
    }

    const userId = userData.user.id;

    /*
     * Cliente ADMINISTRATIVO.
     * Esta clave solamente existe dentro de la Edge Function.
     */
    const adminClient = createClient(
      SUPABASE_URL,
      SUPABASE_ADMIN_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    /*
     * Eliminación definitiva del usuario.
     *
     * Supabase invalida las sesiones/refresh tokens
     * asociados al usuario al eliminarlo.
     */
    const {
      error: deleteError,
    } = await adminClient.auth.admin.deleteUser(
      userId,
      false
    );

    if (deleteError) {
      console.error(
        "Error eliminando usuario:",
        deleteError
      );

      return jsonResponse(
        {
          success: false,
          error:
            deleteError.message ||
            "No se pudo eliminar la cuenta.",
        },
        500
      );
    }

    /*
     * ÉXITO REAL.
     */
    console.log(
      `EmiMatch: cuenta eliminada correctamente. user_id=${userId}`
    );

    return jsonResponse({
      success: true,
      message: "Cuenta eliminada correctamente.",
    });

  } catch (error) {
    console.error(
      "delete-account error:",
      error
    );

    return jsonResponse(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Error interno al eliminar la cuenta.",
      },
      500
    );
  }
});
