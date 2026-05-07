-- Notification System Database Schema

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  channel VARCHAR(50) NOT NULL,
  priority VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL,
  subject TEXT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  template_id VARCHAR(255),
  alert_event_id VARCHAR(255),
  group_id VARCHAR(255),
  scheduled_for TIMESTAMP,
  sent_at TIMESTAMP,
  delivered_at TIMESTAMP,
  failed_at TIMESTAMP,
  error TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);

-- Indexes for notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_channel ON notifications(channel);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notifications(priority);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_scheduled_for ON notifications(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_notifications_group_id ON notifications(group_id);
CREATE INDEX IF NOT EXISTS idx_notifications_alert_event_id ON notifications(alert_event_id);

-- Notification preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id VARCHAR(255) PRIMARY KEY,
  channels JSONB NOT NULL DEFAULT '{}',
  quiet_hours JSONB,
  alert_filters JSONB,
  digest_mode JSONB,
  grouping JSONB,
  updated_at TIMESTAMP NOT NULL
);

-- Notification templates table
CREATE TABLE IF NOT EXISTS notification_templates (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  channel VARCHAR(50) NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  variables JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);

-- Indexes for templates
CREATE INDEX IF NOT EXISTS idx_notification_templates_channel ON notification_templates(channel);
CREATE INDEX IF NOT EXISTS idx_notification_templates_name ON notification_templates(name);

-- Alert events table (enhanced)
CREATE TABLE IF NOT EXISTS alert_events (
  id VARCHAR(255) PRIMARY KEY,
  alert_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  symbol VARCHAR(20),
  triggered_at TIMESTAMP NOT NULL,
  acknowledged_at TIMESTAMP,
  data JSONB,
  notification_sent BOOLEAN DEFAULT FALSE,
  notification_channels JSONB,
  created_at TIMESTAMP NOT NULL
);

