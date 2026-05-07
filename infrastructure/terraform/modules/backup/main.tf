# Backup Module - AWS Backup for RDS and EBS

variable "environment" {
  type = string
}

variable "rds_arn" {
  type = string
}

variable "backup_retention" {
  type    = number
  default = 30
}

# S3 Bucket for Backups
resource "aws_s3_bucket" "backups" {
  bucket = "${var.environment}-trading-bot-backups-${data.aws_caller_identity.current.account_id}"

  tags = {
    Name = "${var.environment}-trading-bot-backups"
  }
}

resource "aws_s3_bucket_versioning" "backups" {
  bucket = aws_s3_bucket.backups.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    id     = "delete-old-backups"
    status = "Enabled"

    expiration {
      days = var.backup_retention
    }

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}

resource "aws_s3_bucket_public_access_block" "backups" {
  bucket = aws_s3_bucket.backups.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# AWS Backup Vault
resource "aws_backup_vault" "main" {
  name = "${var.environment}-trading-bot-vault"

  tags = {
    Name = "${var.environment}-trading-bot-vault"
  }
}

# AWS Backup Plan
resource "aws_backup_plan" "main" {
  name = "${var.environment}-trading-bot-backup-plan"

  rule {
    rule_name         = "daily_backup"
    target_vault_name = aws_backup_vault.main.name
    schedule          = "cron(0 2 * * ? *)" # 2 AM UTC daily

    lifecycle {
      delete_after = var.backup_retention
    }

    recovery_point_tags = {
      Environment = var.environment
      Type        = "daily"
    }
  }

  rule {
    rule_name         = "weekly_backup"
    target_vault_name = aws_backup_vault.main.name
    schedule          = "cron(0 3 ? * SUN *)" # 3 AM UTC every Sunday

    lifecycle {
      delete_after = 90
    }

    recovery_point_tags = {
      Environment = var.environment
      Type        = "weekly"
    }
  }

  tags = {
    Name = "${var.environment}-trading-bot-backup-plan"
  }
}

# IAM Role for AWS Backup
resource "aws_iam_role" "backup" {
  name = "${var.environment}-aws-backup-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "backup.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "backup" {
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForBackup"
  role       = aws_iam_role.backup.name
}

resource "aws_iam_role_policy_attachment" "restore" {
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForRestores"
  role       = aws_iam_role.backup.name
}

# Backup Selection
resource "aws_backup_selection" "rds" {
  name         = "${var.environment}-rds-backup-selection"
  plan_id      = aws_backup_plan.main.id
  iam_role_arn = aws_iam_role.backup.arn

  resources = [
    var.rds_arn
  ]
}

# Data source
data "aws_caller_identity" "current" {}

# Outputs
output "backup_vault_arn" {
  value = aws_backup_vault.main.arn
}

output "backup_plan_id" {
  value = aws_backup_plan.main.id
}

output "backup_bucket_name" {
  value = aws_s3_bucket.backups.id
}

output "backup_bucket_arn" {
  value = aws_s3_bucket.backups.arn
}
