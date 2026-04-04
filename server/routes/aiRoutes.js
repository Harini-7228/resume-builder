import express from "express";
import protect from "../middlewares/authMiddleware.js";
import { enhanceJobDescription, enhanceProfessionalSummary, uploadResume, uploadResumeFile } from "../controllers/aiController.js";
import { uploadPDF } from "../configs/multer.js"; // ✅ use PDF multer explicitly

const aiRouter = express.Router();

aiRouter.post('/enhance-pro-sum', protect, enhanceProfessionalSummary);
aiRouter.post('/enhance-job-desc', protect, enhanceJobDescription);
aiRouter.post('/upload-resume', protect, uploadResume);
aiRouter.post('/upload-resume-file', protect, uploadPDF.single('resume'), uploadResumeFile);
aiRouter.post('/upload', protect, uploadPDF.single('resume'), uploadResumeFile);

export default aiRouter;