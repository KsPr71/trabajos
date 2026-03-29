import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const configuredSecret = Deno.env.get('PUSH_REMINDERS_CRON_SECRET');
    const requestSecret = req.headers.get('x-cron-secret');

    if (!configuredSecret || requestSecret !== configuredSecret) {
      return jsonResponse({ error: 'No autorizado.' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const today = new Date();
    const todayISO = toISODate(today);
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weekEndISO = toISODate(weekEnd);

    const { data: trabajos, error: trabajosError } = await supabase
      .from('trabajos')
      .select('id,nombre_trabajo,fecha_entrega,estado,owner_user_id')
      .not('owner_user_id', 'is', null)
      .not('fecha_entrega', 'is', null)
      .gte('fecha_entrega', todayISO)
      .lte('fecha_entrega', weekEndISO)
      .not('estado', 'in', '("terminado","entregado")');

    if (trabajosError) {
      return jsonResponse(
        { error: `Error cargando trabajos para recordatorio: ${trabajosError.message}` },
        500
      );
    }

    if (!trabajos || trabajos.length === 0) {
      return jsonResponse({ ok: true, sent: 0, reason: 'Sin trabajos por recordar hoy.' });
    }

    const ownerIds = Array.from(
      new Set(
        trabajos
          .map((item) => item.owner_user_id)
          .filter((value): value is string => typeof value === 'string' && value.length > 0)
      )
    );

    if (ownerIds.length === 0) {
      return jsonResponse({ ok: true, sent: 0, reason: 'Sin usuarios propietarios.' });
    }

    const { data: tokenRows, error: tokensError } = await supabase
      .from('device_push_tokens')
      .select('user_id,expo_push_token')
      .in('user_id', ownerIds)
      .eq('is_active', true);

    if (tokensError) {
      return jsonResponse({ error: `Error cargando tokens: ${tokensError.message}` }, 500);
    }

    const tokensByUser = (tokenRows ?? []).reduce<Record<string, string[]>>((acc, row) => {
      const userId = row.user_id;
      const token = row.expo_push_token;
      if (typeof userId !== 'string' || typeof token !== 'string') {
        return acc;
      }
      if (!acc[userId]) {
        acc[userId] = [];
      }
      acc[userId].push(token);
      return acc;
    }, {});

    const messages: {
      to: string;
      title: string;
      body: string;
      sound: 'default';
      data: Record<string, unknown>;
    }[] = [];

    for (const trabajo of trabajos) {
      const ownerUserId = trabajo.owner_user_id;
      const fechaEntrega = trabajo.fecha_entrega;

      if (typeof ownerUserId !== 'string' || typeof fechaEntrega !== 'string') {
        continue;
      }

      const userTokens = tokensByUser[ownerUserId] ?? [];
      if (userTokens.length === 0) {
        continue;
      }

      const { error: logError } = await supabase.from('push_reminder_logs').insert({
        user_id: ownerUserId,
        trabajo_id: trabajo.id,
        reminder_date: todayISO,
      });

      if (logError) {
        if (logError.code === '23505') {
          continue;
        }
        console.error('Error insertando push_reminder_logs', logError.message);
        continue;
      }

      const daysLeft = getDaysDiff(todayISO, fechaEntrega);
      const remainingText = daysLeft <= 0 ? 'vence hoy' : `faltan ${daysLeft} dias`;
      const body = `${trabajo.nombre_trabajo}: ${remainingText} para la entrega (${toDisplayDate(fechaEntrega)}).`;

      for (const token of userTokens) {
        messages.push({
          to: token,
          sound: 'default',
          title: 'Recordatorio de entrega',
          body,
          data: {
            type: 'recordatorio_entrega',
            trabajoId: trabajo.id,
            fechaEntrega,
            diasRestantes: daysLeft,
          },
        });
      }
    }

    if (messages.length === 0) {
      return jsonResponse({ ok: true, sent: 0, reason: 'No hubo mensajes nuevos para enviar.' });
    }

    const result = await sendExpoPushMessages(messages);
    if (!result.ok) {
      return jsonResponse({ ok: false, error: result.error, detail: result.responses }, 500);
    }

    return jsonResponse({ ok: true, sent: result.sent });
  } catch (error) {
    return jsonResponse({ error: String(error) }, 500);
  }
});

function toISODate(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDaysDiff(fromISO: string, toISO: string) {
  const fromDate = new Date(`${fromISO}T00:00:00.000Z`);
  const toDate = new Date(`${toISO}T00:00:00.000Z`);
  const ms = toDate.getTime() - fromDate.getTime();
  return Math.round(ms / 86400000);
}

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

type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  sound?: 'default';
  data?: Record<string, unknown>;
};

async function sendExpoPushMessages(messages: ExpoPushMessage[]) {
  if (messages.length === 0) {
    return { ok: true, sent: 0, chunks: 0, responses: [] as unknown[] };
  }

  const chunks = chunkArray(messages, 100);
  const responses: unknown[] = [];

  for (const chunk of chunks) {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(chunk),
    });

    const payload = await safeJson(response);
    responses.push(payload);

    if (!response.ok) {
      return {
        ok: false,
        sent: 0,
        chunks: chunks.length,
        responses,
        error: `Expo push API error: ${response.status}`,
      };
    }
  }

  return { ok: true, sent: messages.length, chunks: chunks.length, responses };
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function safeJson(response: Response) {
  try {
    return await response.json();
  } catch (_error) {
    return null;
  }
}
