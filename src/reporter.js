import fs from 'fs/promises';
import { createObjectCsvWriter } from 'csv-writer';
import { createRequire } from 'module';
import chalk from 'chalk';

const require = createRequire(import.meta.url);
const markdownPdf = require('markdown-pdf');

export async function generateReport(screens, outputBase, format) {
    const fmt = format.toLowerCase() === 'md' ? 'markdown' : format.toLowerCase();
    const timestamp = new Date().toISOString();

    // Generate Markdown Content (Core)
    let mdContent = `# Mobile App Element Analysis Report\n\n`;
    mdContent += `**Generated:** ${timestamp}\n`;
    mdContent += `**Total Screens:** ${screens.length}\n`;
    mdContent += `**Total Elements:** ${screens.reduce((sum, s) => sum + s.elementCount, 0)}\n\n`;
    mdContent += `---\n\n`;

    screens.forEach((screen, idx) => {
        mdContent += `## Screen ${idx + 1}: ${screen.name}\n\n`;
        mdContent += `**Elements Found:** ${screen.elementCount}\n\n`;

        if (screen.elements.length > 0) {
            mdContent += '| Element Name | Type | Accessibility ID | XPath |\n';
            mdContent += '|---|---|---|---|\n';
            screen.elements.forEach(el => {
                const acc = el.accessibilityId || ''; // simple escape if needed?
                // detailed xpath might need backtick escape
                const safeXpath = el.xpath.replace(/`/g, '\\`');
                mdContent += `| ${el.name} | ${el.type} | ${acc} | \`${safeXpath}\` |\n`;
            });
        }
        mdContent += '\n';
    });

    const outputPath = `${outputBase}.${fmt === 'markdown' ? 'md' : fmt}`;

    console.log(chalk.blue(`Generating report: ${outputPath}`));

    try {
        if (fmt === 'markdown') {
            await fs.writeFile(outputPath, mdContent);
        } else if (fmt === 'csv') {
            const csvWriter = createObjectCsvWriter({
                path: outputPath,
                header: [
                    { id: 'screen', title: 'Screen Name' },
                    { id: 'name', title: 'Element Name' },
                    { id: 'type', title: 'Type' },
                    { id: 'accId', title: 'Accessibility ID' },
                    { id: 'xpath', title: 'XPath' }
                ]
            });

            const records = [];
            screens.forEach(s => {
                s.elements.forEach(el => {
                    records.push({
                        screen: s.name,
                        name: el.name,
                        type: el.type,
                        xpath: el.xpath,
                        accId: el.accessibilityId || ''
                    });
                });
            });

            await csvWriter.writeRecords(records);
        } else if (fmt === 'pdf') {
            await new Promise((resolve, reject) => {
                markdownPdf()
                    .from.string(mdContent)
                    .to(outputPath, () => {
                        resolve();
                    });
            });
        } else {
            throw new Error(`Unsupported format: ${format}`);
        }
    } catch (e) {
        throw new Error(`Failed to generate report: ${e.message}`);
    }
}
