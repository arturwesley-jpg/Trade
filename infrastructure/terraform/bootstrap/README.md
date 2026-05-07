# Bootstrap README

This directory contains the initial Terraform configuration to set up the remote state backend.

## Purpose

Before deploying the main infrastructure, you need to create:
1. **S3 Bucket**: Stores Terraform state files
2. **DynamoDB Table**: Provides state locking to prevent concurrent modifications

## Usage

### First Time Setup

```bash
cd bootstrap
terraform init
terraform plan
terraform apply
```

### Outputs

After applying, you'll get:
- `state_bucket_name`: Name of the S3 bucket for state storage
- `lock_table_name`: Name of the DynamoDB table for state locking

### Important Notes

1. **Run Once**: This only needs to be run once per AWS account
2. **Manual State**: This bootstrap configuration uses local state (not remote)
3. **Protect Resources**: The S3 bucket and DynamoDB table should not be deleted
4. **Versioning**: S3 versioning is enabled to track state file history

### After Bootstrap

Once the backend is created, you can deploy the main infrastructure:

```bash
cd ../environments/production
terraform init
terraform plan
terraform apply
```

The main infrastructure will automatically use the S3 backend created here.

## Cleanup

To remove the state backend (only if you're sure):

```bash
terraform destroy
```

**WARNING**: This will delete the state bucket and lock table. Only do this if you've destroyed all other infrastructure first.
