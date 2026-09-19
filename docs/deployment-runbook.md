# FlowForge Production Deployment & Operations Runbook

This guide walk through deploying, configuring, and operating FlowForge against live Amazon Web Services (AWS). It is written for human operators deploying FlowForge for the first time.

---

## 1. Required Environment Variables

When running the application with `DEMO_MODE=false`, the backend reads configuration from the environment (or a local `.env` file).

| Variable | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| `DEMO_MODE` | **Yes** | `false` | When `false`, uses live AWS services (Bedrock, Textract, S3, DynamoDB). When `true`, routes to offline in-memory mocks. |
| `ENVIRONMENT` | **Yes** | `development` | Deployment environment: `development`, `staging`, or `production`. In `production`, CORS restricts access strictly to `FRONTEND_DOMAIN`. |
| `AWS_REGION` | **Yes** | `us-east-1` | AWS region where primary application resources (S3, DynamoDB, Lambda, API Gateway) are provisioned. |
| `BEDROCK_REGION` | **Yes** | `us-east-1` | AWS region where Amazon Bedrock foundation models are invoked. *(See Section 2 on Region Consistency).* |
| `BEDROCK_MODEL_ID` | No | `anthropic.claude-3-5-sonnet-20240620-v1:0` | Primary foundation model ID for workflow generation, cross-validation, and conflict detection. |
| `BEDROCK_FAST_MODEL_ID` | No | `anthropic.claude-3-5-haiku-20241022-v1:0` | Low-latency model ID for rapid classification and extraction. |
| `MOCK_LLM` | No | `false` | When `true`, runs against live AWS S3, Textract, and DynamoDB, but substitutes mock AI completions. Useful for smoke-testing infrastructure before Bedrock access is approved. |
| `FRONTEND_DOMAIN` | **Yes** | `http://localhost:5173` | Allowed web origin for CORS in staging/production (e.g. `https://app.yourdomain.com`). |
| `CORS_ORIGINS` | No | `[]` | Optional JSON array or comma-separated list of additional origins to whitelist. |
| `AWS_S3_BUCKET` | **Yes** | — | Name of the private S3 bucket provisioned by the SAM stack for document uploads. |
| `AWS_DYNAMODB_TABLE_WORKFLOWS` | **Yes** | — | Name of the DynamoDB table storing workflow definitions and state. |
| `AWS_DYNAMODB_TABLE_DOCUMENTS` | **Yes** | — | Name of the DynamoDB table storing document metadata and extracted fields. |
| `AWS_DYNAMODB_TABLE_AUDIT` | **Yes** | — | Name of the DynamoDB table storing immutable audit logs. |
| `AWS_DYNAMODB_TABLE_RATE_LIMITS` | **Yes** | — | Name of the DynamoDB table managing distributed request rate counts with TTL. |
| `LOG_LEVEL` | No | `INFO` | Application log level (`DEBUG`, `INFO`, `WARNING`, `ERROR`). |
| `MAX_DOCUMENT_SIZE_MB` | No | `10` | Maximum file size allowed for document uploads (in megabytes). |
| `ALLOWED_MIME_TYPES` | No | `["application/pdf","image/png","image/jpeg"]` | Whitelisted MIME types validated by content header. |
| `CONFIDENCE_PASS` | No | `0.85` | Minimum OCR extraction confidence required to automatically pass a document gate. |
| `CONFIDENCE_WARN` | No | `0.60` | Threshold below which low-confidence extractions trigger manual human review. |

---

## 2. Region Consistency & Bedrock Model Access

### Deploy Region vs. Bedrock Region
FlowForge allows you to deploy serverless infrastructure (Lambda, API Gateway, S3, DynamoDB) in one region (e.g., `ap-south-1` Mumbai) while routing AI calls to a foundation model in a region where Amazon Bedrock is available (e.g., `us-east-1` N. Virginia).

- **Stack Region (`region` in `samconfig.toml`):** The region hosting your compute, storage, and databases.
- **Bedrock Region (`BedrockRegion` in SAM parameters):** The region hosting your foundation models.

### CRITICAL: Requesting Bedrock Model Access
> [!IMPORTANT]
> **Before running any live deployment or evaluation, you MUST request model access in the AWS Bedrock Console for whichever region `BedrockRegion` is set to.**
>
> 1. Sign in to the AWS Management Console.
> 2. Switch your active region to your configured `BedrockRegion` (e.g. `us-east-1`).
> 3. Navigate to **Amazon Bedrock** &rarr; **Model access** (in the left sidebar).
> 4. Click **Modify model access**.
> 5. Enable the models configured in your deployment:
>    - **Anthropic Claude 3.5 Sonnet** (`anthropic.claude-3-5-sonnet-20240620-v1:0`)
>    - **Anthropic Claude 3.5 Haiku** (`anthropic.claude-3-5-haiku-20241022-v1:0`)
>    - *(Optional)* **Amazon Nova Lite** (`amazon.nova-lite-v1:0` / `global.amazon.nova-2-lite-v1:0`)
> 6. Submit the request and wait until the status displays **Access granted**.
>
> If model access is not granted in that region, live invocations will fail with `AccessDeniedException`.

