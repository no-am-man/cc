# CC Blockchain Testing Plan (100% Coverage)

We will implement a comprehensive test suite using `jest` and `supertest`. 
Since there is no graphical Web UI yet, "UI Tests" will focus on the **API Interface** (HTTP Endpoints) which serves as the current user interface.

## 1. Environment Setup
- Install `jest` (Test Runner & Assertions).
- Install `supertest` (HTTP Assertions).
- Update `package.json` with test scripts and coverage configuration.

## 2. Unit Testing (`tests/core/`, `tests/wallet/`)
We will target 100% path coverage for the following classes:

- **[src/core/Block.js](src/core/Block.js)**
    - Verify `calculateHash` consistency.
    - Verify `signBlock` and `verifySignature` with valid/invalid keys.
- **[src/core/ContractRunner.js](src/core/ContractRunner.js)**
    - Test execution of valid JS code.
    - **Security**: Verify `process`, `require`, and `fs` are inaccessible.
    - **Gas/Timeout**: Test infinite loop handling (`while(true)`).
    - **Determinism**: Verify `Math.random` throws error.
- **[src/core/UserChain.js](src/core/UserChain.js)**
    - Test Genesis block creation.
    - Test `mint` (Inflation logic).
    - Test `createTransaction` (Send).
    - Test `addBlock` validation (prevHash, signature).
    - Test `validateChain` integrity checks.
- **[src/wallet/Portfolio.js](src/wallet/Portfolio.js)**
    - Test adding/updating assets.
    - Test summary output.
- **[src/Oracle.js](src/Oracle.js)**
    - Verify Singleton pattern (same instance).
    - Test get/set price.

## 3. Integration/API Testing (`tests/api/`)
- **[src/server.js](src/server.js)** (via Supertest)
    - **GET /info**: Check node identity and stats.
    - **POST /mint**: Verify balance updates.
    - **GET /chain**: Verify chain length increases.
    - **POST /transfer-request**: Test the mocked transfer logic.
    - **POST /execute**: Test arbitrary code execution via API.

## 4. Execution
- Run `npm test -- --coverage`.
- Refine tests until 100% coverage is reported.

