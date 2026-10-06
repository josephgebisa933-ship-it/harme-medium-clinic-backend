const express = require("express");
const router = express.Router();
const db = require("../config/database");

// GET all doctors
router.get("/", async (req, res) => {
    try {
        const [doctors] = await db.query(`
            SELECT
                id,
                user_id,
                specialization,
                phone,
                created_at
            FROM doctors
            ORDER BY id DESC
        `);

        res.json(doctors);

    } catch (error) {
        console.error("Error fetching doctors:", error);

        res.status(500).json({
            message: "Failed to fetch doctors",
            error: error.message
        });
    }
});

// POST create a new doctor
router.post("/", async (req, res) => {
    try {
        const {
            user_id,
            specialization,
            phone
        } = req.body;

        if (!user_id || !specialization || !phone) {
            return res.status(400).json({
                message: "user_id, specialization and phone are required"
            });
        }

        const [result] = await db.query(
            `INSERT INTO doctors
            (user_id, specialization, phone)
            VALUES (?, ?, ?)`,
            [
                user_id,
                specialization,
                phone
            ]
        );

        res.status(201).json({
            message: "Doctor created successfully",
            doctorId: result.insertId
        });

    } catch (error) {
        console.error("Error creating doctor:", error);

        res.status(500).json({
            message: "Failed to create doctor",
            error: error.message
        });
    }
});

module.exports = router;