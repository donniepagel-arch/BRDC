/**
 * Pull Feedback Script
 *
 * Reads all documents from the `feedback` collection and creates a summary report.
 * Uses the deployed Firebase function to fetch data.
 *
 * Usage: node scripts/pull-feedback.js [--save]
 *   --save  Save report to docs/work-tracking/FEEDBACK-REPORT.md
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Check for --save flag
const saveToFile = process.argv.includes('--save');

async function fetchFeedback() {
    return new Promise((resolve, reject) => {
        const url = 'https://us-central1-brdc-v2.cloudfunctions.net/getFeedback?status=all&limit=200';
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

async function pullFeedback() {
    console.log('=== Pulling User Feedback from Firestore ===\n');

    try {
        // Fetch all feedback via API
        const response = await fetchFeedback();

        if (!response.success || !response.feedback || response.feedback.length === 0) {
            console.log('No feedback found in the database.');
            process.exit(0);
        }

        console.log(`Found ${response.count} feedback entries\n`);

        // Process and group feedback by status
        const feedbackByStatus = {
            'new': [],
            'reviewed': [],
            'in_progress': [],
            'fixed': [],
            'wont_fix': [],
            'unknown': []
        };

        response.feedback.forEach(fb => {
            const status = fb.status in feedbackByStatus ? fb.status : 'unknown';
            feedbackByStatus[status].push(fb);
        });

        // Generate report
        const report = generateReport(feedbackByStatus, response.count);

        // Print to console
        console.log(report);

        // Optionally save to file
        if (saveToFile) {
            const reportPath = path.join(__dirname, '..', 'docs', 'work-tracking', 'FEEDBACK-REPORT.md');
            fs.writeFileSync(reportPath, report);
            console.log(`\n\nReport saved to: ${reportPath}`);
        }

        process.exit(0);

    } catch (error) {
        console.error('Error pulling feedback:', error);
        process.exit(1);
    }
}

function generateReport(feedbackByStatus, totalCount) {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    let report = `# User Feedback Report

Generated: ${dateStr}
Total Feedback Entries: ${totalCount}

## Summary by Status

| Status | Count |
|--------|-------|
| New (Unaddressed) | ${feedbackByStatus.new.length} |
| In Progress | ${feedbackByStatus.in_progress.length} |
| Reviewed | ${feedbackByStatus.reviewed.length} |
| Fixed | ${feedbackByStatus.fixed.length} |
| Won't Fix | ${feedbackByStatus.wont_fix.length} |
| Unknown | ${feedbackByStatus.unknown.length} |

---

`;

    // New/Unaddressed feedback first
    if (feedbackByStatus.new.length > 0) {
        report += `## NEW (Unaddressed) - ${feedbackByStatus.new.length} items\n\n`;
        report += renderFeedbackSection(feedbackByStatus.new);
    }

    // In Progress
    if (feedbackByStatus.in_progress.length > 0) {
        report += `## IN PROGRESS - ${feedbackByStatus.in_progress.length} items\n\n`;
        report += renderFeedbackSection(feedbackByStatus.in_progress);
    }

    // Reviewed
    if (feedbackByStatus.reviewed.length > 0) {
        report += `## REVIEWED - ${feedbackByStatus.reviewed.length} items\n\n`;
        report += renderFeedbackSection(feedbackByStatus.reviewed);
    }

    // Fixed
    if (feedbackByStatus.fixed.length > 0) {
        report += `## FIXED - ${feedbackByStatus.fixed.length} items\n\n`;
        report += renderFeedbackSection(feedbackByStatus.fixed);
    }

    // Won't Fix
    if (feedbackByStatus.wont_fix.length > 0) {
        report += `## WON'T FIX - ${feedbackByStatus.wont_fix.length} items\n\n`;
        report += renderFeedbackSection(feedbackByStatus.wont_fix);
    }

    // Unknown status
    if (feedbackByStatus.unknown.length > 0) {
        report += `## UNKNOWN STATUS - ${feedbackByStatus.unknown.length} items\n\n`;
        report += renderFeedbackSection(feedbackByStatus.unknown);
    }

    return report;
}

function renderFeedbackSection(items) {
    let section = '';

    items.forEach((fb, index) => {
        const dateStr = fb.created_at
            ? new Date(fb.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
            : 'Unknown date';

        section += `### ${index + 1}. Feedback from ${fb.page}\n\n`;
        section += `- **ID:** \`${fb.id}\`\n`;
        section += `- **Date:** ${dateStr}\n`;
        section += `- **Page:** ${fb.page}\n`;

        if (fb.url) {
            section += `- **URL:** ${fb.url}\n`;
        }

        if (fb.player_id) {
            section += `- **Player ID:** ${fb.player_id}\n`;
        }

        section += `\n**Message:**\n> ${(fb.message || '').replace(/\n/g, '\n> ')}\n\n`;

        if (fb.notes) {
            section += `**Admin Notes:** ${fb.notes}\n\n`;
        }

        if (fb.screen_size) {
            section += `<details>\n<summary>Device Info</summary>\n\n`;
            section += `- Screen: ${fb.screen_size}\n`;
            if (fb.user_agent) {
                section += `- User Agent: ${fb.user_agent}\n`;
            }
            section += `</details>\n\n`;
        }

        section += `---\n\n`;
    });

    return section;
}

pullFeedback().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
