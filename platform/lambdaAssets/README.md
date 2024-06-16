# How to deploy Lambda functions using TypeScript

--Shell script to create a new lambda directory base setup--

Make sure you are in the lambdaAssets directory and run below command with the lambdaProjectName as the first argument.

```bash
./setupLambdaProject.sh myLambdaProjectName
```

Additionaly, if you know what sdk-client services you want to have installed, you can use the --serviceName flag and provide the services to have them installed. The example below installs the "@aws-sdk/client-s3" client service and the"@aws-sdk/client-dynamodb" client service

```bash
./setupLambdaProject.sh myLambdaProject --serviceName s3 dynamodb
```

--Manual Steps to create a new lambda directory base setup--

Create a new directory then navigate to it:

```bash
mkdir -p <projectName>/src
cd <projectName>
```

Initialize it with a TypeScript configuration:

```bash
npm init -y
npx tsc --init
```

Install the follow requisite packages, it's always required:

```bash
npm install --save @types/aws-lambda
```

> OPTIONAL
>
> Install additional aws sdk packages for the services you want to use:

```bash
npm install @aws-sdk/client-<service> for example @aws-sdk/client-s3
```

Update the tsconfig.json accordingly. Don't have to use the same settings as below, but it's a good starting point:

```json
{
  "compilerOptions": {
    /* Visit https://aka.ms/tsconfig.json to read more about this file */
    "target": "es5" /* Specify ECMAScript target version: 'ES3' (default), 'ES5', 'ES2015', 'ES2016', 'ES2017', 'ES2018', 'ES2019', 'ES2020', 'ES2021', or 'ESNEXT'. */,
    "module": "commonjs" /* Specify module code generation: 'none', 'commonjs', 'amd', 'system', 'umd', 'es2015', 'es2020', or 'ESNext'. */,
    "lib": [
      "es2018"
    ] /* Specify library files to be included in the compilation. */,
    "sourceMap": true /* Generates corresponding '.map' file. */,
    "outDir": "dist" /* Redirect output structure to the directory. */,
    "rootDir": "src" /* Specify the root directory of input files. Use to control the output directory structure with --outDir. */,
    "strict": true /* Enable all strict type-checking options. */,
    "esModuleInterop": true /* Enables emit interoperability between CommonJS and ES Modules via creation of namespace objects for all imports. Implies 'allowSyntheticDefaultImports'. */,
    /* Advanced Options */
    "skipLibCheck": true /* Skip type checking of declaration files. */,
    "forceConsistentCasingInFileNames": true /* Disallow inconsistently-cased references to the same file. */
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "**/*.spec.ts"]
}
```

Create an index.ts file in the src directory and put your lambda logic in there. For example, the following code will return a 200 status code and a JSON object with a message property set to "Hello, World!":

```typescript
// File: src/index.ts
export const handler: Handler = async (event: any) => {
  console.log('Hello, World!');
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Hello, World!' }),
  };
};
```

To compile and re-compile the TypeScript code to JavaScript:

```bash
npx tsc
```
