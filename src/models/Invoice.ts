import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IInvoice extends Document {
  organizationId: Types.ObjectId;
  invoiceNumber: string;
  clientId?: Types.ObjectId;
  leadId?: Types.ObjectId;
  projectId?: Types.ObjectId;
  items: Array<{
    description: string;
    quantity: number;
    rate: number;
    amount: number;
    taxRate?: number;
  }>;
  subtotal: number;
  taxAmount: number;
  total: number;
  currency: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  dueDate?: Date;
  paidAt?: Date;
  notes?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const invoiceSchema = new Schema<IInvoice>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    invoiceNumber: { type: String, required: true },
    clientId: { type: Schema.Types.ObjectId, ref: 'User' },
    leadId: { type: Schema.Types.ObjectId, ref: 'Lead' },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project' },
    items: [{
      description: { type: String, required: true },
      quantity: { type: Number, required: true, min: 0 },
      rate: { type: Number, required: true, min: 0 },
      amount: { type: Number, required: true },
      taxRate: Number,
    }],
    subtotal: { type: Number, required: true },
    taxAmount: { type: Number, default: 0 },
    total: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    status: {
      type: String,
      enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled'],
      default: 'draft',
    },
    dueDate: Date,
    paidAt: Date,
    notes: String,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

invoiceSchema.index({ organizationId: 1, invoiceNumber: 1 }, { unique: true });

export const Invoice = mongoose.model<IInvoice>('Invoice', invoiceSchema);
