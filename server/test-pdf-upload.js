// Quick test script to verify PDF parsing works
// Run with: node test-pdf-upload.js

import * as pdf from 'pdf-parse';
import fs from 'fs';
import path from 'path';

async function testPdfParse() {
    console.log('Testing PDF parsing...\n');
    
    // Test with a sample buffer (simulating multer file.buffer)
    const samplePdfPath = process.argv[2];
    
    if (!samplePdfPath) {
        console.log('\nUsage: node test-pdf-upload.js <path-to-pdf-file>');
        console.log('Example: node test-pdf-upload.js ./sample-resume.pdf\n');
        console.log('No PDF file provided, but pdf-parse is installed correctly!');
        return;
    }
    
    try {
        const dataBuffer = fs.readFileSync(samplePdfPath);
        console.log(`✓ PDF file loaded: ${path.basename(samplePdfPath)}`);
        console.log(`  File size: ${(dataBuffer.length / 1024).toFixed(2)} KB\n`);
        
        console.log('Parsing PDF...');
        const data = await pdf(dataBuffer);
        
        console.log('✓ PDF parsed successfully!\n');
        console.log('Results:');
        console.log(`  Text length: ${data.text?.length || 0} characters`);
        console.log(`  First 200 characters:\n  "${(data.text || '').substring(0, 200)}..."\n`);
        
        if (!data.text || data.text.length === 0) {
            console.log('⚠ Warning: No text extracted. PDF might be image-based.');
        }
        
    } catch (error) {
        console.error('✗ Error parsing PDF:', error.message);
    }
}

testPdfParse();
