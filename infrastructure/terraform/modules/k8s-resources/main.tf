# Kubernetes Resources Module
# Deploys application resources to EKS cluster

variable "environment" {
  type = string
}

variable "namespace" {
  type    = string
  default = "trading-bot"
}

variable "api_image" {
  type = string
}

variable "web_image" {
  type = string
}

variable "worker_image" {
  type = string
}

variable "telegram_bot_image" {
  type = string
}

variable "db_host" {
  type = string
}

variable "redis_host" {
  type = string
}

variable "api_replicas" {
  type    = number
  default = 3
}

variable "worker_replicas" {
  type    = number
  default = 2
}

# Kubernetes Provider is configured externally

# Namespace
resource "kubernetes_namespace" "trading_bot" {
  metadata {
    name = var.namespace

    labels = {
      name        = var.namespace
      environment = var.environment
    }
  }
}

# ConfigMap for application configuration
resource "kubernetes_config_map" "app_config" {
  metadata {
    name      = "app-config"
    namespace = kubernetes_namespace.trading_bot.metadata[0].name
  }

  data = {
    NODE_ENV     = var.environment
    DB_HOST      = var.db_host
    REDIS_HOST   = var.redis_host
    LOG_LEVEL    = var.environment == "production" ? "info" : "debug"
  }
}

# Secret for sensitive data (placeholder - use external secrets operator in production)
resource "kubernetes_secret" "app_secrets" {
  metadata {
    name      = "app-secrets"
    namespace = kubernetes_namespace.trading_bot.metadata[0].name
  }

  type = "Opaque"

  data = {
    # These should be populated from AWS Secrets Manager
    jwt_secret         = base64encode("PLACEHOLDER")
    binance_api_key    = base64encode("PLACEHOLDER")
    binance_api_secret = base64encode("PLACEHOLDER")
    telegram_bot_token = base64encode("PLACEHOLDER")
  }
}

# API Deployment
resource "kubernetes_deployment" "api" {
  metadata {
    name      = "trading-api"
    namespace = kubernetes_namespace.trading_bot.metadata[0].name

    labels = {
      app = "trading-api"
    }
  }

  spec {
    replicas = var.api_replicas

    selector {
      match_labels = {
        app = "trading-api"
      }
    }

    template {
      metadata {
        labels = {
          app = "trading-api"
        }
      }

      spec {
        container {
          name  = "api"
          image = var.api_image

          port {
            container_port = 3000
            name           = "http"
          }

          env_from {
            config_map_ref {
              name = kubernetes_config_map.app_config.metadata[0].name
            }
          }

          env_from {
            secret_ref {
              name = kubernetes_secret.app_secrets.metadata[0].name
            }
          }

          resources {
            requests = {
              cpu    = "500m"
              memory = "512Mi"
            }
            limits = {
              cpu    = "1000m"
              memory = "1Gi"
            }
          }

          liveness_probe {
            http_get {
              path = "/health"
              port = 3000
            }
            initial_delay_seconds = 30
            period_seconds        = 10
          }

          readiness_probe {
            http_get {
              path = "/health"
              port = 3000
            }
            initial_delay_seconds = 10
            period_seconds        = 5
          }
        }
      }
    }
  }
}

# API Service
resource "kubernetes_service" "api" {
  metadata {
    name      = "trading-api"
    namespace = kubernetes_namespace.trading_bot.metadata[0].name
  }

  spec {
    selector = {
      app = "trading-api"
    }

    port {
      port        = 80
      target_port = 3000
      protocol    = "TCP"
    }

    type = "ClusterIP"
  }
}