---

## 3. Step-by-Step Deployment (Clean Checkout to Live Deploy)

### Prerequisites
Make sure your development machine or CI/CD runner has:
- **Python 3.12** (`python --version`)
- **Node.js 20+ & npm** (`node -v`)
- **AWS CLI v2** configured with deployment credentials (`aws sts get-caller-identity`)
- **AWS SAM CLI** (`sam --version` &ge; 1.100.0)

### Step 1: Clone Repository
```bash
git clone https://github.com/Lokeshrao69/FirstCommit.git flowforge
cd flowforge
git checkout complete-infrastructure-and-eval
```

### Step 2: Configure AWS Credentials
Ensure your active AWS profile has IAM permissions to create CloudFormation stacks, IAM roles, S3 buckets, DynamoDB tables, and API Gateway HTTP APIs:
```bash
aws configure
# Enter AWS Access Key ID, Secret Access Key, and Default Region (e.g., ap-south-1)
```

### Step 3: Build the SAM Serverless Application
Build the Lambda bundle and package dependencies from `backend/requirements.txt`:
```bash
cd infrastructure
sam build
```

### Step 4: Run Guided Deployment (`sam deploy --guided`)
Run `sam deploy --guided` for your initial stack deployment:
```bash
sam deploy --guided
```

When prompted, provide the following configuration values:

```
Setting up create-bucket
Stack Name [flowforge-staging]: flowforge-staging
AWS Region [ap-south-1]: ap-south-1
Parameter Environment [staging]: staging
Parameter BedrockRegion [us-east-1]: us-east-1
Parameter BedrockModelId [anthropic.claude-3-5-sonnet-20240620-v1:0]: anthropic.claude-3-5-sonnet-20240620-v1:0
Parameter BedrockFastModelId [anthropic.claude-3-5-haiku-20241022-v1:0]: anthropic.claude-3-5-haiku-20241022-v1:0
Parameter CorsOrigins [["http://localhost:5173"]]: ["http://localhost:5173"]
Parameter FrontendDomain [http://localhost:5173]: https://app.yourdomain.com
Parameter DocumentRetentionDays [1]: 1
Parameter LogLevel [INFO]: INFO
Parameter MockLlm [false]: false
Parameter AlarmEmail []: ops-alerts@yourdomain.com
Confirm changes before deploy [y/N]: y
Allow SAM CLI IAM role creation [Y/n]: Y
Disable rollback [y/N]: N
FlowForgeApiFunction has no authentication. Is this okay? [y/N]: y
Save arguments to configuration file [Y/n]: Y
SAM configuration file [samconfig.toml]: samconfig.toml
SAM configuration environment [default]: default
```

*Note on authentication:* The API is designed for public workflow submission with perimeter rate-limiting (API Gateway + DynamoDB). Answering `y` authorizes SAM CLI to bind the function to the HTTP API route.

### Step 5: Capture Deployed Stack Outputs
Once CloudFormation completes the changeset execution, record the stack outputs:
```bash
aws cloudformation describe-stacks \
  --stack-name flowforge-staging \
  --query 'Stacks[0].Outputs' \
  --output table
```
You will see:
- `ApiUrl`: The public API Gateway URL (e.g. `https://abc123xyz.execute-api.ap-south-1.amazonaws.com/staging/`).
- `DocumentBucketName`: Private S3 bucket name.
- `WorkflowsTableName`, `DocumentsTableName`, `AuditTableName`, `RateLimitsTableName`: Physical table names.

---

## 4. Pointing Backend & Frontend to the Live Deploy

### A. Testing the Live API Gateway Endpoint Directly
Perform a health check against the live API Gateway URL:
```bash
curl -i https://<api-id>.execute-api.<region>.amazonaws.com/staging/health
```
Expected response:
```http
HTTP/2 200
content-type: application/json

{"status":"healthy","service":"flowforge-api","environment":"staging","demo_mode":false}
```

Verify CORS headers for your configured `FrontendDomain`:
```bash
curl -i -X OPTIONS https://<api-id>.execute-api.<region>.amazonaws.com/staging/workflows \
  -H "Origin: https://app.yourdomain.com" \
  -H "Access-Control-Request-Method: POST"
```
Expected headers:
```http
access-control-allow-origin: https://app.yourdomain.com
access-control-allow-methods: GET, POST, PUT, DELETE, OPTIONS
```

