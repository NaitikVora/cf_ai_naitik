import { ReviewSession, ReviewEntry } from './review-session';
import { SYSTEM_PROMPT, createCodeReviewPrompt, createFollowUpPrompt } from './prompts';

export { ReviewSession };

interface Env {
  AI: Ai;
  REVIEW_SESSIONS: DurableObjectNamespace<ReviewSession>;
  ASSETS: Fetcher;
}

interface ReviewRequest {
  code: string;
  language: string;
  context?: string;
  sessionId?: string;
}

/**
 * Main Worker - Handles API requests and coordinates code reviews
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // API Routes
      if (path === '/api/review' && request.method === 'POST') {
        return await handleReviewRequest(request, env, corsHeaders);
      }

      if (path === '/api/session/reviews' && request.method === 'GET') {
        return await handleGetReviews(request, env, corsHeaders);
      }

      if (path === '/api/session/clear' && request.method === 'POST') {
        return await handleClearSession(request, env, corsHeaders);
      }

      if (path === '/api/health' && request.method === 'GET') {
        return Response.json({ status: 'ok', timestamp: Date.now() }, { headers: corsHeaders });
      }

      // Serve static assets (frontend)
      if (env.ASSETS) {
        return env.ASSETS.fetch(request);
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders });
    } catch (error) {
      console.error('Error:', error);
      return Response.json(
        { error: 'Internal Server Error', message: String(error) },
        { status: 500, headers: corsHeaders }
      );
    }
  },
} satisfies ExportedHandler<Env>;

/**
 * Handle code review requests
 */
async function handleReviewRequest(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const body = await request.json<ReviewRequest>();
  const { code, language, context, sessionId } = body;

  if (!code || !language) {
    return Response.json(
      { error: 'Missing required fields: code and language' },
      { status: 400, headers: corsHeaders }
    );
  }

  // Get or create session
  const sessionKey = sessionId || crypto.randomUUID();
  const id = env.REVIEW_SESSIONS.idFromName(sessionKey);
  const session = env.REVIEW_SESSIONS.get(id);

  // Check if this is a follow-up review
  const latestReviewResponse = await session.fetch(
    new Request('https://dummy/reviews', { method: 'GET' })
  );
  const { reviews } = await latestReviewResponse.json<{ reviews: any[] }>();
  const isFollowUp = reviews.length > 0;

  // Create appropriate prompt
  let userPrompt: string;
  if (isFollowUp) {
    const latestReview = reviews[reviews.length - 1];
    userPrompt = createFollowUpPrompt(latestReview.review, code, language);
  } else {
    userPrompt = createCodeReviewPrompt(code, language, context);
  }

  // Call Workers AI with Llama 3.3
  const aiResponse = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: 2048,
    temperature: 0.7,
  });

  // Extract review text from AI response
  const review = (aiResponse as any).response || JSON.stringify(aiResponse);

  // Store review in session
  const addReviewUrl = new URL('https://dummy/add-review');
  const reviewEntry = await session.fetch(
    new Request(addReviewUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, language, review, context }),
    })
  );

  // Get the stored entry
  const storedEntry = await reviewEntry.json<ReviewEntry>();

  return Response.json(
    {
      sessionId: sessionKey,
      review,
      reviewId: storedEntry.id || crypto.randomUUID(),
      isFollowUp,
      timestamp: Date.now(),
    },
    { headers: corsHeaders }
  );
}

/**
 * Get all reviews for a session
 */
async function handleGetReviews(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('sessionId');

  if (!sessionId) {
    return Response.json(
      { error: 'Missing sessionId parameter' },
      { status: 400, headers: corsHeaders }
    );
  }

  const id = env.REVIEW_SESSIONS.idFromName(sessionId);
  const session = env.REVIEW_SESSIONS.get(id);

  const response = await session.fetch(new Request('https://dummy/reviews', { method: 'GET' }));
  const data = await response.json();

  return Response.json(data, { headers: corsHeaders });
}

/**
 * Clear all reviews in a session
 */
async function handleClearSession(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const body = await request.json<{ sessionId: string }>();
  const { sessionId } = body;

  if (!sessionId) {
    return Response.json(
      { error: 'Missing sessionId' },
      { status: 400, headers: corsHeaders }
    );
  }

  const id = env.REVIEW_SESSIONS.idFromName(sessionId);
  const session = env.REVIEW_SESSIONS.get(id);

  const response = await session.fetch(new Request('https://dummy/clear', { method: 'POST' }));
  const data = await response.json();

  return Response.json(data, { headers: corsHeaders });
}
