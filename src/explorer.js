import { remote } from 'webdriverio';
import crypto from 'crypto';
import chalk from 'chalk';

import { spawn } from 'child_process';
import http from 'http';

export async function runExplorer(capabilities) {
    console.log(chalk.yellow('Starting Appium session...'));

    const host = process.env.APPIUM_HOST || 'localhost';
    const port = parseInt(process.env.APPIUM_PORT || 4723);

    // Check if we are running locally based on host
    // (Ignoring process.env.SAUCE_USER because it might be set globally but we are targeting localhost)
    const isLocal = (host === 'localhost' || host === '127.0.0.1') &&
        !capabilities['sauce:options'] &&
        !capabilities['bstack:options'];

    let appiumProcess = null;

    if (isLocal && (host === 'localhost' || host === '127.0.0.1')) {
        const isRunning = await checkAppiumRunning(host, port);
        if (!isRunning) {
            console.log(chalk.yellow('⚠️  Appium server not running. Attempting to start...'));
            try {
                appiumProcess = await startAppiumServer(port);
                console.log(chalk.green('✓ Appium server started successfully.'));
            } catch (e) {
                console.error(chalk.red('❌ Failed to start Appium server:'), e.message);
                console.log(chalk.gray('Please start Appium manually via `appium` command.'));
                return [];
            }
        } else {
            console.log(chalk.green('✓ Appium server is running.'));
        }
    }

    const options = {
        capabilities,
        hostname: host,
        port: port,
        path: process.env.APPIUM_PATH || '/',
        logLevel: 'error'
    };

    let browser;
    const capturedScreens = [];

    try {
        browser = await remote(options);
        console.log(chalk.green(`✓ Session created: ${browser.sessionId}`));

        // Give app time to launch
        await new Promise(r => setTimeout(r, 4000));

        console.log(chalk.blue('🔍 Starting autonomous exploration...'));
        await autonomousExplore(browser, capturedScreens);

    } catch (e) {
        console.error(chalk.red('Explorer error:'), e);
    } finally {
        if (browser) {
            try {
                await browser.deleteSession();
                console.log(chalk.yellow('Session ended.'));
            } catch (e) {
                // ignore
            }
        }

        if (appiumProcess) {
            console.log(chalk.gray('Stopping Appium server...'));
            appiumProcess.kill();
        }
    }

    return capturedScreens;
}

function checkAppiumRunning(host, port) {
    // Force 127.0.0.1 if localhost to avoid ambiguity
    const checkHost = host === 'localhost' ? '127.0.0.1' : host;
    return new Promise((resolve) => {
        const req = http.get(`http://${checkHost}:${port}/status`, (res) => {
            resolve(res.statusCode === 200);
        });
        req.on('error', () => resolve(false));
    });
}

function startAppiumServer(port) {
    return new Promise((resolve, reject) => {
        console.log(chalk.gray(`  Spawning appium on port ${port}...`));
        const p = spawn('appium', ['--port', port.toString()], {
            detached: false,
            // Capture output for debugging
            stdio: ['ignore', 'pipe', 'pipe']
        });

        p.stdout.on('data', (d) => {
            // Uncomment to see appium logs
            process.stdout.write(chalk.gray(`[Appium] ${d}`));
        });

        p.stderr.on('data', (d) => {
            process.stderr.write(chalk.red(`[Appium Error] ${d}`));
        });

        p.on('error', (err) => {
            reject(err);
        });

        p.on('exit', (code) => {
            if (code !== 0 && code !== null) {
                reject(new Error(`Appium exited with code ${code}`));
            }
        });

        // Loop check for up to 15 seconds
        let attempts = 0;
        const checkInterval = setInterval(async () => {
            attempts++;
            const running = await checkAppiumRunning('127.0.0.1', port);
            if (running) {
                clearInterval(checkInterval);
                resolve(p);
            } else if (attempts >= 15) {
                clearInterval(checkInterval);
                p.kill();
                reject(new Error('Timeout waiting for Appium to start (15s)'));
            }
        }, 1000);
    });
}

