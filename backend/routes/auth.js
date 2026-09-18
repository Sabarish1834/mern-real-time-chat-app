const router = require("express").Router();
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const auth = require("../middleware/auth");

// Get all users
router.get("/users", auth, async (req, res) => {
    try {
        const users = await User.find({
            username: { $ne: req.user.username },
        }).select("username");

        res.json(users);
    } catch (err) {
        console.log("Users Error", err.message);
        res.status(500).json({ error: err.message });
    }
});

// Register
router.post("/register", async (req, res) => {
    try {
        const { username, password } = req.body;

        const hashed = await bcrypt.hash(password, 10);

        await User.create({
            username,
            password: hashed,
        });

        res.json({
            message: "User created..!",
        });
    } catch (err) {
        res.status(400).json({
            error: "Username already taken",
        });
    }
});

// Login
router.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                error: "Username and Password required",
            });
        }

        const user = await User.findOne({ username });

        if (!user) {
            return res.status(400).json({
                error: "User not found",
            });
        }

        const match = await bcrypt.compare(password, user.password);

        if (!match) {
            return res.status(400).json({
                error: "Password incorrect!!",
            });
        }

        const token = jwt.sign(
            {
                id: user._id,
                username: user.username,
            },
            process.env.JWT_TOKEN,
            {
                expiresIn: "2d",
            }
        );

        res.json({
            token,
            username: user.username,
        });
    } catch (err) {
        console.error("LOGIN ERROR...", err.message);

        res.status(500).json({
            error: err.message,
        });
    }
});

module.exports = router;