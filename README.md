
# CC Multichain Node on Next.js

Version: 2.0.0

This project is a multichain node built with Next.js and deployed on Firebase App Hosting. It provides a secure and scalable platform for interacting with multiple blockchains.

## Features

*   **Next.js:** A popular React framework for building server-rendered and statically generated web applications.
*   **Firebase App Hosting:** A fully managed, serverless platform for deploying modern web applications.
*   **Next-Auth:** A complete open-source authentication solution for Next.js applications.
*   **Modular Firebase SDK:** A modern, tree-shakable SDK for interacting with Firebase services.

## Getting Started

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/your-username/your-repository.git
    ```

2.  **Install the dependencies:**

    ```bash
    npm install
    ```

3.  **Set up your environment variables:**

    Create a `.env.local` file in the root of your project and add the following:

    ```
    # Firebase
    NEXT_PUBLIC_FIREBASE_API_KEY=YOUR_API_KEY
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=YOUR_AUTH_DOMAIN
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=YOUR_PROJECT_ID
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=YOUR_STORAGE_BUCKET
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=YOUR_MESSAGING_SENDER_ID
    NEXT_PUBLIC_FIREBASE_APP_ID=YOUR_APP_ID
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=YOUR_MEASUREMENT_ID

    # Next-Auth
    NEXTAUTH_URL=http://localhost:3000
    NEXTAUTH_SECRET=YOUR_SECRET
    ```

4.  **Run the development server:**

    ```bash
    npm run dev
    ```

## Deployment

This project is deployed on Firebase App Hosting. To deploy your own instance, you will need to create a Firebase project and a Firebase App Hosting backend. You can find more information in the [Firebase App Hosting documentation](https://firebase.google.com/docs/app-hosting).
