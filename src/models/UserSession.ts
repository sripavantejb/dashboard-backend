import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IUserSession extends Document {
  organizationId: Types.ObjectId;
  userId: Types.ObjectId;
  startedAt: Date;
  lastActiveAt: Date;
  durationSeconds: number;
  page?: string;
  module?: string;
  userAgent?: string;
  ipAddress?: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSessionSchema = new Schema<IUserSession>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    startedAt: { type: Date, required: true, default: Date.now },
    lastActiveAt: { type: Date, required: true, default: Date.now },
    durationSeconds: { type: Number, default: 0 },
    page: String,
    module: String,
    userAgent: String,
    ipAddress: String,
  },
  { timestamps: true }
);

userSessionSchema.index({ userId: 1, lastActiveAt: -1 });
userSessionSchema.index({ organizationId: 1, lastActiveAt: -1 });

export const UserSession = mongoose.model<IUserSession>('UserSession', userSessionSchema);
