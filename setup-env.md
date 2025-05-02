# Environment Setup for AI Query Feature

To enable the AI query functionality, you need to set up your environment variables.

## Step 1: Create .env.local file

Create a file named `.env.local` in the root of the `oncare-crm` directory.

## Step 2: Install Required Packages

Install the OpenAI package which is required for the default implementation:

```bash
npm install openai
```

## Step 3: Add OpenAI API Key

Add the following line to your `.env.local` file:

```
OPENAI_API_KEY=your_openai_api_key_here
```

Replace `your_openai_api_key_here` with your actual OpenAI API key. You can get an API key by signing up at [OpenAI's platform](https://platform.openai.com).

## Step 4: Restart the development server

After adding the environment variable, restart your development server for the changes to take effect.

## Using Google's Gemini API (Optional)

The AI query feature includes a built-in toggle to switch between OpenAI and Google's Gemini API. To enable the Gemini option:

1. Install the Gemini SDK:

    ```bash
    npm install @google/generative-ai
    ```

2. Add a Gemini API key to your `.env.local` file:
    ```
    GEMINI_API_KEY=your_gemini_api_key_here
    ```

You can get a Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey).

## Implementation Details

The new AI query interface provides two ways to interact with the AI:

1. **AI Query Mode**: An integrated search option that allows users to type natural language queries directly in the search bar
2. **AI Assistant**: A floating chat interface that can be accessed from anywhere in the application

Both modes allow users to search through cards using natural language queries. For example:

-   "Show me attendees from health systems with revenue over 5B"
-   "Find all conferences in California this year"
-   "Which attendees have 'Director' in their title?"

The AI will interpret these queries and automatically apply the appropriate filters to the data.
