# ECR (Elastic Container Registry) Module

variable "environment" {
  type = string
}

variable "repositories" {
  type = list(string)
  default = [
    "trading-api",
    "trading-web",
    "trading-worker",
    "trading-telegram-bot"
  ]
}

variable "image_retention_count" {
  type    = number
  default = 30
}

# ECR Repositories
resource "aws_ecr_repository" "repos" {
  for_each = toset(var.repositories)

  name                 = "${var.environment}/${each.value}"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = {
    Name = "${var.environment}-${each.value}"
  }
}

# Lifecycle Policy for ECR
resource "aws_ecr_lifecycle_policy" "repos" {
  for_each   = toset(var.repositories)
  repository = aws_ecr_repository.repos[each.key].name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last ${var.image_retention_count} images"
        selection = {
          tagStatus     = "any"
          countType     = "imageCountMoreThan"
          countNumber   = var.image_retention_count
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

# ECR Repository Policy (allow pull from EKS)
resource "aws_ecr_repository_policy" "repos" {
  for_each   = toset(var.repositories)
  repository = aws_ecr_repository.repos[each.key].name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowPull"
        Effect = "Allow"
        Principal = {
          Service = "eks.amazonaws.com"
        }
        Action = [
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:BatchCheckLayerAvailability"
        ]
      }
    ]
  })
}

# Outputs
output "repository_urls" {
  value = {
    for k, v in aws_ecr_repository.repos : k => v.repository_url
  }
}

output "repository_arns" {
  value = {
    for k, v in aws_ecr_repository.repos : k => v.arn
  }
}
