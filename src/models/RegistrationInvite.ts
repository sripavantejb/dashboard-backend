import mongoose, { Schema, Document, Types } from 'mongoose';
import type { SubscriptionPlan } from '../shared/constants/plans.js';

export interface IRegistrationInvite extends Document {
  token: string;
  email?: string;
  organizationName?: string;
  plan: SubscriptionPlan;
  createdBy: Types.ObjectId;
  expiresAt: Date;
  usedAt?: Date;
  usedBy?: Types.ObjectId;
  createdAt: Date;
}

const registrationInviteSchema = new Schema<IRegistrationInvite>(
  {
    token: { type: String, required: true, unique: true, index: true },
    email: { type: String, lowercase: true, trim: true },
    organizationName: String,
    plan: { type: String, enum: ['starter', 'professional', 'enterprise'], default: 'starter' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, required: true },
    usedAt: Date,
    usedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const RegistrationInvite = mongoose.model<IRegistrationInvite>('RegistrationInvite', registrationInviteSchema);
