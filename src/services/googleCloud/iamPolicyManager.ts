/**
 * Google Cloud IAM Policy Manager with Exponential Backoff Retry
 * Handles concurrent policy modifications safely
 */

interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

interface IamPolicy {
  version: number;
  etag: string;
  bindings: IamBinding[];
}

interface IamBinding {
  role: string;
  members: string[];
  condition?: {
    title: string;
    description?: string;
    expression: string;
  };
}

interface IamPolicyResult {
  success: boolean;
  policy?: IamPolicy;
  error?: string;
  attempts: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 5,
  baseDelayMs: 1000,
  maxDelayMs: 32000,
};

/**
 * Calculate exponential backoff delay with jitter
 */
function calculateBackoffDelay(attempt: number, config: RetryConfig): number {
  const exponentialDelay = Math.min(
    config.baseDelayMs * Math.pow(2, attempt),
    config.maxDelayMs
  );
  // Add jitter (±25% randomization)
  const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);
  return Math.floor(exponentialDelay + jitter);
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if error is a concurrent modification error
 */
function isConcurrentModificationError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('concurrent') ||
      message.includes('etag') ||
      message.includes('policy has changed') ||
      message.includes('aborted') ||
      message.includes('conflict')
    );
  }
  return false;
}

/**
 * Get current IAM policy for a resource
 */
async function getIamPolicy(
  projectId: string,
  resourceType: 'project' | 'bucket' | 'topic' | 'subscription',
  resourceName: string,
  accessToken: string
): Promise<IamPolicy> {
  let url: string;

  switch (resourceType) {
    case 'project':
      url = `https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}:getIamPolicy`;
      break;
    case 'bucket':
      url = `https://storage.googleapis.com/storage/v1/b/${resourceName}/iam`;
      break;
    case 'topic':
      url = `https://pubsub.googleapis.com/v1/projects/${projectId}/topics/${resourceName}:getIamPolicy`;
      break;
    case 'subscription':
      url = `https://pubsub.googleapis.com/v1/projects/${projectId}/subscriptions/${resourceName}:getIamPolicy`;
      break;
    default:
      throw new Error(`Unsupported resource type: ${resourceType}`);
  }

  const response = await fetch(url, {
    method: resourceType === 'bucket' ? 'GET' : 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: resourceType === 'bucket' ? undefined : JSON.stringify({}),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get IAM policy: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Set IAM policy for a resource
 */
async function setIamPolicy(
  projectId: string,
  resourceType: 'project' | 'bucket' | 'topic' | 'subscription',
  resourceName: string,
  policy: IamPolicy,
  accessToken: string
): Promise<IamPolicy> {
  let url: string;

  switch (resourceType) {
    case 'project':
      url = `https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}:setIamPolicy`;
      break;
    case 'bucket':
      url = `https://storage.googleapis.com/storage/v1/b/${resourceName}/iam`;
      break;
    case 'topic':
      url = `https://pubsub.googleapis.com/v1/projects/${projectId}/topics/${resourceName}:setIamPolicy`;
      break;
    case 'subscription':
      url = `https://pubsub.googleapis.com/v1/projects/${projectId}/subscriptions/${resourceName}:setIamPolicy`;
      break;
    default:
      throw new Error(`Unsupported resource type: ${resourceType}`);
  }

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ policy }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to set IAM policy: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Modify IAM policy with retry mechanism
 * This is the main function to use for safe policy modifications
 */
export async function modifyIamPolicyWithRetry(
  projectId: string,
  resourceType: 'project' | 'bucket' | 'topic' | 'subscription',
  resourceName: string,
  accessToken: string,
  modifyPolicy: (policy: IamPolicy) => IamPolicy,
  config: Partial<RetryConfig> = {}
): Promise<IamPolicyResult> {
  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      // Step 1: Read current policy
      console.log(`[IAM] Attempt ${attempt + 1}: Reading current policy...`);
      const currentPolicy = await getIamPolicy(
        projectId,
        resourceType,
        resourceName,
        accessToken
      );

      // Step 2: Modify policy in memory
      console.log(`[IAM] Modifying policy (etag: ${currentPolicy.etag})...`);
      const modifiedPolicy = modifyPolicy({ ...currentPolicy });

      // Preserve the etag from the read
      modifiedPolicy.etag = currentPolicy.etag;

      // Step 3: Write modified policy
      console.log(`[IAM] Writing modified policy...`);
      const newPolicy = await setIamPolicy(
        projectId,
        resourceType,
        resourceName,
        modifiedPolicy,
        accessToken
      );

      console.log(`[IAM] Policy updated successfully on attempt ${attempt + 1}`);
      return {
        success: true,
        policy: newPolicy,
        attempts: attempt + 1,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if this is a concurrent modification error
      if (isConcurrentModificationError(error)) {
        if (attempt < retryConfig.maxRetries) {
          const delay = calculateBackoffDelay(attempt, retryConfig);
          console.warn(
            `[IAM] Concurrent modification detected. Retrying in ${delay}ms... (attempt ${attempt + 1}/${retryConfig.maxRetries + 1})`
          );
          await sleep(delay);
          continue;
        }
      } else {
        // Non-retryable error
        console.error(`[IAM] Non-retryable error:`, error);
        break;
      }
    }
  }

  return {
    success: false,
    error: lastError?.message || 'Unknown error',
    attempts: retryConfig.maxRetries + 1,
  };
}

/**
 * Add a member to a role with retry
 */
export async function addIamBinding(
  projectId: string,
  resourceType: 'project' | 'bucket' | 'topic' | 'subscription',
  resourceName: string,
  accessToken: string,
  role: string,
  member: string,
  config?: Partial<RetryConfig>
): Promise<IamPolicyResult> {
  return modifyIamPolicyWithRetry(
    projectId,
    resourceType,
    resourceName,
    accessToken,
    (policy) => {
      const bindings = [...(policy.bindings || [])];
      const existingBinding = bindings.find(b => b.role === role);

      if (existingBinding) {
        if (!existingBinding.members.includes(member)) {
          existingBinding.members.push(member);
        }
      } else {
        bindings.push({ role, members: [member] });
      }

      return { ...policy, bindings };
    },
    config
  );
}

/**
 * Remove a member from a role with retry
 */
export async function removeIamBinding(
  projectId: string,
  resourceType: 'project' | 'bucket' | 'topic' | 'subscription',
  resourceName: string,
  accessToken: string,
  role: string,
  member: string,
  config?: Partial<RetryConfig>
): Promise<IamPolicyResult> {
  return modifyIamPolicyWithRetry(
    projectId,
    resourceType,
    resourceName,
    accessToken,
    (policy) => {
      const bindings = (policy.bindings || []).map(binding => {
        if (binding.role === role) {
          return {
            ...binding,
            members: binding.members.filter(m => m !== member),
          };
        }
        return binding;
      }).filter(binding => binding.members.length > 0);

      return { ...policy, bindings };
    },
    config
  );
}

export type { IamPolicy, IamBinding, IamPolicyResult, RetryConfig };
