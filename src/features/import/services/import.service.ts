import { Types } from 'mongoose';
import { LeadImport, Lead, LeadCategory } from '../../../models/index.js';
import { NotFoundError } from '../../../shared/errors/index.js';
import { parseCSV, parseBulkText, LEAD_FIELD_MAP } from '../../../shared/utils/csv.js';
import { paginate } from '../../../shared/utils/pagination.js';
import type { PaginationQuery } from '../../../shared/types/index.js';

export class ImportService {
  async createFromFile(
    organizationId: string,
    userId: string,
    categoryId: string,
    file: Express.Multer.File,
    source: 'csv' | 'excel'
  ) {
    const text = file.buffer.toString('utf-8');
    const { headers, rows } = parseCSV(text);

    const autoMapping: Record<string, string> = {};
    for (const header of headers) {
      const normalized = header.toLowerCase().replace(/\s+/g, '_');
      if (LEAD_FIELD_MAP[normalized]) autoMapping[header] = LEAD_FIELD_MAP[normalized];
    }

    const importJob = await LeadImport.create({
      organizationId,
      categoryId,
      fileName: file.originalname,
      source,
      status: 'mapping',
      fieldMapping: autoMapping,
      totalRows: rows.length,
      preview: rows.slice(0, 10),
      createdBy: userId,
    });

    return { importJob, headers, sampleRows: rows.slice(0, 5), totalRows: rows.length, storedRows: rows };
  }

  async createFromBulkText(organizationId: string, userId: string, categoryId: string, text: string) {
    const rows = parseBulkText(text);
    const importJob = await LeadImport.create({
      organizationId,
      categoryId,
      source: 'bulk_text',
      status: 'previewing',
      totalRows: rows.length,
      preview: rows.slice(0, 10),
      fieldMapping: { firstname: 'firstName', email: 'email', phone: 'phone', company: 'company' },
      createdBy: userId,
    });
    return { importJob, totalRows: rows.length, storedRows: rows };
  }

  async createManual(organizationId: string, userId: string, categoryId: string, leads: Record<string, unknown>[]) {
    const importJob = await LeadImport.create({
      organizationId,
      categoryId,
      source: 'manual',
      status: 'previewing',
      totalRows: leads.length,
      preview: leads.slice(0, 10),
      createdBy: userId,
    });
    return { importJob, storedRows: leads };
  }

  async updateMapping(organizationId: string, id: string, fieldMapping: Record<string, string>, duplicateStrategy?: string) {
    const job = await LeadImport.findOneAndUpdate(
      { _id: id, organizationId },
      { fieldMapping, duplicateStrategy, status: 'previewing' },
      { new: true }
    );
    if (!job) throw new NotFoundError('Import job');
    return job;
  }

  async executeImport(
    organizationId: string,
    userId: string,
    id: string,
    rows: Record<string, string>[]
  ) {
    const job = await LeadImport.findOne({ _id: id, organizationId });
    if (!job) throw new NotFoundError('Import job');

    job.status = 'processing';
    await job.save();

    let imported = 0;
    let skipped = 0;
    let duplicates = 0;
    let merged = 0;
    const errors: Array<{ row: number; message: string }> = [];

    for (let i = 0; i < rows.length; i++) {
      try {
        const mapped = this.mapRow(rows[i], job.fieldMapping);
        if (!mapped.firstName) {
          errors.push({ row: i + 1, message: 'Missing first name' });
          continue;
        }

        const duplicateQuery: Record<string, unknown> = { organizationId, categoryId: job.categoryId, isArchived: false };
        if (mapped.email) duplicateQuery.email = mapped.email;
        else if (mapped.phone) duplicateQuery.phone = mapped.phone;

        const existing = mapped.email || mapped.phone
          ? await Lead.findOne(duplicateQuery)
          : null;

        if (existing) {
          duplicates++;
          if (job.duplicateStrategy === 'skip') { skipped++; continue; }
          if (job.duplicateStrategy === 'merge') {
            await Lead.findByIdAndUpdate(existing._id, { $set: mapped });
            merged++;
            continue;
          }
        }

        await Lead.create({
          ...mapped,
          organizationId,
          categoryId: job.categoryId,
          createdBy: userId,
          source: `import:${job.source}`,
        });
        imported++;
      } catch (err) {
        errors.push({ row: i + 1, message: err instanceof Error ? err.message : 'Unknown error' });
      }
    }

    await LeadCategory.findByIdAndUpdate(job.categoryId, { $inc: { leadCount: imported } });

    job.status = 'completed';
    job.importedCount = imported;
    job.skippedCount = skipped;
    job.duplicateCount = duplicates;
    job.mergedCount = merged;
    job.errorCount = errors.length;
    job.importErrors = errors.slice(0, 100);
    job.completedAt = new Date();
    await job.save();

    return job;
  }

  async findAll(organizationId: string, query: PaginationQuery) {
    return paginate(LeadImport, { organizationId: new Types.ObjectId(organizationId) }, query, 'categoryId');
  }

  async findById(organizationId: string, id: string) {
    const job = await LeadImport.findOne({ _id: id, organizationId }).populate('categoryId', 'name');
    if (!job) throw new NotFoundError('Import job');
    return job;
  }

  private mapRow(row: Record<string, string>, mapping: Record<string, string>) {
    const result: Record<string, unknown> = {};
    for (const [sourceCol, targetField] of Object.entries(mapping)) {
      if (row[sourceCol] !== undefined && row[sourceCol] !== '') {
        result[targetField] = row[sourceCol];
      }
    }
    return result;
  }
}

export const importService = new ImportService();
