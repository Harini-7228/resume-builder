import { PDFParse } from "pdf-parse";

import Resume from "../models/Resume.js";
import ai from "../configs/ai.js";

const DEFAULT_AI_MODEL = process.env.OPENAI_MODEL || "grok-3-mini";

// Helper: extract JSON from AI response string
const extractJsonFromString = (text) => {
    if (!text || typeof text !== "string") return null;
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return null;
    try {
        return JSON.parse(text.slice(start, end + 1));
    } catch {
        return null;
    }
};

// Helper: regex-based fallback parser if AI JSON fails
const parseResumeFallback = (text) => {
    const raw = typeof text === "string" ? text.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim() : "";
    const email = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
    const phone = raw.match(/\+?[0-9][0-9().\s-]{6,}[0-9]/)?.[0] || "";
    const linkedin = raw.match(/https?:\/\/(?:www\.)?linkedin\.com[^\s,]*/i)?.[0] || "";
    const skillsMatch = raw.match(/SKILLS[:\s]*([A-Za-z0-9,/\s-]+)/i);
    const skills = skillsMatch
        ? skillsMatch[1].split(/[,/\n]/).map((s) => s.trim()).filter(Boolean)
        : [];
    return {
        professional_summary: raw.slice(0, 600),
        skills,
        personal_info: { full_name: "", profession: "", email, phone, location: "", linkedin, website: "" },
        experience: [],
        project: [],
        education: [],
    };
};

// AI caller with exponential backoff retry on 429
const callAIWithRetry = async (params, maxRetries = 2, initialDelay = 500) => {
    let lastError;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            console.log(`AI call attempt ${attempt + 1}/${maxRetries}`);
            return await ai.chat.completions.create(params);
        } catch (error) {
            lastError = error;
            if (error.status === 429) {
                const delay = initialDelay * Math.pow(2, attempt);
                console.log(`Rate limited. Waiting ${delay}ms before retry ${attempt + 1}/${maxRetries}...`);
                await new Promise((resolve) => setTimeout(resolve, delay));
                continue;
            }
            throw error; // Don't retry on other errors
        }
    }
    throw lastError;
};

const RESUME_JSON_STRUCTURE = `{
  "professional_summary": "",
  "skills": [],
  "personal_info": {
    "full_name": "", "profession": "", "email": "",
    "phone": "", "location": "", "linkedin": "", "website": ""
  },
  "experience": [{ "company": "", "position": "", "start_date": "", "end_date": "", "description": "", "is_current": false }],
  "project": [{ "name": "", "type": "", "description": "" }],
  "education": [{ "institution": "", "degree": "", "field": "", "graduation_date": "", "gpa": "" }]
}`;

// POST /api/ai/enhance-pro-sum
export const enhanceProfessionalSummary = async (req, res) => {
    try {
        const { userContent } = req.body;
        if (!userContent) return res.status(400).json({ message: "Missing required fields" });

        const response = await callAIWithRetry({
            model: DEFAULT_AI_MODEL,
            messages: [
                {
                    role: "system",
                    content: "You are an expert resume writer. Enhance the professional summary to be 1-2 compelling sentences highlighting key skills, experience, and career objectives. Make it ATS-friendly. Return only the text, no options or formatting.",
                },
                { role: "user", content: userContent },
            ],
        });
        return res.status(200).json({ enhancedContent: response.choices[0].message.content });
    } catch (error) {
        console.error("AI Enhance Summary Error:", error);
        return res.status(error.status || 500).json({ message: error.message || "AI service error" });
    }
};

// POST /api/ai/enhance-job-desc
export const enhanceJobDescription = async (req, res) => {
    try {
        const { userContent } = req.body;
        if (!userContent) return res.status(400).json({ message: "Missing required fields" });

        const response = await callAIWithRetry({
            model: DEFAULT_AI_MODEL,
            messages: [
                {
                    role: "system",
                    content: "You are an expert resume writer. Enhance the job description to be 1-2 sentences highlighting key responsibilities and achievements using action verbs and quantifiable results. Make it ATS-friendly. Return only the text, no options or formatting.",
                },
                { role: "user", content: userContent },
            ],
        });
        return res.status(200).json({ enhancedContent: response.choices[0].message.content });
    } catch (error) {
        console.error("AI Enhance Job Desc Error:", error);
        return res.status(error.status || 500).json({ message: error.message || "AI service error" });
    }
};

