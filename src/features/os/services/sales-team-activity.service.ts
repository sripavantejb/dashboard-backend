import { Types } from 'mongoose';
import { SalesActivityEvent, SalesAttendance, SalesCall, SalesDeal, SalesEmployee, SalesFollowUp, SalesLead, User } from '../../../models/index.js';
import { SALES_LEAD_STATUSES } from '../../../shared/constants/os.js';
import { loggedCallMatch } from '../calling/analytics.js';

function istToday() {
  return new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);
}

function istDayBounds(date = istToday()) {
  return { date, start: new Date(`${date}T00:00:00+05:30`), end: new Date(`${date}T23:59:59.999+05:30`) };
}

function idOf(value: unknown) {
  return String(value || '');
}

export interface BdaTeamActivityRow {
  employeeId: string;
  name: string;
  employeeCode: string;
  email: string;
  checkInStatus: string;
  checkInAt: Date | null;
  checkOutAt: Date | null;
  lastActivityAt: Date | null;
  lastActivity: string;
  callsToday: number;
  contacting: boolean;
  openLeads: number;
  followUpsDue: number;
  pipeline: Record<string, number>;
  openDeals: number;
  dealValue: number;
}

/** Per-BDA portal snapshot: who is contacting, pipeline, calls, follow-ups. */
export async function buildBdaTeamActivity(organizationId: string) {
  const { date, start, end } = istDayBounds();
  const employees = await SalesEmployee.find({
    organizationId,
    status: 'active',
    recordStatus: 'active',
    isSalesAdmin: { $ne: true },
  }).sort({ employeeCode: 1 }).lean();
  const users = await User.find({ organizationId, _id: { $in: employees.map((e) => e.userId) } }).select('firstName lastName email').lean();
  const names = new Map(employees.map((e) => {
    const u = users.find((x) => String(x._id) === String(e.userId));
    const name = u ? [u.firstName, u.lastName === '-' ? '' : u.lastName].filter(Boolean).join(' ').trim() : e.employeeCode;
    return [String(e._id), { name, email: u?.email || '' }];
  }));
  const ids = employees.map((e) => e._id);

  const [leads, calls, followUps, deals, attendance, lastEvents] = await Promise.all([
    ids.length
      ? SalesLead.find({ organizationId, recordStatus: 'active', assignedEmployeeId: { $in: ids } }).select('status assignedEmployeeId').lean()
      : [],
    ids.length
      ? SalesCall.find({ organizationId, employeeId: { $in: ids }, calledAt: { $gte: start, $lte: end }, ...loggedCallMatch() }).select('employeeId').lean()
      : [],
    ids.length
      ? SalesFollowUp.find({ organizationId, recordStatus: 'active', status: 'pending', ownerEmployeeId: { $in: ids }, dueAt: { $lte: end } }).select('ownerEmployeeId').lean()
      : [],
    ids.length
      ? SalesDeal.find({ organizationId, recordStatus: 'active', ownerEmployeeId: { $in: ids }, stage: { $nin: ['won', 'lost'] } }).select('ownerEmployeeId value').lean()
      : [],
    ids.length
      ? SalesAttendance.find({ organizationId, date, employeeId: { $in: ids } }).lean()
      : [],
    ids.length
      ? SalesActivityEvent.aggregate([
        { $match: { organizationId: new Types.ObjectId(organizationId), actorEmployeeId: { $in: ids } } },
        { $sort: { createdAt: -1 } },
        { $group: { _id: '$actorEmployeeId', lastAt: { $first: '$createdAt' }, lastTitle: { $first: '$title' } } },
      ])
      : [],
  ]);

  const attByEmp = new Map(attendance.map((r) => [idOf(r.employeeId), r]));
  const lastByEmp = new Map(lastEvents.map((r) => [idOf(r._id), r]));
  const emptyPipeline = () => Object.fromEntries(SALES_LEAD_STATUSES.map((st) => [st, 0])) as Record<string, number>;

  const rows: BdaTeamActivityRow[] = employees.map((e) => {
    const id = String(e._id);
    const mine = leads.filter((l) => idOf(l.assignedEmployeeId) === id);
    const pipeline = emptyPipeline();
    for (const l of mine) pipeline[l.status] = (pipeline[l.status] || 0) + 1;
    const callsToday = calls.filter((c) => idOf(c.employeeId) === id).length;
    const att = attByEmp.get(id);
    const last = lastByEmp.get(id);
    const openDeals = deals.filter((d) => idOf(d.ownerEmployeeId) === id);
    return {
      employeeId: id,
      name: names.get(id)?.name || e.employeeCode,
      employeeCode: e.employeeCode,
      email: names.get(id)?.email || '',
      checkInStatus: att?.checkOutAt ? 'checked_out' : att?.checkInAt ? 'checked_in' : 'absent',
      checkInAt: att?.checkInAt || null,
      checkOutAt: att?.checkOutAt || null,
      lastActivityAt: last?.lastAt || null,
      lastActivity: last?.lastTitle || '',
      callsToday,
      contacting: callsToday > 0 || (pipeline.contacted || 0) > 0,
      openLeads: mine.filter((l) => !['converted', 'lost'].includes(l.status)).length,
      followUpsDue: followUps.filter((f) => idOf(f.ownerEmployeeId) === id).length,
      pipeline,
      openDeals: openDeals.length,
      dealValue: openDeals.reduce((s, d) => s + (Number(d.value) || 0), 0),
    };
  });

  const teamPipeline = emptyPipeline();
  for (const row of rows) {
    for (const st of SALES_LEAD_STATUSES) teamPipeline[st] += row.pipeline[st] || 0;
  }

  return {
    date,
    totals: {
      bdas: rows.length,
      contacting: rows.filter((r) => r.contacting).length,
      checkedIn: rows.filter((r) => r.checkInStatus === 'checked_in' || r.checkInStatus === 'checked_out').length,
      callsToday: rows.reduce((s, r) => s + r.callsToday, 0),
      openLeads: rows.reduce((s, r) => s + r.openLeads, 0),
      followUpsDue: rows.reduce((s, r) => s + r.followUpsDue, 0),
      openDeals: rows.reduce((s, r) => s + r.openDeals, 0),
      dealValue: rows.reduce((s, r) => s + r.dealValue, 0),
    },
    pipeline: teamPipeline,
    rows,
  };
}
