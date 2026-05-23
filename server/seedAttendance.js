const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]); // Fix querySrv ECONNREFUSED on Atlas
const mongoose = require("mongoose");
require("dotenv").config();

// Schema
const attendanceSchema = new mongoose.Schema(
    {
        user: mongoose.Schema.Types.ObjectId,
        date: String,
        checkIn: Date,
        checkOut: Date,
        totalHours: Number,
        status: String,
        note: String,
    },
    { timestamps: true }
);

const Attendance = mongoose.model("Attendance", attendanceSchema);

// Helper
function createAttendance(userId, dateStr, status) {
    let checkIn, checkOut, totalHours, note = "";

    if (status === "Absent") {
        return {
            user: userId,
            date: dateStr,
            status: "Absent",
            note: "Absent",
        };
    }

    const baseDate = new Date(dateStr);

    if (status === "Half-day") {
        checkIn = new Date(baseDate.setHours(10, Math.floor(Math.random() * 30)));
        checkOut = new Date(baseDate.setHours(14, Math.floor(Math.random() * 30)));
        totalHours = Number((Math.random() * 3 + 3).toFixed(2));
        note = "Half-day due to shortfall in hours";
    } else {
        checkIn = new Date(baseDate.setHours(9, Math.floor(Math.random() * 30)));
        checkOut = new Date(baseDate.setHours(18, Math.floor(Math.random() * 30)));
        totalHours = Number((Math.random() * 1 + 8).toFixed(2));
        note = "Full working day";
    }

    return {
        user: userId,
        date: dateStr,
        checkIn,
        checkOut,
        totalHours,
        status,
        note,
    };
}

async function seedData() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        console.log("MongoDB Connected");

        const userId = new mongoose.Types.ObjectId("69de2cc7754a3bdc00ae82cb");

        const attendanceData = [];

        const months = [
            { year: 2026, month: 1, days: 28 },
            { year: 2026, month: 2, days: 31 },
        ];

        months.forEach(({ year, month, days }) => {
            for (let d = 1; d <= days; d++) {
                const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

                let rand = Math.random();
                let status;

                if (rand < 0.1) status = "Absent";
                else if (rand < 0.25) status = "Half-day";
                else status = "Present";

                attendanceData.push(createAttendance(userId, dateStr, status));
            }
        });

        await Attendance.insertMany(attendanceData);

        console.log("✅ Attendance Seeded Successfully");
        process.exit();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

seedData();