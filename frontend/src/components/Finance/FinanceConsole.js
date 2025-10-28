import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import NotificationsPanel from "../Notifications/NotificationsPanel";
import { formatLKR } from "../../utils/currency";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { CalendarRange, Download, Filter as FilterIcon, RefreshCcw, Sparkles } from "lucide-react";
import "./FinanceConsole.css";

const API_ROOT = (process.env.REACT_APP_API_URL || "http://localhost:5000").replace(/\/$/, "");
const API = `${API_ROOT}/api`;

const VIEWS = [
  {
    id: "online",
    title: "Online payments",
    description: "Customer purchases completed via online checkout.",
  },
  {
    id: "suppliers",
    title: "Supplier payments",
    description: "Payments issued to suppliers with uploaded slips.",
  },
  {
    id: "declined",
    title: "Declined payments",
    description: "Supplier payment slips that were rejected or cancelled.",
  },
  {
    id: "notifications",
    title: "Notifications",
    description: "Latest payment activity alerts for finance.",
  },
  {
    id: "attendance",
    title: "Attendance summary",
    description: "Monthly attendance breakdown pulled from HR records.",
  },
];

const VIEW_PERMISSIONS = {
  online: "canViewOnline",
  suppliers: "canViewSupplier",
  declined: "canViewDeclined",
  notifications: "canViewNotifications",
  attendance: "canViewAttendance",
};

const ROLE_DAILY_RATES = {
  admin: 12500,
  supplier: 7500,
  "supplier manager": 7800,
  "customer care manager": 8200,
  "customer service": 6200,
  technician: 6800,
  accountant: 9400,
  default: 6500,
};

const SALARY_WEIGHTS = {
  present: 1,
  late: 0.75,
  leave: 0.5,
  absent: 0,
};

const WORKDAY_HOURS = 8;

const HOURS_BY_STATUS = {
  present: WORKDAY_HOURS * SALARY_WEIGHTS.present,
  late: WORKDAY_HOURS * SALARY_WEIGHTS.late,
  leave: WORKDAY_HOURS * SALARY_WEIGHTS.leave,
  absent: 0,
};

const OVERTIME_MULTIPLIER_DEFAULT = 1.5;

const toDateInput = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const copy = new Date(date.getTime());
  copy.setHours(0, 0, 0, 0);
  return copy.toISOString().slice(0, 10);
};

