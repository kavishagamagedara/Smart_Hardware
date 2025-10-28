const Attendance = require("../Model/AttendanceModel");
const User = require("../Model/UserModel");

const STATUS_SET = new Set(["present", "absent", "late", "leave"]);

const normalizeDateOnly = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

const serializeRecord = (record) => {
  if (!record) return null;
  const payload = record.toObject ? record.toObject({ virtuals: false }) : { ...record };
  if (payload.date instanceof Date) payload.date = payload.date.toISOString();
  if (payload.createdAt instanceof Date) payload.createdAt = payload.createdAt.toISOString();
  if (payload.updatedAt instanceof Date) payload.updatedAt = payload.updatedAt.toISOString();
  return payload;
};

const formatISO = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : "";
};

const escapeCsvField = (input) => {
  if (input == null) return "";
  const str = String(input);
  if (!/[",\n]/.test(str)) return str;
  return `"${str.replace(/"/g, '""')}"`;
};

const defaultRange = () => {
  const today = new Date();
  const to = normalizeDateOnly(today);
  const from = new Date(to);
  from.setUTCDate(1);
  return { from, to };
};

const listByDate = async (req, res) => {
  try {
    const { date } = req.query;
    const normalizedDate = normalizeDateOnly(date || new Date());
    if (!normalizedDate) {
      return res.status(400).json({ message: "Invalid date" });
    }

    const records = await Attendance.find({ date: normalizedDate })
      .populate("user", "name email role")
      .populate("recordedBy", "name email role")
      .sort({ updatedAt: -1 });

    res.json({
      date: normalizedDate.toISOString(),
      records: records.map(serializeRecord),
    });
  } catch (err) {
    console.error("listByDate error:", err);
    res.status(500).json({ message: err.message });
  }
};

const listByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { from, to } = req.query;
    if (!userId) return res.status(400).json({ message: "User ID required" });

    const query = { user: userId };
    if (from || to) {
      query.date = {};
      if (from) {
        const fromDate = normalizeDateOnly(from);
        if (!fromDate) return res.status(400).json({ message: "Invalid from date" });
        query.date.$gte = fromDate;
      }
      if (to) {
        const toDate = normalizeDateOnly(to);
        if (!toDate) return res.status(400).json({ message: "Invalid to date" });
        query.date.$lte = toDate;
      }
    }

    const history = await Attendance.find(query)
      .populate("recordedBy", "name email role")
      .sort({ date: -1 })
      .limit(60);

    res.json({
      userId,
      records: history.map(serializeRecord),
    });
  } catch (err) {
    console.error("listByUser error:", err);
    res.status(500).json({ message: err.message });
  }
};

