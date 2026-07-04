import { Types } from 'mongoose';
import { Project } from '../../../models/index.js';
import { NotFoundError } from '../../../shared/errors/index.js';
import { paginate, buildSearchFilter } from '../../../shared/utils/pagination.js';
import type { PaginationQuery } from '../../../shared/types/index.js';

export class ProjectService {
  async create(organizationId: string, userId: string, data: Record<string, unknown>) {
    return Project.create({ ...data, organizationId, createdBy: userId });
  }

  async findAll(organizationId: string, query: PaginationQuery & { status?: string }) {
    const filter: Record<string, unknown> = {
      organizationId: new Types.ObjectId(organizationId),
      ...buildSearchFilter(query.search, ['name', 'description']),
    };
    if (query.status) filter.status = query.status;
    return paginate(Project, filter, query, ['assignedTeam', 'createdBy']);
  }

  async findById(organizationId: string, id: string) {
    const project = await Project.findOne({ _id: id, organizationId })
      .populate('assignedTeam', 'firstName lastName avatar')
      .populate('createdBy', 'firstName lastName');
    if (!project) throw new NotFoundError('Project');
    return project;
  }

  async update(organizationId: string, id: string, data: Record<string, unknown>) {
    const project = await Project.findOneAndUpdate({ _id: id, organizationId }, data, { new: true })
      .populate('assignedTeam', 'firstName lastName avatar');
    if (!project) throw new NotFoundError('Project');
    return project;
  }

  async delete(organizationId: string, id: string) {
    const project = await Project.findOneAndDelete({ _id: id, organizationId });
    if (!project) throw new NotFoundError('Project');
    return project;
  }
}

export const projectService = new ProjectService();