async function autonomousExplore(browser, screens) {
    const visited = new Set();
    const maxScreens = 12;
    const maxTotalClicks = 30; // limit for demo

    const initialSource = await browser.getPageSource();
    const initialHash = hashString(initialSource);

    const clickedPerScreen = {}; // hash -> Set(xpath)
    let totalClicks = 0;

    // Helper to capture current screen
    const capture = async (name) => {
        const source = await browser.getPageSource();
        const screenshot = await browser.takeScreenshot();
        const elements = parseXMLElements(source);

        screens.push({
            name,
            image: screenshot, // base64
            elements,
            elementCount: elements.length,
            timestamp: new Date().toISOString()
        });
        console.log(chalk.gray(`  Captured ${name} (${elements.length} elements)`));
    };

    // Capture Home
    await capture('Home Screen');
    visited.add(initialHash);

    while (totalClicks < maxTotalClicks && screens.length < maxScreens) {
        const source = await browser.getPageSource();
        const currentHash = hashString(source);

        // Capture if new
        if (!visited.has(currentHash)) {
            visited.add(currentHash);
            await capture(`Screen ${screens.length + 1}`);
        }

        if (!clickedPerScreen[currentHash]) clickedPerScreen[currentHash] = new Set();

        // Find candidates
        const candidates = parseXMLElements(source)
            .filter(el => el.name && !isBlacklisted(el.name))
            .filter(el => !clickedPerScreen[currentHash].has(el.xpath));

        if (candidates.length === 0) {
            console.log(chalk.gray('  No more candidates on this screen. Attempting Back...'));
            try {
                await browser.back();
                await new Promise(r => setTimeout(r, 2000));

                // If back didn't change anything, break to avoid infinite loop
                const postBackSource = await browser.getPageSource();
                if (hashString(postBackSource) === currentHash) {
                    console.log(chalk.gray('  Back button did nothing. Ending exploration.'));
                    break;
                }
            } catch (e) {
                break;
            }
            continue;
        }

        // Pick candidate
        const candidate = candidates[0];
        console.log(chalk.cyan(`  Clicking: ${candidate.name} (${candidate.type})`));

        try {
            const el = await browser.$(candidate.xpath);
            await el.click();

            clickedPerScreen[currentHash].add(candidate.xpath);
            totalClicks++;

            await new Promise(r => setTimeout(r, 3000)); // wait for transition

        } catch (e) {
            console.log(chalk.red(`  Failed to click ${candidate.name}`));
            clickedPerScreen[currentHash].add(candidate.xpath);
        }
    }
}

function parseXMLElements(pageSource) {
    const elements = [];
    if (!pageSource) return elements;

    // iOS
    const iosTypes = ['Button', 'TextField', 'Image', 'Cell', 'StaticText', 'Switch', 'Slider', 'Key'];
    iosTypes.forEach(type => {
        const regex = new RegExp(`<XCUIElementType${type}[^>]*?(?:label|name)="([^"]*)"[^>]*?>`, 'gi');
        let match;
        while ((match = regex.exec(pageSource)) !== null) {
            const name = match[1];
            if (name) {
                elements.push({
                    type,
                    name,
                    xpath: `//XCUIElementType${type}[@name="${name}"]`,
                    accessibilityId: name
                });
            }
        }
    });

    // Android
    const androidTypes = ['Button', 'TextView', 'EditText', 'ImageView', 'ImageButton', 'View'];
    androidTypes.forEach(type => {
        const regex = new RegExp(`<android\\.widget\\.${type}[^>]*?(?:text|content-desc)="([^"]*)"[^>]*?>`, 'gi');
        let match;
        while ((match = regex.exec(pageSource)) !== null) {
            const name = match[1];
            if (name) {
                elements.push({
                    type,
                    name,
                    xpath: `//android.widget.${type}[@text="${name}" or @content-desc="${name}"]`,
                    accessibilityId: name
                });
            }
        }
    });

    return elements.slice(0, 50);
}

function hashString(s) {
    return crypto.createHash('sha1').update(s || '').digest('hex');
}

function isBlacklisted(name) {
    if (!name) return false;
    const blacklist = [/logout/i, /sign ?out/i, /delete/i, /remove/i, /purchase/i, /confirm/i];
    return blacklist.some(rx => rx.test(name));
}
