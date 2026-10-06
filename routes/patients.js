
const express = require("express");
const router = express.Router();

const db = require("../config/database");
const authMiddleware = require("../middleware/auth");
const roleMiddleware = require("../middleware/roleMiddleware");

// ======================================================
// GET ALL PATIENTS
// Admin / Doctor only
// ======================================================
router.get(
    "/",
    authMiddleware,
    roleMiddleware("admin", "doctor"),
    async (req, res) => {
        try {
            const [patients] = await db.query(`
                SELECT
                    p.id,
                    p.user_id,
                    u.first_name,
                    u.last_name,
                    u.email,
                    p.phone,
                    p.gender,
                    p.date_of_birth,
                    p.address,
                    p.created_at
                FROM patients p
                JOIN users u ON p.user_id = u.id
                ORDER BY p.id DESC
            `);

            res.json(patients);

        } catch (error) {
            console.error("Error fetching patients:", error);

            res.status(500).json({
                message: "Failed to fetch patients",
                error: error.message
            });
        }
    }
);


// ======================================================
// GET MY PROFILE
// Patient only
// ======================================================
router.get(
    "/me",
    authMiddleware,
    roleMiddleware("patient"),
    async (req, res) => {
        try {

            const [patients] = await db.query(`
                SELECT
                    p.id,
                    p.user_id,
                    u.first_name,
                    u.last_name,
                    u.email,
                    u.role,
                    p.phone,
                    p.gender,
                    p.date_of_birth,
                    p.address,
                    p.created_at
                FROM patients p
                JOIN users u ON p.user_id = u.id
                WHERE p.user_id = ?
            `, [req.user.id]);

            if (patients.length === 0) {
                return res.status(404).json({
                    message: "Patient profile not found"
                });
            }

            res.json(patients[0]);

        } catch (error) {
            console.error("Error fetching my profile:", error);

            res.status(500).json({
                message: "Failed to fetch profile",
                error: error.message
            });
        }
    }
);


// ======================================================
// UPDATE MY PROFILE
// Patient only
// ======================================================
router.put(
    "/me",
    authMiddleware,
    roleMiddleware("patient"),
    async (req, res) => {
        try {

            const {
                phone,
                gender,
                date_of_birth,
                address
            } = req.body;

            if (!phone || !gender) {
                return res.status(400).json({
                    message: "Phone and gender are required"
                });
            }

            const [existingPatient] = await db.query(
                "SELECT id FROM patients WHERE user_id = ?",
                [req.user.id]
            );

            if (existingPatient.length === 0) {

                const [result] = await db.query(`
                    INSERT INTO patients
                    (
                        user_id,
                        phone,
                        gender,
                        date_of_birth,
                        address
                    )
                    VALUES (?, ?, ?, ?, ?)
                `, [
                    req.user.id,
                    phone,
                    gender,
                    date_of_birth || null,
                    address || null
                ]);

                return res.status(201).json({
                    message: "Profile created successfully",
                    patientId: result.insertId
                });
            }

            await db.query(`
                UPDATE patients
                SET
                    phone = ?,
                    gender = ?,
                    date_of_birth = ?,
                    address = ?
                WHERE user_id = ?
            `, [
                phone,
                gender,
                date_of_birth || null,
                address || null,
                req.user.id
            ]);

            res.json({
                message: "Profile updated successfully"
            });

        } catch (error) {
            console.error("Error updating profile:", error);

            res.status(500).json({
                message: "Failed to update profile",
                error: error.message
            });
        }
    }
);


// ======================================================
// CREATE PATIENT
// Admin only
// ======================================================
router.post(
    "/",
    authMiddleware,
    roleMiddleware("admin"),
    async (req, res) => {
        try {

            const {
                user_id,
                phone,
                gender,
                date_of_birth,
                address
            } = req.body;

            if (!user_id || !phone || !gender) {
                return res.status(400).json({
                    message: "user_id, phone and gender are required"
                });
            }

            const [existing] = await db.query(
                "SELECT id FROM patients WHERE user_id = ?",
                [user_id]
            );

            if (existing.length > 0) {
                return res.status(400).json({
                    message: "Patient profile already exists"
                });
            }

            const [result] = await db.query(
                `INSERT INTO patients
                (
                    user_id,
                    phone,
                    gender,
                    date_of_birth,
                    address
                )
                VALUES (?, ?, ?, ?, ?)`,
                [
                    user_id,
                    phone,
                    gender,
                    date_of_birth || null,
                    address || null
                ]
            );

            res.status(201).json({
                message: "Patient created successfully",
                patientId: result.insertId
            });

        } catch (error) {
            console.error("Error creating patient:", error);

            res.status(500).json({
                message: "Failed to create patient",
                error: error.message
            });
        }
    }
);


module.exports = router;