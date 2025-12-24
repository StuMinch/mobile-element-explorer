# Mobile App Element Explorer (MEX)

A powerful CLI tool that autonomously explores mobile applications (iOS/Android) using Appium to discover accessible elements and generate comprehensive analysis reports.

## 🚀 Key Features

- **Autonomous Exploration**: Automatically navigates through your app to discover screens and elements.
- **Smart Reporting**: Generates detailed reports in **Markdown**, **CSV**, or **PDF**.
- **Best Practices**: Prioritizes **Accessibility ID** over XPath to encourage accessible app design.
- **Flexible Configuration**: Supports standard JSON capability files or WebdriverIO (`wdio.conf.js`) configurations.
- **Auto-Start Appium**: Automatically detects and starts a local Appium server if one isn't running.

## 📦 Installation

```bash
npm install mobile-element-explorer
```

## 🛠 Usage

Run the explorer using the CLI executable:

```bash
# General syntax
npx mobile-element-explorer run <path_to_config> [options]
```

### Examples

**1. Run with a JSON capabilities file:**
```bash
npx mobile-element-explorer run ./capabilities.json
```

**2. Run with a WebdriverIO config:**
```bash
npx mobile-element-explorer run ./wdio.conf.js
```

**3. Generate a PDF report with a custom filename:**
```bash
npx mobile-element-explorer run ./capabilities.json --output ./reports/my-app --format pdf
```

### CLI Options

| Option | Alias | Description | Default |
|--------|-------|-------------|---------|
| `--output` | `-o` | Output base filename (without extension) | `output` |
| `--format` | `-f` | Output format (`markdown`, `csv`, `pdf`) | `markdown` |
| `--help` | | Show help message | |

## ⚙️ Configuration

You can provide capabilities in two formats:

### 1. JSON File (`capabilities.json`)
Simple key-value pairs for Appium capabilities.

```json
{
  "platformName": "iOS",
  "appium:automationName": "XCUITest",
  "appium:deviceName": "iPhone 17",
  "appium:app": "/path/to/my.app"
}
```

### 2. WebdriverIO Config (`wdio.conf.js`)
Uses the `capabilities` array from a standard WDIO config. MEX will use the first capability set found.

```javascript
export const config = {
    capabilities: [{
        platformName: 'iOS',
        'appium:app': '/path/to/my.app',
        'appium:deviceName': 'iPhone 17',
    }]
};
```

## 📊 Output Formats

### Markdown (`.md`)
Great for documentation (GitHub/GitLab/Confluence). Includes specific tables for each screen with:
- Element Name
- Type (Button, TextField, etc.)
- Accessibility ID
- XPath

### CSV (`.csv`)
Best for importing into spreadsheets or other data analysis tools.

### PDF (`.pdf`)
Professional, shareable document format for stakeholders.

## 🤖 How it Works

1. **Connects**: Establishes an Appium session based on your config.
2. **Explores**: 
   - Captures the current screen source and screenshot.
   - Identifies interactive elements (Buttons, Inputs, Toggles).
   - "Clicks" elements to navigate to new screens.
   - Intelligently handles "Back" navigation to explore deeper.
3. **Reports**: Compiles all findings into your chosen report format.
