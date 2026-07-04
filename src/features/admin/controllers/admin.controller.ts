import { Response, NextFunction } from 'express';
import { adminService } from '../services/admin.service.js';
import { AuthenticatedRequest } from '../../../shared/types/index.js';
import { NotFoundError } from '../../../shared/errors/index.js';

export class AdminController {
  async getStats(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const stats = await adminService.getStats();
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }

  async listOrganizations(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const orgs = await adminService.listOrganizations();
      res.json({ success: true, data: orgs });
    } catch (error) {
      next(error);
    }
  }

  async createOrganization(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const platformOrg = await adminService.getPlatformOrg();
      if (!platformOrg) throw new NotFoundError('Platform organization');

      const result = await adminService.createOrganization(
        req.user!.id,
        platformOrg._id.toString(),
        req.body
      );
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async updateOrganization(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const platformOrg = await adminService.getPlatformOrg();
      if (!platformOrg) throw new NotFoundError('Platform organization');

      const org = await adminService.updateOrganization(
        platformOrg._id.toString(),
        req.user!.id,
        req.params.id as string,
        req.body
      );
      res.json({ success: true, data: org });
    } catch (error) {
      next(error);
    }
  }

  async listPlatformAdmins(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const admins = await adminService.listPlatformAdmins();
      res.json({ success: true, data: admins });
    } catch (error) {
      next(error);
    }
  }

  async createPlatformAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const platformOrg = await adminService.getPlatformOrg();
      if (!platformOrg) throw new NotFoundError('Platform organization');

      const admin = await adminService.createPlatformAdmin(
        req.user!.id,
        platformOrg._id.toString(),
        req.body
      );
      res.status(201).json({ success: true, data: admin });
    } catch (error) {
      next(error);
    }
  }

  async getActivity(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const activity = await adminService.getActivity({
        organizationId: req.query.organizationId as string | undefined,
        days: req.query.days ? Number(req.query.days) : 30,
      });
      res.json({ success: true, data: activity });
    } catch (error) {
      next(error);
    }
  }

  async getAuditLogs(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const platformOrg = await adminService.getPlatformOrg();
      if (!platformOrg) throw new NotFoundError('Platform organization');

      const logs = await adminService.getAuditLogs(platformOrg._id.toString());
      res.json({ success: true, data: logs });
    } catch (error) {
      next(error);
    }
  }

  async getSettings(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const settings = await adminService.getSettings();
      res.json({ success: true, data: settings });
    } catch (error) {
      next(error);
    }
  }

  async updateSettings(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const platformOrg = await adminService.getPlatformOrg();
      if (!platformOrg) throw new NotFoundError('Platform organization');

      const settings = await adminService.updateSettings(
        req.user!.id,
        platformOrg._id.toString(),
        req.body
      );
      res.json({ success: true, data: settings });
    } catch (error) {
      next(error);
    }
  }

  async listInvites(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const invites = await adminService.listInvites();
      res.json({ success: true, data: invites });
    } catch (error) {
      next(error);
    }
  }

  async createInvite(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const platformOrg = await adminService.getPlatformOrg();
      if (!platformOrg) throw new NotFoundError('Platform organization');

      const invite = await adminService.createInvite(
        req.user!.id,
        platformOrg._id.toString(),
        req.body
      );
      res.status(201).json({ success: true, data: invite });
    } catch (error) {
      next(error);
    }
  }

  async revokeInvite(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const platformOrg = await adminService.getPlatformOrg();
      if (!platformOrg) throw new NotFoundError('Platform organization');

      await adminService.revokeInvite(req.user!.id, platformOrg._id.toString(), req.params.id as string);
      res.json({ success: true, message: 'Invite revoked' });
    } catch (error) {
      next(error);
    }
  }

  async listAccessRequests(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const requests = await adminService.listAccessRequests(req.query.status as string | undefined);
      res.json({ success: true, data: requests });
    } catch (error) {
      next(error);
    }
  }

  async updateAccessRequest(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const platformOrg = await adminService.getPlatformOrg();
      if (!platformOrg) throw new NotFoundError('Platform organization');

      const request = await adminService.updateAccessRequest(
        req.user!.id,
        platformOrg._id.toString(),
        req.params.id as string,
        req.body
      );
      res.json({ success: true, data: request });
    } catch (error) {
      next(error);
    }
  }

  async deleteAccessRequest(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const platformOrg = await adminService.getPlatformOrg();
      if (!platformOrg) throw new NotFoundError('Platform organization');

      await adminService.deleteAccessRequest(req.user!.id, platformOrg._id.toString(), req.params.id as string);
      res.json({ success: true, message: 'Access request deleted' });
    } catch (error) {
      next(error);
    }
  }

  async getOrganization(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const org = await adminService.getOrganizationById(req.params.id as string);
      res.json({ success: true, data: org });
    } catch (error) {
      next(error);
    }
  }

  async listOrganizationUsers(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const users = await adminService.listOrganizationUsers(req.params.id as string);
      res.json({ success: true, data: users });
    } catch (error) {
      next(error);
    }
  }

  async createOrganizationUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const platformOrg = await adminService.getPlatformOrg();
      if (!platformOrg) throw new NotFoundError('Platform organization');

      const user = await adminService.createOrganizationUser(
        req.user!.id,
        platformOrg._id.toString(),
        req.params.id as string,
        req.body
      );
      res.status(201).json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  }

  async updateOrganizationUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const platformOrg = await adminService.getPlatformOrg();
      if (!platformOrg) throw new NotFoundError('Platform organization');

      const user = await adminService.updateOrganizationUser(
        req.user!.id,
        platformOrg._id.toString(),
        req.params.id as string,
        req.params.userId as string,
        req.body
      );
      res.json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  }

  async deactivateOrganizationUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const platformOrg = await adminService.getPlatformOrg();
      if (!platformOrg) throw new NotFoundError('Platform organization');

      await adminService.deactivateOrganizationUser(
        req.user!.id,
        platformOrg._id.toString(),
        req.params.id as string,
        req.params.userId as string
      );
      res.json({ success: true, message: 'User deactivated' });
    } catch (error) {
      next(error);
    }
  }
}

export const adminController = new AdminController();
