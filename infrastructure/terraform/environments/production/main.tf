# Production Environment Configuration

terraform {
  required_version = ">= 1.5.0"

  backend "s3" {
    bucket         = "trading-bot-terraform-state"
    key            = "production/terraform.tfstate"
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
      Environment = "production"
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

  environment        = "production"
  cluster_name       = "trading-bot-prod"
  availability_zones = slice(data.aws_availability_zones.available.names, 0, 3)
  vpc_cidr          = "10.0.0.0/16"
}

# EKS Module
module "eks" {
  source = "../../modules/eks"

  environment        = "production"
  cluster_name       = "trading-bot-prod"
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  node_instance_type = "t3.xlarge"
  min_nodes          = 3
  max_nodes          = 20
  desired_nodes      = 5
}

# RDS Module
module "rds" {
  source = "../../modules/rds"

  environment                = "production"
  vpc_id                     = module.vpc.vpc_id
  private_subnet_ids         = module.vpc.private_subnet_ids
  db_instance_class          = "db.r6g.xlarge"
  allocated_storage          = 200
  max_allocated_storage      = 1000
  allowed_security_groups    = [module.eks.worker_security_group_id]
  backup_retention_period    = 14
  multi_az                   = true
}

# Redis Module
module "redis" {
  source = "../../modules/redis"

  environment             = "production"
  vpc_id                  = module.vpc.vpc_id
  private_subnet_ids      = module.vpc.private_subnet_ids
  node_type               = "cache.r6g.large"
  num_cache_nodes         = 3
  allowed_security_groups = [module.eks.worker_security_group_id]
}

# ALB Module
module "alb" {
  source = "../../modules/alb"

  environment        = "production"
  vpc_id             = module.vpc.vpc_id
  public_subnet_ids  = module.vpc.public_subnet_ids
  certificate_arn    = var.certificate_arn
}

# ECR Module
module "ecr" {
  source = "../../modules/ecr"

  environment            = "production"
  image_retention_count  = 50
}

# Monitoring Module
module "monitoring" {
  source = "../../modules/monitoring"

  environment  = "production"
  cluster_name = "trading-bot-prod"
  vpc_id       = module.vpc.vpc_id
  alarm_email  = var.alarm_email
}

# Backup Module
module "backup" {
  source = "../../modules/backup"

  environment      = "production"
  rds_arn          = module.rds.db_instance_arn
  backup_retention = 30
}

# Secrets Module
module "secrets" {
  source = "../../modules/secrets"

  environment = "production"
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
