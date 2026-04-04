import { createRequire } from 'module';
const requireCJS = createRequire(import.meta.url);
const pdfParse = requireCJS('pdf-parse');
console.log('typeof pdfParse', typeof pdfParse);
console.log('pdfParse keys', Object.keys(pdfParse));
console.log('pdfParse has default', pdfParse && pdfParse.default ? 'yes' : 'no');
