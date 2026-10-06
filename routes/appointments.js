
const express = require("express");
const router = express.Router();

const db = require("../config/database");
const authMiddleware = require("../middleware/auth");
const roleMiddleware = require("../middleware/roleMiddleware");

// GET appointments
router.get("/", authMiddleware, async (req, res) => {
    try {
        let appointments;

        if (req.user.role === "admin") {
            [appointments] = await db.query(`
                SELECT
                    a.id,
                    a.patient_id,
                    a.doctor_id,
                    a.appointment_date,
                    a.appointment_time,
                    a.reason,
                    a.status,
                    a.created_at,
                    CONCAT(pu.first_name, ' ', pu.last_name) AS patient_name,
                    CONCAT(du.first_name, ' ', du.last_name) AS doctor_name,
                    d.specialization
                FROM appointments a
                JOIN patients p ON a.patient_id = p.id
                JOIN users pu ON p.user_id = pu.id
                JOIN doctors d ON a.doctor_id = d.id
                JOIN users du ON d.user_id = du.id
                ORDER BY a.appointment_date DESC, a.appointment_time DESC
            `);
        }

        else if (req.user.role === "doctor") {
            const [doctor] = await db.query(
                "SELECT id FROM doctors WHERE user_id = ?",
                [req.user.id]
            );

            if (doctor.length === 0) {
                return res.json([]);
            }

            [appointments] = await db.query(`
                SELECT
                    a.id,
                    a.patient_id,
                    a.doctor_id,
                    a.appointment_date,
                    a.appointment_time,
                    a.reason,
                    a.status,
                    a.created_at,
                    CONCAT(u.first_name, ' ', u.last_name) AS patient_name
                FROM appointments a
                JOIN patients p ON a.patient_id = p.id
                JOIN users u ON p.user_id = u.id
                WHERE a.doctor_id = ?
                ORDER BY a.appointment_date DESC, a.appointment_time DESC
            `, [doctor[0].id]);
        }

        else {
            const [patient] = await db.query(
                "SELECT id FROM patients WHERE user_id = ?",
                [req.user.id]
            );

            if (patient.length === 0) {
                return res.json([]);
            }

            [appointments] = await db.query(`
                SELECT
                    a.id,
                    a.patient_id,
                    a.doctor_id,
                    a.appointment_date,
                    a.appointment_time,
                    a.reason,
                    a.status,
                    a.created_at,
                    CONCAT(u.first_name, ' ', u.last_name) AS doctor_name,
                    d.specialization
                FROM appointments a
                JOIN doctors d ON a.doctor_id = d.id
                JOIN users u ON d.user_id = u.id
                WHERE a.patient_id = ?
                ORDER BY a.appointment_date DESC, a.appointment_time DESC
            `, [patient[0].id]);
        }

        res.json(appointments);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to fetch appointments"
        });
    }
});


// BOOK APPOINTMENT
router.post(
    "/",
    authMiddleware,
    roleMiddleware("patient"),
    async (req, res) => {
        try {
            const {
                doctor_id,
                appointment_date,
                appointment_time,
                reason
            } = req.body;

            if (
                !doctor_id ||
                !appointment_date ||
                !appointment_time
            ) {
                return res.status(400).json({
                    message: "Doctor, date and time are required"
                });
            }

            // FIND PATIENT
            const [patient] = await db.query(
                "SELECT id, user_id FROM patients WHERE user_id = ?",
                [req.user.id]
            );

            if (patient.length === 0) {
                return res.status(404).json({
                    message: "Patient profile not found"
                });
            }

            const patientId = patient[0].id;

            // FIND DOCTOR + DOCTOR USER ID
            const [doctor] = await db.query(`
                SELECT
                    d.id,
                    d.user_id,
                    CONCAT(u.first_name, ' ', u.last_name) AS doctor_name
                FROM doctors d
                JOIN users u ON d.user_id = u.id
                WHERE d.id = ?
            `, [doctor_id]);

            if (doctor.length === 0) {
                return res.status(404).json({
                    message: "Doctor not found"
                });
            }

            const doctorData = doctor[0];

            // CHECK TIME
            const [existing] = await db.query(`
                SELECT id
                FROM appointments
                WHERE doctor_id = ?
                AND appointment_date = ?
                AND appointment_time = ?
                AND status != 'rejected'
            `, [
                doctor_id,
                appointment_date,
                appointment_time
            ]);

            if (existing.length > 0) {
                return res.status(400).json({
                    message: "This appointment time is already booked"
                });
            }

            // CREATE APPOINTMENT
            const [result] = await db.query(`
                INSERT INTO appointments
                (
                    patient_id,
                    doctor_id,
                    appointment_date,
                    appointment_time,
                    reason,
                    status
                )
                VALUES (?, ?, ?, ?, ?, 'pending')
            `, [
                patientId,
                doctor_id,
                appointment_date,
                appointment_time,
                reason || null
            ]);

            // GET PATIENT NAME
            const [patientUser] = await db.query(`
                SELECT
                    CONCAT(first_name, ' ', last_name) AS patient_name
                FROM users
                WHERE id = ?
            `, [req.user.id]);

            const patientName =
                patientUser.length > 0
                    ? patientUser[0].patient_name
                    : "A patient";

            // NOTIFY DOCTOR
            await db.query(`
                INSERT INTO notifications
                (
                    user_id,
                    title,
                    message,
                    is_read
                )
                VALUES (?, ?, ?, FALSE)
            `, [
                doctorData.user_id,
                "New Appointment",
                `${patientName} booked an appointment with you for ${appointment_date} at ${appointment_time}.`
            ]);

            // GET ALL ADMINS
            const [admins] = await db.query(`
                SELECT id
                FROM users
                WHERE role = 'admin'
            `);

            // NOTIFY ALL ADMINS
            for (const admin of admins) {
                await db.query(`
                    INSERT INTO notifications
                    (
                        user_id,
                        title,
                        message,
                        is_read
                    )
                    VALUES (?, ?, ?, FALSE)
                `, [
                    admin.id,
                    "New Appointment",
                    `${patientName} booked an appointment with Dr. ${doctorData.doctor_name} for ${appointment_date} at ${appointment_time}.`
                ]);
            }

            res.status(201).json({
                message: "Appointment booked successfully",
                appointmentId: result.insertId
            });

        } catch (error) {
            console.error("Booking error:", error);

            res.status(500).json({
                message: "Failed to book appointment",
                error: error.message
            });
        }
    }
);


