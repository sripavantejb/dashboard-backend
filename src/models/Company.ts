import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ICompany extends Document {
  organizationId: Types.ObjectId;
  name: string;
  website?: string;
  industry?: string;
  size?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  assignedTo?: Types.ObjectId;
  tags: string[];
  notes?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const companySchema = new Schema<ICompany>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, trim: true },
    website: String,
    industry: String,
    size: String,
    email: { type: String, lowercase: true },
    phone: String,
    address: String,
    city: String,
    state: String,
    country: { type: String, default: 'India' },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
    tags: [String],
    notes: String,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

companySchema.index({ organizationId: 1, name: 1 });

export const Company = mongoose.model<ICompany>('Company', companySchema);
