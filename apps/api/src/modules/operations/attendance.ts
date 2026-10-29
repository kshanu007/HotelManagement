import type { SessionUser } from '@annapurna/types';
import { attendanceRosterQuery } from '@annapurna/validation';
import { repository } from '../../core/tenancy/repository.js';
import { addDays } from '../../shared/helpers/dates.js';

export async function attendanceRoster(user: SessionUser, input: unknown) {
  const query = attendanceRosterQuery.parse(input);
  const memberships = await repository(user, 'subscriptions')
    .find({
      startDate: { $lte: query.date },
      endDate: { $gte: query.date },
      meal: { $in: [query.meal, 'both'] },
      ...(query.customerId ? { customerId: query.customerId } : {}),
    })
    .lean();
  const escaped = query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const customers = repository(user, 'customers');
  const filter = {
    ...customers.filter,
    status: 'active',
    _id: { $in: memberships.map((m) => m.customerId) },
    ...(query.q
      ? {
          $or: ['name', 'customerCode', 'phone'].map((key) => ({
            [key]: { $regex: escaped, $options: 'i' },
          })),
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    customers.model
      .find(filter)
      .sort({ name: 1, _id: 1 })
      .skip((query.page - 1) * 20)
      .limit(20)
      .lean(),
    customers.model.countDocuments(filter),
  ]);
  const ids = items.map((item) => item._id);
  const monthStart = `${query.date.slice(0, 7)}-01`;
  const nextMonth = new Date(`${monthStart}T00:00:00Z`);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1, 0);
  const monthEnd = nextMonth.toISOString().slice(0, 10);
  const [attendance, leaves] = await Promise.all([
    repository(user, 'attendance')
      .find({ customerId: { $in: ids }, date: query.date, meal: query.meal })
      .lean(),
    repository(user, 'leaves')
      .find({
        customerId: { $in: ids },
        status: 'active',
        startDate: { $lte: monthEnd },
        endDate: { $gte: monthStart },
      })
      .lean(),
  ]);
  return {
    total,
    page: query.page,
    limit: 20,
    month: query.date.slice(0, 7),
    items: items.map((customer) => {
      const record = attendance.find((a) => String(a.customerId) === String(customer._id));
      const customerLeaves = leaves.filter((l) => String(l.customerId) === String(customer._id));
      const onLeave = customerLeaves.some(
        (l) =>
          String(l.startDate) <= query.date &&
          String(l.endDate) >= query.date &&
          (l.meal === 'both' || l.meal === query.meal),
      );
      const days = new Set<string>(),
        meals = new Set<string>();
      for (const leave of customerLeaves) {
        const end = String(leave.endDate) < monthEnd ? String(leave.endDate) : monthEnd;
        for (
          let day = String(leave.startDate) > monthStart ? String(leave.startDate) : monthStart;
          day <= end;
          day = addDays(day, 1)
        ) {
          days.add(day);
          for (const meal of leave.meal === 'both' ? ['lunch', 'dinner'] : [leave.meal])
            meals.add(`${day}/${meal}`);
        }
      }
      const membership = memberships.find((m) => String(m.customerId) === String(customer._id));
      return {
        _id: String(customer._id),
        name: customer.name,
        customerCode: customer.customerCode,
        planName: membership?.planName,
        status: onLeave ? 'leave' : (record?.status ?? 'unmarked'),
        attendanceId: record ? String(record._id) : null,
        note: record?.note ?? '',
        leaveDays: days.size,
        leaveMeals: meals.size,
      };
    }),
  };
}
