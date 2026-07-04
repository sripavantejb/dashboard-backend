import mongoose, { Schema, Document } from 'mongoose';
import type { SubscriptionPlan } from '../shared/constants/plans.js';

export interface IOrganization extends Document {
  name: string;
  slug: string;
  logo?: string;
  website?: string;
  industry?: string;
  subscriptionPlan: SubscriptionPlan;
  maxUsers: number;
  planStartedAt?: Date;
  planExpiresAt?: Date;
  settings: {
    timezone: string;
    currency: string;
    dateFormat: string;
    fiscalYearStart: number;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const organizationSchema = new Schema<IOrganization>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    logo: String,
    website: String,
    industry: String,
    subscriptionPlan: { type: String, enum: ['starter', 'professional', 'enterprise'], default: 'starter' },
    maxUsers: { type: Number, default: 5 },
    planStartedAt: Date,
    planExpiresAt: Date,
    settings: {
      timezone: { type: String, default: 'Asia/Kolkata' },
      currency: { type: String, default: 'INR' },
      dateFormat: { type: String, default: 'DD/MM/YYYY' },
      fiscalYearStart: { type: Number, default: 4 },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Organization = mongoose.model<IOrganization>('Organization', organizationSchema);
