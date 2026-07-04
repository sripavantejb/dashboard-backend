import mongoose, { Schema, Document, Types } from 'mongoose';

export type LeadStatus =
  | 'new' | 'not_contacted' | 'attempt_1' | 'attempt_2' | 'connected'
  | 'interested' | 'meeting' | 'demo' | 'proposal' | 'negotiation'
  | 'won' | 'lost' | 'future_follow_up' | 'dormant';

export interface ILead extends Document {
  organizationId: Types.ObjectId;
  categoryId: Types.ObjectId;
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  companyId?: Types.ObjectId;
  title?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  status: LeadStatus;
  source?: string;
  tags: string[];
  score: number;
  assignedTo?: Types.ObjectId;
  inCallingQueue: boolean;
  queuedAt?: Date;
  queuedBy?: Types.ObjectId;
  customFields: Record<string, unknown>;
  notes?: string;
  lastContactedAt?: Date;
  nextFollowUpAt?: Date;
  estimatedValue?: number;
  currency: string;
  isArchived: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const leadSchema = new Schema<ILead>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'LeadCategory', required: true, index: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    company: { type: String, trim: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company' },
    title: String,
    website: String,
    address: String,
    city: String,
    state: String,
    country: { type: String, default: 'India' },
    pincode: String,
    status: {
      type: String,
      enum: ['new', 'not_contacted', 'attempt_1', 'attempt_2', 'connected', 'interested', 'meeting', 'demo', 'proposal', 'negotiation', 'won', 'lost', 'future_follow_up', 'dormant'],
      default: 'new',
      index: true,
    },
    source: String,
    tags: [{ type: String }],
    score: { type: Number, default: 0, min: 0, max: 100 },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    inCallingQueue: { type: Boolean, default: false, index: true },
    queuedAt: Date,
    queuedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    customFields: { type: Schema.Types.Mixed, default: {} },
    notes: String,
    lastContactedAt: Date,
    nextFollowUpAt: Date,
    estimatedValue: Number,
    currency: { type: String, default: 'INR' },
    isArchived: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

leadSchema.index({ organizationId: 1, categoryId: 1, status: 1 });
leadSchema.index({ organizationId: 1, email: 1 });
leadSchema.index({ organizationId: 1, createdAt: -1 });
leadSchema.index({ organizationId: 1, assignedTo: 1, status: 1 });
leadSchema.index({ organizationId: 1, inCallingQueue: 1, queuedAt: 1 });

leadSchema.virtual('fullName').get(function () {
  return [this.firstName, this.lastName].filter(Boolean).join(' ');
});

export const Lead = mongoose.model<ILead>('Lead', leadSchema);
