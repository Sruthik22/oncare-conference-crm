# Feature Components

This directory contains components that are specific to features in the application. Each feature has its own subdirectory to organize related components.

## Subdirectories:

-   `attendees/`: Components related to attendee management
-   `conferences/`: Components related to conference management
-   `health-systems/`: Components related to health system management
-   `common/`: Components shared across features but still tied to business logic

When adding new components, consider:

1. Which feature does this component belong to?
2. Is it specific to one entity type or shared across multiple?
3. Does it contain business logic specific to a feature?

Components in this directory are typically more complex and stateful than those in the UI directory. They may use hooks, context, and other React patterns to manage state and behavior.
