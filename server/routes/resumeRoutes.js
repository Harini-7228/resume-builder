import express from "express";
import protect from "../middlewares/authMiddleware.js";
import { createResume, updateResume, deleteResume, getResumeById, getPublicResumeById } from "../controllers/resumeController.js";
import { uploadImage } from "../configs/multer.js"; // ✅ use image multer, not PDF multer

const resumeRouter = express.Router();

resumeRouter.post('/create', protect, createResume);
resumeRouter.put('/update', protect, uploadImage.single('image'), updateResume); // ✅ protect BEFORE multer
resumeRouter.delete('/delete/:resumeId', protect, deleteResume);
resumeRouter.get('/get/:resumeId', protect, getResumeById);
resumeRouter.get('/public/:resumeId', getPublicResumeById);

export default resumeRouter;