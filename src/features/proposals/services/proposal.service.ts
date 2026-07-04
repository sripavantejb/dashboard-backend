import { Types } from 'mongoose';
import { Proposal, Lead, Notification } from '../../../models/index.js';
import { NotFoundError } from '../../../shared/errors/index.js';
import { paginate } from '../../../shared/utils/pagination.js';
import type { PaginationQuery } from '../../../shared/types/index.js';

export class ProposalService {
  async create(organizationId: string, userId: string, data: Record<string, unknown>) {
    const lead = await Lead.findOne({ _id: data.leadId, organizationId });
    if (!lead) throw new NotFoundError('Lead');

    const items = (data.items as Array<{ description: string; quantity: number; rate: number }>) || [];
    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.rate, 0);
    const taxAmount = subtotal * 0.18;
    const total = subtotal + taxAmount;

    const proposal = await Proposal.create({
      ...data,
      organizationId,
      items: items.map((item) => ({ ...item, amount: item.quantity * item.rate })),
      subtotal,
      taxAmount,
      total,
      createdBy: userId,
    });

    return proposal.populate('leadId', 'firstName lastName company email');
  }

  async findAll(organizationId: string, query: PaginationQuery & { status?: string; leadId?: string }) {
    const filter: Record<string, unknown> = { organizationId: new Types.ObjectId(organizationId) };
    if (query.status) filter.status = query.status;
    if (query.leadId) filter.leadId = new Types.ObjectId(query.leadId);

    return paginate(Proposal, filter, query, ['leadId', 'createdBy']);
  }

  async findById(organizationId: string, id: string) {
    const proposal = await Proposal.findOne({ _id: id, organizationId })
      .populate('leadId', 'firstName lastName company email phone')
      .populate('createdBy', 'firstName lastName');
    if (!proposal) throw new NotFoundError('Proposal');
    return proposal;
  }

  async update(organizationId: string, id: string, data: Record<string, unknown>) {
    if (data.items) {
      const items = data.items as Array<{ description: string; quantity: number; rate: number }>;
      data.subtotal = items.reduce((sum, item) => sum + item.quantity * item.rate, 0);
      data.taxAmount = (data.subtotal as number) * 0.18;
      data.total = (data.subtotal as number) + (data.taxAmount as number);
      data.items = items.map((item) => ({ ...item, amount: item.quantity * item.rate }));
    }

    const proposal = await Proposal.findOneAndUpdate({ _id: id, organizationId }, data, { new: true })
      .populate('leadId', 'firstName lastName company');
    if (!proposal) throw new NotFoundError('Proposal');
    return proposal;
  }

  async send(organizationId: string, id: string) {
    const proposal = await Proposal.findOneAndUpdate(
      { _id: id, organizationId },
      { status: 'sent', sentAt: new Date() },
      { new: true }
    ).populate('leadId', 'firstName lastName email');
    if (!proposal) throw new NotFoundError('Proposal');

    await Lead.findByIdAndUpdate(proposal.leadId, { status: 'proposal' });
    return proposal;
  }

  async delete(organizationId: string, id: string) {
    const proposal = await Proposal.findOneAndDelete({ _id: id, organizationId });
    if (!proposal) throw new NotFoundError('Proposal');
    return proposal;
  }
}

export const proposalService = new ProposalService();
