import { Types } from 'mongoose';
import { CallLog, Lead, FollowUp, Notification } from '../../../models/index.js';
import { NotFoundError } from '../../../shared/errors/index.js';
import { paginate } from '../../../shared/utils/pagination.js';
import type { PaginationQuery } from '../../../shared/types/index.js';

export class CallLogService {
  async logCall(organizationId: string, userId: string, data: Record<string, unknown>) {
    const lead = await Lead.findOne({ _id: data.leadId, organizationId });
    if (!lead) throw new NotFoundError('Lead');

    const call = await CallLog.create({
      organizationId,
      leadId: data.leadId,
      callerId: userId,
      outcome: data.outcome,
      duration: data.duration || 0,
      notes: data.notes,
      scriptUsed: data.scriptUsed,
      recordingUrl: data.recordingUrl,
      scheduledCallback: data.scheduledCallback,
    });

    const leadUpdate: Record<string, unknown> = { lastContactedAt: new Date() };

    if (data.outcome === 'call_back' && data.scheduledCallback) {
      const scheduledAt = new Date(data.scheduledCallback as string);
      const reminderAt = new Date(scheduledAt.getTime() - 30 * 60 * 1000);
      const leadName = [lead.firstName, lead.lastName].filter(Boolean).join(' ');

      leadUpdate.status = 'future_follow_up';
      leadUpdate.nextFollowUpAt = scheduledAt;
      leadUpdate.inCallingQueue = true;
      leadUpdate.queuedAt = scheduledAt;
      leadUpdate.queuedBy = new Types.ObjectId(userId);

      const followUp = await FollowUp.create({
        organizationId,
        leadId: lead._id,
        type: 'phone',
        title: `Call back — ${leadName}`,
        description: (data.notes as string) || undefined,
        scheduledAt,
        reminderAt,
        assignedTo: userId,
        createdBy: userId,
        autoReminder: true,
      });

      const formattedDate = scheduledAt.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      await Notification.create({
        organizationId,
        userId,
        type: 'follow_up_reminder',
        title: 'Call back scheduled',
        message: `Call back ${leadName} on ${formattedDate}`,
        entityType: 'follow_up',
        entityId: followUp._id.toString(),
        metadata: { leadId: lead._id.toString(), scheduledAt: scheduledAt.toISOString(), type: 'call_back' },
      });

      await Notification.create({
        organizationId,
        userId,
        type: 'follow_up_reminder',
        title: 'Call back reminder',
        message: `Reminder: call ${leadName} in 30 minutes (${formattedDate})`,
        entityType: 'follow_up',
        entityId: followUp._id.toString(),
        metadata: { leadId: lead._id.toString(), scheduledAt: scheduledAt.toISOString(), reminderAt: reminderAt.toISOString(), type: 'call_back_reminder' },
      });
    } else {
      leadUpdate.inCallingQueue = false;
      leadUpdate.queuedAt = null;
      leadUpdate.queuedBy = null;

      const statusMap: Record<string, string> = {
        interested: 'interested',
        meeting: 'meeting',
        proposal: 'proposal',
        won: 'won',
        lost: 'lost',
      };
      if (statusMap[data.outcome as string]) {
        leadUpdate.status = statusMap[data.outcome as string];
      }
    }

    await Lead.findByIdAndUpdate(lead._id, leadUpdate);

    return call.populate([
      { path: 'leadId', select: 'firstName lastName company phone' },
      { path: 'callerId', select: 'firstName lastName avatar' },
    ]);
  }

  async getDailyStats(organizationId: string, userId: string, date?: string) {
    const targetDate = date ? new Date(date) : new Date();
    const start = new Date(targetDate.setHours(0, 0, 0, 0));
    const end = new Date(targetDate.setHours(23, 59, 59, 999));

    const filter = {
      organizationId: new Types.ObjectId(organizationId),
      callerId: new Types.ObjectId(userId),
      createdAt: { $gte: start, $lte: end },
    };

    const [calls, outcomeBreakdown] = await Promise.all([
      CallLog.find(filter)
        .populate('leadId', 'firstName lastName company phone')
        .sort({ createdAt: -1 })
        .lean(),
      CallLog.aggregate([
        { $match: filter },
        { $group: { _id: '$outcome', count: { $sum: 1 }, totalDuration: { $sum: '$duration' } } },
      ]),
    ]);

    const totalCalls = calls.length;
    const connected = outcomeBreakdown.find((o) => o._id === 'connected')?.count || 0;
    const totalDuration = calls.reduce((sum, c) => sum + (c.duration || 0), 0);

    return {
      totalCalls,
      connected,
      totalDuration,
      avgDuration: totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0,
      outcomeBreakdown,
      calls,
    };
  }

  async findAll(organizationId: string, query: PaginationQuery & { leadId?: string; callerId?: string }) {
    const filter: Record<string, unknown> = { organizationId: new Types.ObjectId(organizationId) };
    if (query.leadId) filter.leadId = new Types.ObjectId(query.leadId);
    if (query.callerId) filter.callerId = new Types.ObjectId(query.callerId);

    return paginate(CallLog, filter, query, ['leadId', 'callerId']);
  }

  async getAnalytics(organizationId: string, days = 7) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const daily = await CallLog.aggregate([
      { $match: { organizationId: new Types.ObjectId(organizationId), createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          total: { $sum: 1 },
          connected: { $sum: { $cond: [{ $eq: ['$outcome', 'connected'] }, 1, 0] } },
          interested: { $sum: { $cond: [{ $eq: ['$outcome', 'interested'] }, 1, 0] } },
          duration: { $sum: '$duration' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return daily;
  }
}

export const callLogService = new CallLogService();
