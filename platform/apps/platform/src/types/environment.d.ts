declare global {
  namespace NodeJS {
    interface ProcessEnv {
      DRAGONFLY_DEVELOPMENT_PREFIX: string;
      RETURN_DUMMY_SECRETS_DATA: boolean;
      DOCKER_BUILDS_ENABLED: string;
      USE_LOCAL_ANSIBLE_FILES: boolean;
    }
  }
}

export {};
