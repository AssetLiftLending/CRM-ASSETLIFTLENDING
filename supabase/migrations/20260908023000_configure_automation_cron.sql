CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.configure_email_automation_cron(
  p_app_url TEXT,
  p_cron_secret TEXT
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, cron, net
AS $$
DECLARE
  app_url_secret_id UUID;
  cron_secret_id UUID;
  scheduled_job_id BIGINT;
BEGIN
  IF COALESCE(TRIM(p_app_url), '') = '' OR COALESCE(TRIM(p_cron_secret), '') = '' THEN
    RAISE EXCEPTION 'App URL and cron secret are required';
  END IF;

  SELECT id INTO app_url_secret_id FROM vault.secrets WHERE name = 'assetlift_crm_app_url';
  IF app_url_secret_id IS NULL THEN
    PERFORM vault.create_secret(RTRIM(p_app_url, '/'), 'assetlift_crm_app_url');
  ELSE
    PERFORM vault.update_secret(app_url_secret_id, RTRIM(p_app_url, '/'));
  END IF;

  SELECT id INTO cron_secret_id FROM vault.secrets WHERE name = 'assetlift_crm_cron_secret';
  IF cron_secret_id IS NULL THEN
    PERFORM vault.create_secret(p_cron_secret, 'assetlift_crm_cron_secret');
  ELSE
    PERFORM vault.update_secret(cron_secret_id, p_cron_secret);
  END IF;

  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname = 'assetlift-email-automations';

  SELECT cron.schedule(
    'assetlift-email-automations',
    '*/5 * * * *',
    $job$
      SELECT net.http_get(
        url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'assetlift_crm_app_url') || '/api/cron/automations',
        headers := jsonb_build_object(
          'Authorization',
          'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'assetlift_crm_cron_secret')
        )
      );
    $job$
  ) INTO scheduled_job_id;

  RETURN scheduled_job_id;
END;
$$;

REVOKE ALL ON FUNCTION public.configure_email_automation_cron(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.configure_email_automation_cron(TEXT, TEXT) TO service_role;
