import { Types } from 'mongoose';
import { Invoice } from '../../../models/index.js';
import { NotFoundError } from '../../../shared/errors/index.js';
import { paginate, buildSearchFilter } from '../../../shared/utils/pagination.js';
import type { PaginationQuery } from '../../../shared/types/index.js';

export class InvoiceService {
  async create(organizationId: string, userId: string, data: Record<string, unknown>) {
    const items = (data.items as Array<{ description: string; quantity: number; rate: number; amount?: number; taxRate?: number }>) || [];
    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.rate, 0);
    const taxAmount = Math.round(subtotal * 0.18);
    const total = subtotal + taxAmount;

    const count = await Invoice.countDocuments({ organizationId });
    const invoiceNumber = (data.invoiceNumber as string) || `INV-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;

    return Invoice.create({
      ...data,
      organizationId,
      createdBy: userId,
      invoiceNumber,
      items: items.map((item) => ({ ...item, amount: item.quantity * item.rate })),
      subtotal,
      taxAmount,
      total,
    });
  }

  async findAll(organizationId: string, query: PaginationQuery & { status?: string }) {
    const filter: Record<string, unknown> = {
      organizationId: new Types.ObjectId(organizationId),
      ...buildSearchFilter(query.search, ['invoiceNumber', 'notes']),
    };
    if (query.status) filter.status = query.status;
    return paginate(Invoice, filter, query, ['createdBy']);
  }

  async findById(organizationId: string, id: string) {
    const invoice = await Invoice.findOne({ _id: id, organizationId })
      .populate('createdBy', 'firstName lastName');
    if (!invoice) throw new NotFoundError('Invoice');
    return invoice;
  }

  async update(organizationId: string, id: string, data: Record<string, unknown>) {
    if (data.status === 'paid' && !data.paidAt) {
      data.paidAt = new Date();
    }
    const invoice = await Invoice.findOneAndUpdate({ _id: id, organizationId }, data, { new: true })
      .populate('createdBy', 'firstName lastName');
    if (!invoice) throw new NotFoundError('Invoice');
    return invoice;
  }

  async delete(organizationId: string, id: string) {
    const invoice = await Invoice.findOneAndDelete({ _id: id, organizationId });
    if (!invoice) throw new NotFoundError('Invoice');
    return invoice;
  }
}

export const invoiceService = new InvoiceService();
