// Simple test to verify multer is working
// Add this temporarily to aiRoutes.js to test:
// aiRouter.post('/test-upload', protect, upload.single('resume'), testUpload)

export const testUpload = async (req, res) => {
    try {
        console.log("=== Test Upload ===");
        console.log("Body:", req.body);
        console.log("File:", req.file);
        
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }
        
        return res.json({
            message: 'File received successfully',
            file: {
                originalname: req.file.originalname,
                mimetype: req.file.mimetype,
                size: req.file.size,
                bufferLength: req.file.buffer.length
            }
        });
    } catch (error) {
        console.error("Test upload error:", error);
        return res.status(500).json({ message: error.message });
    }
};
