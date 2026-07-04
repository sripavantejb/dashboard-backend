import { Types } from 'mongoose';
import { AutomationRule } from '../../../models/AutomationRule.js';
import { NotFoundError } from '../../../shared/errors/index.js';

export class AutomationService {
  async findAll(organizationId: string) {
    return AutomationRule.find({ organizationId }).sort({ createdAt: -1 }).lean();
  }

  async create(organizationId: string, userId: string, data: Record<string, unknown>) {
    return AutomationRule.create({ ...data, organizationId, createdBy: userId });
  }

  async update(organizationId: string, id: string, data: Record<string, unknown>) {
    const rule = await AutomationRule.findOneAndUpdate({ _id: id, organizationId }, data, { new: true });
    if (!rule) throw new NotFoundError('Automation rule');
    return rule;
  }

  async delete(organizationId: string, id: string) {
    const rule = await AutomationRule.findOneAndDelete({ _id: id, organizationId });
    if (!rule) throw new NotFoundError('Automation rule');
    return rule;
  }
}

export const automationService = new AutomationService();
