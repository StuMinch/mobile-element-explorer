import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import chalk from 'chalk';
import { loadConfig } from './config.js';
import { runExplorer } from './explorer.js';
import { generateReport } from './reporter.js';

yargs(hideBin(process.argv))
    .command('run <capabilities>', 'Run the element explorer', (yargs) => {
        return yargs
            .positional('capabilities', {
                describe: 'Path to capabilities file (JSON or JS)',
                type: 'string'
            })
            .option('output', {
                alias: 'o',
                type: 'string',
                description: 'Output file path (without extension)',
                default: 'output'
            })
            .option('format', {
                alias: 'f',
                type: 'string',
                description: 'Output format (markdown, csv, pdf)',
                default: 'markdown',
                choices: ['markdown', 'md', 'csv', 'pdf']
            });
    }, async (argv) => {
        try {
            console.log(chalk.green('🚀 Starting Mobile Element Explorer in CLI mode...'));

            const config = await loadConfig(argv.capabilities);
            console.log(chalk.blue(`✓ Loaded capabilities from ${argv.capabilities}`));

            const results = await runExplorer(config);
            await generateReport(results, argv.output, argv.format);

            console.log(chalk.green('✅ Done!'));
        } catch (error) {
            console.error(chalk.red('❌ Error:'), error.message);
            process.exit(1);
        }
    })
    .demandCommand(1)
    .help()
    .parse();
