const fs = require('fs');

function fixPhaseFile(filename) {
    let content = fs.readFileSync(filename, 'utf8');
    
    // 1. Add cors import after admin import
    if (!content.includes("const cors = require('cors')")) {
        content = content.replace(
            "const admin = require('firebase-admin');",
            "const admin = require('firebase-admin');\nconst cors = require('cors')({origin: true});"
        );
    }
    
    // 2. Replace the manual CORS pattern with cors wrapper
    // Pattern to match:
    // exports.X = functions.https.onRequest(async (req, res) => {
    //     res.set('Access-Control-Allow-Origin', '*');
    //     res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    //     res.set('Access-Control-Allow-Headers', 'Content-Type');
    //     if (req.method === 'OPTIONS') return res.status(204).send('');
    
    // Replace with:
    // exports.X = functions.https.onRequest((req, res) => {
    //     cors(req, res, async () => {
    
    const lines = content.split('\n');
    const result = [];
    let i = 0;
    
    while (i < lines.length) {
        const line = lines[i];
        
        // Check if this is an export line
        if (line.includes('exports.') && line.includes('functions.https.onRequest')) {
            // Replace async (req, res) => with (req, res) =>
            let exportLine = line.replace('async (req, res) =>', '(req, res) =>');
            result.push(exportLine);
            i++;
            
            // Add cors wrapper
            result.push('    cors(req, res, async () => {');
            
            // Skip the 4 manual CORS lines
            while (i < lines.length && 
                   (lines[i].includes("res.set('Access-Control") || 
                    lines[i].includes("if (req.method === 'OPTIONS')"))) {
                i++;
            }
            
            // Now we need to find the closing }); of this function and add }); before it
            let depth = 1; // We're inside the function
            let functionLines = [];
            
            while (i < lines.length && depth > 0) {
                const currentLine = lines[i];
                functionLines.push(currentLine);
                
                // Count braces
                for (let char of currentLine) {
                    if (char === '{') depth++;
                    if (char === '}') depth--;
                }
                
                i++;
            }
            
            // Remove the last line (which is });) from functionLines
            const lastLine = functionLines.pop();
            
            // Add all function lines
            result.push(...functionLines);
            
            // Close cors wrapper
            result.push('    });');
            
            // Add the function closing
            result.push(lastLine);
        } else {
            result.push(line);
            i++;
        }
    }
    
    fs.writeFileSync(filename, result.join('\n'));
    console.log(`Fixed ${filename}`);
}

// Fix all phase files
try {
    fixPhaseFile('phase-1-2.js');
    fixPhaseFile('phase-3-4.js');
    fixPhaseFile('phase-5-6-7.js');
    console.log('All files fixed successfully!');
} catch (error) {
    console.error('Error:', error.message);
}
