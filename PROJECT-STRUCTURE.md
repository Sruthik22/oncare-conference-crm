# OnCare CRM Project Structure

This document outlines the new project structure for the OnCare CRM application and provides guidance for migrating existing code to the new structure.

## New Directory Structure

The project now follows a modular organization:

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

Each directory has a README.md file explaining its purpose and guidelines for adding new files.

## Migration Plan

We're implementing this new structure incrementally. Here's the migration plan:

1. **Phase 1: Setup Directory Structure** (Completed)

    - Create the new directory structure
    - Add documentation for each directory
    - Create index files for easier imports

2. **Phase 2: Component Migration** (In Progress)

    - Copy components to their new locations
    - Update imports in the codebase
    - Remove old component files after migration is complete

3. **Phase 3: Test and Refine**
    - Test the application to ensure everything works with the new structure
    - Refine the structure based on team feedback

## Migration Guidelines

When migrating components and hooks, follow these guidelines:

1. **Copy, Don't Move**: First copy files to their new location, then update imports, and only delete the original after everything is working.

2. **Use Index Files**: Import from index files rather than directly from component files for cleaner imports:

    ```typescript
    // Good
    import { Icon, Checkbox } from "@/components/ui"

    // Avoid
    import { Icon } from "@/components/ui/Icon"
    import { Checkbox } from "@/components/ui/checkbox"
    ```

3. **Update Testing**: Update any test files to use the new import paths.

4. **Refactor Opportunistically**: When moving a component, consider if it needs refactoring to better fit the new structure, but keep changes minimal.

## Benefits of the New Structure

This new structure provides several benefits:

1. **Improved Organization**: Components and hooks are logically grouped by purpose and feature.

2. **Better Discoverability**: New team members can quickly understand the codebase structure.

3. **Code Reuse**: Common UI components and hooks are more easily identified and reused.

4. **Scalability**: The structure can easily accommodate new features and components without becoming unwieldy.

5. **Maintenance**: Related code is kept together, making maintenance easier.

## Questions?

If you have questions about the new structure or where something should go, please refer to the README.md files in each directory or ask in the team chat.
