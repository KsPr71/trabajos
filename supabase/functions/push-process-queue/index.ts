import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

type QueueRow = {
  id: number;
  user_id: string;
  trabajo_id: number | null;
  event_type: 'trabajo_creado' | 'trabajo_terminado' | string;
  payload: Record<string, unknown> | null;
  attempt_count: number;
  max_attempts: number;
};

type MessageContent = {
  title: string;
  body: string;
  data: Record<string, unknown>;
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

    const batchSize = getEnvInt('PUSH_QUEUE_BATCH_SIZE', 50, 1, 500);
    const retryDelayMinutes = getEnvInt('PUSH_QUEUE_RETRY_DELAY_MINUTES', 15, 1, 720);
    const nowIso = new Date().toISOString();

    const { data: claimedRows, error: claimError } = await supabase.rpc(
      'fn_claim_notification_queue',
      { p_limit: batchSize }
    );

    if (claimError) {
      return jsonResponse(
        { error: `No se pudo reclamar notification_queue: ${claimError.message}` },
        500
      );
    }

    const queueRows = (claimedRows ?? []) as QueueRow[];
    if (queueRows.length === 0) {
      return jsonResponse({ ok: true, claimed: 0, sent: 0, reason: 'Sin items pendientes.' });
    }

    const userIds = Array.from(
      new Set(
        queueRows
          .map((item) => item.user_id)
          .filter((value): value is string => typeof value === 'string' && value.length > 0)
      )
    );

    const { data: tokenRows, error: tokenError } = await supabase
      .from('device_push_tokens')
      .select('user_id,expo_push_token')
      .in('user_id', userIds)
      .eq('is_active', true);

    if (tokenError) {
      await markRowsForRetry(supabase, queueRows, `Error cargando tokens: ${tokenError.message}`, retryDelayMinutes);
      return jsonResponse(
        { ok: false, claimed: queueRows.length, sent: 0, error: `Error cargando tokens: ${tokenError.message}` },
        500
      );
    }

    const tokensByUser = (tokenRows ?? []).reduce<Record<string, string[]>>((acc, row) => {
      const userId = row.user_id;
      const token = row.expo_push_token;
      if (typeof userId !== 'string' || typeof token !== 'string' || token.length === 0) {
        return acc;
      }
      if (!acc[userId]) {
        acc[userId] = [];
      }
      acc[userId].push(token);
      return acc;
    }, {});

    const sentIds: number[] = [];
    const retryItems: { row: QueueRow; error: string }[] = [];
    const failedItems: { row: QueueRow; error: string }[] = [];
    let sentMessages = 0;
    let skippedNoTokens = 0;
    let skippedUnsupported = 0;

    for (const row of queueRows) {
      const content = buildMessageContent(row);
      if (!content) {
        skippedUnsupported += 1;
        failedItems.push({ row, error: `event_type no soportado: ${row.event_type}` });
        continue;
      }

      const userTokens = tokensByUser[row.user_id] ?? [];
      if (userTokens.length === 0) {
        skippedNoTokens += 1;
        sentIds.push(row.id);
        continue;
      }

      const result = await sendExpoPushMessages(
        userTokens.map((token) => ({
          to: token,
          title: content.title,
          body: content.body,
          data: content.data,
          sound: 'default',
        }))
      );

      if (result.ok) {
        sentIds.push(row.id);
        sentMessages += result.sent;
        continue;
      }

      const errorText = result.error ?? 'Error desconocido enviando a Expo.';
      if (row.attempt_count >= row.max_attempts) {
        failedItems.push({ row, error: errorText });
      } else {
        retryItems.push({ row, error: errorText });
      }
    }

    if (sentIds.length > 0) {
      const { error: sentUpdateError } = await supabase
        .from('notification_queue')
        .update({
          status: 'sent',
          processed_at: nowIso,
          locked_at: null,
          last_error: null,
          updated_at: nowIso,
        })
        .in('id', sentIds);

      if (sentUpdateError) {
        console.error('Error marcando notification_queue como sent', sentUpdateError.message);
      }
    }

    for (const item of retryItems) {
      const retryAtIso = new Date(Date.now() + retryDelayMinutes * 60000).toISOString();
      const { error: retryError } = await supabase
        .from('notification_queue')
        .update({
          status: 'pending',
          scheduled_for: retryAtIso,
          locked_at: null,
          last_error: item.error.slice(0, 2000),
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.row.id);

      if (retryError) {
        console.error('Error reprogramando item de notification_queue', retryError.message);
      }
    }

    for (const item of failedItems) {
      const { error: failedError } = await supabase
        .from('notification_queue')
        .update({
          status: 'failed',
          locked_at: null,
          last_error: item.error.slice(0, 2000),
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.row.id);

      if (failedError) {
        console.error('Error marcando item de notification_queue como failed', failedError.message);
      }
    }

    return jsonResponse({
      ok: true,
      claimed: queueRows.length,
      sent: sentMessages,
      sentEvents: sentIds.length,
      retries: retryItems.length,
      failed: failedItems.length,
      skippedNoTokens,
      skippedUnsupported,
    });
  } catch (error) {
    return jsonResponse({ error: String(error) }, 500);
  }
});

function buildMessageContent(row: QueueRow): MessageContent | null {
  const payload = row.payload ?? {};
  const trabajoNombre = getString(payload.trabajoNombre) ?? 'Trabajo';
  const fechaEntrega = getString(payload.fechaEntrega);
  const trabajoId = row.trabajo_id ?? getNumber(payload.trabajoId);

  if (row.event_type === 'trabajo_creado') {
    return {
      title: 'Trabajo creado',
      body: fechaEntrega
        ? `Se creo "${trabajoNombre}". Entrega: ${toDisplayDate(fechaEntrega)}`
        : `Se creo "${trabajoNombre}".`,
      data: {
        type: 'trabajo_creado',
        trabajoId,
        trabajoNombre,
        fechaEntrega,
      },
    };
  }

  if (row.event_type === 'trabajo_terminado') {
    return {
      title: 'Trabajo terminado',
      body: `"${trabajoNombre}" esta terminado y listo para gestionar entrega.`,
      data: {
        type: 'trabajo_terminado',
        trabajoId,
        trabajoNombre,
        fechaEntrega,
      },
    };
  }

  return null;
}

async function markRowsForRetry(
  supabase: ReturnType<typeof createClient>,
  rows: QueueRow[],
  errorText: string,
  retryDelayMinutes: number
) {
  for (const row of rows) {
    if (row.attempt_count >= row.max_attempts) {
      await supabase
        .from('notification_queue')
        .update({
          status: 'failed',
          locked_at: null,
          last_error: errorText.slice(0, 2000),
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id);
      continue;
    }

    const retryAtIso = new Date(Date.now() + retryDelayMinutes * 60000).toISOString();
    await supabase
      .from('notification_queue')
      .update({
        status: 'pending',
        scheduled_for: retryAtIso,
        locked_at: null,
        last_error: errorText.slice(0, 2000),
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id);
  }
}

function getString(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function getEnvInt(name: string, defaultValue: number, min: number, max: number) {
  const raw = Deno.env.get(name);
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return defaultValue;
  }
  return Math.min(Math.max(Math.round(parsed), min), max);
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