### B. Running the Local Backend Against Real AWS (`DEMO_MODE=false`)
If you want to run the FastAPI server on your local development machine while persisting state to real AWS cloud resources:
```bash
# Set environment variables from your deployed stack
export DEMO_MODE=false
export ENVIRONMENT=development
export AWS_REGION=ap-south-1
export BEDROCK_REGION=us-east-1
export AWS_S3_BUCKET=flowforge-staging-documentbucket-xxxxx
export AWS_DYNAMODB_TABLE_WORKFLOWS=flowforge-staging-WorkflowsTable-xxxxx
export AWS_DYNAMODB_TABLE_DOCUMENTS=flowforge-staging-DocumentsTable-xxxxx
export AWS_DYNAMODB_TABLE_AUDIT=flowforge-staging-AuditTable-xxxxx
export AWS_DYNAMODB_TABLE_RATE_LIMITS=flowforge-staging-RateLimitsTable-xxxxx
export FRONTEND_DOMAIN=http://localhost:5173

# Start the Uvicorn server
cd backend
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

### C. Building & Running the Frontend Against the Live API
To build the frontend against your deployed API:
```bash
cd frontend

# Set the live API endpoint (or place in frontend/.env.production)
export VITE_API_BASE_URL=https://<api-id>.execute-api.<region>.amazonaws.com/staging
export VITE_USE_MOCK=false

# Lint and Build
npm run lint
npm run build

# Preview the production bundle locally
npm run preview
```

---

## 5. Running the AI Evaluation Harness Against Live Bedrock

FlowForge includes an evaluation harness (`evaluation/run_evaluation.py`) that tests:
1. Workflow Generation Validity (JSON Schema compliance)
2. Document Classification Accuracy
3. Field Extraction Precision
4. Cross-Document Conflict Detection
5. Generation & OCR Processing Latencies

### Step 1: Generate Test Document Fixtures
Generate sample PDF and image documents with clean and conflicting test profiles:
```bash
python evaluation/generate_test_documents.py
```
This populates synthetic test files in `evaluation/data/` (e.g. `income_certificate_valid.txt`, `transcript_conflict.txt`).

### Step 2: Set Live Evaluation Environment Variables
Export the credentials and region for Amazon Bedrock:
```bash
export DEMO_MODE=false
export AWS_REGION=ap-south-1
export BEDROCK_REGION=us-east-1
export BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20240620-v1:0
export BEDROCK_FAST_MODEL_ID=anthropic.claude-3-5-haiku-20241022-v1:0
export AWS_S3_BUCKET=<YourDeployedBucketName>
```

### Step 3: Run Evaluation with `--provider bedrock`
Execute the evaluator using live Bedrock foundation models:
```bash
python evaluation/run_evaluation.py --provider bedrock --strict
```

### Expected Output Format
```
FlowForge evaluation — provider: bedrock (model: anthropic.claude-3-5-sonnet-20240620-v1:0)
==============================================================================
metric                                   value      target  samples  status
------------------------------------------------------------------------------
workflow_generation_validity            100.0%         95%       12  PASS
classification_accuracy                 100.0%         90%        9  PASS
field_extraction_accuracy                96.2%         85%       26  PASS
conflict_detection_accuracy             100.0%         80%        3  PASS
workflow_generation_latency_ms         1850.4ms     5000ms       12  PASS
document_processing_latency_ms          620.1ms    10000ms        9  PASS
==============================================================================

results written to evaluation/results/eval_bedrock_20260919TxxxxxxZ.json
```
- If any metric fails the strict threshold, the script exits with code `1`.
- Results are permanently saved to a timestamped JSON file in `evaluation/results/`.

---

## 6. Verification Checklist for Production Release

Before routing live user traffic:
1. [ ] **CloudWatch Alarms:** Confirm `LambdaErrorAlarm`, `LambdaThrottleAlarm`, and `LambdaDurationAlarm` are in state `OK` in the CloudWatch console.
2. [ ] **Rate Limiting:** Confirm `RateLimitsTable` has TTL enabled on attribute `expires_at`.
3. [ ] **S3 Encryption:** Verify the S3 bucket denies unencrypted PUT requests and has bucket versioning enabled.
4. [ ] **CORS Lockdown:** Confirm that `curl -I -H "Origin: http://localhost:5173"` against the production API returns no `Access-Control-Allow-Origin` header when `Environment=production`.
5. [ ] **Audit Trail:** Query `AuditTableName` after executing a workflow advance to ensure events are written with unique `event_id` and timestamps.
