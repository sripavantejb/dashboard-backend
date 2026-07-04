import mongoose, { Schema, Document, Types } from 'mongoose';

export type TaskStatus = 'pending' | 'assigned' | 'in_progress' | 'review' | 'completed' | 'cancelled' | 'overdue';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface ITask extends Document {
  organizationId: Types.ObjectId;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignedTo?: Types.ObjectId;
  createdBy: Types.ObjectId;
  projectId?: Types.ObjectId;
  leadId?: Types.ObjectId;
  parentTaskId?: Types.ObjectId;
  dueDate?: Date;
  completedAt?: Date;
  checklist: Array<{ text: string; completed: boolean }>;
  tags: string[];
  estimatedHours?: number;
  actualHours?: number;
  isRecurring: boolean;
  recurringPattern?: string;
  createdAt: Date;
  updatedAt: Date;
}

const taskSchema = new Schema<ITask>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: String,
    status: {
      type: String,
      enum: ['pending', 'assigned', 'in_progress', 'review', 'completed', 'cancelled', 'overdue'],
      default: 'pending',
      index: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project' },
    leadId: { type: Schema.Types.ObjectId, ref: 'Lead' },
    parentTaskId: { type: Schema.Types.ObjectId, ref: 'Task' },
    dueDate: { type: Date, index: true },
    completedAt: Date,
    checklist: [{ text: String, completed: { type: Boolean, default: false } }],
    tags: [String],
    estimatedHours: Number,
    actualHours: Number,
    isRecurring: { type: Boolean, default: false },
    recurringPattern: String,
  },
  { timestamps: true }
);

taskSchema.index({ organizationId: 1, assignedTo: 1, status: 1, dueDate: 1 });

export const Task = mongoose.model<ITask>('Task', taskSchema);
