import { Router } from 'express';
import multer from 'multer';
import { importController } from '../controllers/import.controller.js';
import { authenticate, authorize } from '../../../shared/middleware/auth.js';
import { z } from 'zod';
import { validateBody, validateParams } from '../../../shared/middleware/validate.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
const idParam = z.object({ id: z.string().min(1) });

const bulkTextSchema = z.object({ categoryId: z.string(), text: z.string().min(1) });
const manualSchema = z.object({ categoryId: z.string(), leads: z.array(z.record(z.unknown())).min(1) });
const mappingSchema = z.object({
  fieldMapping: z.record(z.string()),
  duplicateStrategy: z.enum(['skip', 'merge', 'import_all']).optional(),
});

router.use(authenticate);

router.get('/', authorize('leads:read', 'leads:*'), importController.findAll.bind(importController));
router.post('/upload', authorize('leads:*', 'leads:write'), upload.single('file'), importController.upload.bind(importController));
router.post('/bulk-text', authorize('leads:*', 'leads:write'), validateBody(bulkTextSchema), importController.bulkText.bind(importController));
router.post('/manual', authorize('leads:*', 'leads:write'), validateBody(manualSchema), importController.manual.bind(importController));
router.get('/:id', authorize('leads:read', 'leads:*'), validateParams(idParam), importController.findById.bind(importController));
router.patch('/:id/mapping', authorize('leads:*', 'leads:write'), validateParams(idParam), validateBody(mappingSchema), importController.updateMapping.bind(importController));
router.post('/:id/execute', authorize('leads:*', 'leads:write'), validateParams(idParam), importController.execute.bind(importController));

export default router;
