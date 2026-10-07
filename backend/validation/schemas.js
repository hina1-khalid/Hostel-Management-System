const { z } = require("../utils/validate");

const email = z.string().trim().toLowerCase().email("must be a valid email address");
const password = z.string().min(6, "must be at least 6 characters").max(72, "must be at most 72 characters");
const id = z.string().regex(/^[a-f\d]{24}$/i, "invalid ID");
const dateLike = z.string().refine((v) => !isNaN(new Date(v)), "invalid date");
const money = z.coerce.number().min(0, "cannot be negative");

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD");
const hostelOpt = id.optional().or(z.literal(""));
const positive = z.coerce.number().gt(0, "must be greater than 0");

module.exports = {
  maintenanceCreate: z.object({ hostel: hostelOpt, title: z.string().trim().min(3, "must be at least 3 characters").max(120), category: z.string().optional(), intervalDays: z.coerce.number().int().min(1, "must be at least 1").max(730, "must be at most 730"), firstDueDate: ymd.optional(), lastDoneDate: ymd.optional(), assignedTo: z.string().max(80).optional(), estimatedCost: money.optional(), notes: z.string().max(500).optional() }),
  maintenanceComplete: z.object({ doneDate: ymd.optional(), cost: money.optional(), notes: z.string().max(500).optional() }),
  messExpense: z.object({ hostel: hostelOpt, date: ymd.optional(), category: z.string().optional(), description: z.string().trim().min(2, "is required").max(200), amount: positive, paidTo: z.string().max(80).optional() }),
  stockItem: z.object({ hostel: hostelOpt, name: z.string().trim().min(2, "is required").max(60), category: z.string().optional(), unit: z.string().optional(), quantity: money.optional(), minQuantity: money.optional() }),
  stockMove: z.object({ type: z.enum(["in", "out", "adjust"]), quantity: z.coerce.number().min(0, "cannot be negative"), cost: money.optional(), note: z.string().max(200).optional() }),
  staffMember: z.object({ hostel: hostelOpt, name: z.string().trim().min(2, "is required").max(80), role: z.string().optional(), phone: z.string().max(30).optional(), cnic: z.string().max(20).optional(), joiningDate: dateLike, monthlySalary: positive, messStaff: z.boolean().optional(), notes: z.string().max(300).optional() }),
  staffAttendance: z.object({ date: ymd, records: z.array(z.object({ staff: id, status: z.enum(["present", "absent", "half_day", "leave"]) })).min(1, "needs at least one record").max(500) }),
  payrollGenerate: z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "must be YYYY-MM"), hostel: hostelOpt }),
  payrollAdjust: z.object({ bonus: money.optional(), advance: money.optional(), note: z.string().max(300).optional() }),
  register: z.object({ name: z.string().trim().min(2, "must be at least 2 characters").max(80), email, password, phone: z.string().max(30).optional() }),
  login: z.object({ email: z.string().min(1, "is required"), password: z.string().min(1, "is required") }),
  profile: z.object({ name: z.string().trim().min(1, "cannot be empty").max(80).optional(), phone: z.string().max(30).optional(), emailNotifications: z.boolean().optional() }).passthrough(),
  changePassword: z.object({ currentPassword: z.string().min(1, "is required"), newPassword: password }),
  forgotPassword: z.object({ email }),
  resetPassword: z.object({ token: z.string().min(20, "is invalid"), password }),
  createStaff: z.object({ name: z.string().trim().min(2).max(80), email, password, phone: z.string().max(30).optional(), role: z.enum(["admin", "security", "superadmin"]), hostel: id.optional().or(z.literal("")) }),
  createRoom: z.object({ hostel: id, roomNumber: z.string().trim().min(1, "is required").max(20), floor: z.coerce.number().int().min(0).max(50).optional(), capacity: z.coerce.number().int().min(1, "must be at least 1").max(20), monthlyRent: money.optional() }).passthrough(),
  createFee: z.object({ student: id, feeType: z.string().min(1), amount: money, lateFee: money.optional(), dueDate: dateLike }).passthrough(),
  createComplaint: z.object({ title: z.string().trim().min(3, "must be at least 3 characters").max(150), description: z.string().trim().min(5, "must be at least 5 characters").max(2000), category: z.string().optional(), priority: z.string().optional() }),
  applyLeave: z.object({ reason: z.string().trim().min(3, "must be at least 3 characters").max(500), fromDate: dateLike, toDate: dateLike, leaveType: z.string().optional(), contactDuringLeave: z.string().max(100).optional() }),
  registerVisitor: z.object({ visitorName: z.string().trim().min(2).max(80), cnic: z.string().trim().min(5, "looks too short").max(20), phone: z.string().max(30).optional(), relation: z.string().max(40).optional(), purpose: z.string().max(200).optional(), studentId: z.string().optional(), registrationNumber: z.string().optional() }),
  roomRequest: z.object({ reason: z.string().trim().min(5, "please give a short reason (5+ characters)").max(500), requestedRoom: id.optional().or(z.literal("")), hostel: id.optional().or(z.literal("")) }),
};
