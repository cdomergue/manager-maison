# TachesMenageres

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 20.1.4.

## Architecture

The application is built with two deployment modes:

### Production (AWS)

- Frontend: AWS Amplify
- Backend: AWS Lambda + API Gateway
- Automatic deployments from the main branch

### Development

- Frontend: Angular development server
- Backend: Unified Node.js server (static files + API)
- All-in-one local development experience

## Development Setup

1. **Install dependencies:**

   ```bash
   npm install
   cd server && npm install
   ```

2. **Start the development server:**

   ```bash
   # In one terminal, start the unified server (API + static files)
   cd server
   npm run dev

   # In another terminal, start the Angular development server
   ng serve
   ```

The application will be available at:

- Angular dev server: `http://localhost:4200/`
- Unified server: `http://localhost:3001/`

The application will automatically reload whenever you modify any of the source files.

## Building

### For Production (AWS)

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. The build is automatically deployed to AWS Amplify when pushed to the main branch.

### For Development

```bash
ng build
cd server
npm run build-and-start
```

This will build the Angular app and serve it through the unified server.

## Lambda Functions

The `lambda/` directory contains AWS Lambda functions that provide the backend API in production. To deploy Lambda functions:

```bash
./deploy-lambda.sh
```

## Running Tests

### Unit Tests

```bash
ng test
```

Executes unit tests via [Karma](https://karma-runner.github.io).

### End-to-End Tests

```bash
ng e2e
```

Note: Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

- [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli)
- [AWS Amplify Documentation](https://docs.aws.amazon.com/amplify/)
- [AWS Lambda Documentation](https://docs.aws.amazon.com/lambda/)
