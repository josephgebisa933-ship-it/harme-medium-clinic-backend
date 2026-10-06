const express = require("express");
const router = express.Router();

const db = require("../config/database");
const authMiddleware = require("../middleware/auth");


// GET my notifications
router.get("/", authMiddleware, async (req, res) => {
    try {

        const [notifications] = await db.query(`
            SELECT *
            FROM notifications
            WHERE user_id = ?
            ORDER BY created_at DESC
        `, [req.user.id]);

        res.json(notifications);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to fetch notifications"
        });
    }
});


// MARK AS READ
router.put("/:id/read", authMiddleware, async (req, res) => {
    try {

        const [result] = await db.query(`
            UPDATE notifications
            SET is_read = TRUE
            WHERE id = ?
            AND user_id = ?
        `, [
            req.params.id,
            req.user.id
        ]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "Notification not found"
            });
        }

        res.json({
            message: "Notification marked as read"
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to update notification"
        });
    }
});

module.exports = router;