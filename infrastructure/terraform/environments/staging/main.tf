# Staging Environment Configuration

terraform {
  required_version = ">= 1.5.0"

  backend "s3" {
    bucket         = "trading-bot-terraform-state"
    key            = "staging/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "trading-bot-terraform-locks"
  }
}

# Variables
variable "region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "alarm_email" {
  description = "Email for CloudWatch alarms"
  type        = string
  default     = ""
}

variable "certificate_arn" {
  description = "ARN of ACM certificate for HTTPS"
  type        = string
  default     = ""
}

# Provider
provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Environment = "staging"
      Project     = "trading-bot"
      ManagedBy   = "terraform"
    }
  }
}

# Data sources
data "aws_availability_zones" "available" {
  state = "available"
}

# VPC Module
module "vpc" {
  source = "../../modules/vpc"

  environment        = "staging"
  cluster_name       = "trading-bot-staging"
  availability_zones = slice(data.aws_availability_zones.available.names, 0, 2)
  vpc_cidr          = "10.1.0.0/16"
}

# EKS Module
module "eks" {
  source = "../../modules/eks"

  environment        = "staging"
  cluster_name       = "trading-bot-staging"
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  node_instance_type = "t3.large"
  min_nodes          = 2
  max_nodes          = 5
  desired_nodes      = 2
}

# RDS Module
module "rds" {
  source = "../../modules/rds"

  environment                = "staging"
  vpc_id                     = module.vpc.vpc_id
  private_subnet_ids         = module.vpc.private_subnet_ids
  db_instance_class          = "db.t3.large"
  allocated_storage          = 50
  max_allocated_storage      = 200
  allowed_security_groups    = [module.eks.worker_security_group_id]
  backup_retention_period    = 7
  multi_az                   = false
}

# Redis Module
module "redis" {
  source = "../../modules/redis"

  environment             = "staging"
  vpc_id                  = module.vpc.vpc_id
  private_subnet_ids      = module.vpc.private_subnet_ids
  node_type               = "cache.t3.medium"
  num_cache_nodes         = 2
  allowed_security_groups = [module.eks.worker_security_group_id]
}

# ALB Module
module "alb" {
  source = "../../modules/alb"

  environment        = "staging"
  vpc_id             = module.vpc.vpc_id
  public_subnet_ids  = module.vpc.public_subnet_ids
  certificate_arn    = var.certificate_arn
}

# ECR Module
module "ecr" {
  source = "../../modules/ecr"

  environment            = "staging"
  image_retention_count  = 20
}

# Monitoring Module
module "monitoring" {
  source = "../../modules/monitoring"

  environment  = "staging"
  cluster_name = "trading-bot-staging"
  vpc_id       = module.vpc.vpc_id
  alarm_email  = var.alarm_email
}

# Backup Module
module "backup" {
  source = "../../modules/backup"

  environment      = "staging"
  rds_arn          = module.rds.db_instance_arn
  backup_retention = 7
}

# Secrets Module
module "secrets" {
  source = "../../modules/secrets"

  environment = "staging"
}

# Outputs
output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "eks_cluster_endpoint" {
  description = "EKS cluster endpoint"
  value       = module.eks.cluster_endpoint
}

output "eks_cluster_name" {
  description = "EKS cluster name"
  value       = module.eks.cluster_name
}

output "rds_endpoint" {
  description = "RDS endpoint"
  value       = module.rds.db_instance_endpoint
  sensitive   = true
}

output "redis_endpoint" {
  description = "Redis endpoint"
  value       = module.redis.primary_endpoint_address
  sensitive   = true
}

output "alb_dns_name" {
  description = "ALB DNS name"
  value       = module.alb.alb_dns_name
}

output "ecr_repositories" {
  description = "ECR repository URLs"
  value       = module.ecr.repository_urls
}

output "backup_bucket" {
  description = "S3 backup bucket name"
  value       = module.backup.backup_bucket_name
}
