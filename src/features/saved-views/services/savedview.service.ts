import { Types } from 'mongoose';
import { SavedView } from '../../../models/index.js';
import { NotFoundError } from '../../../shared/errors/index.js';

export class SavedViewService {
  async create(organizationId: string, userId: string, data: Record<string, unknown>) {
    if (data.isDefault) {
      await SavedView.updateMany({ organizationId, userId }, { isDefault: false });
    }
    return SavedView.create({ ...data, organizationId, userId });
  }

  async findAll(organizationId: string, userId: string) {
    return SavedView.find({
      organizationId,
      $or: [{ userId }, { isShared: true }],
    }).sort({ isDefault: -1, name: 1 });
  }

  async update(organizationId: string, userId: string, id: string, data: Record<string, unknown>) {
    if (data.isDefault) {
      await SavedView.updateMany({ organizationId, userId }, { isDefault: false });
    }
    const view = await SavedView.findOneAndUpdate({ _id: id, organizationId, userId }, data, { new: true });
    if (!view) throw new NotFoundError('Saved view');
    return view;
  }

  async delete(organizationId: string, userId: string, id: string) {
    const view = await SavedView.findOneAndDelete({ _id: id, organizationId, userId });
    if (!view) throw new NotFoundError('Saved view');
    return view;
  }
}

export const savedViewService = new SavedViewService();
