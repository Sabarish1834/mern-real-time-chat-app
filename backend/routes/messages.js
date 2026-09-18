const router = require("express").Router();

const Message = require("../models/Message");
const auth = require("../middleware/auth");

// Get messages between two users
router.get("/:receiver", auth, async (req, res) => {
    try {
        const { receiver } = req.params;
        const sender = req.user.username;

        const messages = await Message.find({
            $or: [
                { sender, receiver },
                { sender: receiver, receiver: sender },
            ],
        }).sort({ createdAt: 1 });

        res.json(messages);
    } catch (err) {
        console.error("GET MESSAGES ERROR...", err.message);

        res.status(500).json({
            error: err.message,
        });
    }
});

// Send message to a specific user
router.post("/", auth, async (req, res) => {
    try {
        const { text, receiver } = req.body;

        if (!text || !receiver) {
            return res.status(400).json({
                error: "Message and receiver are required",
            });
        }

        const message = await Message.create({
            sender: req.user.username,
            receiver,
            text,
            status: "sent",
        });

        res.json(message);
    } catch (err) {
        console.error("SEND MESSAGE ERROR...", err.message);

        res.status(500).json({
            error: err.message,
        });
    }
});

// Update message status
router.patch("/:messageId/status", auth, async (req, res) => {
    try {
        const { messageId } = req.params;
        const { status } = req.body;

        if (!["sent", "delivered", "seen"].includes(status)) {
            return res.status(400).json({
                error: "Invalid message status",
            });
        }

        const message = await Message.findById(messageId);

        if (!message) {
            return res.status(404).json({
                error: "Message not found",
            });
        }

        // Only receiver can change message status
        if (message.receiver !== req.user.username) {
            return res.status(403).json({
                error: "You cannot update this message status",
            });
        }

        message.status = status;

        await message.save();

        res.json(message);
    } catch (err) {
        console.error("UPDATE STATUS ERROR...", err.message);

        res.status(500).json({
            error: err.message,
        });
    }
});

module.exports = router;