import { Response, NextFunction } from 'express';
import { importService } from '../services/import.service.js';
import { AuthenticatedRequest } from '../../../shared/types/index.js';

// In-memory row store for import sessions (production: use Redis or temp file)
const rowStore = new Map<string, Record<string, string>[]>();

export class ImportController {
  async upload(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ success: false, error: { message: 'File required' } });

      const { categoryId } = req.body;
      const source = file.mimetype.includes('sheet') || file.originalname.endsWith('.xlsx') ? 'excel' : 'csv';
      const result = await importService.createFromFile(
        req.user!.organizationId, req.user!.id, categoryId, file, source
      );

      rowStore.set(result.importJob._id.toString(), result.storedRows);

      res.status(201).json({
        success: true,
        data: {
          importJob: result.importJob,
          headers: result.headers,
          sampleRows: result.sampleRows,
          totalRows: result.totalRows,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async bulkText(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { categoryId, text } = req.body;
      const result = await importService.createFromBulkText(req.user!.organizationId, req.user!.id, categoryId, text);
      rowStore.set(result.importJob._id.toString(), result.storedRows as Record<string, string>[]);
      res.status(201).json({ success: true, data: result.importJob });
    } catch (error) {
      next(error);
    }
  }

  async manual(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { categoryId, leads } = req.body;
      const result = await importService.createManual(req.user!.organizationId, req.user!.id, categoryId, leads);
      rowStore.set(result.importJob._id.toString(), result.storedRows as Record<string, string>[]);
      res.status(201).json({ success: true, data: result.importJob });
    } catch (error) {
      next(error);
    }
  }

  async updateMapping(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const job = await importService.updateMapping(
        req.user!.organizationId,
        req.params.id as string,
        req.body.fieldMapping,
        req.body.duplicateStrategy
      );
      res.json({ success: true, data: job });
    } catch (error) {
      next(error);
    }
  }

  async execute(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const rows = rowStore.get(id) || req.body.rows || [];
      const job = await importService.executeImport(req.user!.organizationId, req.user!.id, id, rows);
      rowStore.delete(id);
      res.json({ success: true, data: job });
    } catch (error) {
      next(error);
    }
  }

  async findAll(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await importService.findAll(req.user!.organizationId, req.query);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async findById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const job = await importService.findById(req.user!.organizationId, req.params.id as string);
      res.json({ success: true, data: job });
    } catch (error) {
      next(error);
    }
  }
}

export const importController = new ImportController();
