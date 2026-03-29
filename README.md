# Archei

Aplicacion Expo + Supabase para gestion de trabajos academicos.

## Desarrollo local

1. Instalar dependencias:

```bash
npm install
```

2. Iniciar la app:

```bash
npx expo start
```

## Push remotas con Expo Push Service

Este proyecto ya incluye la modalidad:

- La app obtiene y registra `ExpoPushToken` por usuario.
- El backend (Edge Functions) envia al API de Expo.
- Expo enruta a FCM/APNs.

### Archivos clave

- Migracion: `supabase/migrations/20260328113000_add_push_notifications_infra.sql`
- Migracion cola + triggers SQL: `supabase/migrations/20260329101500_add_notification_queue_and_triggers.sql`
- Registro de token en app: `lib/push-notifications.ts`
- Cola push (processor): `supabase/functions/push-process-queue/index.ts`
- Envio directo/manual de prueba: `supabase/functions/push-trabajo-created/index.ts`
- Recordatorios diarios: `supabase/functions/push-daily-reminders/index.ts`

### 1) Aplicar migraciones

```bash
supabase db push
```

### 2) Desplegar funciones

```bash
supabase functions deploy push-trabajo-created
supabase functions deploy push-process-queue
supabase functions deploy push-daily-reminders
```

### 3) Configurar secreto para el job diario

```bash
supabase secrets set PUSH_REMINDERS_CRON_SECRET=tu_secreto_largo
```

### 4) Programar procesador de cola (frecuente)

Este endpoint procesa la tabla `notification_queue` (poblada por triggers SQL en `trabajos`):

`https://<PROJECT_REF>.supabase.co/functions/v1/push-process-queue`

Headers:

`x-cron-secret: <PUSH_REMINDERS_CRON_SECRET>`

Frecuencia recomendada: cada 1-5 minutos.

### 5) Programar recordatorio diario (ej: 09:00)

Realiza un `POST` diario a:

`https://<PROJECT_REF>.supabase.co/functions/v1/push-daily-reminders`

con header:

`x-cron-secret: <PUSH_REMINDERS_CRON_SECRET>`

Puedes usar Supabase Scheduled Functions o un scheduler externo.
