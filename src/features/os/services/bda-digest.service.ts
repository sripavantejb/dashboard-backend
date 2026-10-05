import { Types } from 'mongoose';
import { ReminderLog, SalesActivityEvent, User } from '../../../models/index.js';
import { notificationRecipients } from '../../../shared/os/company.js';
import { sendNotificationEmail } from '../../../shared/utils/mailer.js';
import { formatIst, istDayKey } from './reminders.service.js';

const QUIET = new Set(['attendance_check_in', 'daily_work_status', 'call_started']);

function hourKey(now = new Date()) {
  // IST hour bucket so the digest aligns with the team's workday.
  const ist = new Date(now.getTime() + 330 * 60 * 1000);
  return ist.toISOString().slice(0, 13);
}

/**
 * One email per hour with all BDA / Sales CRM changes — replaces per-change emails.
 */
export async function runBdaHourlyDigest(organizationId: string, force = false) {
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const org = new Types.ObjectId(organizationId);
  const events = await SalesActivityEvent.find({
    organizationId: org,
    createdAt: { $gte: since },
    type: { $nin: [...QUIET] },
  })
    .sort({ createdAt: -1 })
    .limit(80)
    .lean();

  if (!events.length) return { sent: 0, events: 0 };

  const [admins, salesEmails] = await Promise.all([
    User.find({ organizationId: org, isActive: true, role: { $in: ['admin'] } }).select('email firstName').lean(),
    notificationRecipients(organizationId, 'sales'),
  ]);
  const recipients = [...new Set([
    ...admins.map((a) => a.email.toLowerCase()),
    ...salesEmails.map((e) => e.toLowerCase()),
  ])];
  if (!recipients.length) return { sent: 0, items: events.length };

  const bucket = hourKey();
  const lines = events.map((e) => {
    const when = formatIst(e.createdAt as Date);
    const who = e.actorName || 'BDA';
    const detail = e.detail ? ` — ${e.detail}` : '';
    return `${when} · ${who}: ${e.title}${detail}`;
  });

  let sent = 0;
  for (const email of recipients) {
    const key = `bda-digest:${bucket}:${email}`;
    if (!force) {
      try {
        await ReminderLog.create({ organizationId, key, email, slot: 'bda_hourly', dayKey: istDayKey() });
      } catch {
        continue;
      }
    }
    const subject = `BDA hourly update · ${events.length} change${events.length === 1 ? '' : 's'}`;
    await sendNotificationEmail(
      email,
      {
        title: subject,
        body: 'All Sales CRM / BDA changes from the last hour. Full history is on the BDA dashboard and Activity.',
        lines: lines.slice(0, 40),
        href: '/bda/dashboard',
        ctaLabel: 'Open BDA dashboard →',
      },
      subject,
      { organizationId }
    );
    sent++;
  }
  return { sent, items: events.length };
}
