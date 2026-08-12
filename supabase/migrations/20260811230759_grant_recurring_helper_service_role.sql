grant execute on function private.recurring_occurrence_after_from(
  date,
  public.recurring_schedule_cadence,
  integer,
  date,
  integer
) to service_role;
