# LinkedIn Job Auto-Apply Bot

Automates applying to LinkedIn jobs using Playwright MCP (Model Context Protocol) with Claude Code.

## Prerequisites

- Node.js v18+
- Claude Code CLI installed

## Setup

1. Clone the repo and install dependencies:
   ```bash
   git clone <repo-url>
   cd playwright-mcp
   npm install
   ```

2. Install Playwright browsers:
   ```bash
   npx playwright install
   ```

3. Create a `.env` file with your credentials:
   ```
   LINKEDIN_EMAIL=your-email@gmail.com
   LINKEDIN_PASSWORD=your-password
   ```

4. Place your resume PDF in the project root (e.g., `Manoj_Ambati_Resume.pdf`).

## How to Run

1. Start Claude Code with the Playwright MCP server:
   ```bash
   claude --mcp-server playwright-mcp
   ```
   Or configure it in your Claude Code MCP settings (`~/.claude/settings.json`):
   ```json
   {
     "mcpServers": {
       "playwright-mcp": {
         "command": "npx",
         "args": ["@playwright/mcp"]
       }
     }
   }
   ```

2. Ask Claude Code to apply for jobs:
   ```
   run this to apply jobs in linkedin
   ```

## What It Does

1. Opens a Playwright browser and navigates to LinkedIn login
2. Logs in using credentials from `.env`
3. Searches for **Full Stack Developer** jobs in India with **Easy Apply** filter (last 24 hours, most recent)
4. For each matching job:
   - Clicks Easy Apply
   - Fills contact info (email, phone) from your LinkedIn profile
   - Attaches your uploaded resume
   - Answers additional screening questions
   - Reviews and submits the application
5. Moves to the next relevant job and repeats

## Notes

- The bot only applies to **Easy Apply** jobs (no external redirects)
- Screening questions are answered based on your resume/profile (e.g., years of experience per skill)
- LinkedIn may show CAPTCHAs or verification challenges — handle those manually if they appear
- Keep the browser window visible during the process so you can intervene if needed
