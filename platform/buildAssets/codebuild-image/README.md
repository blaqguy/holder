# Manually building and pushing Docker image to ECR

1. Authenticate to target environment using AWS SSO and export credentials for programatic access
2. Navigate to Amazon ECR -> Repositories -> codebuild-image -> View push commands
3. Run commands in directory containing `Dockerfile`

If you are running an ARM processor (M1 Macbook), include `--platform linux/amd64` in your build command
`docker build --platform linux/amd64 -t codebuild-image .`

Example set of commands using platform sandbox as target environment:
`aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 259311287469.dkr.ecr.us-east-1.amazonaws.com`
`docker build -t codebuild-image .`
`docker tag codebuild-image:latest 259311287469.dkr.ecr.us-east-1.amazonaws.com/codebuild-image:latest`
`docker push 259311287469.dkr.ecr.us-east-1.amazonaws.com/codebuild-image:latest`
