import { GetParameterCommand, type SSMClient } from '@aws-sdk/client-ssm';

/**
 * Read the demo password from SSM Parameter Store at runtime.
 *
 * Fails closed: a missing parameter, an empty value, or a permissions error
 * propagates to the caller so the deploy fails instead of falling back to a
 * default password. Only the parameter NAME travels in the Lambda
 * environment — the value never enters git, Lambda env, or the CloudFormation
 * template.
 */
export async function readDemoPassword(
  client: SSMClient,
  paramName: string,
): Promise<string> {
  const { Parameter } = await client.send(
    new GetParameterCommand({ Name: paramName, WithDecryption: true }),
  );
  if (!Parameter?.Value) {
    throw new Error(`SSM parameter ${paramName} returned no value`);
  }
  return Parameter.Value;
}
