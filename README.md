# cf_ai_naitik

An AI-powered Code Review Bot built on Cloudflare's edge infrastructure, leveraging Workers AI (Llama 3.3 70B) for intelligent code analysis with persistent state management via Durable Objects.

## Overview

This application provides automated code reviews powered by advanced AI, with features including:

- **LLM Integration**: Uses Llama 3.3 70B on Cloudflare Workers AI for comprehensive code analysis
- **Workflow Coordination**: Cloudflare Workers orchestrate API requests and AI interactions
- **User Interface**: Interactive web chat interface for code submission and review viewing
- **Persistent Memory**: Durable Objects maintain review history and session state across requests
- **Multi-Language Support**: Reviews code in 12+ programming languages

## Architecture

### Components

1. **Cloudflare Workers** (`src/index.ts`)
   - API endpoints for code submission and review retrieval
   - Routes requests to appropriate handlers
   - Integrates with Workers AI for LLM inference

2. **Durable Objects** (`src/review-session.ts`)
   - Manages persistent review history per session
   - Stores code submissions, reviews, and metadata
   - Enables context-aware follow-up reviews

3. **Workers AI** (`src/prompts.ts`)
   - Llama 3.3 70B model for code analysis
   - Identifies bugs, security issues, and best practices
   - Provides actionable suggestions with examples

4. **Frontend** (`public/index.html`)
   - Clean, responsive web interface
   - Code submission form with language selection
   - Review history viewer
   - Session management

### Data Flow

```
User submits code → Worker API → Durable Object (check history)
                                        ↓
                               Workers AI (Llama 3.3)
                                        ↓
                               Durable Object (store review)
                                        ↓
                               Return review to user
```

## Features

- AI-powered code review using state-of-the-art LLM
- Identifies bugs, security vulnerabilities, and code quality issues
- Suggests improvements with code examples
- Persistent review history per session
- Context-aware follow-up reviews that reference previous feedback
- Support for JavaScript, TypeScript, Python, Java, Go, Rust, C++, C#, Ruby, PHP, Swift, and Kotlin
- Clean, modern web interface
- Real-time review generation
- Session-based state management

## Requirements

- Node.js 18 or higher
- npm or yarn
- A Cloudflare account (free tier works)
- Wrangler CLI

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/NaitikVora/cf_ai_naitik.git
   cd cf_ai_naitik
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Authenticate with Cloudflare**
   ```bash
   npx wrangler login
   ```

## Local Development

Run the application locally with Wrangler's development server:

```bash
npm run dev
```

This will:
- Start a local server (typically at `http://localhost:8787`)
- Enable hot reloading for code changes
- Simulate Durable Objects locally
- Connect to Workers AI for inference

**Note**: Workers AI requires an internet connection even in local development mode.

### Testing Locally

1. Open `http://localhost:8787` in your browser
2. Select a programming language from the dropdown
3. Paste code to review in the text area
4. Optionally add context (e.g., "Focus on security")
5. Click "Get AI Review"
6. View the AI-generated review
7. Submit more code for follow-up reviews

The application maintains session state, so follow-up reviews will reference previous submissions.

## Deployment

Deploy to Cloudflare's global network:

```bash
npm run deploy
```

After deployment, you'll receive a URL like `https://cf-ai-code-reviewer.YOUR-SUBDOMAIN.workers.dev`

### First Deployment

On your first deployment, Wrangler will:
1. Create the Worker
2. Set up Durable Object namespace
3. Configure Workers AI binding
4. Deploy static assets

### Subsequent Deployments

Future deployments will update your existing Worker while maintaining Durable Object state.

## Project Structure

```
cf_ai_naitik/
├── src/
│   ├── index.ts              # Main Worker with API endpoints
│   ├── review-session.ts     # Durable Object for state management
│   └── prompts.ts            # AI prompts for code review
├── public/
│   └── index.html            # Frontend interface
├── wrangler.toml             # Cloudflare configuration
├── package.json              # Dependencies and scripts
├── tsconfig.json             # TypeScript configuration
├── README.md                 # This file
└── PROMPTS.md                # AI prompts documentation
```

## API Endpoints

### POST `/api/review`
Submit code for AI review.

**Request:**
```json
{
  "code": "function example() { return true; }",
  "language": "javascript",
  "context": "Check for best practices",
  "sessionId": "optional-session-id"
}
```

**Response:**
```json
{
  "sessionId": "uuid-v4",
  "review": "AI-generated review...",
  "reviewId": "uuid-v4",
  "isFollowUp": false,
  "timestamp": 1234567890
}
```

### GET `/api/session/reviews?sessionId=<id>`
Retrieve all reviews for a session.

**Response:**
```json
{
  "reviews": [
    {
      "id": "uuid-v4",
      "timestamp": 1234567890,
      "code": "...",
      "language": "javascript",
      "review": "...",
      "context": "..."
    }
  ]
}
```

### POST `/api/session/clear`
Clear all reviews in a session.

**Request:**
```json
{
  "sessionId": "uuid-v4"
}
```

### GET `/api/health`
Health check endpoint.

## Configuration

### Cloudflare Workers AI

The application uses the `@cf/meta/llama-3.3-70b-instruct-fp8-fast` model. You can modify this in `src/index.ts`:

```typescript
const aiResponse = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
  messages: [...],
  max_tokens: 2048,
  temperature: 0.7,
});
```

### Durable Objects

Review sessions are isolated by session ID. Each session maintains its own state in a separate Durable Object instance.

### Customization

- **AI Prompts**: Edit `src/prompts.ts` to customize review criteria
- **Frontend**: Modify `public/index.html` for UI changes
- **Languages**: Add more languages in the frontend dropdown and update the backend accordingly

## Troubleshooting

### "AI binding not found"
Ensure you're logged in to Cloudflare and have Workers AI enabled:
```bash
npx wrangler login
```

### "Durable Object migration failed"
If migrations fail, you may need to delete and redeploy:
```bash
npx wrangler delete
npm run deploy
```

### Local development not working
Make sure you have the latest Wrangler version:
```bash
npm install -D wrangler@latest
```

## Performance

- **Cold start**: ~100-200ms
- **AI inference**: ~2-5 seconds (depends on code length)
- **Total request time**: ~2-6 seconds
- **Durable Objects**: Near-instant state reads/writes

## Costs

With Cloudflare's free tier:
- **Workers**: 100,000 requests/day
- **Workers AI**: 10,000 neurons/day (Llama 3.3 uses ~1000 neurons per request)
- **Durable Objects**: 1 million requests/month

For this application, you can expect ~10-20 free code reviews per day on the free tier.

## Security

- No code is stored permanently (only during session)
- Sessions are isolated via unique IDs
- CORS enabled for frontend access
- Input validation on all endpoints

## Future Enhancements

- [ ] Multi-file project reviews
- [ ] GitHub integration for PR reviews
- [ ] Custom review templates
- [ ] Export reviews as PDF/Markdown
- [ ] User authentication
- [ ] Rate limiting per user
- [ ] Diff-based reviews for code changes

## License

MIT

## Author

Naitik Vora

## Acknowledgments

- Built with [Cloudflare Workers](https://workers.cloudflare.com/)
- Powered by [Workers AI](https://ai.cloudflare.com/)
- LLM: [Llama 3.3 70B](https://ai.meta.com/llama/)

## Links

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Workers AI Documentation](https://developers.cloudflare.com/workers-ai/)
- [Durable Objects Documentation](https://developers.cloudflare.com/durable-objects/)
- [Cloudflare AI Agents Guide](https://developers.cloudflare.com/agents/)
