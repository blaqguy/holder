#!/bin/bash

# Exit if any command fails
set -e

# Function to display usage
usage() {
  echo "Usage: $0 projectName [--serviceName service1 service2 ...]"
}

# Check for minimum number of arguments
if [ "$#" -lt 1 ]; then
  usage
  exit 1
fi

# First argument is the project name
PROJECT_NAME=$1
shift

# Initialize an array to hold packages to be installed
declare -a PACKAGES_TO_INSTALL=("@types/aws-lambda")

# Flag to track when we start processing service names
PROCESS_SERVICES=false

# Process remaining arguments
while [ "$#" -gt 0 ]; do
  case "$1" in
    --serviceName)
      PROCESS_SERVICES=true
      shift
      ;;
    *)
      if $PROCESS_SERVICES; then
        # Add AWS SDK package for the service to the array
        PACKAGES_TO_INSTALL+=("@aws-sdk/client-$1")
      else
        # Unexpected argument
        usage
        exit 1
      fi
      shift
      ;;
  esac
done

# Create project directory and navigate into it
mkdir -p "$PROJECT_NAME/src"
cd "$PROJECT_NAME"

# Initialize the project with npm and TypeScript configuration
npm init -y
npx tsc --init

# Prepare tsconfig.json with provided settings
cat <<EOT > tsconfig.json
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
EOT

# Create index.ts in the src directory with the default Lambda handler function
cat <<EOT > src/index.ts
// File: src/index.ts
import { Handler } from 'aws-lambda';

// File: src/index.ts
export const handler: Handler = async (event: any) => {
  console.log('Hello, World!');
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Hello, World!' }),
  };
};
EOT

# Install all required packages at once
npm install --save "${PACKAGES_TO_INSTALL[@]}"

echo "Project $PROJECT_NAME setup complete. Packages installed: ${PACKAGES_TO_INSTALL[*]}"
