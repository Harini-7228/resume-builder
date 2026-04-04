import express from "express";
import { registerUser, loginUser, getUserById, forgotPassword, resetPassword } from "../controllers/userController.js";
import protect from "../middlewares/authMiddleware.js";
import { getUserResumes } from "../controllers/userController.js";

const userRouter = express.Router();

userRouter.post("/register", registerUser);
userRouter.post("/login", loginUser);
userRouter.post("/forgot-password", forgotPassword);
userRouter.post("/reset-password", resetPassword);
userRouter.get("/data", protect, getUserById);
userRouter.get("/resumes", protect, getUserResumes);

export default userRouter;
