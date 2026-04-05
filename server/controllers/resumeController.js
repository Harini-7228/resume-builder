// controller for creating a new resume

import imagekit from "../configs/imageKit.js";
import Resume from "../models/Resume.js";

// POST: /api/resumes/create
export const createResume = async (req, res) => {
    try {
        const userId = req.userId;
        const { title } = req.body;

        // create new resume
        const newResume = await Resume.create({
            userId,
            title
        })
        // return success message
        return res.status(201).json({ message: "Resume created successfully", resume: newResume })

    } catch (error) {
        return res.status(400).json({ message: error.message })
    }
}

//controller for deleting a resume
// DELETE: /api/resumes/delete
export const deleteResume = async (req, res) => {
    try {
        const userId = req.userId;
        const { resumeId } = req.params;
        await Resume.findOneAndDelete({ _id: resumeId, userId })

        // return success message
        return res.status(200).json({ message: "Resume deleted successfully" })

    } catch (error) {
        return res.status(400).json({ message: error.message })
    }
}

// get user resume by id
// GET: /api/resumes/get
export const getResumeById = async (req, res) => {
    try {
        const userId = req.userId;
        const { resumeId } = req.params;
        const resume = await Resume.findOne({ _id: resumeId, userId })
        if (!resume) {
            return res.status(404).json({ message: "Resume not found" })
        }

        resume.__v = undefined;
        resume.createdAt = undefined;
        resume.updatedAt = undefined;
        return res.status(200).json({ resume })

    } catch (error) {
        return res.status(400).json({ message: error.message })
    }
}

// get resume by id public
// GET: /api/resumes/public
export const getPublicResumeById = async (req, res) => {
    try {
        const { resumeId } = req.params;
        const resume = await Resume.findOne({ _id: resumeId, public: true })
        if (!resume) {
            return res.status(404).json({ message: "Resume not found" })
        }

        return res.status(200).json({ resume })

    } catch (error) {
        return res.status(400).json({ message: error.message })

    }
}
// controller for updating a resume
// PUT: /api/resumes/update
export const updateResume = async (req, res) => {
    try {
        const userId = req.userId;
        const { resumeId, resumeData, removeBackground } = req.body;
        const image = req.file;

        if (!resumeData && !image) {
            return res.status(400).json({ message: "Missing resume data or image" });
        }

        let resumeDataCopy;
        try {
            resumeDataCopy = typeof resumeData === 'string' ? JSON.parse(resumeData) : JSON.parse(JSON.stringify(resumeData || {}));
        } catch (parseErr) {
            console.error("Malformed resumeData:", parseErr.message);
            return res.status(400).json({ message: "Invalid resume data format" });
        }
        
        resumeDataCopy.personal_info = resumeDataCopy.personal_info || {};
        
        // Ensure remove_background is persisted at the root level if provided
        if (removeBackground !== undefined) {
            resumeDataCopy.remove_background = removeBackground === 'true' || removeBackground === true;
        }

        if (image) {
            // ImageKit v7 requires Blob/ReadStream/Base64 — not a raw Buffer
            const base64 = image.buffer.toString('base64');
            const dataUri = `data:${image.mimetype || 'image/jpeg'};base64,${base64}`;
            
            const isBgRemoveEnabled = resumeDataCopy.remove_background === true;

            const response = await imagekit.files.upload({
                file: dataUri,
                fileName: image.originalname || 'resume-logo.png',
                folder: 'user-resumes',
                transformation: {
                    pre: 'w-300,h-300,fo-face,z-0.75' + (isBgRemoveEnabled ? ',e-bgremove' : '')
                }
            });

            resumeDataCopy.personal_info.image = response.url;
        } else if (resumeDataCopy.personal_info.image && typeof resumeDataCopy.personal_info.image !== 'string') {
            delete resumeDataCopy.personal_info.image;
        }

        if (resumeDataCopy.personal_info.image === undefined) {
            delete resumeDataCopy.personal_info.image;
        }

        const resume = await Resume.findOneAndUpdate({ userId, _id: resumeId }, resumeDataCopy, { new: true });

        return res.status(200).json({ message: "Saved succesfully", resume })

    } catch (error) {
        return res.status(400).json({ message: error.message })
    }
}
//