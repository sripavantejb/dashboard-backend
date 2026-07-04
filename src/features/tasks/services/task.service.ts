import { Types } from 'mongoose';
import { Task } from '../../../models/index.js';
import { Notification } from '../../../models/Notification.js';
import { NotFoundError } from '../../../shared/errors/index.js';
import { paginate, buildSearchFilter } from '../../../shared/utils/pagination.js';
import type { PaginationQuery } from '../../../shared/types/index.js';

export class TaskService {
  async create(organizationId: string, userId: string, data: Record<string, unknown>) {
    const task = await Task.create({
      ...data,
      organizationId,
      createdBy: userId,
      status: data.assignedTo ? 'assigned' : 'pending',
    });

    if (data.assignedTo) {
      await Notification.create({
        organizationId,
        userId: data.assignedTo,
        type: 'task_assigned',
        title: 'New task assigned',
        message: `You have been assigned: ${data.title}`,
        entityType: 'task',
        entityId: task._id.toString(),
      });
    }

    return task.populate('assignedTo', 'firstName lastName avatar');
  }

  async findAll(organizationId: string, query: PaginationQuery & { status?: string; priority?: string; assignedTo?: string; projectId?: string }) {
    const filter: Record<string, unknown> = {
      organizationId: new Types.ObjectId(organizationId),
      ...buildSearchFilter(query.search, ['title', 'description']),
    };

    if (query.status) filter.status = query.status;
    if (query.priority) filter.priority = query.priority;
    if (query.assignedTo) filter.assignedTo = new Types.ObjectId(query.assignedTo);
    if (query.projectId) filter.projectId = new Types.ObjectId(query.projectId);

    return paginate(Task, filter, query, ['assignedTo', 'createdBy']);
  }

  async findById(organizationId: string, id: string) {
    const task = await Task.findOne({ _id: id, organizationId })
      .populate('assignedTo', 'firstName lastName avatar email')
      .populate('createdBy', 'firstName lastName')
      .populate('leadId', 'firstName lastName company')
      .populate('projectId', 'name');
    if (!task) throw new NotFoundError('Task');
    return task;
  }

  async update(organizationId: string, userId: string, id: string, data: Record<string, unknown>) {
    const existing = await Task.findOne({ _id: id, organizationId });
    if (!existing) throw new NotFoundError('Task');

    if (data.status === 'completed') {
      data.completedAt = new Date();
    }

    const task = await Task.findOneAndUpdate({ _id: id, organizationId }, data, { new: true })
      .populate('assignedTo', 'firstName lastName avatar');

    if (data.assignedTo && data.assignedTo !== existing.assignedTo?.toString()) {
      await Notification.create({
        organizationId,
        userId: data.assignedTo as string,
        type: 'task_assigned',
        title: 'Task assigned to you',
        message: `Task "${existing.title}" has been assigned to you`,
        entityType: 'task',
        entityId: id,
      });
    }

    if (data.status === 'completed' && existing.assignedTo) {
      await Notification.create({
        organizationId,
        userId: existing.createdBy,
        type: 'task_completed',
        title: 'Task completed',
        message: `Task "${existing.title}" has been completed`,
        entityType: 'task',
        entityId: id,
      });
    }

    return task;
  }

  async delete(organizationId: string, id: string) {
    const task = await Task.findOneAndDelete({ _id: id, organizationId });
    if (!task) throw new NotFoundError('Task');
    return task;
  }
}

export const taskService = new TaskService();
