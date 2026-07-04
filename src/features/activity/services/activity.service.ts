import { Types } from 'mongoose';
import { UserSession } from '../../../models/index.js';

const SESSION_IDLE_MS = 5 * 60 * 1000;

export class ActivityService {
  async heartbeat(
    organizationId: string,
    userId: string,
    data: { page?: string; module?: string; sessionId?: string },
    meta?: { ipAddress?: string; userAgent?: string }
  ) {
    const now = new Date();

    if (data.sessionId) {
      const existing = await UserSession.findOne({
        _id: data.sessionId,
        userId,
        organizationId,
      });

      if (existing) {
        const idleMs = now.getTime() - existing.lastActiveAt.getTime();
        const addedSeconds = idleMs <= SESSION_IDLE_MS ? Math.round(idleMs / 1000) : 0;

        existing.lastActiveAt = now;
        existing.durationSeconds += addedSeconds;
        if (data.page) existing.page = data.page;
        if (data.module) existing.module = data.module;
        await existing.save();
        return { sessionId: existing._id.toString(), durationSeconds: existing.durationSeconds };
      }
    }

    const session = await UserSession.create({
      organizationId,
      userId,
      startedAt: now,
      lastActiveAt: now,
      page: data.page,
      module: data.module,
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { sessionId: session._id.toString(), durationSeconds: 0 };
  }

  async getUserActivitySummary(organizationId?: string, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const match: Record<string, unknown> = { lastActiveAt: { $gte: since } };
    if (organizationId) match.organizationId = new Types.ObjectId(organizationId);

    return UserSession.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$userId',
          totalSeconds: { $sum: '$durationSeconds' },
          sessions: { $sum: 1 },
          lastActiveAt: { $max: '$lastActiveAt' },
          organizationId: { $first: '$organizationId' },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $lookup: {
          from: 'organizations',
          localField: 'organizationId',
          foreignField: '_id',
          as: 'organization',
        },
      },
      { $unwind: { path: '$organization', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          userId: '$_id',
          totalSeconds: 1,
          sessions: 1,
          lastActiveAt: 1,
          email: '$user.email',
          firstName: '$user.firstName',
          lastName: '$user.lastName',
          role: '$user.role',
          organizationName: '$organization.name',
          organizationId: '$organizationId',
        },
      },
      { $sort: { totalSeconds: -1 } },
    ]);
  }

  async getRecentSessions(organizationId?: string, limit = 50) {
    const filter: Record<string, unknown> = {};
    if (organizationId) filter.organizationId = new Types.ObjectId(organizationId);

    return UserSession.find(filter)
      .populate('userId', 'firstName lastName email role')
      .populate('organizationId', 'name slug')
      .sort({ lastActiveAt: -1 })
      .limit(limit)
      .lean();
  }
}

export const activityService = new ActivityService();
