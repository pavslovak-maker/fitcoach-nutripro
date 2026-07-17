// ============================================================
// Scheduler — cron joby pro pravidelné úkoly
// V produkci: node-cron nebo BullMQ repeatable jobs
// ============================================================

// import cron from 'node-cron';

const logger = console;

/**
 * Hlavní plánovač — registruje všechny cron joby.
 */
export function startScheduler() {
  // ─── Neděle 20:00 — týdenní AI generování pro všechny klienty ──
  // cron.schedule('0 20 * * 0', weeklyAIGeneration);

  // ─── Denně 06:00 — sync wearable dat ──────────────────────
  // cron.schedule('0 6 * * *', dailyWearableSync);

  // ─── Denně 07:00 — ranní check-in reminder ───────────────
  // cron.schedule('0 7 * * *', morningCheckinReminder);

  // ─── 1. den v měsíci — měsíční progress report ───────────
  // cron.schedule('0 9 1 * *', monthlyProgressReport);

  logger.info('scheduler.started');
}

/**
 * Týdenní AI generování — jádro systému.
 * Prochází všechny aktivní uživatele a enqueue-uje AI job.
 * Staggering: rozloží joby do 2 hodin (ne všechny naráz).
 */
async function weeklyAIGeneration(): Promise<void> {
  logger.info('scheduler.weekly_ai_start');

  const activeUsers = await db.users.findMany({
    where: { is_active: true, role: 'client' },
    select: { id: true },
  });

  let enqueued = 0;
  const batchSize = 50; // Zpracovávej po 50

  for (let i = 0; i < activeUsers.length; i += batchSize) {
    const batch = activeUsers.slice(i, i + batchSize);

    for (const user of batch) {
      const weekStr = getWeekString();
      const idempotencyKey = `weekly_${user.id}_${weekStr}`;

      // Idempotence: nekrej job pokud už existuje
      const existing = await db.ai_jobs.findUnique({
        where: { idempotency_key: idempotencyKey },
      });

      if (!existing) {
        await aiQueue.add('generate_recommendation', {
          user_id: user.id,
          job_type: 'weekly_plan',
          idempotency_key: idempotencyKey,
        }, {
          delay: Math.random() * 7200000, // Random delay 0–2h (staggering)
          attempts: 3,
          backoff: { type: 'exponential', delay: 30000 },
        });
        enqueued++;
      }
    }
  }

  logger.info('scheduler.weekly_ai_done', { total: activeUsers.length, enqueued });
}

/**
 * Denní sync wearable dat (Garmin, Withings).
 * Prochází uživatele s aktivním zařízením a tahá data za včerejšek.
 */
async function dailyWearableSync(): Promise<void> {
  logger.info('scheduler.wearable_sync_start');

  const devices = await db.wearable_devices.findMany({
    where: { je_aktivni: true },
  });

  for (const device of devices) {
    try {
      await syncWearableData(device);
    } catch (error) {
      logger.error('scheduler.wearable_sync_error', {
        device_id: device.id,
        user_id: device.user_id,
        error: (error as Error).message,
      });

      // Pokud token expired, označ zařízení
      if ((error as Error).message.includes('token_expired')) {
        await db.wearable_devices.update({
          where: { id: device.id },
          data: { je_aktivni: false },
        });

        // Notifikuj uživatele
        await sendNotification(device.user_id, {
          title: 'Propojení s hodinkami vypršelo',
          body: 'Připoj hodinky znovu v nastavení.',
        });
      }
    }
  }
}

/**
 * Ranní reminder pro check-in.
 * Posílá push notifikaci pokud uživatel ještě nevyplnil check-in.
 */
async function morningCheckinReminder(): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  // Najdi uživatele kteří mají zapnutý reminder a ještě dnes nevyplnili
  const users = await db.users.findMany({
    where: {
      is_active: true,
      notification_preferences: { ranní_checkin: true },
    },
    select: { id: true },
  });

  for (const user of users) {
    const existingCheckin = await db.daily_checkins.findUnique({
      where: { user_id_datum: { user_id: user.id, datum: today } },
    });

    if (!existingCheckin) {
      await sendNotification(user.id, {
        title: 'Dobré ráno! ☀️',
        body: 'Vyplň rychlý check-in — zabere to 30 sekund.',
      });
    }
  }
}

// ─── Helpers ────────────────────────────────────────────────

function getWeekString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const oneJan = new Date(year, 0, 1);
  const weekNum = Math.ceil(
    ((now.getTime() - oneJan.getTime()) / 86400000 + oneJan.getDay() + 1) / 7
  );
  return `${year}-W${weekNum.toString().padStart(2, '0')}`;
}

async function syncWearableData(device: any): Promise<void> {
  // V produkci: Garmin Connect API / Withings API volání
  // viz /mnt/user-data/outputs/integracija-smartdevices.md
  logger.info('wearable.sync', { device_id: device.id, type: device.typ });
}

async function sendNotification(userId: string, payload: { title: string; body: string }): Promise<void> {
  logger.info('notification.send', { userId, ...payload });
}

// Placeholder
const db: any = {};
const aiQueue: any = { add: async () => {} };
