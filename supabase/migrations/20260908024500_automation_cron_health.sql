CREATE OR REPLACE FUNCTION public.email_automation_cron_health()
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, cron
AS $$
  SELECT jsonb_build_object(
    'job', (
      SELECT to_jsonb(job_info) - 'command'
      FROM (
        SELECT jobid, jobname, schedule, active, nodename
        FROM cron.job
        WHERE jobname = 'assetlift-email-automations'
      ) AS job_info
    ),
    'recent_runs', COALESCE((
      SELECT jsonb_agg(to_jsonb(run_info) ORDER BY run_info.start_time DESC)
      FROM (
        SELECT status, return_message, start_time, end_time
        FROM cron.job_run_details
        WHERE jobid = (
          SELECT jobid FROM cron.job WHERE jobname = 'assetlift-email-automations'
        )
        ORDER BY start_time DESC
        LIMIT 10
      ) AS run_info
    ), '[]'::jsonb),
    'queue', (
      SELECT jsonb_build_object(
        'pending', COUNT(*) FILTER (WHERE status = 'pending'),
        'processing', COUNT(*) FILTER (WHERE status = 'processing'),
        'failed', COUNT(*) FILTER (WHERE status = 'failed')
      )
      FROM public.scheduled_automation_actions
    )
  );
$$;

REVOKE ALL ON FUNCTION public.email_automation_cron_health() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.email_automation_cron_health() TO service_role;
