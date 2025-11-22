# AI Prompts Documentation

This document contains all AI prompts used in the AI Code Review Bot application. The prompts are designed to work with Llama 3.3 70B on Cloudflare Workers AI.

## Overview

The application uses a structured prompting approach with:
- **System Prompt**: Defines the AI's role and review format
- **User Prompts**: Context-specific instructions for different review scenarios

All prompts are defined in `src/prompts.ts` and used by the main Worker in `src/index.ts`.

---

## System Prompt

**Purpose**: Establishes the AI's role as an expert code reviewer and defines the output format.

**Location**: `src/prompts.ts` - `SYSTEM_PROMPT`

**Prompt**:
```
You are an expert code reviewer with deep knowledge of software engineering best practices, security vulnerabilities, and code quality standards.

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

Be thorough but concise. Focus on actionable feedback.
```

**Design Rationale**:
- Sets clear expectations for the AI's expertise level
- Defines multiple review dimensions (bugs, security, quality, performance)
- Specifies structured output format for consistent reviews
- Emphasizes constructive, actionable feedback
- Includes positive feedback to balance criticism

---

## Code Review Prompt (First Review)

**Purpose**: Generates the initial code review for newly submitted code.

**Location**: `src/prompts.ts` - `createCodeReviewPrompt()`

**Function Signature**:
```typescript
createCodeReviewPrompt(code: string, language: string, context?: string): string
```

**Generated Prompt Template**:
```
Please review the following {language} code:

```{language}
{code}
```

[Optional: Additional context: {context}]

Provide a comprehensive code review following the format specified in your system prompt.
```

**Usage Example**:
```typescript
const prompt = createCodeReviewPrompt(
  "function add(a, b) { return a + b }",
  "javascript",
  "Focus on type safety"
);
```

**Generated Example**:
```
Please review the following javascript code:

```javascript
function add(a, b) { return a + b }
```

Additional context: Focus on type safety

Provide a comprehensive code review following the format specified in your system prompt.
```

**Design Rationale**:
- Clear code block formatting with language specification
- Optional context allows users to guide the review focus
- References system prompt to maintain output consistency
- Simple, direct instruction for better LLM comprehension

---

## Follow-Up Review Prompt

**Purpose**: Generates reviews for updated code that references previous feedback.

**Location**: `src/prompts.ts` - `createFollowUpPrompt()`

**Function Signature**:
```typescript
createFollowUpPrompt(previousReview: string, newCode: string, language: string): string
```

**Generated Prompt Template**:
```
Based on your previous review:

{previousReview}

The code has been updated to:

```{language}
{newCode}
```

Please review the changes and confirm if the previous issues were addressed or if new issues have been introduced.
```

**Usage Example**:
```typescript
const prompt = createFollowUpPrompt(
  "Previous review: Missing error handling...",
  "function add(a, b) { try { return a + b } catch(e) { console.error(e) } }",
  "javascript"
);
```

**Generated Example**:
```
Based on your previous review:

Previous review: Missing error handling...

The code has been updated to:

```javascript
function add(a, b) { try { return a + b } catch(e) { console.error(e) } }
```

Please review the changes and confirm if the previous issues were addressed or if new issues have been introduced.
```

**Design Rationale**:
- Provides context by including previous review
- Explicitly asks AI to compare old vs. new code
- Checks for both issue resolution and new problems
- Enables iterative code improvement workflow

---

## Prompt Implementation in Code

### Main Worker (`src/index.ts`)

The prompts are used in the `handleReviewRequest` function:

```typescript
// Determine if this is a follow-up review
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
```

---

## AI Model Configuration

**Model**: `@cf/meta/llama-3.3-70b-instruct-fp8-fast`

**Parameters**:
- **max_tokens**: 2048
  - Allows comprehensive reviews with examples
  - Balances detail with response time

- **temperature**: 0.7
  - Provides creative but consistent suggestions
  - Not too random (avoids hallucinations)
  - Not too deterministic (allows varied phrasing)

**Message Structure**:
- **System message**: Sets the AI's role and behavior
- **User message**: Provides code and specific review instructions

