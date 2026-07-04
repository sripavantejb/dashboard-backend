import { Types } from 'mongoose';
import {
  Project,
  Expense,
  ProjectBudgetPayment,
  ProjectRevenueEntry,
} from '../../../models/index.js';
import { NotFoundError } from '../../../shared/errors/index.js';
import { notifyFinanceChange } from '../../../shared/utils/finance-notify.js';

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

async function getProjectFinanceSummary(organizationId: string, projectId: string) {
  const orgOid = new Types.ObjectId(organizationId);
  const projOid = new Types.ObjectId(projectId);

  const [budgetAgg, revenueAgg, spentAgg, project] = await Promise.all([
    ProjectBudgetPayment.aggregate([
      { $match: { organizationId: orgOid, projectId: projOid } },
      {
        $group: {
          _id: '$status',
          total: { $sum: '$amount' },
        },
      },
    ]),
    ProjectRevenueEntry.aggregate([
      { $match: { organizationId: orgOid, projectId: projOid } },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
        },
      },
    ]),
    Expense.aggregate([
      {
        $match: {
          organizationId: orgOid,
          projectId: projOid,
          status: 'paid',
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Project.findOne({ _id: projectId, organizationId }),
  ]);

  if (!project) throw new NotFoundError('Project');

  const budgetReceived = budgetAgg.find((b) => b._id === 'received')?.total || 0;
  const budgetPending = budgetAgg.find((b) => b._id === 'pending')?.total || 0;
  const revenueCredits = revenueAgg.find((r) => r._id === 'credit')?.total || 0;
  const revenueDebits = revenueAgg.find((r) => r._id === 'debit')?.total || 0;
  const totalRevenue = revenueCredits - revenueDebits;
  const totalSpent = spentAgg[0]?.total || 0;

  return {
    projectId: project._id.toString(),
    projectName: project.name,
    budget: project.budget || 0,
    budgetReceived,
    budgetPending,
    totalRevenue,
    totalSpent,
    netProfit: totalRevenue - totalSpent,
    progress: project.progress,
    status: project.status,
  };
}

export class FinanceService {
  async getOverview(organizationId: string) {
    const projects = await Project.find({ organizationId }).sort({ name: 1 });
    const summaries = await Promise.all(
      projects.map((p) => getProjectFinanceSummary(organizationId, p._id.toString()))
    );

    const totals = summaries.reduce(
      (acc, s) => ({
        budget: acc.budget + s.budget,
        budgetReceived: acc.budgetReceived + s.budgetReceived,
        budgetPending: acc.budgetPending + s.budgetPending,
        totalRevenue: acc.totalRevenue + s.totalRevenue,
        totalSpent: acc.totalSpent + s.totalSpent,
        netProfit: acc.netProfit + s.netProfit,
      }),
      { budget: 0, budgetReceived: 0, budgetPending: 0, totalRevenue: 0, totalSpent: 0, netProfit: 0 }
    );

    return { totals, projects: summaries };
  }

  async getProjectDetail(organizationId: string, projectId: string) {
    const summary = await getProjectFinanceSummary(organizationId, projectId);

    const orgOid = new Types.ObjectId(organizationId);
    const projOid = new Types.ObjectId(projectId);

    const [budgetPayments, revenueEntries, expenses] = await Promise.all([
      ProjectBudgetPayment.find({ organizationId: orgOid, projectId: projOid })
        .sort({ createdAt: -1 })
        .populate('createdBy', 'firstName lastName'),
      ProjectRevenueEntry.find({ organizationId: orgOid, projectId: projOid })
        .sort({ recordedAt: -1 })
        .populate('createdBy', 'firstName lastName'),
      Expense.find({ organizationId: orgOid, projectId: projOid })
        .sort({ spentAt: -1 })
        .populate('createdBy', 'firstName lastName'),
    ]);

    return { summary, budgetPayments, revenueEntries, expenses };
  }

  async createBudgetPayment(
    organizationId: string,
    userId: string,
    data: {
      projectId: string;
      label: string;
      amount: number;
      status?: 'received' | 'pending';
      receivedAt?: string;
      dueDate?: string;
      notes?: string;
    }
  ) {
    const project = await Project.findOne({ _id: data.projectId, organizationId });
    if (!project) throw new NotFoundError('Project');

    const status = data.status || 'pending';
    const payment = await ProjectBudgetPayment.create({
      organizationId,
      projectId: data.projectId,
      label: data.label,
      amount: data.amount,
      status,
      receivedAt: status === 'received' ? (data.receivedAt ? new Date(data.receivedAt) : new Date()) : undefined,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      notes: data.notes,
      createdBy: userId,
    });

    await notifyFinanceChange({
      organizationId,
      actorId: userId,
      type: status === 'received' ? 'budget_received' : 'budget_pending',
      title: status === 'received' ? 'Budget received' : 'Budget payment pending',
      message: `${data.label} — ₹${data.amount.toLocaleString('en-IN')} for ${project.name}`,
      entityType: 'project',
      entityId: data.projectId,
      metadata: { paymentId: payment._id.toString(), amount: data.amount, status },
    });

    return payment.populate('createdBy', 'firstName lastName');
  }

  async updateBudgetPayment(
    organizationId: string,
    userId: string,
    id: string,
    data: Partial<{
      label: string;
      amount: number;
      status: 'received' | 'pending';
      receivedAt: string;
      dueDate: string;
      notes: string;
    }>
  ) {
    const update: Record<string, unknown> = { ...data };
    if (data.receivedAt) update.receivedAt = new Date(data.receivedAt);
    if (data.dueDate) update.dueDate = new Date(data.dueDate);
    if (data.status === 'received' && !data.receivedAt) {
      update.receivedAt = new Date();
    }
    if (data.status === 'pending') {
      update.receivedAt = null;
    }

    const payment = await ProjectBudgetPayment.findOneAndUpdate(
      { _id: id, organizationId },
      update,
      { new: true }
    ).populate('createdBy', 'firstName lastName');

    if (!payment) throw new NotFoundError('Budget payment');

    const project = await Project.findById(payment.projectId);
    await notifyFinanceChange({
      organizationId,
      actorId: userId,
      type: payment.status === 'received' ? 'budget_received' : 'finance_updated',
      title: 'Budget payment updated',
      message: `${payment.label} for ${project?.name || 'project'} is now ${payment.status}`,
      entityType: 'project',
      entityId: payment.projectId.toString(),
      metadata: { paymentId: id },
    });

    return payment;
  }

  async deleteBudgetPayment(organizationId: string, userId: string, id: string) {
    const payment = await ProjectBudgetPayment.findOneAndDelete({ _id: id, organizationId });
    if (!payment) throw new NotFoundError('Budget payment');

    const project = await Project.findById(payment.projectId);
    await notifyFinanceChange({
      organizationId,
      actorId: userId,
      type: 'finance_updated',
      title: 'Budget payment removed',
      message: `${payment.label} removed from ${project?.name || 'project'}`,
      entityType: 'project',
      entityId: payment.projectId.toString(),
    });

    return payment;
  }

  async createRevenueEntry(
    organizationId: string,
    userId: string,
    data: {
      projectId: string;
      type: 'credit' | 'debit';
      amount: number;
      description: string;
      recordedAt?: string;
    }
  ) {
    const project = await Project.findOne({ _id: data.projectId, organizationId });
    if (!project) throw new NotFoundError('Project');

    const entry = await ProjectRevenueEntry.create({
      organizationId,
      projectId: data.projectId,
      type: data.type,
      amount: data.amount,
      description: data.description,
      recordedAt: data.recordedAt ? new Date(data.recordedAt) : new Date(),
      createdBy: userId,
    });

    const action = data.type === 'credit' ? 'added' : 'subtracted';
    await notifyFinanceChange({
      organizationId,
      actorId: userId,
      type: 'project_revenue_adjusted',
      title: `Revenue ${action}`,
      message: `${data.description} — ${data.type === 'credit' ? '+' : '-'}₹${data.amount.toLocaleString('en-IN')} on ${project.name}`,
      entityType: 'project',
      entityId: data.projectId,
      metadata: { entryId: entry._id.toString(), type: data.type, amount: data.amount },
    });

    return entry.populate('createdBy', 'firstName lastName');
  }

  async deleteRevenueEntry(organizationId: string, userId: string, id: string) {
    const entry = await ProjectRevenueEntry.findOneAndDelete({ _id: id, organizationId });
    if (!entry) throw new NotFoundError('Revenue entry');

    const project = await Project.findById(entry.projectId);
    await notifyFinanceChange({
      organizationId,
      actorId: userId,
      type: 'finance_updated',
      title: 'Revenue entry removed',
      message: `${entry.description} removed from ${project?.name || 'project'}`,
      entityType: 'project',
      entityId: entry.projectId.toString(),
    });

    return entry;
  }

  async syncProjectSpent(organizationId: string, projectId: string) {
    await syncProjectSpent(organizationId, projectId);
  }
}

export const financeService = new FinanceService();
