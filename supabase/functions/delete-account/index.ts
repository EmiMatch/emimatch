import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return response(
      {
        success: false,
        error: "Método no permitido.",
      },
      405
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return response(
        {
          success: false,
          error: "Configuración segura de Supabase incompleta.",
        },
        500
      );
    }

    const authorization =
      req.headers.get("Authorization") ||
      req.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return response(
        {
          success: false,
          error: "Falta autorización.",
        },
        401
      );
    }

    const accessToken = authorization.replace("Bearer ", "").trim();

    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (userError || !user) {
      return response(
        {
          success: false,
          error: "Sesión inválida o expirada.",
        },
        401
      );
    }

    const userId = user.id;

    const cleanup = [];

    /*
     * Primero eliminamos datos dependientes.
     * Si alguna tabla no existe, se registra el error
     * y la función continúa para poder informar el resultado.
     */

    const deletes = [
      ["messages", "sender_id"],
      ["messages", "receiver_id"],
      ["matches", "user1_id"],
      ["matches", "user2_id"],
      ["swipes", "user_id"],
      ["swipes", "target_user_id"],
      ["reports", "reporter_id"],
      ["reports", "reported_id"],
      ["user_blocks", "blocker_id"],
      ["user_blocks", "blocked_id"],
      ["profiles", "id"],
    ];

    for (const [table, column] of deletes) {
      const { error } = await supabaseAdmin
        .from(table)
        .delete()
        .eq(column, userId);

      if (error) {
        cleanup.push({
          table,
          column,
          success: false,
          error: error.message,
        });
      } else {
        cleanup.push({
          table,
          column,
          success: true,
        });
      }
    }

    const { error: deleteUserError } =
      await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteUserError) {
      return response(
        {
          success: false,
          error:
            deleteUserError.message ||
            "No se pudo eliminar la cuenta de autenticación.",
          cleanup,
        },
        500
      );
    }

    return response({
      success: true,
      message: "Cuenta eliminada correctamente.",
      user_id: userId,
      cleanup,
    });
  } catch (error) {
    console.error("EmiMatch delete-account:", error);

    return response(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Error interno del servidor.",
      },
      500
    );
  }
});