// POST /api/ai/upload-resume (text-based upload)
export const uploadResume = async (req, res) => {
    try {
        const { resumeText, title } = req.body;
        const userId = req.userId;

        if (!resumeText) return res.status(400).json({ message: "Resume text is required" });
        if (!title) return res.status(400).json({ message: "Resume title is required" });
        if (!userId) return res.status(401).json({ message: "User not authenticated" });

        const safeText = resumeText.slice(0, 5000);
        console.log("Text-based resume upload for user:", userId, "length:", safeText.length);

        const response = await callAIWithRetry({
            model: DEFAULT_AI_MODEL,
            messages: [
                { role: "system", content: "You are an expert resume parser. Extract structured data and return valid JSON only." },
                { role: "user", content: `Parse this resume and return ONLY valid JSON matching this structure (use empty strings for missing fields):\n${RESUME_JSON_STRUCTURE}\n\nResume text:\n${safeText}` },
            ],
            temperature: 0.3,
        });

        let parsedData = extractJsonFromString(response.choices[0].message.content);
        if (!parsedData) parsedData = parseResumeFallback(safeText);

        const newResume = await Resume.create({
            userId, title,
            personal_info: parsedData.personal_info || {},
            professional_summary: parsedData.professional_summary || safeText.slice(0, 600),
            experience: parsedData.experience || [],
            project: parsedData.project || [],
            education: parsedData.education || [],
            skills: parsedData.skills || [],
        });

        console.log("Resume created:", newResume._id);
        return res.json({ resumeId: newResume._id, message: "Resume uploaded successfully" });
    } catch (error) {
        console.error("Upload Resume Error:", error.message);
        if (error.status === 429) return res.status(429).json({ message: "AI service is busy. Please try again in 30 seconds." });
        return res.status(error.status || 500).json({ message: error.message || "Failed to process resume" });
    }
};

// POST /api/ai/upload-resume-file (PDF file upload)
export const uploadResumeFile = async (req, res) => {
    let title, userId, safeResumeText = "";

    try {
        console.log("=== PDF Resume Upload ===");

        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded. Send a PDF as the 'resume' form field." });
        }

        title = req.body.title;
        userId = req.userId;

        if (!title) return res.status(400).json({ message: "Resume title is required" });
        if (!userId) return res.status(401).json({ message: "User not authenticated" });
        if (!process.env.GROK_API_KEY) return res.status(500).json({ message: "GROK_API_KEY is not set in .env" });

        console.log("File:", req.file.originalname, "Size:", req.file.size);

        // Parse PDF buffer using pdf-parse v2
        let resumeText;
        try {
            const parser = new PDFParse({ data: req.file.buffer });
            const parsed = await parser.getText();
            resumeText = parsed.text || "";
            console.log("PDF parsed, text length:", resumeText.length);
        } catch (pdfErr) {
            console.error("PDF parse error:", pdfErr.message);
            return res.status(400).json({ message: `Failed to read PDF: ${pdfErr.message}` });
        }

        if (!resumeText.trim()) {
            return res.status(400).json({ message: "Could not extract text. PDF may be image-based or empty." });
        }

        safeResumeText = resumeText.slice(0, 5000);

        const response = await callAIWithRetry({
            model: DEFAULT_AI_MODEL,
            messages: [
                { role: "system", content: "You are an expert resume parser. Extract structured data and return valid JSON only." },
                { role: "user", content: `Parse this resume and return ONLY valid JSON matching this structure (use empty strings for missing fields):\n${RESUME_JSON_STRUCTURE}\n\nResume text:\n${safeResumeText}` },
            ],
            temperature: 0.3,
        });

        let parsedData = extractJsonFromString(response.choices[0].message.content);
        if (!parsedData) parsedData = parseResumeFallback(safeResumeText);

        const newResume = await Resume.create({
            userId, title,
            personal_info: parsedData.personal_info || {},
            professional_summary: parsedData.professional_summary || safeResumeText.slice(0, 600),
            experience: parsedData.experience || [],
            project: parsedData.project || [],
            education: parsedData.education || [],
            skills: parsedData.skills || [],
        });

        console.log("Resume created:", newResume._id);
        return res.status(200).json({ resumeId: newResume._id, message: "Resume uploaded and parsed successfully" });

    } catch (error) {
        console.error("Upload Resume File Error:", { status: error.status, message: error.message, name: error.name });

        if (error.status === 429) {
            return res.status(429).json({ message: "AI service is busy. Please try again in 30 seconds." });
        }

        // Fallback: save what we extracted even if AI failed
        if (userId && title) {
            try {
                const fallback = await Resume.create({
                    userId, title,
                    personal_info: {},
                    professional_summary: safeResumeText.slice(0, 600),
                    experience: [], project: [], education: [], skills: [],
                });
                return res.status(200).json({
                    resumeId: fallback._id,
                    message: "Resume saved (AI parsing failed - you can edit it manually)",
                });
            } catch (fallbackErr) {
                console.error("Fallback save failed:", fallbackErr.message);
            }
        }

        return res.status(500).json({ message: error.message || "Failed to process resume. Please try again." });
    }
};