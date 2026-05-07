# Secrets Manager Module

variable "environment" {
  type = string
}

variable "secrets" {
  type = map(string)
  default = {
    jwt_secret           = ""
    binance_api_key      = ""
    binance_api_secret   = ""
    telegram_bot_token   = ""
    encryption_key       = ""
  }
}

# Create secrets in AWS Secrets Manager
resource "aws_secretsmanager_secret" "app_secrets" {
  for_each = var.secrets

  name                    = "${var.environment}/trading-bot/${each.key}"
  recovery_window_in_days = 7

  tags = {
    Name        = "${var.environment}-${each.key}"
    Environment = var.environment
  }
}

resource "aws_secretsmanager_secret_version" "app_secrets" {
  for_each = var.secrets

  secret_id     = aws_secretsmanager_secret.app_secrets[each.key].id
  secret_string = each.value != "" ? each.value : "PLACEHOLDER_CHANGE_ME"
}

# IAM Policy for accessing secrets
resource "aws_iam_policy" "secrets_access" {
  name        = "${var.environment}-secrets-access-policy"
  description = "Policy to allow access to application secrets"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = [
          for secret in aws_secretsmanager_secret.app_secrets : secret.arn
        ]
      }
    ]
  })
}

# Outputs
output "secret_arns" {
  value = {
    for k, v in aws_secretsmanager_secret.app_secrets : k => v.arn
  }
}

output "secrets_access_policy_arn" {
  value = aws_iam_policy.secrets_access.arn
}
