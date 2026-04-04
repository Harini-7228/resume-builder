import User from "../models/User.js"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import Resume from "../models/Resume.js"
import crypto from "crypto"
import nodemailer from "nodemailer"

const generateToken = (userId) => {
    const token = jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: "7d" })
    return token;
}

const createTransporter = () => {
    if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        return nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: Number(process.env.EMAIL_PORT) || 587,
            secure: process.env.EMAIL_SECURE === 'true',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        })
    }
    return null;
}

const sendPasswordResetEmail = async (email, resetUrl) => {
    const transporter = createTransporter();
    const subject = 'Password Reset Request';
    const html = `<p>You requested a password reset. Click the link below to reset your password:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you did not request this, ignore this email.</p>`;

    if (!transporter) {
        console.log('Password reset email not sent because email transport is not configured. Reset URL:', resetUrl);
        return;
    }

    await transporter.sendMail({
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to: email,
        subject,
        html
    });
}

// controller for user registration
// POST: /api/users/register

export const registerUser = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // check if required fields are present
        if (!name || !email || !password) {
            return res.status(400).json({ message: "Missing required fields" })
        }

        // check if user already exists
        const user = await User.findOne({ email: email.toLowerCase() })
        if (user) {
            return res.status(400).json({ message: "User already exists" })
        }

        //create new user
        const hashedPassword = await bcrypt.hash(password, 10)
        const newUser = await User.create({
            name, email: email.toLowerCase(), password: hashedPassword
        })

        const token = generateToken(newUser._id)
        newUser.password = undefined;
        return res.status(201).json({ message: "User registered successfully", user: newUser, token })

    } catch (error) {
        return res.status(400).json({ message: error.message })
    }
}

// controller for user login
// POST: /api/users/login

export const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        // check if user exists
        const user = await User.findOne({ email: email.toLowerCase() })
        if (!user) {
            console.log(`Login failed: User not found for email ${email}`);
            return res.status(400).json({ message: "Invalid email or password" })
        }

        // check if password is correct
        if (!user.comparePassword(password)) {
            console.log(`Login failed: Incorrect password for email ${email}`);
            return res.status(400).json({ message: "Invalid email or password" })
        }

        // generate token
        const token = generateToken(user._id)
        user.password = undefined;
        return res.status(200).json({ message: "Login successful", user, token })

    } catch (error) {
        return res.status(400).json({ message: error.message })
    }
}

// controller for getting user by id
// GET: /api/users/data
export const getUserById = async (req, res) => {
    try {
        const userId = req.userId;
        // check if user exists
        const user = await User.findById(userId)
        if (!user) {
            return res.status(404).json({ message: "User not found" })
        }
        // return user
        user.password = undefined;

        return res.status(200).json({ user })

    } catch (error) {
        return res.status(400).json({ message: error.message })
    }
}

// controller for getting user resumes
// GET: /api/users/resumes
export const getUserResumes = async (req, res) => {
    try {
        const userId = req.userId;
        // return user resumes
        const resumes = await Resume.find({ userId })
        return res.status(200).json({ resumes })
    } catch (error) {
        return res.status(400).json({ message: error.message })
    }
}

// controller for forgot password
// POST: /api/users/forgot-password
export const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(200).json({ message: "If your email exists, a reset link was sent." });
        }

        const resetToken = crypto.randomBytes(32).toString("hex");
        const resetTokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");
        user.resetPasswordToken = resetTokenHash;
        user.resetPasswordExpires = Date.now() + 1000 * 60 * 60; // 1 hour
        await user.save();

        const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
        const resetUrl = `${clientUrl}/login?state=reset&token=${resetToken}`;
        await sendPasswordResetEmail(user.email, resetUrl);

        return res.status(200).json({ message: "If your email exists, a reset link was sent." });
    } catch (error) {
        console.error("Forgot password error:", error);
        return res.status(500).json({ message: "Unable to process password reset request." });
    }
}

// controller for reset password
// POST: /api/users/reset-password
export const resetPassword = async (req, res) => {
    try {
        const { token, password } = req.body;
        if (!token || !password) {
            return res.status(400).json({ message: "Token and new password are required" });
        }

        const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
        const user = await User.findOne({
            resetPasswordToken: tokenHash,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: "Invalid or expired reset token" });
        }

        user.password = await bcrypt.hash(password, 10);
        user.resetPasswordToken = '';
        user.resetPasswordExpires = undefined;
        await user.save();

        return res.status(200).json({ message: "Password reset successful. You can now login with your new password." });
    } catch (error) {
        console.error("Reset password error:", error);
        return res.status(500).json({ message: "Unable to reset password." });
    }
}