const startOfMonth = (date) => {
  const copy = new Date(date.getFullYear(), date.getMonth(), 1);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const startOfYear = (date) => {
  const copy = new Date(date.getFullYear(), 0, 1);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const addDays = (date, days) => {
  const copy = new Date(date.getTime());
  copy.setDate(copy.getDate() + days);
  return copy;
};

const computeQuickRange = (key) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  switch (key) {
    case "last7":
      return { from: toDateInput(addDays(today, -6)), to: toDateInput(today) };
    case "last30":
      return { from: toDateInput(addDays(today, -29)), to: toDateInput(today) };
    case "mtd": {
      const start = startOfMonth(today);
      return { from: toDateInput(start), to: toDateInput(today) };
    }
    case "ytd": {
      const start = startOfYear(today);
      return { from: toDateInput(start), to: toDateInput(today) };
    }
    default:
      return { from: "", to: "" };
  }
};

const PAYMENT_RANGE_PRESETS = [
  { id: "last7", label: "Last 7 days" },
  { id: "last30", label: "Last 30 days" },
  { id: "mtd", label: "Month to date" },
  { id: "ytd", label: "Year to date" },
];

const ATTENDANCE_RANGE_PRESETS = [
  { id: "last7", label: "Last 7 days" },
  { id: "last30", label: "Last 30 days" },
  { id: "mtd", label: "Month to date" },
  { id: "ytd", label: "Year to date" },
];

const roundTo = (value, places = 2) => {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

const sanitizeNumeric = (value, { allowNegative = false } = {}) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  if (allowNegative) return numeric;
  return Math.max(0, numeric);
};

const formatDecimal = (value, digits = 2) => {
  if (!Number.isFinite(value)) return "0";
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

const statusMeta = (value) => {
  switch ((value || "").toLowerCase()) {
    case "paid":
      return { label: "Approved", tone: "status-chip--success" };
    case "pending":
    case "requires_action":
      return { label: "Pending", tone: "status-chip--warning" };
    case "failed":
    case "canceled":
      return { label: "Declined", tone: "status-chip--danger" };
    default:
      return { label: value || "Unknown", tone: "" };
  }
};

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
};

const formatAmount = (payment) => {
  const raw = Number(payment?.amount);
  if (!Number.isFinite(raw)) return "—";
  const divisor = payment?.method === "stripe" ? 100 : 1;
  const value = raw / divisor;
  return formatLKR(value);
};

const buildHeaders = (token) => {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

const defaultAttendanceRange = () => {
  const today = new Date();
  const to = today.toISOString().slice(0, 10);
  const first = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const from = first.toISOString().slice(0, 10);
  return { from, to, role: "all" };
};

export default function FinanceConsole({ initialView = "online", capabilities = {} }) {
  const { token } = useAuth();
  const [view, setView] = useState(initialView);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [onlinePayments, setOnlinePayments] = useState([]);
  const [supplierPayments, setSupplierPayments] = useState([]);
  const [attendanceSummary, setAttendanceSummary] = useState(null);
  const [attendanceFilters, setAttendanceFilters] = useState(defaultAttendanceRange);
  const [paymentFilters, setPaymentFilters] = useState({ from: "", to: "" });
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [deletingId, setDeletingId] = useState("");
  const [salaryOverrides, setSalaryOverrides] = useState({});

  const headers = useMemo(() => buildHeaders(token), [token]);

  const caps = useMemo(
    () => ({
      canAccessConsole: true,
      canViewOnline: true,
      canViewSupplier: true,
      canViewDeclined: true,
      canDeleteDeclined: true,
      canViewNotifications: true,
      canViewAttendance: true,
      canManageSalary: true,
      ...capabilities,
    }),
    [capabilities]
  );

  const allowedViews = useMemo(
    () => VIEWS.filter((option) => caps[VIEW_PERMISSIONS[option.id]]),
    [caps]
  );

  const canUseConsole = useMemo(
    () => caps.canAccessConsole && allowedViews.length > 0,
    [caps.canAccessConsole, allowedViews.length]
  );

  useEffect(() => {
    if (allowedViews.length === 0) return;
    if (!allowedViews.some((option) => option.id === view)) {
      setView(allowedViews[0].id);
    }
  }, [allowedViews, view]);

  const permittedForCurrentView = useMemo(
    () => Boolean(caps[VIEW_PERMISSIONS[view]]),
    [caps, view]
  );

  const canManageSalary = Boolean(caps.canManageSalary);

  const attendanceUsersById = useMemo(() => {
    const map = new Map();
    (attendanceSummary?.users || []).forEach((user) => {
      if (user?.userId) {
        map.set(user.userId, user);
      }
    });
    return map;
  }, [attendanceSummary]);

  const attendanceRoleOptions = useMemo(() => {
    const roles = new Set();
    (attendanceSummary?.users || []).forEach((user) => {
      const rawRole = String(user?.role || "").trim();
      if (!rawRole) return;
      const normalized = rawRole.toLowerCase();
      if (normalized.includes("supplier")) return;
      if (normalized === "user" || normalized === "customer") return;
      roles.add(rawRole);
    });
    return Array.from(roles).sort((a, b) => a.localeCompare(b));
  }, [attendanceSummary]);

  const getDefaultSalaryConfig = useCallback((user) => {
    const roleKey = String(user?.role || "").toLowerCase();
    const dailyRate = ROLE_DAILY_RATES[roleKey] || ROLE_DAILY_RATES.default;
    const hourlyRate = roundTo(dailyRate / WORKDAY_HOURS);

    return {
      hourlyRate,
      overtimeHours: 0,
      overtimeMultiplier: OVERTIME_MULTIPLIER_DEFAULT,
      bonus: 0,
      deductions: 0,
    };
  }, []);

  useEffect(() => {
    if (!attendanceSummary?.users) return;

    setSalaryOverrides((prev) => {
      const next = {};
      const validIds = new Set();

      attendanceSummary.users.forEach((user) => {
        if (!user?.userId) return;
        validIds.add(user.userId);
        const existing = prev[user.userId];
        next[user.userId] = existing
          ? { ...getDefaultSalaryConfig(user), ...existing }
          : getDefaultSalaryConfig(user);
      });

      return next;
    });
  }, [attendanceSummary, getDefaultSalaryConfig]);

  useEffect(() => {
    if (!attendanceRoleOptions.length) return;
    if (attendanceFilters.role === "all") return;
    const hasRole = attendanceRoleOptions.some(
      (role) => role.toLowerCase() === String(attendanceFilters.role || "").toLowerCase()
    );
    if (!hasRole) {
      setAttendanceFilters((prev) => ({ ...prev, role: "all" }));
    }
  }, [attendanceRoleOptions, attendanceFilters.role]);

  const handleSalaryConfigChange = useCallback(
    (userId, field, rawValue) => {
      if (!userId || !canManageSalary) return;
      const user = attendanceUsersById.get(userId);
      const allowNegative = field === "bonus";
      const sanitized = sanitizeNumeric(rawValue, { allowNegative });

      setSalaryOverrides((prev) => {
        const base = prev[userId] || getDefaultSalaryConfig(user);
        return {
          ...prev,
          [userId]: {
            ...base,
            [field]: sanitized,
          },
        };
      });
    },
    [attendanceUsersById, getDefaultSalaryConfig, canManageSalary]
  );

  const handleResetSalary = useCallback(
    (userId) => {
      if (!userId || !canManageSalary) return;
      const user = attendanceUsersById.get(userId);
      setSalaryOverrides((prev) => ({
        ...prev,
        [userId]: getDefaultSalaryConfig(user),
      }));
    },
    [attendanceUsersById, getDefaultSalaryConfig, canManageSalary]
  );

  const handlePaymentFilterChange = (event) => {
    const { name, value } = event.target;
    setPaymentFilters((prev) => ({ ...prev, [name]: value }));
  };

  const applyPaymentPreset = (presetId) => {
    const range = computeQuickRange(presetId);
    setPaymentFilters(range);
  };

  useEffect(() => {
    if (!token || !canUseConsole || !permittedForCurrentView) {
      setLoading(false);
      setError("");
      return;
    }

    if (view === "notifications") {
      setLoading(false);
      setError("");
      return;
    }

    const controller = new AbortController();
    const { signal } = controller;

    const load = async () => {
      try {
        setLoading(true);
        setError("");

        if (view === "attendance") {
          const params = new URLSearchParams();
          if (attendanceFilters.from) params.set("from", attendanceFilters.from);
          if (attendanceFilters.to) params.set("to", attendanceFilters.to);
          if (attendanceFilters.role && attendanceFilters.role !== "all") {
            params.set("role", attendanceFilters.role);
          }

          const response = await fetch(`${API}/attendance/summary?${params.toString()}`, {
            headers,
            signal,
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(payload?.message || "Unable to load attendance summary");
          }
          if (!signal.aborted) {
            setAttendanceSummary(payload);
          }
          return;
        }

        const method = view === "online" ? "stripe" : "slip";
        const params = new URLSearchParams();
        params.set("method", method);
        if (paymentFilters.from) params.set("from", paymentFilters.from);
        if (paymentFilters.to) params.set("to", paymentFilters.to);
        
        const url = `${API}/payments?${params.toString()}`;
        const response = await fetch(url, { headers, signal });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.message || "Unable to load payments");
        }
        const items = Array.isArray(payload?.payments) ? payload.payments : [];
        if (signal.aborted) return;

        if (view === "online") {
          setOnlinePayments(items);
        } else {
          setSupplierPayments(items);
        }
      } catch (err) {
        if (!signal.aborted) {
          setError(err.message || "Unable to load data");
          if (view === "online") {
            setOnlinePayments([]);
          } else if (view === "suppliers" || view === "declined") {
            setSupplierPayments([]);
          } else if (view === "attendance") {
            setAttendanceSummary(null);
          }
        }
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    };

    load();
    return () => controller.abort();
  }, [token, headers, view, attendanceFilters, paymentFilters, canUseConsole, permittedForCurrentView, refreshIndex]);

  useEffect(() => {
    if (view !== "declined" || !canUseConsole || !permittedForCurrentView) return;

    const interval = setInterval(() => {
      setRefreshIndex((prev) => prev + 1);
    }, 30000);

    return () => clearInterval(interval);
  }, [view, canUseConsole, permittedForCurrentView]);

  const declinedPayments = useMemo(
    () =>
      supplierPayments.filter((payment) => {
        const status = (payment?.paymentStatus || "").toLowerCase();
        return status === "failed" || status === "canceled";
      }),
    [supplierPayments]
  );

  const deleteDeclinedPayment = useCallback(
    async (payment) => {
      if (!caps.canDeleteDeclined) {
        setError("You do not have permission to delete declined payments.");
        return;
      }
      if (!payment?._id) return;
      if (!window.confirm("Delete this declined payment permanently?")) return;

      setDeletingId(payment._id);
      setError("");
      try {
        const response = await fetch(`${API}/payments/${payment._id}`, {
          method: "DELETE",
          headers,
          credentials: "include",
        });
        let payload = null;
        if (response.status !== 204) {
          payload = await response.json().catch(() => null);
        }
        if (!response.ok) {
          throw new Error(payload?.message || payload?.error || "Unable to delete payment");
        }
        setSupplierPayments((prev) => prev.filter((item) => item._id !== payment._id));
      } catch (err) {
        setError(err.message || "Unable to delete payment");
      } finally {
        setDeletingId("");
      }
    },
    [caps.canDeleteDeclined, headers]
  );

  const handleRefresh = useCallback(() => {
    if (!permittedForCurrentView) return;
    setRefreshIndex((prev) => prev + 1);
  }, [permittedForCurrentView]);

  const handleAttendanceFilterChange = (event) => {
    const { name, value } = event.target;
    setAttendanceFilters((prev) => ({ ...prev, [name]: value }));
  };

  const applyAttendancePreset = (presetId) => {
    const range = computeQuickRange(presetId);
    setAttendanceFilters((prev) => ({ ...prev, ...range }));
  };

  const exportPaymentsPDF = (data, reportType) => {
    try {
      const doc = new jsPDF("landscape", "pt", "a4");
      
      doc.setFontSize(18);
      doc.setFont(undefined, "bold");
      doc.text(`${reportType} Report`, 40, 40);
      
      doc.setFontSize(11);
      doc.setFont(undefined, "normal");
      const dateRange = paymentFilters.from && paymentFilters.to
        ? `${paymentFilters.from} to ${paymentFilters.to}`
        : "All dates";
      doc.text(`Date Range: ${dateRange}`, 40, 60);
      doc.text(`Generated: ${new Date().toLocaleString("en-US")}`, 40, 75);
      doc.text(`Total Records: ${data.length}`, 40, 90);
      
      const totalAmount = data.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      doc.text(`Total Amount: ${formatLKR(totalAmount)}`, 40, 105);
      
      let tableData, columns;
      
      if (reportType === "Online Payments") {
        columns = ["Reference", "Customer", "Email", "Amount", "Status", "Date"];
        tableData = data.map((payment) => [
          payment.paymentIntentId || payment._id || "—",
          payment.customerName || "—",
          payment.customerEmail || payment.email || "—",
          formatLKR(payment.amount || 0),
          payment.paymentStatus || payment.status || "—",
          payment.createdAt ? new Date(payment.createdAt).toLocaleDateString("en-US") : "—"
        ]);
      } else {
        columns = ["Supplier", "Amount", "Status", "Submitted", "Has Slip"];
        tableData = data.map((payment) => [
          payment.supplierName || payment.supplierEmail || "—",
          formatLKR(payment.amount || 0),
          payment.paymentStatus || "—",
          payment.createdAt ? new Date(payment.createdAt).toLocaleDateString("en-US") : "—",
          payment.slipUrl ? "Yes" : "No"
        ]);
      }
      
      autoTable(doc, {
        startY: 125,
        head: [columns],
        body: tableData,
        styles: { fontSize: 9, cellPadding: 5 },
        headStyles: { fillColor: [66, 139, 202], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        margin: { left: 40, right: 40 }
      });
      
      const filename = `${reportType.toLowerCase().replace(/ /g, "-")}-${paymentFilters.from || "start"}-${paymentFilters.to || "end"}.pdf`;
      doc.save(filename);
    } catch (error) {
      console.error("PDF export failed:", error);
      setError("Failed to export PDF: " + error.message);
    }
  };

  const exportPaymentsCSV = (data, reportType) => {
    try {
      let headers, rows;
      
      if (reportType === "Online Payments") {
        headers = ["Reference", "Customer", "Email", "Amount", "Status", "Created Date"];
        rows = data.map((payment) => [
          payment.paymentIntentId || payment._id || "",
          payment.customerName || "",
          payment.customerEmail || payment.email || "",
          payment.amount || 0,
          payment.paymentStatus || payment.status || "",
          payment.createdAt ? new Date(payment.createdAt).toISOString() : ""
        ]);
      } else {
        headers = ["Supplier", "Amount", "Status", "Submitted Date", "Slip URL"];
        rows = data.map((payment) => [
          payment.supplierName || payment.supplierEmail || "",
          payment.amount || 0,
          payment.paymentStatus || "",
          payment.createdAt ? new Date(payment.createdAt).toISOString() : "",
          payment.slipUrl || ""
        ]);
      }
      
      const csvContent = [
        headers.join(","),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      ].join("\n");
      
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${reportType.toLowerCase().replace(/ /g, "-")}-${paymentFilters.from || "start"}-${paymentFilters.to || "end"}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("CSV export failed:", error);
      setError("Failed to export CSV: " + error.message);
    }
  };

  const exportAttendanceCSV = () => {
    try {
      if (!attendanceSummary?.users || attendanceSummary.users.length === 0) {
        setError("No attendance data to export");
        return;
      }

      const headers = ["Employee", "Email", "Role", "Present", "Late", "Absent", "Leave", "Total Days"];
      const rows = attendanceSummary.users.map((user) => [
        user.name || "",
        user.email || "",
        user.role || "",
        user.counts?.present || 0,
        user.counts?.late || 0,
        user.counts?.absent || 0,
        user.counts?.leave || 0,
        (user.counts?.present || 0) + (user.counts?.late || 0) + (user.counts?.absent || 0) + (user.counts?.leave || 0)
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `attendance-summary-${attendanceFilters.from || "start"}-${attendanceFilters.to || "end"}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("CSV export failed:", error);
      setError("Failed to export CSV: " + error.message);
    }
  };

  const renderAttendanceSummary = () => {
    if (!token) {
      return (
        <div className="finance-console__empty">
          <p>Sign in to view attendance data.</p>
        </div>
      );
    }

    if (loading) {
      return (
        <div className="finance-console__loading">
          <div className="spinner" />
          <p>Loading attendance…</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="finance-console__error">
          <p>{error}</p>
          <button type="button" className="btn btn-secondary" onClick={handleRefresh}>
            Retry
          </button>
        </div>
      );
    }

    if (!attendanceSummary) {
      return (
        <div className="finance-console__empty">
          <p>No attendance records found for this period.</p>
        </div>
      );
    }
    const { users = [], range = {} } = attendanceSummary;

    const normalizedUsers = users.filter((user) => {
      const role = String(user?.role || "").toLowerCase();
      if (!role) return false;
      // Exclude suppliers (any role containing "supplier")
      if (role.includes("supplier")) return false;
      // Exclude regular users/customers (only show staff/employees)
      if (role === "user" || role === "customer") return false;
      // Include all staff roles: admin, managers, technicians, accountants, etc.
      return true;
    });

    const roleKey = (attendanceFilters.role || "all").toLowerCase();
    const filteredUsers = normalizedUsers.filter((user) => {
      if (roleKey === "all") return true;
      return String(user?.role || "").toLowerCase() === roleKey;
    });

    const totalsForAll = normalizedUsers.reduce(
      (acc, user) => {
        const counts = user?.counts || {};
        acc.present += counts.present || 0;
        acc.late += counts.late || 0;
        acc.absent += counts.absent || 0;
        acc.leave += counts.leave || 0;
        return acc;
      },
      { present: 0, late: 0, absent: 0, leave: 0 }
    );

    const totalsForRole = filteredUsers.reduce(
      (acc, user) => {
        const counts = user?.counts || {};
        acc.present += counts.present || 0;
        acc.late += counts.late || 0;
        acc.absent += counts.absent || 0;
        acc.leave += counts.leave || 0;
        return acc;
      },
      { present: 0, late: 0, absent: 0, leave: 0 }
    );

    const displayTotals = roleKey === "all" ? totalsForAll : totalsForRole;

    const salaryRows = filteredUsers.map((user) => {
      const counts = user.counts || {};
      const override = salaryOverrides[user.userId] || getDefaultSalaryConfig(user);

      const hourlyRate = roundTo(override.hourlyRate || 0);
      const overtimeHours = roundTo(override.overtimeHours || 0);
      const overtimeMultiplier = Math.max(
        0,
        roundTo(override.overtimeMultiplier ?? OVERTIME_MULTIPLIER_DEFAULT, 2)
      );
      const bonus = roundTo(override.bonus || 0);
      const deductions = roundTo(override.deductions || 0);

      const regularHours = roundTo(
        (counts.present || 0) * HOURS_BY_STATUS.present +
          (counts.late || 0) * HOURS_BY_STATUS.late +
          (counts.leave || 0) * HOURS_BY_STATUS.leave,
        2
      );

      const regularPay = roundTo(regularHours * hourlyRate);
      const overtimePay = roundTo(overtimeHours * hourlyRate * overtimeMultiplier);
      const grossPay = roundTo(regularPay + overtimePay + bonus);
      const netPay = roundTo(grossPay - deductions);

      return {
        ...user,
        counts,
        hourlyRate,
        regularHours,
        overtimeHours,
        overtimeMultiplier,
        regularPay,
        overtimePay,
        bonus,
        deductions,
        totalSalary: netPay,
      };
    });

    const salaryTotals = salaryRows.reduce(
      (acc, row) => {
        acc.regularHours += row.regularHours || 0;
        acc.overtimeHours += row.overtimeHours || 0;
        acc.regularPay += row.regularPay || 0;
        acc.overtimePay += row.overtimePay || 0;
        acc.bonus += row.bonus || 0;
        acc.deductions += row.deductions || 0;
        acc.netPay += row.totalSalary || 0;
        return acc;
      },
      { regularHours: 0, overtimeHours: 0, regularPay: 0, overtimePay: 0, bonus: 0, deductions: 0, netPay: 0 }
    );

    return (
      <div className="attendance-summary">
        <section className="attendance-summary__overview">
          { ["present", "late", "absent", "leave"].map((status) => {
            const labels = {
              present: "Present",
              late: "Late arrivals",
              absent: "Absent",
              leave: "On leave",
            };
            return (
              <article key={status} className={`attendance-summary__card attendance-summary__card--${status}`}>
                <h3>{labels[status]}</h3>
                <p>{displayTotals[status] || 0}</p>
              </article>
            );
          })}
          <article className="attendance-summary__card attendance-summary__card--salary">
            <div className="attendance-summary__card-meta">
              <h3>Total estimated salary</h3>
              <span className="attendance-summary__card-sub">Based on reported attendance</span>
            </div>
            <p className="attendance-summary__card-value">{formatLKR(salaryTotals.netPay)}</p>
          </article>
        </section>

        <section className="attendance-summary__meta">
          <div>
            <h3>Reporting window</h3>
            <p>
              {range.from ? new Date(range.from).toLocaleDateString() : "—"} –{" "}
              {range.to ? new Date(range.to).toLocaleDateString() : "—"}
            </p>
          </div>
          <div className="attendance-summary__actions">
            <button type="button" className="btn btn-secondary" onClick={handleRefresh} disabled={loading}>
              Refresh
            </button>
          </div>
        </section>

        <div className="finance-console__table-wrapper">
          <table className="finance-console__table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Role</th>
                <th>Present</th>
                <th>Late</th>
                <th>Absent</th>
                <th>Leave</th>
                <th>Hourly rate (LKR)</th>
                <th>Regular hours</th>
                <th>Overtime hours</th>
                <th>Overtime ×</th>
                <th>Regular pay</th>
                <th>Overtime pay</th>
                <th>Bonus</th>
                <th>Deductions</th>
                <th>Net salary</th>
                <th className="w-40">Notes</th>
              </tr>
            </thead>
            <tbody>
              {salaryRows.length === 0 ? (
                <tr>
                  <td colSpan={16} className="text-center text-muted">
                    No attendance records for this period.
                  </td>
                </tr>
              ) : (
                salaryRows.map((row) => (
                  <tr key={row.userId} className="attendance-summary__salary-row">
                    <td>
                      <div className="attendance-summary__person">
                        <span className="attendance-summary__name">{row.name || "—"}</span>
                        <span className="attendance-summary__email">{row.email || "—"}</span>
                      </div>
                    </td>
                    <td>{row.role || "—"}</td>
                    <td>{row.counts?.present ?? 0}</td>
                    <td>{row.counts?.late ?? 0}</td>
                    <td>{row.counts?.absent ?? 0}</td>
                    <td>{row.counts?.leave ?? 0}</td>
                    <td>
                      <div className="attendance-summary__salary-inputs">
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={salaryOverrides[row.userId]?.hourlyRate ?? row.hourlyRate ?? ""}
                          disabled={!canManageSalary}
                          onChange={(event) =>
                            handleSalaryConfigChange(row.userId, "hourlyRate", event.target.value)
                          }
                        />
                      </div>
                    </td>
                    <td>{formatDecimal(row.regularHours)}</td>
                    <td>
                      <div className="attendance-summary__salary-inputs">
                        <input
                          type="number"
                          min="0"
                          step="0.25"
                          value={salaryOverrides[row.userId]?.overtimeHours ?? row.overtimeHours ?? ""}
                          disabled={!canManageSalary}
                          onChange={(event) =>
                            handleSalaryConfigChange(row.userId, "overtimeHours", event.target.value)
                          }
                        />
                      </div>
                    </td>
                    <td>
                      <div className="attendance-summary__salary-inputs">
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={salaryOverrides[row.userId]?.overtimeMultiplier ?? row.overtimeMultiplier ?? ""}
                          disabled={!canManageSalary}
                          onChange={(event) =>
                            handleSalaryConfigChange(row.userId, "overtimeMultiplier", event.target.value)
                          }
                        />
                      </div>
                    </td>
                    <td>{formatLKR(row.regularPay)}</td>
                    <td>{formatLKR(row.overtimePay)}</td>
                    <td>
                      <div className="attendance-summary__salary-inputs">
                        <input
                          type="number"
                          step="0.5"
                          value={salaryOverrides[row.userId]?.bonus ?? row.bonus ?? ""}
                          disabled={!canManageSalary}
                          onChange={(event) => handleSalaryConfigChange(row.userId, "bonus", event.target.value)}
                        />
                      </div>
                    </td>
                    <td>
                      <div className="attendance-summary__salary-inputs">
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={salaryOverrides[row.userId]?.deductions ?? row.deductions ?? ""}
                          disabled={!canManageSalary}
                          onChange={(event) =>
                            handleSalaryConfigChange(row.userId, "deductions", event.target.value)
                          }
                        />
                      </div>
                    </td>
                    <td>{formatLKR(row.totalSalary)}</td>
                    <td>
                      <div className="attendance-summary__notes">
                        {row.notes?.length ? (
                          <ul>
                            {row.notes.map((note, index) => (
                              <li key={index}>{note}</li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                        <button type="button" className="btn btn-link" onClick={() => handleResetSalary(row.userId)}>
                          Reset overrides
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {salaryRows.length > 0 ? (
              <tfoot>
                <tr>
                  <td colSpan={7}>
                    <div className="attendance-summary__footer">
                      <span>Total payroll projection</span>
                    </div>
                  </td>
                  <td>{formatDecimal(salaryTotals.regularHours)}</td>
                  <td>{formatDecimal(salaryTotals.overtimeHours)}</td>
                  <td>—</td>
                  <td>{formatLKR(salaryTotals.regularPay)}</td>
                  <td>{formatLKR(salaryTotals.overtimePay)}</td>
                  <td>{formatLKR(salaryTotals.bonus)}</td>
                  <td>{formatLKR(salaryTotals.deductions)}</td>
                  <td>{formatLKR(salaryTotals.netPay)}</td>
                  <td />
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </div>
    );
  };

  const renderTable = (items, options = {}) => {
    if (!token) {
      return (
        <div className="finance-console__empty">
          <p>Sign in to view finance data.</p>
        </div>
      );
    }

    if (loading) {
      return (
        <div className="finance-console__loading">
          <div className="spinner" />
          <p>Loading {options.loadingLabel || "records"}…</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="finance-console__error">
          <p>{error}</p>
          <button type="button" className="btn btn-secondary" onClick={handleRefresh}>
            Retry
          </button>
        </div>
      );
    }

    if (!items?.length) {
      return (
        <div className="finance-console__empty">
          <p>{options.emptyLabel || "No records yet."}</p>
        </div>
      );
    }

    return (
      <div className="finance-console__table-wrapper">
        <table className="finance-console__table">
          <thead>
            <tr>
              {options.columns.map((column) => (
                <th key={column.key} className={column.className || ""}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <React.Fragment key={options.getKey ? options.getKey(item) : item._id || item.id}>
                {options.renderRow ? options.renderRow(item) : null}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderOnlinePayments = () =>
    renderTable(onlinePayments, {
      loadingLabel: "online payments",
      emptyLabel: "No online payments found for this period.",
      columns: [
        { key: "reference", label: "Reference" },
        { key: "customer", label: "Customer" },
        { key: "amount", label: "Amount" },
        { key: "status", label: "Status" },
        { key: "created", label: "Created" },
      ],
      getKey: (item) => item._id || item.paymentIntentId || item.id,
      renderRow: (payment) => (
        <tr>
          <td>{payment?.paymentIntentId || payment?._id || "—"}</td>
          <td>
            <div className="finance-console__customer">
              <span className="finance-console__customer-name">{payment?.customerName || "—"}</span>
              <span className="finance-console__customer-email">{payment?.customerEmail || payment?.email || "—"}</span>
            </div>
          </td>
          <td>{formatAmount(payment)}</td>
          <td>
            {(() => {
              const meta = statusMeta(payment?.paymentStatus || payment?.status);
              return <span className={`status-chip ${meta.tone}`}>{meta.label}</span>;
            })()}
          </td>
          <td>{formatDateTime(payment?.createdAt || payment?.created)}</td>
        </tr>
      ),
    });

  const renderSupplierPayments = () =>
    renderTable(supplierPayments, {
      loadingLabel: "supplier payments",
      emptyLabel: "No supplier payments found.",
      columns: [
        { key: "supplier", label: "Supplier" },
        { key: "amount", label: "Amount" },
        { key: "status", label: "Status" },
        { key: "submittedAt", label: "Submitted" },
        { key: "slip", label: "Slip" },
      ],
      getKey: (item) => item._id || item.id,
      renderRow: (payment) => (
        <tr>
          <td>{payment?.supplierName || payment?.supplierEmail || "—"}</td>
          <td>{formatAmount(payment)}</td>
          <td>
            {(() => {
              const meta = statusMeta(payment?.paymentStatus);
              return <span className={`status-chip ${meta.tone}`}>{meta.label}</span>;
            })()}
          </td>
          <td>{formatDateTime(payment?.createdAt)}</td>
          <td>
            {payment?.slipUrl ? (
              <a
                href={payment.slipUrl.startsWith("http") ? payment.slipUrl : `${API_ROOT}${payment.slipUrl}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-link"
              >
                View
              </a>
            ) : (
              <span className="text-muted">—</span>
            )}
          </td>
        </tr>
      ),
    });

  const renderDeclinedPayments = () =>
    renderTable(declinedPayments, {
      loadingLabel: "declined payments",
      emptyLabel: "No declined payments right now.",
      columns: [
        { key: "supplier", label: "Supplier" },
        { key: "amount", label: "Amount" },
        { key: "reason", label: "Reason" },
        { key: "updatedAt", label: "Updated" },
        { key: "actions", label: "Actions", className: "text-right" },
      ],
      getKey: (item) => item._id || item.id,
      renderRow: (payment) => (
        <tr className="finance-console__declined-row">
          <td>{payment?.supplierName || payment?.supplierEmail || "—"}</td>
          <td>{formatAmount(payment)}</td>
          <td>{payment?.declineReason || payment?.note || "—"}</td>
          <td>{formatDateTime(payment?.updatedAt || payment?.createdAt)}</td>
          <td className="text-right">
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => deleteDeclinedPayment(payment)}
              disabled={deletingId === (payment._id || payment.id)}
            >
              {deletingId === (payment._id || payment.id) ? "Deleting…" : "Delete"}
            </button>
          </td>
        </tr>
      ),
    });

  const renderView = () => {
    if (!canUseConsole) {
      return (
        <div className="finance-console__empty">
          <p>You don&apos;t have permission to access the finance console.</p>
        </div>
      );
    }

    switch (view) {
      case "online":
        return renderOnlinePayments();
      case "suppliers":
        return renderSupplierPayments();
      case "declined":
        return renderDeclinedPayments();
      case "notifications":
        return (
          <NotificationsPanel 
            scope="finance" 
            types={[
              "payment",
              "payment-online",
              "payment-status",
              "payment-supplier",
              "payment-supplier-approved",
              "payment-supplier-declined",
              "payment-supplier-pending"
            ]} 
          />
        );
      case "attendance":
        return renderAttendanceSummary();
      default:
        return (
          <div className="finance-console__empty">
            <p>Unknown view selected.</p>
          </div>
        );
    }
  };

  const renderPaymentFilters = (reportType, dataset = []) => {
    const totalRecords = dataset.length;
    const totalAmount = dataset.reduce((sum, item) => sum + (Number(item?.amount) || 0), 0);
    const averageAmount = totalRecords ? totalAmount / totalRecords : 0;
    const isPresetActive = (presetId) => {
      const presetRange = computeQuickRange(presetId);
      return presetRange.from === (paymentFilters.from || "") && presetRange.to === (paymentFilters.to || "");
    };

    const currentRangeLabel = paymentFilters.from && paymentFilters.to
      ? `${paymentFilters.from} → ${paymentFilters.to}`
      : "All dates";

    return (
      <div className="finance-console__filter-bar">
        <div className="finance-console__filters-col">
          <div className="finance-console__filter-heading">
            <span className="finance-console__icon-pill" aria-hidden="true">
              <CalendarRange size={18} />
            </span>
            <div>
              <h3>{reportType}</h3>
              <p>
                {currentRangeLabel}
                {PAYMENT_RANGE_PRESETS.some((preset) => isPresetActive(preset.id)) ? " · Quick preset" : ""}
              </p>
            </div>
          </div>

          <div className="finance-console__quick-ranges" role="group" aria-label={`${reportType} quick ranges`}>
            {PAYMENT_RANGE_PRESETS.map((preset) => {
              const active = isPresetActive(preset.id);
              return (
                <button
                  key={preset.id}
                  type="button"
                  className={`finance-console__quick-button ${active ? "active" : ""}`}
                  onClick={() => applyPaymentPreset(preset.id)}
                  disabled={loading}
                >
                  <Sparkles size={14} aria-hidden="true" />
                  <span>{preset.label}</span>
                </button>
              );
            })}
          </div>

          <div className="finance-console__filters-card">
            <form
              className="finance-console__filters"
              onSubmit={(event) => {
                event.preventDefault();
                handleRefresh();
              }}
            >
              <label htmlFor="payment-from">
                From
                <input
                  id="payment-from"
                  type="date"
                  name="from"
                  value={paymentFilters.from || ""}
                  max={paymentFilters.to || undefined}
                  onChange={handlePaymentFilterChange}
                />
              </label>
              <label htmlFor="payment-to">
                To
                <input
                  id="payment-to"
                  type="date"
                  name="to"
                  value={paymentFilters.to || ""}
                  min={paymentFilters.from || undefined}
                  onChange={handlePaymentFilterChange}
                />
              </label>

              <div className="finance-console__filter-actions">
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  <FilterIcon size={16} aria-hidden="true" />
                  <span>Apply filter</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setPaymentFilters({ from: "", to: "" });
                  }}
                  disabled={loading || (!paymentFilters.from && !paymentFilters.to)}
                >
                  <RefreshCcw size={16} aria-hidden="true" />
                  <span>Clear</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="finance-console__export-pane">
          <div className="finance-console__metrics" role="list" aria-label={`${reportType} insights`}>
            <div className="finance-console__metric-card" role="listitem">
              <span className="finance-console__metric-label">Total records</span>
              <strong>{totalRecords}</strong>
            </div>
            <div className="finance-console__metric-card" role="listitem">
              <span className="finance-console__metric-label">Total amount</span>
              <strong>{formatLKR(totalAmount)}</strong>
            </div>
            <div className="finance-console__metric-card" role="listitem">
              <span className="finance-console__metric-label">Average value</span>
              <strong>{formatLKR(averageAmount)}</strong>
            </div>
          </div>

          <div className="finance-console__export-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => exportPaymentsPDF(dataset, reportType)}
              disabled={loading || dataset.length === 0}
            >
              <Download size={16} aria-hidden="true" />
              <span>Export PDF</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => exportPaymentsCSV(dataset, reportType)}
              disabled={loading || dataset.length === 0}
            >
              <Download size={16} aria-hidden="true" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderAttendanceFilters = () => {
    const normalizedUsers = (attendanceSummary?.users || []).filter((user) => {
      const role = String(user?.role || "").toLowerCase();
      if (!role) return false;
      if (role.includes("supplier")) return false;
      if (role === "user" || role === "customer") return false;
      return true;
    });

    const roleKey = (attendanceFilters.role || "all").toLowerCase();
    const filteredUsers = normalizedUsers.filter((user) => {
      if (roleKey === "all") return true;
      return String(user?.role || "").toLowerCase() === roleKey;
    });

    const aggregateTotals = normalizedUsers.reduce(
      (acc, user) => {
        const counts = user?.counts || {};
        acc.present += counts.present || 0;
        acc.late += counts.late || 0;
        acc.absent += counts.absent || 0;
        acc.leave += counts.leave || 0;
        return acc;
      },
      { present: 0, late: 0, absent: 0, leave: 0 }
    );

    const filteredTotals = filteredUsers.reduce(
      (acc, user) => {
        const counts = user?.counts || {};
        acc.present += counts.present || 0;
        acc.late += counts.late || 0;
        acc.absent += counts.absent || 0;
        acc.leave += counts.leave || 0;
        return acc;
      },
      { present: 0, late: 0, absent: 0, leave: 0 }
    );

    const displayTotals = roleKey === "all" ? aggregateTotals : filteredTotals;
    const totalPeople = roleKey === "all" ? normalizedUsers.length : filteredUsers.length;
    const workedDays = (displayTotals.present || 0) + (displayTotals.late || 0);
    const rangeLabel = attendanceFilters.from && attendanceFilters.to
      ? `${attendanceFilters.from} → ${attendanceFilters.to}`
      : "All recorded dates";

    const roleValue = attendanceFilters.role || "all";
    const hasCustomDates = Boolean(attendanceFilters.from || attendanceFilters.to);
    const hasCustomRole = roleKey !== "all";
    const canClearFilters = hasCustomDates || hasCustomRole;

    return (
      <div className="attendance-toolbar">
        <div className="attendance-toolbar__top">
          <div className="attendance-toolbar__info">
            <h3>
              <span className="attendance-toolbar__icon" aria-hidden="true">
                <CalendarRange size={18} />
              </span>
              Attendance
            </h3>
            <p>Select a date range, narrow by role, and refresh to load the most recent attendance totals.</p>
            <span className="attendance-toolbar__range">{rangeLabel}</span>
          </div>

          <div className="attendance-toolbar__controls">
            <form
              className="attendance-toolbar__form"
              onSubmit={(event) => {
                event.preventDefault();
                handleRefresh();
              }}
            >
              <label className="attendance-toolbar__field" htmlFor="attendance-from">
                <span className="attendance-toolbar__label">Start date</span>
                <input
                  id="attendance-from"
                  type="date"
                  name="from"
                  value={attendanceFilters.from || ""}
                  max={attendanceFilters.to || undefined}
                  onChange={handleAttendanceFilterChange}
                />
              </label>

              <label className="attendance-toolbar__field" htmlFor="attendance-to">
                <span className="attendance-toolbar__label">End date</span>
                <input
                  id="attendance-to"
                  type="date"
                  name="to"
                  value={attendanceFilters.to || ""}
                  min={attendanceFilters.from || undefined}
                  onChange={handleAttendanceFilterChange}
                />
              </label>

              <label className="attendance-toolbar__field attendance-toolbar__field--select" htmlFor="attendance-role">
                <span className="attendance-toolbar__label">Filter by role</span>
                <select
                  id="attendance-role"
                  name="role"
                  value={roleValue}
                  onChange={handleAttendanceFilterChange}
                  disabled={attendanceRoleOptions.length === 0}
                >
                  <option value="all">All roles</option>
                  {attendanceRoleOptions.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </label>

              <div className="attendance-toolbar__actions">
                <button type="submit" className="attendance-toolbar__refresh" disabled={loading}>
                  Refresh
                </button>
                <button
                  type="button"
                  className="attendance-toolbar__clear"
                  onClick={() => {
                    setAttendanceFilters((prev) => ({ ...prev, from: "", to: "", role: "all" }));
                  }}
                  disabled={loading || !canClearFilters}
                >
                  Clear
                </button>
              </div>
            </form>

            <button
              type="button"
              className="attendance-toolbar__export-link"
              onClick={exportAttendanceCSV}
              disabled={loading || !attendanceSummary?.users || attendanceSummary.users.length === 0}
            >
              Export report
            </button>
          </div>
        </div>

        <div className="attendance-toolbar__quick">
          <span className="attendance-toolbar__quick-label">Quick ranges</span>
          <div className="attendance-toolbar__quick-buttons" role="group" aria-label="Attendance quick ranges">
            {ATTENDANCE_RANGE_PRESETS.map((preset) => {
              const presetRange = computeQuickRange(preset.id);
              const active =
                presetRange.from === (attendanceFilters.from || "") &&
                presetRange.to === (attendanceFilters.to || "");
              return (
                <button
                  key={preset.id}
                  type="button"
                  className={`attendance-toolbar__quick-button ${active ? "active" : ""}`}
                  onClick={() => applyAttendancePreset(preset.id)}
                  disabled={loading}
                >
                  <Sparkles size={14} aria-hidden="true" />
                  <span>{preset.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="attendance-toolbar__footer">
          <div className="attendance-toolbar__metrics" role="list" aria-label="Attendance insights">
            <div className="attendance-toolbar__metric" role="listitem">
              <span className="attendance-toolbar__metric-label">Team members</span>
              <strong>{totalPeople}</strong>
            </div>
            <div className="attendance-toolbar__metric" role="listitem">
              <span className="attendance-toolbar__metric-label">Present days</span>
              <strong>{displayTotals.present || 0}</strong>
            </div>
            <div className="attendance-toolbar__metric" role="listitem">
              <span className="attendance-toolbar__metric-label">Worked days</span>
              <strong>{workedDays}</strong>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const handleSelectView = useCallback(
    (nextView) => {
      if (view === nextView) return;
      setError("");
      setView(nextView);
      setRefreshIndex((prev) => prev + 1);
    },
    [view]
  );

  if (!caps.canAccessConsole) {
    return (
      <div className="finance-console__empty">
        <p>You don&apos;t have permission to access the finance console.</p>
      </div>
    );
  }

  return (
    <section className="finance-console">
      <header className="finance-console__header">
        <div>
          <h1>Finance console</h1>
          <p className="text-muted">Review payment activity, supplier slips, and attendance insights.</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={handleRefresh} disabled={loading}>
          Refresh
        </button>
      </header>

      <nav className="finance-console__tabs" aria-label="Finance console sections">
        {allowedViews.map((option) => {
          const isActive = option.id === view;
          return (
            <button
              key={option.id}
              type="button"
              className={`btn ${isActive ? "btn-primary" : "btn-secondary"} finance-console__tab ${
                isActive ? "finance-console__tab--active" : ""
              }`}
              onClick={() => handleSelectView(option.id)}
            >
              <span className="finance-console__tab-title">{option.title}</span>
              <span className="finance-console__tab-description">{option.description}</span>
            </button>
          );

        })}
      </nav>

      {view === "online" && permittedForCurrentView ? (
        <section className="finance-console__subheader">
          <h2>Online Payments Report</h2>
          {renderPaymentFilters("Online Payments", onlinePayments)}
        </section>
      ) : null}

      {view === "suppliers" && permittedForCurrentView ? (
        <section className="finance-console__subheader">
          <h2>Supplier Payments Report</h2>
          {renderPaymentFilters("Supplier Payments", supplierPayments)}
        </section>
      ) : null}

      {view === "attendance" && permittedForCurrentView ? (
        <section className="finance-console__subheader">
          <h2>Attendance summary</h2>
          {renderAttendanceFilters()}
        </section>
      ) : null}

      <div className="finance-console__content">{renderView()}</div>
    </section>
  );
}
