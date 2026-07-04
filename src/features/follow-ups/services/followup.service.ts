import { Types } from 'mongoose';
import { FollowUp, Lead, Notification } from '../../../models/index.js';
import { NotFoundError } from '../../../shared/errors/index.js';
import { paginate } from '../../../shared/utils/pagination.js';
import type { PaginationQuery } from '../../../shared/types/index.js';

export class FollowUpService {
  async create(organizationId: string, userId: string, data: Record<string, unknown>) {
    const lead = await Lead.findOne({ _id: data.leadId, organizationId });
    if (!lead) throw new NotFoundError('Lead');

    const scheduledAt = new Date(data.scheduledAt as string);
    const reminderAt = data.autoReminder !== false
      ? new Date(scheduledAt.getTime() - 30 * 60 * 1000)
      : undefined;

    const followUp = await FollowUp.create({
      ...data,
      organizationId,
      assignedTo: data.assignedTo || userId,
      createdBy: userId,
      scheduledAt,
      reminderAt,
    });

    await Lead.findByIdAndUpdate(lead._id, { nextFollowUpAt: scheduledAt });

    await Notification.create({
      organizationId,
      userId: data.assignedTo || userId,
      type: 'follow_up_reminder',
      title: 'Follow-up scheduled',
      message: `${data.type} follow-up: ${data.title}`,
      entityType: 'follow_up',
      entityId: followUp._id.toString(),
    });

    return followUp.populate([
      { path: 'leadId', select: 'firstName lastName company phone' },
      { path: 'assignedTo', select: 'firstName lastName avatar' },
    ]);
  }

  async findAll(organizationId: string, query: PaginationQuery & { status?: string; assignedTo?: string; type?: string }) {
    const filter: Record<string, unknown> = { organizationId: new Types.ObjectId(organizationId) };
    if (query.status) filter.status = query.status;
    if (query.assignedTo) filter.assignedTo = new Types.ObjectId(query.assignedTo);
    if (query.type) filter.type = query.type;

    return paginate(FollowUp, filter, { ...query, sort: 'scheduledAt', order: 'asc' }, ['leadId', 'assignedTo']);
  }

  async getUpcoming(organizationId: string, userId: string, days = 7) {
    const now = new Date();
    const until = new Date();
    until.setDate(until.getDate() + days);

    return FollowUp.find({
      organizationId,
      assignedTo: userId,
      status: 'scheduled',
      scheduledAt: { $gte: now, $lte: until },
    })
      .populate('leadId', 'firstName lastName company phone')
      .sort({ scheduledAt: 1 })
      .lean();
  }

  async getMissed(organizationId: string) {
    const now = new Date();
    const missed = await FollowUp.find({
      organizationId,
      status: 'scheduled',
      scheduledAt: { $lt: now },
    })
      .populate('leadId', 'firstName lastName company')
      .populate('assignedTo', 'firstName lastName')
      .lean();

    await FollowUp.updateMany(
      { organizationId, status: 'scheduled', scheduledAt: { $lt: now } },
      { status: 'missed' }
    );

    return missed;
  }

  async complete(organizationId: string, id: string, notes?: string) {
    const followUp = await FollowUp.findOneAndUpdate(
      { _id: id, organizationId },
      { status: 'completed', completedAt: new Date(), description: notes },
      { new: true }
    );
    if (!followUp) throw new NotFoundError('Follow-up');
    return followUp;
  }

  async update(organizationId: string, id: string, data: Record<string, unknown>) {
    const followUp = await FollowUp.findOneAndUpdate({ _id: id, organizationId }, data, { new: true })
      .populate('leadId', 'firstName lastName company phone');
    if (!followUp) throw new NotFoundError('Follow-up');
    return followUp;
  }

  async delete(organizationId: string, id: string) {
    const followUp = await FollowUp.findOneAndDelete({ _id: id, organizationId });
    if (!followUp) throw new NotFoundError('Follow-up');
    return followUp;
  }
}

export const followUpService = new FollowUpService();
