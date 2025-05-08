# OnCare CRM

A lightweight, AI-native CRM built with Next.js and Supabase.

## Features

-   Modern, responsive UI with both table and card views
-   Real-time data synchronization with Supabase
-   Easy navigation between contacts, health systems, and conferences
-   Beautiful and intuitive user interface

## Getting Started

1. Clone the repository
2. Install dependencies:
    ```bash
    npm install
    ```
3. Create a `.env.local` file in the root directory with your Supabase credentials:
    ```
    NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
    ```
4. Run the development server:
    ```bash
    npm run dev
    ```
5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

The project follows a modular organization:

```
oncare-crm/
├── app/                  # Next.js App Router files
│   ├── api/              # API routes
│   └── (routes)/         # Page routes
├── components/           # React components
│   ├── ui/               # Low-level UI components
│   ├── features/         # Feature-specific components
│   │   ├── attendees/    # Attendee-related components
│   │   ├── conferences/  # Conference-related components
│   │   ├── health-systems/ # Health system-related components
│   │   └── common/       # Shared feature components
│   └── layout/           # Layout components
├── hooks/                # React hooks
│   ├── api/              # API-related hooks
│   ├── features/         # Feature-specific hooks
│   └── ui/               # UI-related hooks
├── lib/                  # Utility functions and services
│   ├── api/              # API-related utilities
│   ├── context/          # React context providers
│   └── utils/            # Helper utilities
├── types/                # TypeScript type definitions
└── public/               # Static assets
```

## Database Schema

The CRM uses the following tables in Supabase:

-   `contacts`: Stores contact information
-   `health_systems`: Stores health system information
-   `conferences`: Stores conference information

## Development

-   Built with Next.js 13+ (App Router)
-   Uses TypeScript for type safety
-   Styled with Tailwind CSS
-   Uses TanStack Table for data tables
-   Integrates with Supabase for data storage

## Learn More

To learn more about Next.js, take a look at the following resources:

-   [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
-   [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
