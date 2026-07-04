import { Types } from 'mongoose';
import { Expense } from '../../../models/index.js';
import { NotFoundError } from '../../../shared/errors/index.js';
import { paginate, buildSearchFilter } from '../../../shared/utils/pagination.js';
import type { PaginationQuery } from '../../../shared/types/index.js';

export class ExpenseService {
  async create(organizationId: string, userId: string, data: Record<string, unknown>) {
    const count = await Expense.countDocuments({ organizationId });
    const referenceNumber = (data.referenceNumber as string)
      || `EXP-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;

    return Expense.create({
      ...data,
      organizationId,
      createdBy: userId,
      referenceNumber,
      spentAt: data.spentAt ? new Date(data.spentAt as string) : new Date(),
    });
  }

  async findAll(organizationId: string, query: PaginationQuery & { status?: string; category?: string }) {
    const filter: Record<string, unknown> = {
      organizationId: new Types.ObjectId(organizationId),
      ...buildSearchFilter(query.search, ['title', 'vendor', 'referenceNumber', 'notes']),
    };
    if (query.status) filter.status = query.status;
    if (query.category) filter.category = query.category;

    return paginate(Expense, filter, { ...query, sort: query.sort || 'spentAt', order: query.order || 'desc' }, ['createdBy']);
  }

  async findById(organizationId: string, id: string) {
    const expense = await Expense.findOne({ _id: id, organizationId })
      .populate('createdBy', 'firstName lastName');
    if (!expense) throw new NotFoundError('Expense');
    return expense;
  }

  async update(organizationId: string, id: string, data: Record<string, unknown>) {
    if (data.spentAt) data.spentAt = new Date(data.spentAt as string);
    const expense = await Expense.findOneAndUpdate({ _id: id, organizationId }, data, { new: true })
      .populate('createdBy', 'firstName lastName');
    if (!expense) throw new NotFoundError('Expense');
    return expense;
  }

  async delete(organizationId: string, id: string) {
    const expense = await Expense.findOneAndDelete({ _id: id, organizationId });
    if (!expense) throw new NotFoundError('Expense');
    return expense;
  }
}

export const expenseService = new ExpenseService();
