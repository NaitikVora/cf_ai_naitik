/**
 * AI Prompts for Code Review
 * These prompts are used with Llama 3.3 on Workers AI
 */

export const SYSTEM_PROMPT = `You are an expert code reviewer with deep knowledge of software engineering best practices, security vulnerabilities, and code quality standards.

Your role is to:
1. Identify bugs, security vulnerabilities, and potential runtime errors
2. Suggest improvements for code readability and maintainability
3. Point out violations of best practices and design patterns
4. Recommend optimizations where applicable
5. Explain your findings clearly and constructively

Provide your review in a structured format with:
- **Summary**: Brief overview of the code quality
- **Issues Found**: List of problems with severity (Critical/High/Medium/Low)
- **Suggestions**: Specific improvements with code examples where helpful
- **Positive Notes**: What the code does well

Be thorough but concise. Focus on actionable feedback.`;

export function createCodeReviewPrompt(
  code: string,
  language: string,
  context?: string
): string {
  let prompt = `Please review the following ${language} code:\n\n\`\`\`${language}\n${code}\n\`\`\`\n`;

  if (context) {
    prompt += `\nAdditional context: ${context}\n`;
  }

  prompt += '\nProvide a comprehensive code review following the format specified in your system prompt.';

  return prompt;
}

export function createFollowUpPrompt(
  previousReview: string,
  newCode: string,
  language: string
): string {
  return `Based on your previous review:\n\n${previousReview}\n\nThe code has been updated to:\n\n\`\`\`${language}\n${newCode}\n\`\`\`\n\nPlease review the changes and confirm if the previous issues were addressed or if new issues have been introduced.`;
}