// DOCTOR / ADMIN APPROVE / REJECT / COMPLETE
router.put(
    "/:id/status",
    authMiddleware,
    roleMiddleware("doctor", "admin"),
    async (req, res) => {
        try {
            const { status } = req.body;

            if (!["confirmed", "rejected", "completed"].includes(status)) {
                return res.status(400).json({
                    message: "Invalid appointment status"
                });
            }

            const { id } = req.params;

            let result;

            // DOCTOR
            if (req.user.role === "doctor") {

                const [doctor] = await db.query(
                    "SELECT id FROM doctors WHERE user_id = ?",
                    [req.user.id]
                );

                if (doctor.length === 0) {
                    return res.status(403).json({
                        message: "Doctor profile not found"
                    });
                }

                [result] = await db.query(`
                    UPDATE appointments
                    SET status = ?
                    WHERE id = ?
                    AND doctor_id = ?
                `, [
                    status,
                    id,
                    doctor[0].id
                ]);

                if (result.affectedRows === 0) {
                    return res.status(404).json({
                        message: "Appointment not found"
                    });
                }

            }

            // ADMIN
            else {

                [result] = await db.query(
                    "UPDATE appointments SET status = ? WHERE id = ?",
                    [status, id]
                );

                if (result.affectedRows === 0) {
                    return res.status(404).json({
                        message: "Appointment not found"
                    });
                }
            }


            // GET APPOINTMENT + PATIENT
            const [appointmentData] = await db.query(`
                SELECT
                    a.patient_id,
                    p.user_id AS patient_user_id,
                    a.appointment_date,
                    a.appointment_time,
                    CONCAT(u.first_name, ' ', u.last_name) AS doctor_name
                FROM appointments a
                JOIN patients p ON a.patient_id = p.id
                JOIN doctors d ON a.doctor_id = d.id
                JOIN users u ON d.user_id = u.id
                WHERE a.id = ?
            `, [id]);


            if (appointmentData.length > 0) {

                const appointment = appointmentData[0];

                let title = "";
                let notificationMessage = "";

                if (status === "confirmed") {

                    title = "Appointment Confirmed";

                    notificationMessage =
                        `Your appointment with ${appointment.doctor_name} has been confirmed for ${appointment.appointment_date} at ${appointment.appointment_time}.`;

                }

                else if (status === "rejected") {

                    title = "Appointment Rejected";

                    notificationMessage =
                        `Your appointment with ${appointment.doctor_name} has been rejected.`;

                }

                else if (status === "completed") {

                    title = "Appointment Completed";

                    notificationMessage =
                        `Your appointment with ${appointment.doctor_name} has been completed.`;
                }


                // NOTIFY PATIENT
                await db.query(`
                    INSERT INTO notifications
                    (
                        user_id,
                        title,
                        message,
                        is_read
                    )
                    VALUES (?, ?, ?, FALSE)
                `, [
                    appointment.patient_user_id,
                    title,
                    notificationMessage
                ]);
            }


            res.json({
                message: `Appointment ${status} successfully`
            });

        } catch (error) {
            console.error("Appointment status error:", error);

            res.status(500).json({
                message: "Failed to update appointment"
            });
        }
    }
);


// DELETE APPOINTMENT
router.delete(
    "/:id",
    authMiddleware,
    roleMiddleware("admin"),
    async (req, res) => {
        try {
            const [result] = await db.query(
                "DELETE FROM appointments WHERE id = ?",
                [req.params.id]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    message: "Appointment not found"
                });
            }

            res.json({
                message: "Appointment deleted successfully"
            });

        } catch (error) {
            console.error(error);

            res.status(500).json({
                message: "Failed to delete appointment"
            });
        }
    }
);

module.exports = router;