const upsertAttendance = async (req, res) => {
  try {
    const { userId, date, status, note } = req.body || {};
    if (!userId || !date || !status) {
      return res.status(400).json({ message: "userId, date, and status are required" });
    }

    const normalizedStatus = String(status).trim().toLowerCase();
    if (!STATUS_SET.has(normalizedStatus)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const normalizedDate = normalizeDateOnly(date);
    if (!normalizedDate) {
      return res.status(400).json({ message: "Invalid date" });
    }

    const user = await User.findById(userId).select("name email role");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const payload = {
      status: normalizedStatus,
      note: typeof note === "string" ? note.trim() : "",
      recordedBy: req.user?._id,
    };

    const record = await Attendance.findOneAndUpdate(
      { user: user._id, date: normalizedDate },
      {
        $set: payload,
        $setOnInsert: { user: user._id, date: normalizedDate },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    )
      .populate("user", "name email role")
      .populate("recordedBy", "name email role");

    res.json({ record: serializeRecord(record) });
  } catch (err) {
    console.error("upsertAttendance error:", err);
    res.status(500).json({ message: err.message });
  }
};

const summaryByRange = async (req, res) => {
  try {
    const { from: rawFrom, to: rawTo } = req.query || {};

    let fromDate = rawFrom ? normalizeDateOnly(rawFrom) : null;
    let toDate = rawTo ? normalizeDateOnly(rawTo) : null;

    if (!fromDate || !toDate) {
      const defaults = defaultRange();
      fromDate = fromDate || defaults.from;
      toDate = toDate || defaults.to;
    }

    if (fromDate > toDate) {
      const temp = fromDate;
      fromDate = toDate;
      toDate = temp;
    }

    const records = await Attendance.find({
      date: { $gte: fromDate, $lte: toDate },
    })
      .populate("user", "name email role")
      .populate("recordedBy", "name email role")
      .lean();

    const totals = {
      present: 0,
      absent: 0,
      late: 0,
      leave: 0,
    };

    const perUser = new Map();

    records.forEach((record) => {
      const status = String(record.status || "present").toLowerCase();
      if (Object.prototype.hasOwnProperty.call(totals, status)) {
        totals[status] += 1;
      }

      const userId = record?.user?._id?.toString?.() || record?.user?.toString?.();
      if (!userId) return;

      if (!perUser.has(userId)) {
        perUser.set(userId, {
          userId,
          name: record?.user?.name || "",
          email: record?.user?.email || "",
          role: record?.user?.role || "",
          counts: { present: 0, absent: 0, late: 0, leave: 0 },
          notes: [],
        });
      }

      const entry = perUser.get(userId);
      if (Object.prototype.hasOwnProperty.call(entry.counts, status)) {
        entry.counts[status] += 1;
      }

      if (record.note) {
        entry.notes.push({
          date: record.date instanceof Date ? record.date.toISOString() : record.date,
          note: record.note,
        });
      }
    });

    res.json({
      range: {
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
      },
      totals,
      users: Array.from(perUser.values()),
    });
  } catch (err) {
    console.error("summaryByRange error:", err);
    res.status(500).json({ message: err.message });
  }
};

const exportAttendanceReport = async (req, res) => {
  try {
    const { from: rawFrom, to: rawTo, format = "csv" } = req.query || {};

    let fromDate = rawFrom ? normalizeDateOnly(rawFrom) : null;
    let toDate = rawTo ? normalizeDateOnly(rawTo) : null;

    if (!fromDate && !toDate) {
      const today = normalizeDateOnly(new Date());
      fromDate = today;
      toDate = today;
    }

    if (!fromDate) fromDate = normalizeDateOnly(new Date());
    if (!toDate) toDate = fromDate;
    if (fromDate > toDate) {
      const temp = fromDate;
      fromDate = toDate;
      toDate = temp;
    }

    const records = await Attendance.find({
      date: { $gte: fromDate, $lte: toDate },
    })
      .populate("user", "name email role")
      .populate("recordedBy", "name email role")
      .sort({ date: 1, "user.name": 1 })
      .lean();

    const totals = {
      present: 0,
      absent: 0,
      late: 0,
      leave: 0,
    };

    const serialized = records.map((record) => {
      const status = String(record.status || "present").toLowerCase();
      if (Object.prototype.hasOwnProperty.call(totals, status)) {
        totals[status] += 1;
      }
      return {
        date: formatISO(record.date),
        employee: record.user?.name || "",
        email: record.user?.email || "",
        role: record.user?.role || "",
        status,
        note: record.note || "",
        recordedBy: record.recordedBy?.name || "",
        recordedByEmail: record.recordedBy?.email || "",
        updatedAt: formatISO(record.updatedAt),
      };
    });

    if (format === "json") {
      return res.json({
        range: { from: formatISO(fromDate), to: formatISO(toDate) },
        totals,
        records: serialized,
      });
    }

    const header = [
      "Date",
      "Employee",
      "Email",
      "Role",
      "Status",
      "Note",
      "Recorded by",
      "Recorded by (email)",
      "Last updated",
    ];

    const csvLines = [header.map(escapeCsvField).join(",")];
    serialized.forEach((row) => {
      csvLines.push(
        [
          row.date,
          row.employee,
          row.email,
          row.role,
          row.status,
          row.note,
          row.recordedBy,
          row.recordedByEmail,
          row.updatedAt,
        ]
          .map(escapeCsvField)
          .join(",")
      );
    });

    csvLines.push("");
    csvLines.push("Totals");
    csvLines.push(["Present", totals.present].map(escapeCsvField).join(","));
    csvLines.push(["Absent", totals.absent].map(escapeCsvField).join(","));
    csvLines.push(["Late", totals.late].map(escapeCsvField).join(","));
    csvLines.push(["Leave", totals.leave].map(escapeCsvField).join(","));

    const csv = csvLines.join("\n");
    const filenameStamp = `${formatISO(fromDate).slice(0, 10)}_${formatISO(toDate).slice(0, 10)}`;
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="attendance-report-${filenameStamp}.csv"`
    );
    return res.send(csv);
  } catch (err) {
    console.error("exportAttendanceReport error:", err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  listByDate,
  listByUser,
  upsertAttendance,
  summaryByRange,
  exportAttendanceReport,
};
