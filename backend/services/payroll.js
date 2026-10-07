const { daysInMonth } = require("../utils/helpers");

const PAID_LEAVES = () => Number(process.env.PAID_LEAVES_PER_MONTH || 2);
const round = (n) => Math.round(n);

// Salary rules (all shown to the admin in the UI):
//  - every day of the month is "present" unless an absence / half day / leave was recorded
//  - absent = full day deducted, half day = half, leave = free up to PAID_LEAVES_PER_MONTH (default 2), extra leave is deducted
//  - a person who joined mid-month is paid only from the joining day
//  - net = base - deduction + bonus - advance (never below 0)
// `records` = this month's attendance rows for the person: [{ date: "YYYY-MM-DD", status }]
const calcPayroll = ({ monthlySalary, joiningDate, month, records, bonus = 0, advance = 0 }) => {
  const days = daysInMonth(month);
  const join = joiningDate ? new Date(joiningDate).toISOString().slice(0, 10) : null;
  const startDay = join && join.slice(0, 7) === month ? Number(join.slice(8, 10)) : 1;
  const payableDays = days - startDay + 1;
  const base = round((monthlySalary * payableDays) / days);
  const perDay = monthlySalary / days;

  const inRange = records.filter((r) => Number(r.date.slice(8, 10)) >= startDay);
  const count = (st) => inRange.filter((r) => r.status === st).length;
  const absent = count("absent"), half = count("half_day"), leave = count("leave");
  const unpaidLeave = Math.max(0, leave - PAID_LEAVES());
  const deduction = round(perDay * (absent + 0.5 * half + unpaidLeave));
  const net = Math.max(0, base - deduction + Number(bonus || 0) - Number(advance || 0));
  return {
    baseSalary: base, daysInMonth: days, presentDays: payableDays - absent - half - leave, halfDays: half,
    absentDays: absent, leaveDays: leave, unpaidLeaveDays: unpaidLeave, deduction, bonus: Number(bonus || 0), advance: Number(advance || 0), netSalary: net,
  };
};

module.exports = { calcPayroll };
