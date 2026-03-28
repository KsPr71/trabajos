export type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  sound?: 'default';
  data?: Record<string, unknown>;
};

export async function sendExpoPushMessages(messages: ExpoPushMessage[]) {
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
