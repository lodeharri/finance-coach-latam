interface AppEnv {
  readonly DATABASE_URL: string;
  readonly LLM_PROVIDER?: string;
  readonly GEMINI_API_KEY?: string;
  readonly OPENAI_API_KEY?: string;
  readonly COGNITO_USER_POOL_ID?: string;
  readonly COGNITO_USER_POOL_CLIENT_ID?: string;
  readonly COGNITO_REGION?: string;
  readonly AWS_REGION?: string;
  readonly NODE_ENV?: string;
  readonly LOG_LEVEL?: string;
  readonly CATEGORIZER_QUEUE_URL?: string;
}

function readEnv(): AppEnv {
  return {
    DATABASE_URL: process.env.DATABASE_URL ?? '',
    LLM_PROVIDER: process.env.LLM_PROVIDER,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    COGNITO_USER_POOL_ID: process.env.COGNITO_USER_POOL_ID,
    COGNITO_USER_POOL_CLIENT_ID: process.env.COGNITO_USER_POOL_CLIENT_ID,
    COGNITO_REGION: process.env.COGNITO_REGION,
    AWS_REGION: process.env.AWS_REGION,
    NODE_ENV: process.env.NODE_ENV,
    LOG_LEVEL: process.env.LOG_LEVEL,
    CATEGORIZER_QUEUE_URL: process.env.CATEGORIZER_QUEUE_URL,
  };
}

export interface LLMProviderConfig {
  readonly provider: 'gemini' | 'openai';
  readonly geminiApiKey?: string;
  readonly openaiApiKey?: string;
}

export interface CognitoConfig {
  readonly region: string;
  readonly userPoolId: string;
  readonly userPoolClientId: string;
}

export interface Config {
  readonly databaseUrl: string;
  readonly llm: LLMProviderConfig;
  readonly cognito: CognitoConfig;
  readonly awsRegion: string;
  readonly nodeEnv: 'development' | 'production' | 'test';
  readonly logLevel: 'debug' | 'info' | 'warn' | 'error';
}

function optionalSecret(value: string | undefined): string | undefined {
  const secret = value?.trim();
  return secret || undefined;
}

function readLLMConfig(env: AppEnv): LLMProviderConfig {
  const provider = env.LLM_PROVIDER?.trim() || 'gemini';

  if (provider !== 'gemini' && provider !== 'openai') {
    throw new Error(`LLM_PROVIDER must be "gemini" or "openai"; received "${provider}".`);
  }

  const geminiApiKey = optionalSecret(env.GEMINI_API_KEY);
  const openaiApiKey = optionalSecret(env.OPENAI_API_KEY);

  if (provider === 'gemini' && !geminiApiKey) {
    console.warn('GEMINI_API_KEY is not set; Gemini LLM calls will fail until it is configured.');
  }

  if (provider === 'openai' && !openaiApiKey) {
    console.warn('OPENAI_API_KEY is not set; OpenAI LLM calls will fail until it is configured.');
  }

  return Object.freeze({ provider, geminiApiKey, openaiApiKey });
}

let cached: Config | undefined;

export function getConfig(): Config {
  if (cached) return cached;

  const env = readEnv();
  const databaseUrl = env.DATABASE_URL.trim();

  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is required. Set it in backend/.env (local) or in the Lambda environment (deploy) before invoking the function.',
    );
  }

  const nodeEnv = (env.NODE_ENV ?? 'production') as Config['nodeEnv'];
  const logLevel = (env.LOG_LEVEL ?? 'info') as Config['logLevel'];
  const awsRegion = env.AWS_REGION?.trim() || 'us-east-1';

  cached = Object.freeze({
    databaseUrl,
    llm: readLLMConfig(env),
    cognito: Object.freeze({
      region: env.COGNITO_REGION?.trim() || awsRegion,
      userPoolId: env.COGNITO_USER_POOL_ID?.trim() || '',
      userPoolClientId: env.COGNITO_USER_POOL_CLIENT_ID?.trim() || '',
    }),
    awsRegion,
    nodeEnv,
    logLevel,
  });
  return cached;
}
