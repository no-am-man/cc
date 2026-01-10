
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

    # Google OAuth
    GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
    GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET

    # Oracle
    METAL_PRICE_API_KEY=YOUR_METAL_PRICE_API_KEY
    ```

4.  **Run the development server:**

    ```bash
    npm run dev
    ```

## Deployment

This project is configured for **Firebase App Hosting**.

### Prerequisites
1.  A Firebase Project.
2.  A GitHub repository with this code.

### Step-by-Step Deployment

1.  **Push to GitHub**: Ensure your latest changes are pushed to your GitHub repository.
2.  **Firebase Console**: Go to the [Firebase Console](https://console.firebase.google.com/).
3.  **App Hosting**: Navigate to **Build > App Hosting**.
4.  **Get Started**: Click "Get Started" and follow the prompts to connect your GitHub repository.
5.  **Configuration**:
    *   **Root Directory**: Leave as `/` (default).
    *   **Live Branch**: Select `main` (or your preferred branch).
6.  **Environment Variables**:
    You MUST configure the following environment variables in the Firebase App Hosting dashboard (under "Settings" or during setup). Do not commit these to GitHub.

    *   `NEXT_PUBLIC_FIREBASE_API_KEY`
    *   `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
    *   `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
    *   `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
    *   `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
    *   `NEXT_PUBLIC_FIREBASE_APP_ID`
    *   `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` (Optional)
    *   `NEXTAUTH_URL` (Your deployed URL, e.g., `https://your-app-id.web.app`)
    *   `NEXTAUTH_SECRET` (Generate a random string: `openssl rand -base64 32`)
    *   `GOOGLE_CLIENT_ID` (From Google Cloud Console)
    *   `GOOGLE_CLIENT_SECRET` (From Google Cloud Console)
    *   `METAL_PRICE_API_KEY` (From MetalPriceAPI)

7.  **Deploy**: Firebase will automatically build and deploy your application. Future pushes to the `main` branch will trigger automatic rollouts.

### Database Rules
Since this app uses Firestore for the blockchain, ensure your **Firestore Security Rules** are set up correctly to allow:
*   Users to read/write their own chains.
*   Users to read (but not write) public chains.
*   Users to read/write their own private keys (ensure this is strictly protected!).

**Note**: The app is configured to use Firestore for persistence, making it fully compatible with serverless environments.
