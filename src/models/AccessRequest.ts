import mongoose, { Schema, Document, Types } from 'mongoose';

export type AccessRequestStatus = 'pending' | 'contacted' | 'approved' | 'rejected';

export interface IAccessRequest extends Document {
  firstName: string;
  lastName: string;
  email: string;
  companyName: string;
  phone?: string;
  teamSize?: string;
  message?: string;
  status: AccessRequestStatus;
  adminNotes?: string;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const accessRequestSchema = new Schema<IAccessRequest>(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    companyName: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    teamSize: { type: String, trim: true },
    message: { type: String, trim: true, maxlength: 2000 },
    status: {
      type: String,
      enum: ['pending', 'contacted', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    adminNotes: { type: String, maxlength: 2000 },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
  },
  { timestamps: true }
);

accessRequestSchema.index({ status: 1, createdAt: -1 });

export const AccessRequest = mongoose.model<IAccessRequest>('AccessRequest', accessRequestSchema);
