const fs = require('fs');

function fixPhaseFile(filename) {
    let content = fs.readFileSync(filename, 'utf8');
    
    // 1. Add cors import after admin import if not present
    if (!content.includes("const cors = require('cors')")) {
        content = content.replace(
            "const admin = require('firebase-admin');",
            "const admin = require('firebase-admin');\nconst cors = require('cors')({origin: true});"
        );
    }
    
    // 2. Remove all manual CORS headers and OPTIONS handling
    content = content.replace(/    res\.set\('Access-Control-Allow-Origin', '\*'\);\n/g, '');
    content = content.replace(/    res\.set\('Access-Control-Allow-Methods', '[^']*'\);\n/g, '');
    content = content.replace(/    res\.set\('Access-Control-Allow-Headers', '[^']*'\);\n/g, '');
    content = content.replace(/    if \(req\.method === 'OPTIONS'\) return res\.status\(204\)\.send\(''\);\n/g, '');
    
    // 3. Wrap function body in cors callback
    // Find all exports
    const regex = /(exports\.\w+\s*=\s*functions\.https\.onRequest)\(async \(req, res\) => \{/g;
    content = content.replace(regex, '$1((req, res) => {\n    cors(req, res, async () => {');
    
    // 4. Close cors wrapper before final });
    // Find all closing }); that are at the end of a function
    const lines = content.split('\n');
    const result = [];
    let inFunction = false;
    let braceDepth = 0;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        result.push(line);
        
        // Track if we're in an exports function
        if (line.includes('exports.') && line.includes('functions.https.onRequest')) {
            inFunction = true;
            braceDepth = 0;
        }
        
        // Count braces
        if (inFunction) {
            braceDepth += (line.match(/\{/g) || []).length;
            braceDepth -= (line.match(/\}/g) || []).length;
            
            // If we hit closing brace and depth is 0, this is the end of the function
            if (braceDepth === 0 && line.trim() === '});') {
                // Add cors closing before this line
                result[result.length - 1] = '    });';
                result.push('});');
                inFunction = false;
            }
        }
    }
    
    fs.writeFileSync(filename, result.join('\n'));
    console.log(`Fixed ${filename}`);
}

// Fix all phase files
fixPhaseFile('phase-1-2.js');
fixPhaseFile('phase-3-4.js');
fixPhaseFile('phase-5-6-7.js');

console.log('All phase files fixed!');
