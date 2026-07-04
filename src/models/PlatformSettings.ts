import mongoose, { Schema, Document } from 'mongoose';

export interface IPlatformSettings extends Document {
  key: string;
  allowPublicRegistration: boolean;
  inviteOnlyMode: boolean;
  updatedAt: Date;
}

const platformSettingsSchema = new Schema<IPlatformSettings>(
  {
    key: { type: String, required: true, unique: true, default: 'platform' },
    allowPublicRegistration: { type: Boolean, default: false },
    inviteOnlyMode: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

export const PlatformSettings = mongoose.model<IPlatformSettings>('PlatformSettings', platformSettingsSchema);

export async function getPlatformSettings() {
  let settings = await PlatformSettings.findOne({ key: 'platform' });
  if (!settings) {
    settings = await PlatformSettings.create({ key: 'platform', allowPublicRegistration: false, inviteOnlyMode: true });
  }
  return settings;
}
