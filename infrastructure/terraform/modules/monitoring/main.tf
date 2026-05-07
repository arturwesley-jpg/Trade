# Monitoring Module - CloudWatch, Alarms, and Dashboards

variable "environment" {
  type = string
}

variable "cluster_name" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "alarm_email" {
  type    = string
  default = ""
}

# SNS Topic for Alarms
resource "aws_sns_topic" "alarms" {
  name = "${var.environment}-trading-alarms"

  tags = {
    Name = "${var.environment}-trading-alarms"
  }
}

resource "aws_sns_topic_subscription" "alarm_email" {
  count     = var.alarm_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.alarms.arn
  protocol  = "email"
  endpoint  = var.alarm_email
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "application" {
  name              = "/aws/trading-bot/${var.environment}/application"
  retention_in_days = 30

  tags = {
    Name = "${var.environment}-application-logs"
  }
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/trading-bot/${var.environment}/api"
  retention_in_days = 30

  tags = {
    Name = "${var.environment}-api-logs"
  }
}

resource "aws_cloudwatch_log_group" "worker" {
  name              = "/aws/trading-bot/${var.environment}/worker"
  retention_in_days = 30

  tags = {
    Name = "${var.environment}-worker-logs"
  }
}

resource "aws_cloudwatch_log_group" "telegram_bot" {
  name              = "/aws/trading-bot/${var.environment}/telegram-bot"
  retention_in_days = 30

  tags = {
    Name = "${var.environment}-telegram-bot-logs"
  }
}

# CloudWatch Dashboard
resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${var.environment}-trading-bot-dashboard"

  dashboard_body = jsonencode({
    widgets = [
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/EKS", "cluster_failed_node_count", { stat = "Average" }],
            [".", "cluster_node_count", { stat = "Average" }]
          ]
          period = 300
          stat   = "Average"
          region = data.aws_region.current.name
          title  = "EKS Cluster Nodes"
        }
      },
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/RDS", "CPUUtilization", { stat = "Average" }],
            [".", "DatabaseConnections", { stat = "Average" }],
            [".", "FreeableMemory", { stat = "Average" }]
          ]
          period = 300
          stat   = "Average"
          region = data.aws_region.current.name
          title  = "RDS Metrics"
        }
      },
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/ElastiCache", "CPUUtilization", { stat = "Average" }],
            [".", "DatabaseMemoryUsagePercentage", { stat = "Average" }],
            [".", "NetworkBytesIn", { stat = "Sum" }],
            [".", "NetworkBytesOut", { stat = "Sum" }]
          ]
          period = 300
          stat   = "Average"
          region = data.aws_region.current.name
          title  = "ElastiCache Metrics"
        }
      },
      {
        type = "log"
        properties = {
          query   = "SOURCE '${aws_cloudwatch_log_group.application.name}' | fields @timestamp, @message | sort @timestamp desc | limit 20"
          region  = data.aws_region.current.name
          title   = "Recent Application Logs"
        }
      }
    ]
  })
}

# Metric Filters for Application Errors
resource "aws_cloudwatch_log_metric_filter" "application_errors" {
  name           = "${var.environment}-application-errors"
  log_group_name = aws_cloudwatch_log_group.application.name
  pattern        = "[time, request_id, level = ERROR*, ...]"

  metric_transformation {
    name      = "ApplicationErrors"
    namespace = "TradingBot/${var.environment}"
    value     = "1"
  }
}

resource "aws_cloudwatch_metric_alarm" "application_errors" {
  alarm_name          = "${var.environment}-high-application-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "ApplicationErrors"
  namespace           = "TradingBot/${var.environment}"
  period              = "300"
  statistic           = "Sum"
  threshold           = "10"
  alarm_description   = "This metric monitors application errors"
  alarm_actions       = [aws_sns_topic.alarms.arn]
}

# Metric Filters for API Latency
resource "aws_cloudwatch_log_metric_filter" "api_latency" {
  name           = "${var.environment}-api-latency"
  log_group_name = aws_cloudwatch_log_group.api.name
  pattern        = "[time, request_id, level, method, path, status_code, duration]"

  metric_transformation {
    name      = "APILatency"
    namespace = "TradingBot/${var.environment}"
    value     = "$duration"
    unit      = "Milliseconds"
  }
}

resource "aws_cloudwatch_metric_alarm" "api_latency" {
  alarm_name          = "${var.environment}-high-api-latency"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "APILatency"
  namespace           = "TradingBot/${var.environment}"
  period              = "300"
  statistic           = "Average"
  threshold           = "1000"
  alarm_description   = "This metric monitors API latency"
  alarm_actions       = [aws_sns_topic.alarms.arn]
}

# Composite Alarm for Critical Issues
resource "aws_cloudwatch_composite_alarm" "critical_issues" {
  alarm_name          = "${var.environment}-critical-issues"
  alarm_description   = "Composite alarm for critical trading bot issues"
  actions_enabled     = true
  alarm_actions       = [aws_sns_topic.alarms.arn]

  alarm_rule = "ALARM(${aws_cloudwatch_metric_alarm.application_errors.alarm_name}) OR ALARM(${aws_cloudwatch_metric_alarm.api_latency.alarm_name})"
}

# Data source for current region
data "aws_region" "current" {}

# Outputs
output "sns_topic_arn" {
  value = aws_sns_topic.alarms.arn
}

output "dashboard_name" {
  value = aws_cloudwatch_dashboard.main.dashboard_name
}

output "application_log_group" {
  value = aws_cloudwatch_log_group.application.name
}

output "api_log_group" {
  value = aws_cloudwatch_log_group.api.name
}

output "worker_log_group" {
  value = aws_cloudwatch_log_group.worker.name
}
