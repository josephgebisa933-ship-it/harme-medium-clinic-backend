const express = require("express");
const router = express.Router();

const db = require("../config/database");
const authMiddleware = require("../middleware/auth");
const roleMiddleware = require("../middleware/roleMiddleware");


// GET records
router.get("/", authMiddleware, async (req, res) => {
    try {

        if (req.user.role === "patient") {

            const [patient] = await db.query(
                "SELECT id FROM patients WHERE user_id = ?",
                [req.user.id]
            );

            if (patient.length === 0) {
                return res.json([]);
            }

            const [records] = await db.query(`
                SELECT
                    mr.*,
                    CONCAT(u.first_name, ' ', u.last_name) AS doctor_name,
                    d.specialization
                FROM medical_records mr
                JOIN doctors d ON mr.doctor_id = d.id
                JOIN users u ON d.user_id = u.id
                WHERE mr.patient_id = ?
                ORDER BY mr.record_date DESC
            `, [patient[0].id]);

            return res.json(records);
        }


        if (req.user.role === "doctor") {

            const [doctor] = await db.query(
                "SELECT id FROM doctors WHERE user_id = ?",
                [req.user.id]
            );

            if (doctor.length === 0) {
                return res.json([]);
            }

            const [records] = await db.query(`
                SELECT
                    mr.*,
                    CONCAT(u.first_name, ' ', u.last_name) AS patient_name
                FROM medical_records mr
                JOIN patients p ON mr.patient_id = p.id
                JOIN users u ON p.user_id = u.id
                WHERE mr.doctor_id = ?
                ORDER BY mr.record_date DESC
            `, [doctor[0].id]);

            return res.json(records);
        }


        const [records] = await db.query(`
            SELECT
                mr.*,
                CONCAT(pu.first_name, ' ', pu.last_name) AS patient_name,
                CONCAT(du.first_name, ' ', du.last_name) AS doctor_name
            FROM medical_records mr
            JOIN patients p ON mr.patient_id = p.id
            JOIN users pu ON p.user_id = pu.id
            JOIN doctors d ON mr.doctor_id = d.id
            JOIN users du ON d.user_id = du.id
            ORDER BY mr.record_date DESC
        `);

        res.json(records);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to fetch medical records"
        });
    }
});


// CREATE RECORD
router.post(
    "/",
    authMiddleware,
    roleMiddleware("doctor", "admin"),
    async (req, res) => {
        try {

            const {
                patient_id,
                diagnosis,
                prescription,
                treatment,
                record_date
            } = req.body;

            if (!patient_id || !diagnosis || !record_date) {
                return res.status(400).json({
                    message: "Patient, diagnosis and date are required"
                });
            }

            let doctorId;

            if (req.user.role === "doctor") {

                const [doctor] = await db.query(
                    "SELECT id FROM doctors WHERE user_id = ?",
                    [req.user.id]
                );

                if (doctor.length === 0) {
                    return res.status(404).json({
                        message: "Doctor profile not found"
                    });
                }

                doctorId = doctor[0].id;

            } else {
                doctorId = req.body.doctor_id;
            }

            const [result] = await db.query(`
                INSERT INTO medical_records
                (
                    patient_id,
                    doctor_id,
                    diagnosis,
                    prescription,
                    treatment,
                    record_date
                )
                VALUES (?, ?, ?, ?, ?, ?)
            `, [
                patient_id,
                doctorId,
                diagnosis,
                prescription || null,
                treatment || null,
                record_date
            ]);

            res.status(201).json({
                message: "Medical record created successfully",
                recordId: result.insertId
            });

        } catch (error) {
            console.error(error);

            res.status(500).json({
                message: "Failed to create medical record"
            });
        }
    }
);

module.exports = router;