-- Indexes for alert events
CREATE INDEX IF NOT EXISTS idx_alert_events_alert_id ON alert_events(alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_events_user_id ON alert_events(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_events_type ON alert_events(type);
CREATE INDEX IF NOT EXISTS idx_alert_events_triggered_at ON alert_events(triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_events_notification_sent ON alert_events(notification_sent);

-- Alerts table (enhanced with notification settings)
CREATE TABLE IF NOT EXISTS alerts (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  conditions JSONB NOT NULL,
  symbol VARCHAR(20),
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  priority VARCHAR(20) NOT NULL DEFAULT 'medium',
  notification_channels JSONB NOT NULL DEFAULT '["in-app"]',
  notification_template_id VARCHAR(255),
  throttle_minutes INTEGER DEFAULT 0,
  last_triggered_at TIMESTAMP,
  trigger_count INTEGER DEFAULT 0,
  max_triggers INTEGER,
  expires_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);

-- Indexes for alerts
CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(type);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_symbol ON alerts(symbol);
CREATE INDEX IF NOT EXISTS idx_alerts_priority ON alerts(priority);
CREATE INDEX IF NOT EXISTS idx_alerts_expires_at ON alerts(expires_at);

-- Alert rules table (for complex rule-based alerts)
CREATE TABLE IF NOT EXISTS alert_rules (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  rule_type VARCHAR(50) NOT NULL,
  conditions JSONB NOT NULL,
  actions JSONB NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  priority VARCHAR(20) NOT NULL DEFAULT 'medium',
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);

-- Indexes for alert rules
CREATE INDEX IF NOT EXISTS idx_alert_rules_user_id ON alert_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_rule_type ON alert_rules(rule_type);
CREATE INDEX IF NOT EXISTS idx_alert_rules_enabled ON alert_rules(enabled);

-- Notification delivery log (for tracking and analytics)
CREATE TABLE IF NOT EXISTS notification_delivery_log (
  id SERIAL PRIMARY KEY,
  notification_id VARCHAR(255) NOT NULL,
  channel VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL,
  attempt_number INTEGER NOT NULL,
  delivered_at TIMESTAMP,
  error TEXT,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL
);

-- Indexes for delivery log
CREATE INDEX IF NOT EXISTS idx_notification_delivery_log_notification_id ON notification_delivery_log(notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_delivery_log_channel ON notification_delivery_log(channel);
CREATE INDEX IF NOT EXISTS idx_notification_delivery_log_status ON notification_delivery_log(status);
CREATE INDEX IF NOT EXISTS idx_notification_delivery_log_created_at ON notification_delivery_log(created_at DESC);

-- Views for analytics

-- Notification statistics view
CREATE OR REPLACE VIEW notification_stats_by_user AS
SELECT
  user_id,
  COUNT(*) as total_notifications,
  COUNT(*) FILTER (WHERE status = 'delivered') as delivered_count,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
  COUNT(*) FILTER (WHERE channel = 'email') as email_count,
  COUNT(*) FILTER (WHERE channel = 'sms') as sms_count,
  COUNT(*) FILTER (WHERE channel = 'push') as push_count,
  COUNT(*) FILTER (WHERE channel = 'telegram') as telegram_count,
  COUNT(*) FILTER (WHERE channel = 'discord') as discord_count,
  COUNT(*) FILTER (WHERE channel = 'slack') as slack_count,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') as last_24h_count,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as last_7d_count,
  AVG(EXTRACT(EPOCH FROM (delivered_at - created_at))) FILTER (WHERE delivered_at IS NOT NULL) as avg_delivery_time_seconds
FROM notifications
GROUP BY user_id;

-- Alert statistics view
CREATE OR REPLACE VIEW alert_stats_by_user AS
SELECT
  user_id,
  COUNT(*) as total_alerts,
  COUNT(*) FILTER (WHERE status = 'active') as active_alerts,
  COUNT(*) FILTER (WHERE status = 'paused') as paused_alerts,
  COUNT(*) FILTER (WHERE status = 'triggered') as triggered_alerts,
  COUNT(*) FILTER (WHERE type = 'price') as price_alerts,
  COUNT(*) FILTER (WHERE type = 'indicator') as indicator_alerts,
  COUNT(*) FILTER (WHERE type = 'whale') as whale_alerts,
  COUNT(*) FILTER (WHERE type = 'news') as news_alerts,
  SUM(trigger_count) as total_triggers
FROM alerts
GROUP BY user_id;

-- Recent alert events view
CREATE OR REPLACE VIEW recent_alert_events AS
SELECT
  ae.id,
  ae.alert_id,
  ae.user_id,
  ae.type,
  ae.symbol,
  ae.triggered_at,
  ae.acknowledged_at,
  ae.notification_sent,
  a.name as alert_name,
  a.priority,
  ae.data
FROM alert_events ae
JOIN alerts a ON ae.alert_id = a.id
WHERE ae.triggered_at >= NOW() - INTERVAL '30 days'
ORDER BY ae.triggered_at DESC;

-- Functions

-- Function to clean up old notifications
CREATE OR REPLACE FUNCTION cleanup_old_notifications(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM notifications
  WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL
  AND status IN ('delivered', 'failed');

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old alert events
CREATE OR REPLACE FUNCTION cleanup_old_alert_events(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM alert_events
  WHERE triggered_at < NOW() - (days_to_keep || ' days')::INTERVAL;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get notification delivery rate
CREATE OR REPLACE FUNCTION get_notification_delivery_rate(
  p_user_id VARCHAR(255),
  p_days INTEGER DEFAULT 7
)
RETURNS NUMERIC AS $$
DECLARE
  total_count INTEGER;
  delivered_count INTEGER;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'delivered')
  INTO total_count, delivered_count
  FROM notifications
  WHERE user_id = p_user_id
  AND created_at >= NOW() - (p_days || ' days')::INTERVAL;

  IF total_count = 0 THEN
    RETURN 0;
  END IF;

  RETURN ROUND((delivered_count::NUMERIC / total_count::NUMERIC) * 100, 2);
END;
$$ LANGUAGE plpgsql;

-- Triggers

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_notifications_updated_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_templates_updated_at
  BEFORE UPDATE ON notification_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alerts_updated_at
  BEFORE UPDATE ON alerts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alert_rules_updated_at
  BEFORE UPDATE ON alert_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE notifications IS 'Stores all notification records across all channels';
COMMENT ON TABLE notification_preferences IS 'User notification preferences and channel configurations';
COMMENT ON TABLE notification_templates IS 'Reusable notification templates';
COMMENT ON TABLE alert_events IS 'Records of alert triggers';
COMMENT ON TABLE alerts IS 'User-defined alerts with notification settings';
COMMENT ON TABLE alert_rules IS 'Complex rule-based alerts';
COMMENT ON TABLE notification_delivery_log IS 'Detailed delivery tracking for analytics';
