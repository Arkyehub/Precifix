# AI Rules for this Application

This document outlines the core technologies and best practices for developing this application.

## Tech Stack Overview

This project is built using a modern web development stack, focusing on performance, maintainability, and a great developer experience.

*   **React**: A declarative, component-based JavaScript library for building user interfaces.
*   **TypeScript**: A typed superset of JavaScript that compiles to plain JavaScript, enhancing code quality and developer productivity.
*   **Vite**: A fast and opinionated build tool that provides a lightning-fast development server and optimized builds.
*   **Tailwind CSS**: A utility-first CSS framework for rapidly building custom designs directly in your markup.
*   **shadcn/ui**: A collection of beautifully designed, accessible, and customizable UI components built with Radix UI and Tailwind CSS.
*   **React Router**: A standard library for routing in React applications, enabling declarative navigation.
*   **TanStack Query (React Query)**: A powerful library for managing, caching, and synchronizing server state in React applications.
*   **Lucide React**: A collection of beautiful and customizable open-source icons.
*   **jsPDF**: A client-side JavaScript PDF generation library.
*   **Sonner**: A modern toast component for displaying notifications.

## Library Usage Guidelines

To maintain consistency and leverage the strengths of each library, please adhere to the following guidelines:

*   **UI Components**: Always prioritize `shadcn/ui` components for building the user interface. If a specific component is not available in `shadcn/ui`, create a new component following the `shadcn/ui` styling conventions (using Tailwind CSS and Radix UI primitives if applicable).
*   **Styling**: Use `Tailwind CSS` exclusively for all styling. Avoid writing custom CSS files or inline styles unless absolutely necessary for dynamic, component-specific properties.
*   **Routing**: Use `react-router-dom` for all navigation and routing within the application. Define routes in `src/App.tsx`.
*   **State Management (Server State)**: For fetching, caching, and updating server data, use `@tanstack/react-query`.
*   **State Management (Client State)**: For local component state, use React's built-in `useState`, `useReducer`, or `useContext` hooks.
*   **Icons**: Integrate icons using the `lucide-react` library.
*   **Toast Notifications**: Use `sonner` for displaying simple, non-blocking notifications to the user.
*   **PDF Generation**: Use `jspdf` for any functionality requiring client-side PDF document creation.