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
- Registro de token en app: `lib/push-notifications.ts`
- Envio al crear trabajo: `supabase/functions/push-trabajo-created/index.ts`
- Recordatorios diarios: `supabase/functions/push-daily-reminders/index.ts`

### 1) Aplicar migraciones

```bash
supabase db push
```

### 2) Desplegar funciones

```bash
supabase functions deploy push-trabajo-created
supabase functions deploy push-daily-reminders
```

### 3) Configurar secreto para el job diario

```bash
supabase secrets set PUSH_REMINDERS_CRON_SECRET=tu_secreto_largo
```

### 4) Programar ejecucion diaria (ej: 09:00)

Realiza un `POST` diario a:

`https://<PROJECT_REF>.supabase.co/functions/v1/push-daily-reminders`

con header:

`x-cron-secret: <PUSH_REMINDERS_CRON_SECRET>`

Puedes usar Supabase Scheduled Functions o un scheduler externo.
