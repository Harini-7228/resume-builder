import { PDFParse } from "pdf-parse";

import Resume from "../models/Resume.js";
import ai from "../configs/ai.js";

const DEFAULT_AI_MODEL = process.env.OPENAI_MODEL || "llama-3.3-70b-versatile";
const FAST_AI_MODEL = "llama3-8b-8192";
const POSITION_KEYWORDS = /(?:developer|engineer|analyst|manager|specialist|lead|architect|consultant|representative|assistant|head|coordinator|administrator|supervisor|designer|officer|associate|intern|vp|director|c-level|consultant|technician|representative|agent|clerk|specialist|writer|editor|accountant|auditor|consultant)\b/i;

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
    const phone = flat.match(/(?:\+?\d[\d\s\-().]{8,}\d)/)?.[0]?.trim() || "";
    const linkedin = flat.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com(?:\/[^\s,<>"]*)?/i)?.[0] || "";
    const website = flat.match(/https?:\/\/(?!(?:www\.)?linkedin\.com)[^\s,<>"]+/i)?.[0] || "";
    
    // Look for City, State/Country (e.g., NY, USA or New York, NY)
    const locationMatch = flat.match(/\b([A-Z][a-z\s]+,\s*[A-Z]{2,3})\b|\b([A-Z][a-z\s]+,\s*[A-Z][a-z\s]+)\b/);
    const location = locationMatch ? (locationMatch[1] || locationMatch[2]) : "";

    // --- Section detection ---
    // ... rest of the logic remains ...
    const SECTION_RE = /^(CONTACT|SUMMARY|PROFESSIONAL SUMMARY|OBJECTIVE|EXPERIENCE|WORK EXPERIENCE|PROFESSIONAL EXPERIENCE|WORK HISTORY|EMPLOYMENT|EMPLOYMENT HISTORY|CAREER HISTORY|EDUCATION|ACADEMIC BACKGROUND|SKILLS|TECHNICAL SKILLS|TECHNICAL SUMMARY|PROJECTS?|CERTIFICATIONS?|ACHIEVEMENTS?|AWARDS & HONORS|AWARDS|S UMMARY)$/i;
    const sections = {};
    let currentSection = "header";
    sections[currentSection] = [];

    for (const line of lines) {
        const cleanedLine = line.replace(/\s+/g, " ").trim();
        if (SECTION_RE.test(cleanedLine)) {
            currentSection = cleanedLine.toUpperCase()
                .replace("S UMMARY", "SUMMARY")
                .replace("WORK EXPERIENCE", "EXPERIENCE")
                .replace("PROFESSIONAL EXPERIENCE", "EXPERIENCE")
                .replace("WORK HISTORY", "EXPERIENCE")
                .replace("EMPLOYMENT HISTORY", "EXPERIENCE")
                .replace("EMPLOYMENT", "EXPERIENCE")
                .replace("CAREER HISTORY", "EXPERIENCE")
                .replace("PROFESSIONAL SUMMARY", "SUMMARY")
                .replace("ACADEMIC BACKGROUND", "EDUCATION")
                .replace("TECHNICAL SKILLS", "SKILLS")
                .replace("TECHNICAL SUMMARY", "SUMMARY")
                .replace("AWARDS & HONORS", "ACHIEVEMENTS")
                .replace("AWARDS", "ACHIEVEMENTS")
                .replace("CERTIFICATIONS", "ACHIEVEMENTS");
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

    // --- Date conversion helper: "Jun 2023" → "2023-06" ---
    const MONTH_MAP = { jan:"01",feb:"02",mar:"03",apr:"04",may:"05",jun:"06",jul:"07",aug:"08",sep:"09",oct:"10",nov:"11",dec:"12" };
    const toIsoMonth = (str) => {
        if (!str) return "";
        if (/^\d{4}-\d{2}$/.test(str.trim())) return str.trim();
        const m = str.match(/([A-Za-z]{3,9})\.?\s+(\d{4})/);
        if (m) { const mo = MONTH_MAP[m[1].toLowerCase().slice(0,3)]; return mo ? `${m[2]}-${mo}` : ""; }
        if (/^\d{4}$/.test(str.trim())) return `${str.trim()}-01`;
        return "";
    };

    // --- Education ---
    const eduLines = sections["EDUCATION"] || [];
    const education = [];
    const DATE_RE = /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|\d{4}/i;
    let i = 0;
    while (i < eduLines.length) {
        const line = eduLines[i];
        if (/b\.?tech|b\.?e\.?|m\.?tech|bachelor|master|phd|mba|diploma|higher secondary|secondary school|high school|hsc|ssc|\bbs\b|\bms\b/i.test(line)) {
            const institution = eduLines[i + 1] || "";
            const rawDate = (eduLines[i + 1] + " " + (eduLines[i + 2] || "")).match(DATE_RE)?.[0] || "";
            education.push({ institution: institution.match(DATE_RE) ? "" : institution, degree: line, field: "", graduation_date: toIsoMonth(rawDate), gpa: "" });
            i += 2;
        } else { i++; }
    }

    // --- Experience ---
    const expLines = sections["EXPERIENCE"] || [];
    const experience = [];
    const DATE_RANGE_RE = /((?:[A-Za-z]{3,9}\.?\s+\d{4})|(?:\d{2}\/\d{4})|(?:\d{4}))\s*[-–—\t]+\s*((?:[A-Za-z]{3,9}\.?\s+\d{4})|(?:\d{2}\/\d{4})|(?:\d{4})|Present|Current)/i;
    const COMPANY_KEYWORDS = /inc\b|corp\b|tech\b|solutions\b|limited\b|ltd\b|group\b|systems\b|technologies\b/i;
    
    let currentExp = null;
    let lastShortLines = []; // Buffer for potential titles/companies
    let linesSinceExpStart = 0;

    for (const line of expLines) {
        const dateMatch = line.match(DATE_RANGE_RE);
        
        if (dateMatch) {
            // BACKTRACKING: If we're starting a new job, check if the previous job's description 
            // ended with a line that looks like a Job Title.
            let stolenTitle = "";
            if (currentExp && currentExp.description) {
                const descLines = currentExp.description.split("\n");
                const lastLine = descLines[descLines.length - 1].trim();
                if (lastLine && lastLine.length < 60 && POSITION_KEYWORDS.test(lastLine) && !lastLine.endsWith(".")) {
                    stolenTitle = lastLine;
                    descLines.pop();
                    currentExp.description = descLines.join("\n").trim();
                }
            }

            if (currentExp) experience.push(currentExp);
            
            // Extract what's on the SAME line as the date
            let onLineTitle = line.replace(dateMatch[0], "").replace(/^[•\-\t\s]+|[•\-\t\s]+$/g, "").trim();
            
            // If the text on the same line is too long, it's likely a description merger
            if (onLineTitle.length > 60 || (onLineTitle.endsWith(".") && !COMPANY_KEYWORDS.test(onLineTitle)) || onLineTitle.includes(":")) {
                onLineTitle = ""; 
            }

            // Decide position/company using onLineTitle, stolenTitle, and buffer
            let position = onLineTitle || stolenTitle;
            let company = "";

            if (!position && lastShortLines.length > 0) {
                const candidate1 = lastShortLines.pop(); 
                const candidate2 = lastShortLines.pop(); 
                
                if (candidate2) {
                    if (POSITION_KEYWORDS.test(candidate2) && !POSITION_KEYWORDS.test(candidate1)) {
                        position = candidate2; company = candidate1;
                    } else if (POSITION_KEYWORDS.test(candidate1) && !POSITION_KEYWORDS.test(candidate2)) {
                        position = candidate1; company = candidate2;
                    } else {
                        position = candidate1; company = candidate2;
                    }
                } else {
                    position = candidate1;
                }
            } else if (position && lastShortLines.length > 0) {
                company = lastShortLines.pop();
            }

            // Final swap if company looks more like a title
            if (company && POSITION_KEYWORDS.test(company) && !POSITION_KEYWORDS.test(position)) {
                const tmp = position; position = company; company = tmp;
            }

            currentExp = {
                company: company || "",
                position: position || "Experience Item",
                start_date: toIsoMonth(dateMatch[1]?.trim() || ""),
                end_date: /present|current/i.test(dateMatch[2] || "") ? "" : toIsoMonth(dateMatch[2]?.trim() || ""),
                description: "",
                is_current: /present|current/i.test(dateMatch[2] || ""),
            };
            lastShortLines = [];
            linesSinceExpStart = 0;
        } else if (currentExp) {
            linesSinceExpStart++;
            const looksLikeCompany = (line.length < 60 && !line.startsWith("-") && !line.startsWith("•") && (linesSinceExpStart <= 2 || COMPANY_KEYWORDS.test(line)));
            if (!currentExp.company && looksLikeCompany) {
                currentExp.company = line;
            } else {
                // To support backtracking later, we'll store description with newlines
                currentExp.description = (currentExp.description + "\n" + line).trim();
            }
        } else {
            if (line.length < 80 && !line.startsWith("-") && !line.startsWith("•") && (!line.endsWith(".") || COMPANY_KEYWORDS.test(line))) {
                lastShortLines.push(line);
                if (lastShortLines.length > 3) lastShortLines.shift(); 
            }
        }
    }
    // Final cleanup of newlines in descriptions
    experience.forEach(exp => {
        if (exp.description) exp.description = exp.description.replace(/\n/g, " ").trim();
    });
    if (currentExp) {
        currentExp.description = currentExp.description.replace(/\n/g, " ").trim();
        experience.push(currentExp);
    }

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

// Helper: convert AI API errors to friendly messages
const friendlyAIError = (error) => {
    const rawBody = error?.error?.message || error?.message || "Unknown error";
    console.error(`[AI Error] status=${error.status} body="${rawBody}"`);
    if (error.status === 401) return { status: 401, message: `AI error: Invalid API key — please check your GROQ_API_KEY in Secrets. (${rawBody})` };
    if (error.status === 403) return { status: 403, message: `AI features unavailable — your team has no credits. Add credits at: https://console.x.ai/team/f96499f0-0781-4463-899c-8277f9739b4f` };
    if (error.status === 429) return { status: 429, message: "AI service is busy. Please wait 30 seconds and try again." };
    return { status: error.status || 500, message: `AI service error ${error.status || ""}: ${rawBody}` };
};

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
        const { status, message } = friendlyAIError(error);
        return res.status(status).json({ message });
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
        const { status, message } = friendlyAIError(error);
        return res.status(status).json({ message });
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
        if (!process.env.GROQ_API_KEY) return res.status(500).json({ message: "GROQ_API_KEY is not set in .env" });

        console.log("File:", req.file.originalname, "Size:", req.file.size);

        // Parse PDF buffer using PDFParse
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

        console.log("Using High-Speed AI Parser for maximum 'Instanity'...");
        let parsedData;
        try {
            const aiResponse = await callAIWithRetry({
                model: FAST_AI_MODEL,
                messages: [
                    { role: "system", content: "You are an expert resume parser. Extract structured data from the text and return valid JSON only." },
                    { role: "user", content: `Parse this resume text and return ONLY valid JSON matching this exact structure: ${RESUME_JSON_STRUCTURE}\n\nResume text:\n${safeResumeText}` },
                ],
                temperature: 0.1,
                max_tokens: 2000,
            });
            parsedData = extractJsonFromString(aiResponse.choices[0].message.content);
        } catch (aiErr) {
            console.error("Fast AI parser failed, spinning up fallback...", aiErr.message);
        }

        if (!parsedData) {
            console.log("AI failed or took too long, using improved Regex fallback...");
            parsedData = parseResumeFallback(safeResumeText);
        }

        const newResume = await Resume.create({
            userId, title,
            personal_info: parsedData.personal_info || {},
            professional_summary: parsedData.professional_summary || "",
            experience: parsedData.experience || [],
            project: parsedData.project || [],
            education: parsedData.education || [],
            skills: parsedData.skills || [],
            remove_background: false
        });

        console.log("Resume created:", newResume._id);
        return res.status(200).json({ resumeId: newResume._id, message: "Resume uploaded instantly and accurately" });

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