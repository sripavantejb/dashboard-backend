import { AccessRequest } from '../../../models/index.js';
import { ConflictError } from '../../../shared/errors/index.js';

export class AccessRequestService {
  async submit(data: {
    firstName: string;
    lastName: string;
    email: string;
    companyName: string;
    phone?: string;
    teamSize?: string;
    message?: string;
  }) {
    const email = data.email.toLowerCase();

    const recentDuplicate = await AccessRequest.findOne({
      email,
      status: 'pending',
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });

    if (recentDuplicate) {
      throw new ConflictError('You already submitted a request. Our team will contact you shortly.');
    }

    const request = await AccessRequest.create({
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      email,
      companyName: data.companyName.trim(),
      phone: data.phone?.trim(),
      teamSize: data.teamSize?.trim(),
      message: data.message?.trim(),
      status: 'pending',
    });

    return {
      _id: request._id,
      email: request.email,
      companyName: request.companyName,
      status: request.status,
      createdAt: request.createdAt,
    };
  }
}

export const accessRequestService = new AccessRequestService();
