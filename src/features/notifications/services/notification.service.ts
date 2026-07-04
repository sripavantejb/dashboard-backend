import { Types } from 'mongoose';
import { Notification } from '../../../models/index.js';
import { NotFoundError } from '../../../shared/errors/index.js';
import { paginate } from '../../../shared/utils/pagination.js';
import type { PaginationQuery } from '../../../shared/types/index.js';

export class NotificationService {
  async findAll(userId: string, query: PaginationQuery & { read?: string }) {
    const filter: Record<string, unknown> = {
      userId: new Types.ObjectId(userId),
    };
    if (query.read !== undefined) filter.read = query.read === 'true';

    return paginate(Notification, filter, { ...query, sort: 'createdAt', order: 'desc' });
  }

  async getUnreadCount(userId: string) {
    return Notification.countDocuments({ userId, read: false });
  }

  async markAsRead(userId: string, id: string) {
    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId },
      { read: true, readAt: new Date() },
      { new: true }
    );
    if (!notification) throw new NotFoundError('Notification');
    return notification;
  }

  async markAllAsRead(userId: string) {
    await Notification.updateMany(
      { userId, read: false },
      { read: true, readAt: new Date() }
    );
  }
}

export const notificationService = new NotificationService();
