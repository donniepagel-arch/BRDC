const fs = require('fs');

function fixFile(filename) {
    let content = fs.readFileSync(filename, 'utf8');
    
    // 1. Add cors import
    if (!content.includes("const cors = require('cors')")) {
        content = content.replace(
            "const admin = require('firebase-admin');",
            "const admin = require('firebase-admin');\nconst cors = require('cors')({origin: true});"
        );
    }
    
    // 2. Simple replace: wrap the entire try-catch in cors
    // Find pattern: exports.X = functions.https.onRequest(async (req, res) => {
    //     res.set('Access-Control-Allow-Origin', '*');
    //     res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    //     res.set('Access-Control-Allow-Headers', 'Content-Type');
    //     if (req.method === 'OPTIONS') return res.status(204).send('');
    
    // Replace the function signature
    content = content.replace(
        /exports\.(\w+) = functions\.https\.onRequest\(async \(req, res\) => \{/g,
        'exports.$1 = functions.https.onRequest((req, res) => {\n    return cors(req, res, async () => {'
    );
    
    // Remove manual CORS headers
    content = content.replace(/    res\.set\('Access-Control-Allow-Origin', '\*'\);\n/g, '');
    content = content.replace(/    res\.set\('Access-Control-Allow-Methods', '[^']+'\);\n/g, '');
    content = content.replace(/    res\.set\('Access-Control-Allow-Headers', '[^']+'\);\n/g, '');
    content = content.replace(/    if \(req\.method === 'OPTIONS'\) return res\.status\(204\)\.send\(''\);\n/g, '');
    
    // Now we need to add closing }); before each final });
    // Match the end of functions: lines that are just "});" at the end
    content = content.replace(/\n\}\);\n\n/g, '\n    });\n});\n\n');
    
    fs.writeFileSync(filename, content);
    console.log(`Fixed ${filename}`);
}

fixFile('phase-1-2.js');
fixFile('phase-3-4.js');
fixFile('phase-5-6-7.js');

console.log('Done!');
