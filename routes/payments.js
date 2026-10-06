const express = require("express");
const router = express.Router();

const db = require("../config/database");
const authMiddleware = require("../middleware/auth");
const roleMiddleware = require("../middleware/roleMiddleware");


// GET payments
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

            const [payments] = await db.query(`
                SELECT *
                FROM payments
                WHERE patient_id = ?
                ORDER BY payment_date DESC
            `, [patient[0].id]);

            return res.json(payments);
        }


        const [payments] = await db.query(`
            SELECT
                p.*,
                CONCAT(u.first_name, ' ', u.last_name) AS patient_name
            FROM payments p
            JOIN patients pt ON p.patient_id = pt.id
            JOIN users u ON pt.user_id = u.id
            ORDER BY p.payment_date DESC
        `);

        res.json(payments);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to fetch payments"
        });
    }
});


// CREATE PAYMENT RECORD
router.post(
    "/",
    authMiddleware,
    roleMiddleware("patient", "admin"),
    async (req, res) => {
        try {

            const {
                amount,
                payment_method,
                transaction_id,
                description
            } = req.body;

            if (!amount || !payment_method) {
                return res.status(400).json({
                    message: "Amount and payment method are required"
                });
            }

            let patientId;

            if (req.user.role === "patient") {

                const [patient] = await db.query(
                    "SELECT id FROM patients WHERE user_id = ?",
                    [req.user.id]
                );

                if (patient.length === 0) {
                    return res.status(404).json({
                        message: "Patient profile not found"
                    });
                }

                patientId = patient[0].id;

            } else {
                patientId = req.body.patient_id;
            }

            const [result] = await db.query(`
                INSERT INTO payments
                (
                    patient_id,
                    amount,
                    payment_method,
                    transaction_id,
                    description,
                    status
                )
                VALUES (?, ?, ?, ?, ?, 'pending')
            `, [
                patientId,
                amount,
                payment_method,
                transaction_id || null,
                description || null
            ]);

            res.status(201).json({
                message: "Payment record created",
                paymentId: result.insertId
            });

        } catch (error) {
            console.error(error);

            res.status(500).json({
                message: "Failed to create payment"
            });
        }
    }
);

module.exports = router;