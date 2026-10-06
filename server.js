
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const db = require("./config/database");

const patientsRoutes = require("./routes/patients");
const doctorsRoutes = require("./routes/doctors");
const appointmentsRoutes = require("./routes/appointments");
const authRoutes = require("./routes/auth");
const medicalRecordsRoutes = require("./routes/medicalRecords");
const paymentsRoutes = require("./routes/payments");
const notificationsRoutes = require("./routes/notifications");

const authMiddleware = require("./middleware/auth");
const roleMiddleware = require("./middleware/roleMiddleware");

const app = express();

// GLOBAL MIDDLEWARE
app.use(cors());
app.use(express.json());

// ROUTES
app.use("/api/auth", authRoutes);
app.use("/api/patients", patientsRoutes);
app.use("/api/doctors", doctorsRoutes);
app.use("/api/appointments", appointmentsRoutes);
app.use("/api/medical-records", medicalRecordsRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/notifications", notificationsRoutes);

// MEDICAL RECORDS TEST
app.get("/api/medical-test", (req, res) => {
    res.json({
        message: "Medical records route is working"
    });
});

// HOME
app.get("/", (req, res) => {
    res.json({
        message: "Harme Medium Clinic Backend is running"
    });
});

// TEST
app.get("/test", (req, res) => {
    res.send("TEST WORKING");
});

// PROTECTED
app.get(
    "/api/protected",
    authMiddleware,
    (req, res) => {
        res.json({
            message: "Protected route accessed successfully",
            user: req.user
        });
    }
);

// ADMIN
app.get(
    "/api/admin",
    authMiddleware,
    roleMiddleware("admin"),
    (req, res) => {
        res.json({
            message: "Welcome Admin",
            user: req.user
        });
    }
);

// DOCTOR
app.get(
    "/api/doctor",
    authMiddleware,
    roleMiddleware("doctor"),
    (req, res) => {
        res.json({
            message: "Welcome Doctor",
            user: req.user
        });
    }
);

// PATIENT
app.get(
    "/api/patient",
    authMiddleware,
    roleMiddleware("patient"),
    (req, res) => {
        res.json({
            message: "Welcome Patient",
            user: req.user
        });
    }
);

// DATABASE TEST
db.getConnection()
    .then(connection => {
        console.log("MySQL database connected successfully!");
        connection.release();
    })
    .catch(error => {
        console.error(
            "MySQL connection failed:",
            error.message
        );
    });

// START SERVER
const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
    console.log(
        `Harme Medium Clinic server running on port ${PORT}`
    );
});