---

## Prompt Engineering Techniques Used

### 1. Role Definition
- "You are an expert code reviewer..." establishes expertise
- Defines specific responsibilities and knowledge areas

### 2. Structured Output
- Specifies exact format (Summary, Issues, Suggestions, Positive Notes)
- Uses markdown formatting for readability
- Ensures consistent review structure

### 3. Severity Classification
- Requests issue severity levels (Critical/High/Medium/Low)
- Helps users prioritize fixes

### 4. Context Injection
- Allows user-provided context to guide review focus
- Maintains flexibility for different use cases

### 5. Few-Shot Learning (Implicit)
- Format specification acts as example template
- AI learns expected structure from instructions

### 6. Chain of Thought
- Follow-up prompts reference previous reviews
- Enables iterative improvement dialogue

### 7. Constraint Setting
- "Be thorough but concise" balances detail with brevity
- "Focus on actionable feedback" ensures practical suggestions

---

## Example Review Output

Given this input:
```javascript
function calculateDiscount(price, discount) {
  return price - discount;
}
```

The AI generates:
```
**Summary**
This is a simple discount calculation function with several issues that could lead to bugs in production.

**Issues Found**

Critical:
- No input validation - function accepts any values including negative numbers, strings, or null
- No type checking - could receive non-numeric inputs leading to NaN results

High:
- Function assumes discount is absolute value, not percentage (unclear naming)
- Missing error handling for edge cases

Medium:
- No documentation/comments explaining expected inputs
- Function name suggests percentage discount but implementation treats it as absolute value

**Suggestions**

1. Add input validation:
```javascript
function calculateDiscount(price, discount) {
  if (typeof price !== 'number' || typeof discount !== 'number') {
    throw new TypeError('Price and discount must be numbers');
  }
  if (price < 0 || discount < 0) {
    throw new RangeError('Price and discount must be non-negative');
  }
  if (discount > price) {
    throw new RangeError('Discount cannot exceed price');
  }
  return price - discount;
}
```

2. Consider if discount should be a percentage instead:
```javascript
function calculateDiscount(price, discountPercent) {
  // ... validation ...
  return price * (1 - discountPercent / 100);
}
```

**Positive Notes**
- Function is simple and easy to understand
- Pure function with no side effects
- Clear parameter names
```

---

## Prompt Versioning

**Current Version**: 1.0

**Changelog**:
- v1.0 (2024-11-22): Initial prompts for code review bot
  - System prompt with structured output format
  - Code review prompt with optional context
  - Follow-up review prompt with previous review reference

---

## Future Prompt Improvements

Potential enhancements for future versions:

1. **Language-Specific Reviews**
   - Customize prompts for each programming language
   - Include language-specific best practices

2. **Custom Review Templates**
   - Allow users to define custom review criteria
   - Support different review types (security, performance, style)

3. **Multi-File Context**
   - Extend prompts to handle multiple related files
   - Understand project structure and dependencies

4. **Diff-Based Reviews**
   - Review only changed lines (git diff style)
   - More efficient for large files with small changes

5. **Learning from Feedback**
   - Incorporate user feedback on review quality
   - Adjust prompts based on accepted/rejected suggestions

---

## Testing Prompts

To test prompt effectiveness:

1. **Submit basic code** - Verify review completeness
2. **Submit buggy code** - Check bug detection accuracy
3. **Submit vulnerable code** - Validate security awareness
4. **Submit follow-up** - Test context retention
5. **Submit complex code** - Assess depth of analysis

---

## Prompt Maintenance

**Guidelines**:
- Keep prompts concise but comprehensive
- Test changes with various code samples
- Monitor review quality metrics
- Update based on user feedback
- Document all changes in this file

**Contact**: For prompt suggestions or issues, please open a GitHub issue.

---

## References

- [Prompt Engineering Guide](https://www.promptingguide.ai/)
- [Llama 3.3 Documentation](https://ai.meta.com/llama/)
- [Cloudflare Workers AI Docs](https://developers.cloudflare.com/workers-ai/)