# Web Deployment
resource "kubernetes_deployment" "web" {
  metadata {
    name      = "trading-web"
    namespace = kubernetes_namespace.trading_bot.metadata[0].name

    labels = {
      app = "trading-web"
    }
  }

  spec {
    replicas = 2

    selector {
      match_labels = {
        app = "trading-web"
      }
    }

    template {
      metadata {
        labels = {
          app = "trading-web"
        }
      }

      spec {
        container {
          name  = "web"
          image = var.web_image

          port {
            container_port = 80
            name           = "http"
          }

          resources {
            requests = {
              cpu    = "250m"
              memory = "256Mi"
            }
            limits = {
              cpu    = "500m"
              memory = "512Mi"
            }
          }

          liveness_probe {
            http_get {
              path = "/"
              port = 80
            }
            initial_delay_seconds = 30
            period_seconds        = 10
          }
        }
      }
    }
  }
}

# Web Service
resource "kubernetes_service" "web" {
  metadata {
    name      = "trading-web"
    namespace = kubernetes_namespace.trading_bot.metadata[0].name
  }

  spec {
    selector = {
      app = "trading-web"
    }

    port {
      port        = 80
      target_port = 80
      protocol    = "TCP"
    }

    type = "ClusterIP"
  }
}

# Worker Deployment
resource "kubernetes_deployment" "worker" {
  metadata {
    name      = "trading-worker"
    namespace = kubernetes_namespace.trading_bot.metadata[0].name

    labels = {
      app = "trading-worker"
    }
  }

  spec {
    replicas = var.worker_replicas

    selector {
      match_labels = {
        app = "trading-worker"
      }
    }

    template {
      metadata {
        labels = {
          app = "trading-worker"
        }
      }

      spec {
        container {
          name  = "worker"
          image = var.worker_image

          env_from {
            config_map_ref {
              name = kubernetes_config_map.app_config.metadata[0].name
            }
          }

          env_from {
            secret_ref {
              name = kubernetes_secret.app_secrets.metadata[0].name
            }
          }

          resources {
            requests = {
              cpu    = "500m"
              memory = "512Mi"
            }
            limits = {
              cpu    = "2000m"
              memory = "2Gi"
            }
          }
        }
      }
    }
  }
}

# Telegram Bot Deployment
resource "kubernetes_deployment" "telegram_bot" {
  metadata {
    name      = "trading-telegram-bot"
    namespace = kubernetes_namespace.trading_bot.metadata[0].name

    labels = {
      app = "trading-telegram-bot"
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "trading-telegram-bot"
      }
    }

    template {
      metadata {
        labels = {
          app = "trading-telegram-bot"
        }
      }

      spec {
        container {
          name  = "telegram-bot"
          image = var.telegram_bot_image

          env_from {
            config_map_ref {
              name = kubernetes_config_map.app_config.metadata[0].name
            }
          }

          env_from {
            secret_ref {
              name = kubernetes_secret.app_secrets.metadata[0].name
            }
          }

          resources {
            requests = {
              cpu    = "250m"
              memory = "256Mi"
            }
            limits = {
              cpu    = "500m"
              memory = "512Mi"
            }
          }
        }
      }
    }
  }
}

# Horizontal Pod Autoscaler for API
resource "kubernetes_horizontal_pod_autoscaler_v2" "api" {
  metadata {
    name      = "trading-api-hpa"
    namespace = kubernetes_namespace.trading_bot.metadata[0].name
  }

  spec {
    scale_target_ref {
      api_version = "apps/v1"
      kind        = "Deployment"
      name        = kubernetes_deployment.api.metadata[0].name
    }

    min_replicas = var.api_replicas
    max_replicas = var.api_replicas * 3

    metric {
      type = "Resource"
      resource {
        name = "cpu"
        target {
          type                = "Utilization"
          average_utilization = 70
        }
      }
    }

    metric {
      type = "Resource"
      resource {
        name = "memory"
        target {
          type                = "Utilization"
          average_utilization = 80
        }
      }
    }
  }
}

# Outputs
output "namespace" {
  value = kubernetes_namespace.trading_bot.metadata[0].name
}

output "api_service_name" {
  value = kubernetes_service.api.metadata[0].name
}

output "web_service_name" {
  value = kubernetes_service.web.metadata[0].name
}
