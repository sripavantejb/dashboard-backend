import { Types } from 'mongoose';
import { Expense, Project } from '../../../models/index.js';
import { NotFoundError } from '../../../shared/errors/index.js';
import { paginate, buildSearchFilter } from '../../../shared/utils/pagination.js';
import { notifyFinanceChange } from '../../../shared/utils/finance-notify.js';
import type { PaginationQuery } from '../../../shared/types/index.js';

async function syncProjectSpent(organizationId: string, projectId: string) {
  const result = await Expense.aggregate([
    {
      $match: {
        organizationId: new Types.ObjectId(organizationId),
        projectId: new Types.ObjectId(projectId),
        status: 'paid',
      },
    },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  await Project.findOneAndUpdate(
    { _id: projectId, organizationId },
    { spent: result[0]?.total || 0 }
  );
}

export class ExpenseService {
  async create(organizationId: string, userId: string, data: Record<string, unknown>) {
    const count = await Expense.countDocuments({ organizationId });
    const referenceNumber = (data.referenceNumber as string)
      || `EXP-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;

    const expense = await Expense.create({
      ...data,
      organizationId,
      createdBy: userId,
      referenceNumber,
      spentAt: data.spentAt ? new Date(data.spentAt as string) : new Date(),
    });

    if (data.projectId) {
      await syncProjectSpent(organizationId, data.projectId as string);
      const project = await Project.findById(data.projectId);
      await notifyFinanceChange({
        organizationId,
        actorId: userId,
        type: 'project_spending_added',
        title: 'Project spending added',
        message: `${data.title} — ₹${Number(data.amount).toLocaleString('en-IN')} on ${project?.name || 'project'}`,
        entityType: 'project',
        entityId: data.projectId as string,
        metadata: { expenseId: expense._id.toString(), amount: data.amount },
      });
    }

    return expense;
  }

  async findAll(organizationId: string, query: PaginationQuery & { status?: string; category?: string; projectId?: string }) {
    const filter: Record<string, unknown> = {
      organizationId: new Types.ObjectId(organizationId),
      ...buildSearchFilter(query.search, ['title', 'vendor', 'referenceNumber', 'notes']),
    };
    if (query.status) filter.status = query.status;
    if (query.category) filter.category = query.category;
    if (query.projectId) filter.projectId = new Types.ObjectId(query.projectId);

    return paginate(Expense, filter, { ...query, sort: query.sort || 'spentAt', order: query.order || 'desc' }, ['createdBy', 'projectId']);
  }

  async findById(organizationId: string, id: string) {
    const expense = await Expense.findOne({ _id: id, organizationId })
      .populate('createdBy', 'firstName lastName')
      .populate('projectId', 'name');
    if (!expense) throw new NotFoundError('Expense');
    return expense;
  }

  async update(organizationId: string, userId: string, id: string, data: Record<string, unknown>) {
    if (data.spentAt) data.spentAt = new Date(data.spentAt as string);

    const existing = await Expense.findOne({ _id: id, organizationId });
    if (!existing) throw new NotFoundError('Expense');

    const expense = await Expense.findOneAndUpdate({ _id: id, organizationId }, data, { new: true })
      .populate('createdBy', 'firstName lastName')
      .populate('projectId', 'name');
    if (!expense) throw new NotFoundError('Expense');

    const projectIds = new Set<string>();
    if (existing.projectId) projectIds.add(existing.projectId.toString());
    if (expense.projectId) projectIds.add(expense.projectId.toString());

    for (const pid of projectIds) {
      await syncProjectSpent(organizationId, pid);
    }

    if (expense.projectId) {
      const projectName = typeof expense.projectId === 'object' && 'name' in expense.projectId
        ? (expense.projectId as { name: string }).name
        : 'project';
      await notifyFinanceChange({
        organizationId,
        actorId: userId,
        type: 'finance_updated',
        title: 'Spending updated',
        message: `${expense.title} updated for ${projectName}`,
        entityType: 'project',
        entityId: expense.projectId.toString(),
      });
    }

    return expense;
  }

  async delete(organizationId: string, userId: string, id: string) {
    const expense = await Expense.findOneAndDelete({ _id: id, organizationId });
    if (!expense) throw new NotFoundError('Expense');

    if (expense.projectId) {
      await syncProjectSpent(organizationId, expense.projectId.toString());
      const project = await Project.findById(expense.projectId);
      await notifyFinanceChange({
        organizationId,
        actorId: userId,
        type: 'finance_updated',
        title: 'Spending removed',
        message: `${expense.title} removed from ${project?.name || 'project'}`,
        entityType: 'project',
        entityId: expense.projectId.toString(),
      });
    }

    return expense;
  }
}

export const expenseService = new ExpenseService();
