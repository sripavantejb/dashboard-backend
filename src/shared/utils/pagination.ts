import type { FilterQuery, Model } from 'mongoose';
import type { PaginationQuery, PaginatedResult } from '../types/index.js';

export function parsePagination(query: PaginationQuery) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const sort = query.sort || 'createdAt';
  const order = query.order === 'asc' ? 1 : -1;
  return { page, limit, sort, order, skip: (page - 1) * limit };
}

export async function paginate<T>(
  model: Model<T>,
  filter: FilterQuery<T>,
  query: PaginationQuery,
  populate?: string | string[]
): Promise<PaginatedResult<T>> {
  const { page, limit, sort, order, skip } = parsePagination(query);

  let q = model.find(filter).sort({ [sort]: order as 1 | -1 }).skip(skip).limit(limit);
  if (populate) q = q.populate(populate);

  const [data, total] = await Promise.all([
    q.lean(),
    model.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    data: data as T[],
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

export function buildSearchFilter(
  search: string | undefined,
  fields: string[]
): Record<string, unknown> {
  if (!search?.trim()) return {};
  const regex = { $regex: search.trim(), $options: 'i' };
  return { $or: fields.map((f) => ({ [f]: regex })) };
}
