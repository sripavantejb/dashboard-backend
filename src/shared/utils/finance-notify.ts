import { Types } from 'mongoose';
import { Notification, User } from '../../models/index.js';
import type { NotificationType } from '../../models/Notification.js';

export async function notifyFinanceChange(params: {
  organizationId: string;
  actorId: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}) {
  const orgId = new Types.ObjectId(params.organizationId);
  const financeUsers = await User.find({
    organizationId: orgId,
    isActive: true,
    role: { $in: ['admin', 'finance'] },
  }).select('_id');

  const userIds = new Set<string>([params.actorId]);
  financeUsers.forEach((u) => userIds.add(u._id.toString()));

  await Promise.all(
    [...userIds].map((userId) =>
      Notification.create({
        organizationId: orgId,
        userId,
        type: params.type,
        title: params.title,
        message: params.message,
        entityType: params.entityType,
        entityId: params.entityId,
        metadata: params.metadata,
      })
    )
  );
}
