export type SubscriptionPlan = 'starter' | 'professional' | 'enterprise';

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = ['starter', 'professional', 'enterprise'];

export const PLAN_CONFIG: Record<SubscriptionPlan, { label: string; maxUsers: number; monthlyPrice: number }> = {
  starter: { label: 'Starter', maxUsers: 5, monthlyPrice: 0 },
  professional: { label: 'Professional', maxUsers: 25, monthlyPrice: 4999 },
  enterprise: { label: 'Enterprise', maxUsers: 999, monthlyPrice: 14999 },
};

export function getMaxUsersForPlan(plan: SubscriptionPlan): number {
  return PLAN_CONFIG[plan]?.maxUsers ?? 5;
}
