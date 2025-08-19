const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const router = express.Router();

// User schema
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
module.exports.User = User;

// Signup route
router.post("/auth/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      name,
      email,
      password: hashedPassword,
    });

    await user.save();

    const token = jwt.sign({ userId: user._id }, "secret", { expiresIn: "1h" });
    res.status(201).json({ token, message: "User created successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

// Login route
router.post("/auth/login", async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });

    if (user && (await bcrypt.compare(req.body.password, user.password))) {
      const token = jwt.sign({ userId: user._id }, "secret", {
        expiresIn: "1h",
      });
      res.json({ token, message: "Login successful" });
    } else {
      res.status(401).json({ error: "Invalid Credentials" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

// JWT middleware
function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;

  try {
    if (authHeader) {
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, "secret");
      req.user = decoded; // attach decoded user to request
      next();
    } else {
      res.status(401).json({ error: "Token not found. Unauthorized request" });
    }
  } catch (error) {
    res.status(403).json({ error: "Invalid or expired token" });
  }
}

module.exports = { router, authenticateJWT };
