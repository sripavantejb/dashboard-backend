import { Types } from 'mongoose';
import { Lead, LeadCategory, LeadActivity } from '../../../models/index.js';
import { Notification } from '../../../models/Notification.js';
import { NotFoundError } from '../../../shared/errors/index.js';
import { paginate, buildSearchFilter } from '../../../shared/utils/pagination.js';
import type { PaginationQuery } from '../../../shared/types/index.js';

export class LeadService {
  async create(organizationId: string, userId: string, data: Record<string, unknown>) {
    const lead = await Lead.create({
      ...data,
      organizationId,
      createdBy: userId,
      categoryId: data.categoryId,
    });

    await LeadCategory.findByIdAndUpdate(data.categoryId, { $inc: { leadCount: 1 } });

    await LeadActivity.create({
      organizationId,
      leadId: lead._id,
      type: 'note',
      title: 'Lead created',
      createdBy: userId,
    });

    if (data.assignedTo) {
      await this.notifyAssignment(organizationId, data.assignedTo as string, lead);
    }

    return lead.populate('assignedTo', 'firstName lastName avatar');
  }

  async findAll(organizationId: string, query: PaginationQuery & { categoryId?: string; status?: string; assignedTo?: string; inCallingQueue?: string; queueReady?: string }) {
    const filter: Record<string, unknown> = {
      organizationId: new Types.ObjectId(organizationId),
      isArchived: false,
      ...buildSearchFilter(query.search, ['firstName', 'lastName', 'email', 'phone', 'company']),
    };

    if (query.categoryId) filter.categoryId = new Types.ObjectId(query.categoryId);
    if (query.status) filter.status = query.status;
    if (query.assignedTo) filter.assignedTo = new Types.ObjectId(query.assignedTo);
  if (query.inCallingQueue === 'true') filter.inCallingQueue = true;
  if (query.inCallingQueue === 'false') filter.inCallingQueue = false;
  if (query.queueReady === 'true') {
    filter.inCallingQueue = true;
    filter.$or = [
      { queuedAt: { $exists: false } },
      { queuedAt: null },
      { queuedAt: { $lte: new Date() } },
    ];
  }

    return paginate(Lead, filter, query, ['assignedTo', 'categoryId']);
  }

  async findById(organizationId: string, id: string) {
    const lead = await Lead.findOne({ _id: id, organizationId })
      .populate('assignedTo', 'firstName lastName avatar email')
      .populate('categoryId', 'name slug color')
      .populate('createdBy', 'firstName lastName');
    if (!lead) throw new NotFoundError('Lead');
    return lead;
  }

  async update(organizationId: string, userId: string, id: string, data: Record<string, unknown>) {
    const existing = await Lead.findOne({ _id: id, organizationId });
    if (!existing) throw new NotFoundError('Lead');

    if (data.status && data.status !== existing.status) {
      await LeadActivity.create({
        organizationId,
        leadId: id,
        type: 'status_change',
        title: `Status changed to ${data.status}`,
        metadata: { from: existing.status, to: data.status },
        createdBy: userId,
      });
    }

    if (data.assignedTo && data.assignedTo !== existing.assignedTo?.toString()) {
      await this.notifyAssignment(organizationId, data.assignedTo as string, existing);
    }

    const lead = await Lead.findOneAndUpdate({ _id: id, organizationId }, data, { new: true })
      .populate('assignedTo', 'firstName lastName avatar');
    return lead;
  }

  async bulkUpdate(organizationId: string, userId: string, leadIds: string[], updates: Record<string, unknown>) {
    const patch: Record<string, unknown> = { ...updates };

    if (updates.inCallingQueue === true) {
      patch.queuedAt = new Date();
      patch.queuedBy = new Types.ObjectId(userId);
    } else if (updates.inCallingQueue === false) {
      patch.queuedAt = null;
      patch.queuedBy = null;
    }

    const result = await Lead.updateMany(
      { _id: { $in: leadIds }, organizationId },
      patch
    );

    if (updates.status) {
      await LeadActivity.insertMany(
        leadIds.map((leadId) => ({
          organizationId,
          leadId,
          type: 'status_change',
          title: `Bulk status changed to ${updates.status}`,
          createdBy: userId,
        }))
      );
    }

    if (updates.inCallingQueue === true) {
      await LeadActivity.insertMany(
        leadIds.map((leadId) => ({
          organizationId,
          leadId,
          type: 'assignment',
          title: 'Added to calling queue',
          createdBy: userId,
        }))
      );
    }

    return { modifiedCount: result.modifiedCount };
  }

  async delete(organizationId: string, id: string) {
    const lead = await Lead.findOneAndUpdate(
      { _id: id, organizationId },
      { isArchived: true },
      { new: true }
    );
    if (!lead) throw new NotFoundError('Lead');
    await LeadCategory.findByIdAndUpdate(lead.categoryId, { $inc: { leadCount: -1 } });
    return lead;
  }

  async getPipeline(organizationId: string, categoryId: string) {
    const category = await LeadCategory.findOne({ _id: categoryId, organizationId });
    if (!category) throw new NotFoundError('Lead category');

    const stages = category.pipelineStages;
    const pipeline = await Promise.all(
      stages.map(async (stage) => {
        const leads = await Lead.find({
          organizationId,
          categoryId,
          status: stage,
          isArchived: false,
        })
          .populate('assignedTo', 'firstName lastName avatar')
          .sort({ updatedAt: -1 })
          .lean();
        return { stage, leads, count: leads.length };
      })
    );

    return { category, pipeline };
  }

  async getActivities(organizationId: string, leadId: string) {
    return LeadActivity.find({ organizationId, leadId })
      .populate('createdBy', 'firstName lastName avatar')
      .sort({ createdAt: -1 })
      .lean();
  }

  async addActivity(organizationId: string, userId: string, leadId: string, data: { type: string; title: string; description?: string; metadata?: Record<string, unknown> }) {
    const lead = await Lead.findOne({ _id: leadId, organizationId });
    if (!lead) throw new NotFoundError('Lead');

    const activity = await LeadActivity.create({
      organizationId,
      leadId,
      ...data,
      createdBy: userId,
    });

    if (['call', 'email', 'meeting', 'whatsapp'].includes(data.type)) {
      await Lead.findByIdAndUpdate(leadId, { lastContactedAt: new Date() });
    }

    return activity.populate('createdBy', 'firstName lastName avatar');
  }

  private async notifyAssignment(organizationId: string, assigneeId: string, lead: InstanceType<typeof Lead>) {
    await Notification.create({
      organizationId,
      userId: assigneeId,
      type: 'lead_assigned',
      title: 'New lead assigned',
      message: `You have been assigned lead: ${lead.firstName} ${lead.lastName || ''}`,
      entityType: 'lead',
      entityId: lead._id.toString(),
    });
  }
}

export const leadService = new LeadService();
