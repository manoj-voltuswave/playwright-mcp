# LinkedIn & Naukri Job Auto-Apply Bot

Automates applying to **LinkedIn** and **Naukri** jobs using the [Playwright MCP](https://github.com/microsoft/playwright-mcp) server with Claude Code.

There is no automation script in this repo. Claude Code drives the browser through the Playwright MCP tools, following the prompt templates in [`prompts/`](prompts/). You paste a prompt (or just say "apply on linkedin" / "apply on naukri") and Claude takes over.

## Prerequisites

- Node.js v18+
- [Claude Code](https://docs.claude.com/en/docs/claude-code) CLI installed
- A LinkedIn account and/or a Naukri account with a complete profile and uploaded resume

## Setup

1. Install dependencies and Playwright browsers:
   ```bash
   npm install
   npx playwright install chromium
   ```

2. Create a `.env` file from the template:
   ```bash
   cp .env.example .env
   ```
   Then fill in your credentials:
   ```
   LINKEDIN_EMAIL=your-email@gmail.com
   LINKEDIN_PASSWORD=your-password
   NAUKRI_EMAIL=your-email@gmail.com
   NAUKRI_PASSWORD=your-password
   ```

3. Place your resume PDF in the project root (e.g. `Manoj_Ambati_Resume_2026.pdf`). The prompts reference this filename — update them if you rename it.

4. Create your candidate-facts file from the template (this is the data Claude uses to answer screening questions — years per skill, CTC, notice period, DOB, etc.):
   ```bash
   cp prompts/candidate-facts.example.md prompts/candidate-facts.md
   ```
   Then edit `prompts/candidate-facts.md` with your real values. **This file is gitignored** so your salary and DOB never get committed. Re-edit it whenever your resume changes.

## Configure the Playwright MCP server in Claude Code

Add the MCP server to your Claude Code config (`~/.claude/settings.json` or project `.claude/settings.json`):

### Headed mode (default — start here)

The browser window is visible so you can watch the bot, intervene on CAPTCHAs/OTPs, and stop it if anything looks off.

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}
```

### Headless mode (switch to this once the flow is reliable)

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest", "--headless"]
    }
  }
}
```

After editing settings, restart Claude Code so the new MCP config is picked up.

## How to run

In a Claude Code session inside this repo, just say one of:

- `apply on linkedin` → Claude follows [`prompts/apply-linkedin.md`](prompts/apply-linkedin.md)
- `apply on naukri` → Claude follows [`prompts/apply-naukri.md`](prompts/apply-naukri.md)

If Claude doesn't pick up the prompt automatically, paste the contents of the relevant file into the chat.

## What it does

**LinkedIn** (Easy Apply only)
1. Logs in with `LINKEDIN_EMAIL` / `LINKEDIN_PASSWORD`
2. Searches Full Stack Developer in India, last 24 h, sorted by date, **Easy Apply** filter on
3. For each job: clicks Easy Apply, fills contact info, attaches resume, answers screening questions, submits
4. Skips jobs that redirect to external company sites

**Naukri** (in-platform applies only)
1. Logs in with `NAUKRI_EMAIL` / `NAUKRI_PASSWORD`
2. Searches Full Stack Developer in India, freshness = last 1 day, sorted by date
3. For each job: clicks **Apply** (skips **Apply on company site**), fills any pop-up screening questions, submits
4. Tracks applied count and stops at a sensible daily limit (default 25)

## Notes & caveats

- **Manual oversight first.** Run in headed mode for the first few sessions. Watch what gets submitted before trusting headless.
- **CAPTCHAs / OTPs.** Both sites occasionally challenge logins. In headed mode, solve them by hand — Claude will wait. In headless mode, the run will likely fail; switch back to headed to clear the challenge once.
- **Rate limits.** LinkedIn caps Easy Apply at ~100/day; Naukri throttles after rapid bursts. Keep daily volume modest to avoid account flags.
- **Resume.** LinkedIn uses whatever PDF is currently set as your default Easy Apply resume (manage at *Settings → Data Privacy → Job application settings*). Naukri uses the resume on your profile.
- **ToS.** Automated applies sit in a grey area on both platforms' terms of service. Use at your own risk and only on your own account.
- **Profile completeness.** Naukri ranks profiles for visibility — fill out skills, experience, and education thoroughly before running, or you'll get fewer / lower-quality results.
