import { Types } from 'mongoose';
import { LeadCategory } from '../../../models/index.js';
import { NotFoundError, ConflictError } from '../../../shared/errors/index.js';
import { paginate, buildSearchFilter } from '../../../shared/utils/pagination.js';
import type { PaginationQuery } from '../../../shared/types/index.js';

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export class LeadCategoryService {
  async create(organizationId: string, data: Record<string, unknown>) {
    const slug = slugify(data.name as string);
    const exists = await LeadCategory.findOne({ organizationId, slug });
    if (exists) throw new ConflictError('Category with this name already exists');

    return LeadCategory.create({
      ...data,
      organizationId,
      slug,
      assignedTeam: (data.assignedTeam as string[] || []).map((id) => new Types.ObjectId(id)),
    });
  }

  async findAll(organizationId: string, query: PaginationQuery) {
    const filter = {
      organizationId: new Types.ObjectId(organizationId),
      isActive: true,
      ...buildSearchFilter(query.search, ['name', 'description']),
    };
    return paginate(LeadCategory, filter, query, 'assignedTeam');
  }

  async findById(organizationId: string, id: string) {
    const category = await LeadCategory.findOne({
      _id: id,
      organizationId,
    }).populate('assignedTeam', 'firstName lastName avatar email');
    if (!category) throw new NotFoundError('Lead category');
    return category;
  }

  async update(organizationId: string, id: string, data: Record<string, unknown>) {
    if (data.name) {
      const slug = slugify(data.name as string);
      const exists = await LeadCategory.findOne({ organizationId, slug, _id: { $ne: id } });
      if (exists) throw new ConflictError('Category with this name already exists');
      data.slug = slug;
    }
    if (data.assignedTeam) {
      data.assignedTeam = (data.assignedTeam as string[]).map((tid) => new Types.ObjectId(tid));
    }

    const category = await LeadCategory.findOneAndUpdate(
      { _id: id, organizationId },
      data,
      { new: true }
    );
    if (!category) throw new NotFoundError('Lead category');
    return category;
  }

  async delete(organizationId: string, id: string) {
    const category = await LeadCategory.findOneAndUpdate(
      { _id: id, organizationId },
      { isActive: false },
      { new: true }
    );
    if (!category) throw new NotFoundError('Lead category');
    return category;
  }
}

export const leadCategoryService = new LeadCategoryService();
