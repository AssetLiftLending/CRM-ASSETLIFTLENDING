CREATE OR REPLACE FUNCTION public.email_automation_cron_health()
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, cron, net
AS $$
  SELECT jsonb_build_object(
    'job', (
      SELECT to_jsonb(j) - 'command'
      FROM cron.job AS j
      WHERE j.jobname = 'assetlift-email-automations'
    ),
    'recent_runs', (
      SELECT COALESCE(jsonb_agg(to_jsonb(r)), '[]'::jsonb)
      FROM (
        SELECT status, return_message, start_time, end_time
        FROM cron.job_run_details
        WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'assetlift-email-automations')
        ORDER BY start_time DESC
        LIMIT 10
      ) AS r
    ),
    'http_responses', (
      SELECT COALESCE(jsonb_agg(to_jsonb(h)), '[]'::jsonb)
      FROM (
        SELECT status_code, timed_out, error_msg, created
        FROM net._http_response
        ORDER BY created DESC
        LIMIT 10
      ) AS h
    ),
    'queue', jsonb_build_object(
      'pending', (SELECT COUNT(*) FROM public.scheduled_automation_actions WHERE status = 'pending'),
      'processing', (SELECT COUNT(*) FROM public.scheduled_automation_actions WHERE status = 'processing'),
      'failed', (SELECT COUNT(*) FROM public.scheduled_automation_actions WHERE status = 'failed')
    )
  );
$$;

REVOKE ALL ON FUNCTION public.email_automation_cron_health() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.email_automation_cron_health() TO service_role;
