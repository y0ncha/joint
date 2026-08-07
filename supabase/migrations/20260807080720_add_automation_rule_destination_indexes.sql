create index automation_rules_household_category_idx
on public.automation_rules(household_id, category_id)
where category_id is not null;

create index automation_rules_household_subcategory_idx
on public.automation_rules(household_id, subcategory_id)
where subcategory_id is not null;
