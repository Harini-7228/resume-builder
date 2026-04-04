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

// Helper: strip app UI noise from PDF text before parsing
const cleanPdfText = (text) => {
    if (!text) return "";
    const uiNoise = [
        /resume\.\s*Hi,?\s*\w+\s*Logout/gi,
        /Back to Dashboard/gi,
        /Next\s*$/gim,
        /Template\s+Accent/gi,
        /Personal Information\s*Get Started with the personal information/gi,
        /Full Name \*/gi,
        /Email Address \*/gi,
        /Phone Number\s*$/gim,
        /Location\s*$/gim,
        /Profession\s*$/gim,
        /LinkedIn Profile\s*$/gim,
        /Personal Website\s*$/gim,
        /upload user image/gi,
        /Get Started with.*/gi,
        /Please login.*/gi,
        /Don't have an account.*/gi,
    ];
    let cleaned = text;
    for (const pattern of uiNoise) cleaned = cleaned.replace(pattern, "");
    return cleaned.replace(/\n{3,}/g, "\n\n").trim();
};

// Helper: parse resume text into structured data line-by-line
const parseResumeFallback = (rawText) => {
    const empty = { full_name: "", profession: "", email: "", phone: "", location: "", linkedin: "", website: "" };
    if (!rawText || typeof rawText !== "string") {
        return { professional_summary: "", skills: [], personal_info: empty, experience: [], project: [], education: [] };
    }

    const text = cleanPdfText(rawText);
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    const flat = lines.join(" ");

    // --- Contact info (regex on flat text) ---
    const email = flat.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
    const phone = flat.match(/(?:\+?\d[\d\s\-().]{5,}\d)/)?.[0]?.trim() || "";
    const linkedin = flat.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com(?:\/[^\s,<>"]*)?/i)?.[0] || "";
    const website = flat.match(/https?:\/\/(?!(?:www\.)?linkedin\.com)[^\s,<>"]+/i)?.[0] || "";
    const location = flat.match(/\b([A-Z][a-zA-Z\s]+,\s*(?:[A-Z]{2,3}|[A-Z][a-zA-Z]+))\b/)?.[1] || "";

    // --- Section detection ---
    const SECTION_RE = /^(CONTACT|SUMMARY|PROFESSIONAL SUMMARY|OBJECTIVE|EXPERIENCE|WORK EXPERIENCE|EDUCATION|SKILLS|PROJECTS?|CERTIFICATIONS?|ACHIEVEMENTS?|S UMMARY)$/i;
    const sections = {};
    let currentSection = "header";
    sections[currentSection] = [];

    for (const line of lines) {
        if (SECTION_RE.test(line.replace(/\s+/g, " "))) {
            currentSection = line.replace(/\s+/g, " ").toUpperCase().replace("S UMMARY", "SUMMARY").replace("WORK EXPERIENCE", "EXPERIENCE").replace("PROFESSIONAL SUMMARY", "SUMMARY");
            sections[currentSection] = [];
        } else {
            (sections[currentSection] = sections[currentSection] || []).push(line);
        }
    }

    // --- Name & profession from header ---
    const headerLines = sections["header"] || [];
    let full_name = "", profession = "";
    for (const line of headerLines) {
        if (!full_name && /^[A-Z][a-z]+(\s+[A-Z][a-z]+)+$/.test(line)) full_name = line;
        if (!profession && /developer|engineer|analyst|designer|manager|architect|specialist|consultant/i.test(line) && line.length < 60) profession = line;
    }
    // Also check first few lines of full text as name fallback
    if (!full_name) {
        for (const line of lines.slice(0, 10)) {
            if (/^[A-Z][a-z]+(\s+[A-Z][a-z]+)+$/.test(line)) { full_name = line; break; }
        }
    }

    // --- Summary ---
    const summaryLines = sections["SUMMARY"] || sections["OBJECTIVE"] || [];
    const professional_summary = summaryLines.join(" ").replace(/\s+/g, " ").trim();

    // --- Skills ---
    const skillLines = sections["SKILLS"] || [];
    const skills = skillLines
        .flatMap(l => l.split(/[,|\/•]/))
        .map(s => s.trim())
        .filter(s => s.length > 1 && s.length < 40 && !/^\d+$/.test(s));

    // --- Education ---
    const eduLines = sections["EDUCATION"] || [];
    const education = [];
    const DATE_RE = /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|\d{4}/i;
    let i = 0;
    while (i < eduLines.length) {
        const line = eduLines[i];
        if (/b\.?tech|b\.?e\.?|m\.?tech|bachelor|master|phd|mba|diploma|higher secondary|secondary school|high school|hsc|ssc|\bbs\b|\bms\b/i.test(line)) {
            const institution = eduLines[i + 1] || "";
            const dateStr = (eduLines[i + 1] + " " + (eduLines[i + 2] || "")).match(DATE_RE)?.[0] || "";
            education.push({ institution: institution.match(DATE_RE) ? "" : institution, degree: line, field: "", graduation_date: dateStr, gpa: "" });
            i += 2;
        } else { i++; }
    }

    // --- Experience ---
    const expLines = sections["EXPERIENCE"] || [];
    const experience = [];
    const DATE_RANGE_RE = /([A-Za-z]{3,9}\.?\s+\d{4})\s*[-–—]\s*((?:[A-Za-z]{3,9}\.?\s+\d{4})|Present|Current)/i;
    let currentExp = null;
    for (const line of expLines) {
        const dateMatch = line.match(DATE_RANGE_RE);
        if (dateMatch) {
            if (currentExp) experience.push(currentExp);
            const position = line.replace(dateMatch[0], "").trim();
            currentExp = {
                company: "", position,
                start_date: dateMatch[1]?.trim() || "",
                end_date: dateMatch[2]?.trim() || "",
                description: "",
                is_current: /present|current/i.test(dateMatch[2] || ""),
            };
        } else if (currentExp) {
            if (!currentExp.company && line.length < 60 && !line.startsWith("-") && !line.startsWith("•")) {
                currentExp.company = line;
            } else {
                currentExp.description = (currentExp.description + " " + line).trim();
            }
        }
    }
    if (currentExp) experience.push(currentExp);

    // --- Projects ---
    const projectLines = sections["PROJECT"] || sections["PROJECTS"] || [];
    const project = [];
    let currentProject = null;
    for (const line of projectLines) {
        if (/web application|mobile app|desktop|api|tool|system|platform|productivity|edtech/i.test(line) && currentProject) {
            currentProject.type = line;
        } else if (line.startsWith("-") || line.startsWith("•")) {
            if (currentProject) currentProject.description = (currentProject.description + " " + line.replace(/^[-•]\s*/, "")).trim();
        } else if (line.length < 60 && line.length > 3 && !DATE_RE.test(line)) {
            if (currentProject) project.push(currentProject);
            currentProject = { name: line, type: "", description: "" };
        } else if (currentProject) {
            currentProject.description = (currentProject.description + " " + line).trim();
        }
    }
    if (currentProject) project.push(currentProject);

    return {
        professional_summary,
        skills: skills.slice(0, 20),
        personal_info: { full_name, profession, email, phone, location, linkedin, website },
        experience: experience.slice(0, 10),
        project: project.slice(0, 10),
        education: education.slice(0, 6),
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

        // Clean UI noise and truncate
        const cleanedText = cleanPdfText(resumeText);
        safeResumeText = cleanedText.slice(0, 5000);
        console.log("Cleaned text length:", safeResumeText.length);

        const response = await callAIWithRetry({
            model: DEFAULT_AI_MODEL,
            messages: [
                {
                    role: "system",
                    content: `You are an expert resume parser. The text may come from a multi-column PDF so the order of words may be jumbled. Carefully identify and extract each resume section (name, profession, contact, summary, experience, education, skills, projects) and return ONLY a valid JSON object with no additional text, markdown, or explanation.`,
                },
                {
                    role: "user",
                    content: `Parse this resume text and return ONLY valid JSON matching exactly this structure (use empty strings/arrays for missing fields, never null):\n${RESUME_JSON_STRUCTURE}\n\nResume text:\n${safeResumeText}`,
                },
            ],
            temperature: 0.1,
        });

        let parsedData = extractJsonFromString(response.choices[0].message.content);
        if (!parsedData) {
            console.warn("AI returned invalid JSON, using fallback parser");
            parsedData = parseResumeFallback(resumeText);
        }

        const newResume = await Resume.create({
            userId, title,
            personal_info: parsedData.personal_info || {},
            professional_summary: parsedData.professional_summary || "",
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

        // Fallback: parse the text without AI and save structured result
        if (userId && title && safeResumeText) {
            try {
                console.log("AI failed, using regex fallback parser...");
                const fallbackData = parseResumeFallback(safeResumeText);
                const fallback = await Resume.create({
                    userId, title,
                    personal_info: fallbackData.personal_info || {},
                    professional_summary: fallbackData.professional_summary || "",
                    experience: fallbackData.experience || [],
                    project: fallbackData.project || [],
                    education: fallbackData.education || [],
                    skills: fallbackData.skills || [],
                });
                return res.status(200).json({
                    resumeId: fallback._id,
                    message: "Resume parsed and saved (some fields may need manual review)",
                });
            } catch (fallbackErr) {
                console.error("Fallback save failed:", fallbackErr.message);
            }
        }

        return res.status(500).json({ message: error.message || "Failed to process resume. Please try again." });
    }
};