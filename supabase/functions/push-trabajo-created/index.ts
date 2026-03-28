import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

import { sendExpoPushMessages } from '../_shared/expo-push.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type RequestBody = {
  trabajoNombre?: string;
  fechaEntrega?: string | null;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Authorization header requerido.' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      const message = userError?.message?.toLowerCase() ?? '';
      if (message.includes('jwt')) {
        return jsonResponse(
          { error: 'JWT invalido o expirado. Cierra sesion y vuelve a iniciar sesion.' },
          401
        );
      }
      return jsonResponse({ error: 'Usuario no autenticado.' }, 401);
    }

    const body = (await req.json()) as RequestBody;
    const trabajoNombre = (body.trabajoNombre ?? '').trim();
    const fechaEntrega = body.fechaEntrega ?? null;

    if (!trabajoNombre) {
      return jsonResponse({ error: 'trabajoNombre es obligatorio.' }, 400);
    }

    const { data: tokenRows, error: tokenError } = await supabase
      .from('device_push_tokens')
      .select('expo_push_token')
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (tokenError) {
      return jsonResponse(
        { error: `No se pudieron leer tokens: ${tokenError.message}` },
        500
      );
    }

    const tokens = (tokenRows ?? [])
      .map((row) => row.expo_push_token)
      .filter((value): value is string => typeof value === 'string' && value.length > 0);

    if (tokens.length === 0) {
      return jsonResponse({ ok: true, sent: 0, reason: 'Sin tokens registrados.' });
    }

    const bodyText = fechaEntrega
      ? `Se creo "${trabajoNombre}". Entrega: ${toDisplayDate(fechaEntrega)}`
      : `Se creo "${trabajoNombre}".`;

    const result = await sendExpoPushMessages(
      tokens.map((token) => ({
        to: token,
        sound: 'default',
        title: 'Trabajo creado',
        body: bodyText,
        data: {
          type: 'trabajo_creado',
          trabajoNombre,
          fechaEntrega,
        },
      }))
    );

    if (!result.ok) {
      return jsonResponse({ ok: false, error: result.error, detail: result.responses }, 500);
    }

    return jsonResponse({ ok: true, sent: result.sent });
  } catch (error) {
    return jsonResponse({ error: String(error) }, 500);
  }
});

function toDisplayDate(value: string) {
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) {
    return value;
  }
  return `${day}/${month}/${year}`;
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}
